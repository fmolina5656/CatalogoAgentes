import type { AgenteEntrada, Marca } from "./types";

/** Validación en el front con el mismo JSON Schema que exporta el modelo Pydantic.
 *  Es un intérprete pequeño del subconjunto que usa Pydantic (sin eval, compatible con la CSP). */
type S = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
let raiz: S | null = null;

export function prepararValidador(schema: object) {
  raiz = schema as S;
}

export type Errores = Record<string, string>;
type Err = { ruta: string; msg: string };

function resolver(s: S): S {
  if (s.$ref && raiz) return resolver(raiz.$defs[s.$ref.split("/").pop()]);
  return s;
}

function tipoOk(t: string, v: unknown): boolean {
  switch (t) {
    case "string": return typeof v === "string";
    case "integer": return Number.isInteger(v);
    case "number": return typeof v === "number";
    case "boolean": return typeof v === "boolean";
    case "array": return Array.isArray(v);
    case "object": return typeof v === "object" && v !== null && !Array.isArray(v);
    case "null": return v === null;
    default: return true;
  }
}

function revisar(sch: S, v: unknown, ruta: string, out: Err[]): void {
  const s = resolver(sch);
  const poner = (msg: string, r = ruta): void => { out.push({ ruta: r, msg }); };
  if (s.anyOf) {
    const intentos = s.anyOf.map((alt: S) => { const e: Err[] = []; revisar(alt, v, ruta, e); return e; });
    if (intentos.some((e: Err[]) => e.length === 0)) return;
    // Reporta la alternativa que no es null (la que el usuario intentaba llenar).
    const mejor = s.anyOf.findIndex((alt: S) => resolver(alt).type !== "null");
    out.push(...intentos[mejor >= 0 ? mejor : 0]);
    return;
  }
  if (s.type && !tipoOk(s.type, v)) {
    poner(v === undefined || v === null || v === "" ? "Es obligatorio" : "Valor no válido");
    return;
  }
  if (s.enum && !s.enum.includes(v)) return poner("Elige una opción válida");
  if (s.const !== undefined && v !== s.const) return poner("Elige una opción válida");
  if (typeof v === "string") {
    const t = v.trim();
    if (s.minLength !== undefined && t.length < s.minLength) return poner(s.minLength === 1 ? "No puede ir vacío" : `Mínimo ${s.minLength} caracteres`);
    if (s.maxLength !== undefined && v.length > s.maxLength) return poner(`Máximo ${s.maxLength} caracteres`);
    if (s.pattern && !new RegExp(s.pattern).test(t)) {
      if (ruta === "slug") return poner("Solo minúsculas, números y guiones (ej. mi-agente)");
      if (ruta.includes("componentes")) return poner("Usa minúsculas, números y guiones");
      return poner("Formato no válido");
    }
  }
  if (Array.isArray(v)) {
    if (s.minItems !== undefined && v.length < s.minItems) poner(`Agrega al menos ${s.minItems}`);
    if (s.maxItems !== undefined && v.length > s.maxItems) poner(`Máximo ${s.maxItems} elementos`);
    const pre: S[] = s.prefixItems ?? [];
    v.forEach((x, i) => {
      const it = pre[i] ?? s.items;
      if (it) revisar(it, x, ruta ? `${ruta}.${i}` : String(i), out);
    });
  }
  if (s.type === "object" && v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of s.required ?? []) if (o[k] === undefined) poner("Es obligatorio", ruta ? `${ruta}.${k}` : k);
    for (const [k, sub] of Object.entries(s.properties ?? {})) {
      if (o[k] !== undefined) revisar(sub as S, o[k], ruta ? `${ruta}.${k}` : k, out);
    }
    if (s.additionalProperties === false) {
      for (const k of Object.keys(o)) if (!(k in (s.properties ?? {}))) poner(`Campo no permitido: ${k}`);
    }
  }
}

export function validar(d: AgenteEntrada, m: Marca): Errores {
  const out: Errores = {};
  const poner = (k: string, v: string) => { if (!out[k]) out[k] = v; };
  if (raiz) {
    const errs: Err[] = [];
    revisar(raiz, d, "", errs);
    for (const e of errs) poner(e.ruta, e.msg);
  }
  // Reglas que dependen del archivo de marca (las mismas que valida el back).
  const fam = m.familias.find((f) => f.id === d.familia);
  if (!fam) poner("familia", "Elige una familia");
  else if (fam.subfamilias.length && !fam.subfamilias.some((s) => s.id === d.subfamilia)) poner("subfamilia", "Elige una subfamilia");
  if (!m.plataformas.includes(d.plataforma)) poner("plataforma", "Elige una plataforma");
  if (d.cta && !/^(https?:\/\/\S+|mailto:\S+)$/i.test(d.cta.url.trim())) poner("cta.url", "Debe empezar con https:// o mailto:");
  if (d.cta && !d.cta.texto.trim()) poner("cta.texto", "Escribe el texto del botón");
  if (d.demo_url && !/^https?:\/\/\S+$/i.test(d.demo_url)) poner("demo_url", "Debe empezar con https://");
  const arq = d.arquitectura;
  if (arq) {
    const ids = arq.componentes.map((c) => c.id);
    if (new Set(ids).size !== ids.length) poner("arquitectura.componentes", "Hay piezas con el mismo id");
    arq.conexiones.forEach(([a, b], i) => {
      if (!ids.includes(a) || !ids.includes(b)) poner(`arquitectura.conexiones.${i}`, "Elige las dos piezas");
      else if (a === b) poner(`arquitectura.conexiones.${i}`, "Una pieza no puede conectarse consigo misma");
    });
    arq.pasos.forEach((p, i) => {
      if (p.componentes.some((c) => !ids.includes(c))) poner(`arquitectura.pasos.${i}`, "Usa piezas que existan");
    });
  }
  return out;
}

export function slugDe(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
