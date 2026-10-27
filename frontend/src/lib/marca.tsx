import { createContext, useContext } from "react";
import type { AgentePublico, Familia, Marca } from "./types";

export const MarcaContext = createContext<Marca | null>(null);

export function useMarca(): Marca {
  const m = useContext(MarcaContext);
  if (!m) throw new Error("Marca no cargada");
  return m;
}

const VARS: Record<string, string> = {
  verde: "--green", teal: "--teal", azul: "--blue", degradado: "--gradient",
  texto_sobre_degradado: "--on-gradient", fondo: "--bg", tarjeta: "--card", linea: "--line",
  linea_2: "--line-2", texto: "--text", texto_2: "--text-2", texto_3: "--text-3",
  alerta: "--warn", error: "--error",
};

/** La paleta vive en catalogo.config.json: aquí se vuelca a variables CSS. */
export function aplicarPaleta(m: Marca) {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(m.paleta)) if (VARS[k]) root.style.setProperty(VARS[k], v);
  for (const f of m.familias) root.style.setProperty(`--fam-${f.id}`, f.color);
  document.documentElement.lang = m.idioma || "es";
}

export function familiaDe(m: Marca, id: string): Familia | undefined {
  return m.familias.find((f) => f.id === id);
}

export function subfamiliaDe(m: Marca, a: Pick<AgentePublico, "familia" | "subfamilia">) {
  return familiaDe(m, a.familia)?.subfamilias.find((s) => s.id === a.subfamilia);
}

export function colorDe(m: Marca, familia: string): string {
  return familiaDe(m, familia)?.color ?? "#397ef6";
}
