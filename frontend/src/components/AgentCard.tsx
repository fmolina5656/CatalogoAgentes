import { Link } from "react-router-dom";
import type { AgentePublico } from "../lib/types";
import { colorDe, useMarca } from "../lib/marca";
import { Cover } from "./Cover";
import { EjemploBadge, FamiliaBadge, MadurezBadge } from "./Badges";

export function etiquetasDe(a: AgentePublico): string[] {
  const t = [...a.integraciones.slice(0, 1), ...a.tecnologias];
  return [...new Set(t)].slice(0, 3);
}

export function AgentCard({ a, link = true }: { a: AgentePublico; link?: boolean }) {
  const m = useMarca();
  const contenido = (
    <>
      <Cover a={a} />
      <div className="card-body">
        <div className="card-meta">
          <FamiliaBadge a={a} />
          {a.destacado && <span className="star" title="Destacado" aria-label="Destacado">★</span>}
        </div>
        <h3>{a.nombre}</h3>
        <p className="tagline">{a.tagline}</p>
        <div className="tags">
          <MadurezBadge madurez={a.madurez} />
          {etiquetasDe(a).map((t) => <span key={t} className="tag">{t}</span>)}
        </div>
        {a.es_ejemplo && <EjemploBadge />}
      </div>
    </>
  );
  const style = { "--c": colorDe(m, a.familia) } as React.CSSProperties;
  return link ? (
    <Link className="agent-card" to={`/agentes/${a.slug}`} style={style}>{contenido}</Link>
  ) : (
    <div className="agent-card" style={style}>{contenido}</div>
  );
}
