import type { AgentePublico } from "./types";

export interface Filtros {
  familia: string;
  sub: string;
  plataforma: string;
  industria: string;
  madurez: string;
  q: string;
}

export const CLAVES: (keyof Filtros)[] = ["familia", "sub", "plataforma", "industria", "madurez", "q"];

export function leerFiltros(p: URLSearchParams): Filtros {
  return Object.fromEntries(CLAVES.map((k) => [k, p.get(k) ?? ""])) as unknown as Filtros;
}

export function aParams(f: Filtros): URLSearchParams {
  const p = new URLSearchParams();
  for (const k of CLAVES) if (f[k]) p.set(k, f[k]);
  return p;
}

export function normalizar(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function texto(a: AgentePublico): string {
  return normalizar([
    a.nombre, a.tagline, a.glitch_dice, a.problema, a.que_hace, a.plataforma, ...a.pasos, ...a.tecnologias,
    ...a.integraciones, ...a.industrias, ...a.para_quien, ...a.modelos, ...a.herramientas, ...a.conocimiento,
    ...a.beneficios.map((b) => b.texto),
  ].join(" "));
}

/** Misma lógica que el filtro del API (backend/app/routes/public.py). */
export function filtrar(agentes: AgentePublico[], f: Filtros, ignorar: (keyof Filtros)[] = []): AgentePublico[] {
  const usa = (k: keyof Filtros) => f[k] && !ignorar.includes(k);
  const terminos = usa("q") ? normalizar(f.q).split(/\s+/).filter(Boolean) : [];
  return agentes.filter((a) => {
    if (usa("familia") && a.familia !== f.familia) return false;
    if (usa("sub") && a.subfamilia !== f.sub) return false;
    if (usa("plataforma") && a.plataforma !== f.plataforma) return false;
    if (usa("industria") && !a.industrias.some((i) => normalizar(i) === normalizar(f.industria))) return false;
    if (usa("madurez") && a.madurez !== f.madurez) return false;
    if (terminos.length) {
      const t = texto(a);
      if (!terminos.every((x) => t.includes(x))) return false;
    }
    return true;
  });
}
