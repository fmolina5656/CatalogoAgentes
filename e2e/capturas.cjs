// Capturas del diseño en 390, 820, 1180 y 1600 px.
// Uso: node e2e/capturas.cjs [BASE_URL] [carpeta] [publico|admin|todo]
// Requiere el servidor corriendo (ver README). En modo admin usa ADMIN_PIN.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.argv[2] || "http://127.0.0.1:8000";
const OUT = process.argv[3] || "capturas";
const QUE = process.argv[4] || "todo";
const PIN = process.env.ADMIN_PIN || "1234";
const ANCHOS = [
  { n: "390-celular", w: 390, h: 844 },
  { n: "820-tablet-vertical", w: 820, h: 1180 },
  { n: "1180-tablet-horizontal", w: 1180, h: 820 },
  { n: "1600-monitor", w: 1600, h: 1000 },
];

const PUBLICO = [
  { n: "01-portada", url: "/", full: true },
  { n: "02-filtro-foundry", url: "/?familia=app-modernization&sub=foundry", full: true, scroll: ".catalog" },
  { n: "03-detalle", url: "/agentes/conciliacion-contable", full: true },
  { n: "04-detalle-arquitectura-paso", url: "/agentes/conciliacion-contable", accion: async (p) => {
      await p.getByRole("button", { name: /Recorrer el flujo/ }).click();
      await p.getByRole("button", { name: /Siguiente/ }).click();
      await p.locator(".arch").scrollIntoViewIfNeeded();
    } },
  { n: "05-ejemplo", url: "/agentes/help-desk-de-ti", full: true },
  { n: "06-presentacion-portada", url: "/presentar" },
  { n: "07-presentacion-intro", url: "/presentar", teclas: 1 },
  { n: "08-presentacion-arquitectura", url: "/presentar", teclas: 4 },
  { n: "09-presentacion-valor", url: "/presentar", teclas: 9 },
];

const ADMIN = [
  { n: "20-admin-lista", url: "/admin", full: true },
  { n: "21-admin-editar", url: "/admin", full: true, accion: async (p) => {
      await p.getByRole("link", { name: /Editar Conciliación contable/ }).click();
      await p.waitForSelector(".editor");
    } },
  { n: "22-admin-nuevo", url: "/admin/agentes/nuevo", full: false },
];

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const problemas = [];
  for (const a of ANCHOS) {
    const ctx = await browser.newContext({ viewport: { width: a.w, height: a.h }, deviceScaleFactor: 1, reducedMotion: "reduce" });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => problemas.push(`${a.n}: ${e.message}`));
    let lista = [];
    if (QUE !== "admin") lista = lista.concat(PUBLICO);
    if (QUE !== "publico") {
      await page.goto(BASE + "/admin");
      await page.request.post(BASE + "/api/admin/login", { data: { pin: PIN } });
      lista = lista.concat(ADMIN);
    }
    for (const c of lista) {
      await page.goto(BASE + c.url, { waitUntil: "networkidle" });
      await page.waitForTimeout(250);
      if (c.scroll) await page.locator(c.scroll).scrollIntoViewIfNeeded();
      if (c.teclas) for (let i = 0; i < c.teclas; i++) await page.keyboard.press("ArrowRight");
      if (c.accion) await c.accion(page);
      await page.waitForTimeout(400);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (sw > 0) problemas.push(`${a.n} ${c.n}: scroll horizontal de ${sw}px`);
      await page.screenshot({ path: path.join(OUT, `${c.n}-${a.n}.png`), fullPage: !!c.full });
    }
    await ctx.close();
  }
  await browser.close();
  if (problemas.length) { console.log("PROBLEMAS:\n" + problemas.join("\n")); process.exitCode = 1; }
  else console.log(`Listo: capturas en ${OUT} sin scroll horizontal ni errores de JS.`);
}
main();
