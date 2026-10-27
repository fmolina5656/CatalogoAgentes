import type { AgentePublico } from "../lib/types";
import { colorDe, familiaDe, subfamiliaDe, useMarca } from "../lib/marca";

export function FamiliaBadge({ a }: { a: Pick<AgentePublico, "familia" | "subfamilia"> }) {
  const m = useMarca();
  const f = familiaDe(m, a.familia);
  const sub = subfamiliaDe(m, a);
  return (
    <span className="fam" style={{ "--c": colorDe(m, a.familia) } as React.CSSProperties}>
      <span className="dot" aria-hidden="true" />
      {f?.nombre ?? a.familia}
      {sub && <SubBadge id={sub.id} texto={sub.etiqueta} />}
    </span>
  );
}

export function SubBadge({ id, texto }: { id: string; texto: string }) {
  return (
    <span className={`subfam subfam-${id}`}>
      {id === "foundry" && (
        <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
          <path d="M8 0l1.8 6.2L16 8l-6.2 1.8L8 16l-1.8-6.2L0 8l6.2-1.8z" fill="currentColor" />
        </svg>
      )}
      {texto}
    </span>
  );
}

export function MadurezBadge({ madurez }: { madurez: AgentePublico["madurez"] }) {
  const m = useMarca();
  return <span className={`mad mad-${madurez}`}>{m.madurez[madurez]}</span>;
}

export function EjemploBadge() {
  return <span className="ejemplo" title="Este contenido es un ejemplo y falta validarlo con el equipo">Ejemplo: validar con el equipo</span>;
}
