import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { AgentePublico } from "../lib/types";
import { api, ApiError } from "../lib/api";
import { useMarca } from "../lib/marca";
import { useTitle } from "../lib/hooks";
import { AgentDetailView, CtaLink } from "../components/AgentDetail";
import { GlitchSays } from "../components/Glitch";
import { ULTIMA_BUSQUEDA } from "./Home";

export function AgentPage() {
  const { slug = "" } = useParams();
  const m = useMarca();
  const [a, setA] = useState<AgentePublico | null>(null);
  const [error, setError] = useState<number | null>(null);
  useTitle(a ? `${a.nombre} · ${m.nombre}` : m.nombre);

  useEffect(() => {
    setA(null); setError(null);
    api.agente(slug).then(setA).catch((e) => setError(e instanceof ApiError ? e.status : 500));
    window.scrollTo(0, 0);
  }, [slug]);

  let volver = "/";
  try { const q = sessionStorage.getItem(ULTIMA_BUSQUEDA); if (q) volver = `/?${q}`; } catch { /* sin storage */ }

  if (error) {
    return (
      <div className="wrap notfound">
        <GlitchSays text={error === 404 ? "Ese agente no existe o todavía no está publicado. A lo mejor le cambiaron el nombre." : "Algo se atoró al cargar este agente. Intenta de nuevo en un momento."} />
        <Link className="btn primary" to="/">Ver el catálogo</Link>
      </div>
    );
  }
  if (!a) return <div className="wrap loading" aria-busy="true">Cargando…</div>;

  return (
    <div className="wrap">
      <div className="detail-bar">
        <Link to={volver} className="btn ghost">← Catálogo</Link>
        <div className="detail-bar-actions">
          <Link to={`/presentar?agente=${a.slug}`} className="btn">Presentar</Link>
          <CtaLink a={a} className="btn primary" />
        </div>
      </div>
      <AgentDetailView a={a} />
    </div>
  );
}

export function NotFound() {
  return (
    <div className="wrap notfound">
      <GlitchSays text="Uy, esta página no existe. Pero el catálogo sí, y está bien bonito." />
      <Link className="btn primary" to="/">Ver el catálogo</Link>
    </div>
  );
}
