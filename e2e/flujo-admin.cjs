// Prueba de punta a punta del back: login, validación, imagen, publicar, ver en lo público, conflicto y borrar.
// Uso: ADMIN_PIN=1234 node e2e/flujo-admin.cjs [BASE_URL]
// Ojo: crea y borra un agente de prueba en el entorno al que apuntes. Úsalo en local.
const { chromium } = require("playwright");
const assert = require("assert");

const BASE = process.argv[2] || "http://127.0.0.1:8000";
const PIN = process.env.ADMIN_PIN || "1234";
// PNG de 64x48 px
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAEAAAAAwCAIAAAAuKetIAAAAU0lEQVR4nO3PQQ3AIADAQMAiOvmibyJ4XJb0FLRz3zP+bOmAVw1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgNaA1oDWgf14YCFhdhHwQAAAAASUVORK5CYII=", "base64");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("dialog", (d) => d.accept());

  // 1. Login con PIN
  await page.goto(`${BASE}/admin`);
  await page.getByLabel("PIN de administración").fill("mal");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.getByText("PIN incorrecto").waitFor();
  await page.getByLabel("PIN de administración").fill(PIN);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.getByRole("heading", { name: "Agentes" }).waitFor();

  // 2. Nuevo agente: guardar vacío muestra errores
  await page.getByRole("link", { name: "+ Nuevo agente" }).click();
  await page.getByRole("button", { name: "Publicar" }).click();
  await page.getByText("Revisa los campos marcados").waitFor();
  assert((await page.locator(".err-count").count()) > 0, "debería marcar secciones con errores");

  // 3. Llenar lo mínimo
  const nombre = `Agente e2e ${Date.now()}`;
  await page.getByLabel("Nombre *").fill(nombre);
  await page.getByLabel("Familia *").selectOption("copilot-studio");
  await page.getByLabel("Línea de valor (tagline) *").fill("Prueba de punta a punta.");
  await page.getByLabel("Glitch dice *").fill("Soy una prueba, no me hagas caso.");
  await page.getByLabel("El problema *").fill("Hay que probar el back.");
  await page.getByLabel("Qué hace *").fill("Se crea, se publica y se borra.");
  await page.getByLabel("Cómo funciona (pasos) 1", { exact: true }).fill("Se crea");
  await page.getByLabel("Beneficio 1", { exact: true }).fill("Confianza en el back");
  await page.getByLabel("Plataforma *").selectOption("Copilot Studio");
  await page.getByLabel("Tiempo de implementación *").fill("1 día");

  // 4. Imagen: se sube, exige alt y etiqueta
  await page.locator('input[type=file][multiple]').setInputFiles({ name: "captura.png", mimeType: "image/png", buffer: PNG });
  await page.locator(".img-list li").waitFor();
  await page.getByRole("button", { name: "Publicar" }).click();
  await page.getByText("Revisa los campos marcados").waitFor();
  await page.getByLabel("Texto alternativo *").fill("Pantalla de ejemplo del agente");
  await page.getByLabel("Etiqueta *").selectOption("diagrama");

  // 5. Vista previa en vivo
  assert((await page.locator(".editor-preview .agent-card h3").textContent()).includes("Agente e2e"));

  // 6. Publicar
  await page.getByRole("button", { name: "Publicar" }).click();
  await page.getByText("Guardado y publicado.").waitFor();
  const url = page.url();
  assert(/\/admin\/agentes\/[a-f0-9]{32}$/.test(url), "debería navegar a la ficha creada");
  const slug = await page.getByLabel("Slug (URL) *").inputValue();

  // 7. Se ve en lo público, con su etiqueta de imagen
  const pub = await browser.newPage();
  await pub.goto(`${BASE}/agentes/${slug}`);
  await pub.getByRole("heading", { name: nombre }).waitFor();
  await pub.locator(".img-tag", { hasText: "Diagrama" }).first().waitFor();

  // 8. Conflicto: otra pestaña guarda primero
  const otra = await ctx.newPage();
  await otra.goto(url);
  await otra.getByLabel("Línea de valor (tagline) *").fill("Cambio desde otra pestaña.");
  await otra.getByRole("button", { name: "Guardar cambios" }).click();
  await otra.getByText("Guardado y publicado.").waitFor();
  await page.getByLabel("Línea de valor (tagline) *").fill("Cambio que llega tarde.");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await page.getByText("Alguien más guardó cambios").first().waitFor();
  await page.getByRole("button", { name: "Recargar la versión actual" }).click();
  assert.equal(await page.getByLabel("Línea de valor (tagline) *").inputValue(), "Cambio desde otra pestaña.");

  // 9. Pasar a borrador: desaparece de lo público
  await page.getByRole("button", { name: "Pasar a borrador" }).click();
  await page.getByText("Guardado como borrador.").waitFor();
  const r = await pub.request.get(`${BASE}/api/agentes/${slug}`);
  assert.equal(r.status(), 404, "un borrador no debe verse en el API público");

  // 10. Borrar (con confirmación)
  await page.goto(`${BASE}/admin`);
  const fila = page.locator(".admin-row", { hasText: nombre });
  await fila.getByRole("button", { name: "Borrar" }).click();
  await page.getByRole("button", { name: "Sí, borrar" }).click();
  await page.getByText(`"${nombre}" se borró.`).waitFor();

  await browser.close();
  if (errores.length) throw new Error("Errores de JS: " + errores.join("; "));
  console.log("Flujo del back OK: login, validación, imagen, vista previa, publicar, conflicto, borrador y borrar.");
})().catch((e) => { console.error(e); process.exit(1); });
