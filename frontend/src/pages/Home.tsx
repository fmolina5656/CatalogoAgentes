import { useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import type { AgentePublico } from "../lib/types";
import { aParams, filtrar, leerFiltros, type Filtros } from "../lib/filters";
import { useMarca } from "../lib/marca";
import { useTitle } from "../lib/hooks";
import { GlitchSays } from "../components/Glitch";
import { AgentCard } from "../components/AgentCard";
import { SubBadge } from "../components/Badges";

export const ULTIMA_BUSQUEDA = "catalogo:ultima-busqueda";

function Chip({ activo, onClick, children, color, count }: {
  activo: boolean; onClick: () => void; children: React.ReactNode; color?: string; count?: number;
}) {
  return (
    <button type="button" className={`chip${activo ? " on" : ""}`} aria-pressed={activo} onClick={onClick}
      style={color ? ({ "--c": color } as React.CSSProperties) : undefined}>
      {color && <span className="dot" aria-hidden="true" />}
      {children}
      {count !== undefined && <span className="count">{count}</span>}
    </button>
  );
}

export function Home({ agentes }: { agentes: AgentePublico[] }) {
  const m = useMarca();
  useTitle(`${m.nombre} · ${m.organizacion}`);
  const [params, setParams] = useSearchParams();
  const f = leerFiltros(params);
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { sessionStorage.setItem(ULTIMA_BUSQUEDA, params.toString()); } catch { /* sin storage */ }
  }, [params]);

  const set = (cambio: Partial<Filtros>, scroll = false) => {
    const nuevo = { ...f, ...cambio };
    if (cambio.familia !== undefined && cambio.familia !== f.familia) nuevo.sub = cambio.sub ?? "";
    setParams(aParams(nuevo), { replace: true });
    if (scroll) requestAnimationFrame(() => grid.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const lista = useMemo(() => {
    const r = filtrar(agentes, f);
    return [...r.filter((a) => a.destacado), ...r.filter((a) => !a.destacado)];
  }, [agentes, f]);

  const contar = (cambio: Partial<Filtros>, ignorar: (keyof Filtros)[]) =>
    filtrar(agentes, { ...f, ...cambio }, ignorar).length;
  const industrias = useMemo(() => [...new Set(agentes.flatMap((a) => a.industrias))].sort((a, b) => a.localeCompare(b, "es")), [agentes]);
  const plataformas = m.plataformas.filter((p) => agentes.some((a) => a.plataforma === p));
  const famActiva = m.familias.find((x) => x.id === f.familia);
  const hayFiltros = Object.values(f).some(Boolean);

  return (
    <>
      <section className="hero wrap">
        <div className="hero-copy">
          <p className="kicker">{m.organizacion} · Microsoft partner</p>
          <h1><span className="grad">{m.nombre}</span></h1>
          <p className="sub">{m.descripcion}</p>
        </div>
        <GlitchSays text={m.glitch.portada.join(" ")} className="hero-glitch" />
      </section>

      <section className="wrap families" aria-label="Familias de agentes">
        {m.familias.map((fam) => {
          const n = agentes.filter((a) => a.familia === fam.id).length;
          return (
            <div key={fam.id} className={`family${fam.subfamilias.length ? " major" : ""}`} style={{ "--c": fam.color } as React.CSSProperties}>
              <button type="button" className="family-main" onClick={() => set({ familia: fam.id, sub: "" }, true)}>
                <span className="label">{fam.grupo}</span>
                <span className="family-name">{fam.nombre}</span>
                <span className="family-desc">{fam.descripcion}</span>
                <span className="family-count">{n} {n === 1 ? "agente" : "agentes"} →</span>
              </button>
              {fam.subfamilias.length > 0 && (
                <div className="family-subs">
                  {fam.subfamilias.map((s) => {
                    const ns = agentes.filter((a) => a.familia === fam.id && a.subfamilia === s.id).length;
                    return (
                      <button type="button" key={s.id} className={`family-sub fs-${s.id}`} onClick={() => set({ familia: fam.id, sub: s.id }, true)}>
                        <SubBadge id={s.id} texto={s.nombre} />
                        <span>{s.descripcion}</span>
                        <span className="family-count">{ns} →</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <section className="wrap catalog" ref={grid} aria-labelledby="titulo-catalogo">
        <div className="catalog-head">
          <h2 id="titulo-catalogo">Agentes</h2>
          <p className="muted" aria-live="polite">{lista.length} de {agentes.length}</p>
        </div>

        <div className="filters" role="search">
          <label className="search">
            <span className="sr-only">Buscar agentes</span>
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" /></svg>
            <input type="search" placeholder="Busca por nombre, tecnología, industria…" value={f.q}
              onChange={(e) => set({ q: e.target.value })} />
          </label>

          <div className="chip-row" role="group" aria-label="Familia">
            <Chip activo={!f.familia} onClick={() => set({ familia: "", sub: "" })} count={contar({ familia: "", sub: "" }, ["familia", "sub"])}>Todas</Chip>
            {m.familias.map((fam) => (
              <Chip key={fam.id} activo={f.familia === fam.id} color={fam.color} onClick={() => set({ familia: f.familia === fam.id ? "" : fam.id })}
                count={contar({ familia: fam.id, sub: "" }, ["sub"])}>
                {fam.nombre}
              </Chip>
            ))}
          </div>

          {famActiva && famActiva.subfamilias.length > 0 && (
            <div className="chip-row sub-row" role="group" aria-label={`Dentro de ${famActiva.nombre}`}>
              <Chip activo={!f.sub} onClick={() => set({ sub: "" })}>Todo {famActiva.nombre}</Chip>
              {famActiva.subfamilias.map((s) => (
                <Chip key={s.id} activo={f.sub === s.id} onClick={() => set({ sub: f.sub === s.id ? "" : s.id })} count={contar({ sub: s.id }, [])}>
                  {s.nombre}
                </Chip>
              ))}
            </div>
          )}

          <div className="filter-selects">
            <label>
              <span className="label">Plataforma</span>
              <select value={f.plataforma} onChange={(e) => set({ plataforma: e.target.value })}>
                <option value="">Todas</option>
                {plataformas.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label>
              <span className="label">Industria</span>
              <select value={f.industria} onChange={(e) => set({ industria: e.target.value })}>
                <option value="">Todas</option>
                {industrias.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <div className="madurez-group" role="group" aria-label="Madurez">
              <span className="label">Madurez</span>
              <div className="chip-row">
                {(Object.keys(m.madurez) as (keyof typeof m.madurez)[]).map((k) => (
                  <Chip key={k} activo={f.madurez === k} onClick={() => set({ madurez: f.madurez === k ? "" : k })} count={contar({ madurez: k }, [])}>
                    {m.madurez[k]}
                  </Chip>
                ))}
              </div>
            </div>
            {hayFiltros && <button type="button" className="btn ghost clear" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Limpiar filtros</button>}
          </div>
        </div>

        {lista.length ? (
          <div className="cards">
            {lista.map((a) => <AgentCard key={a.id} a={a} />)}
          </div>
        ) : (
          <div className="empty">
            <GlitchSays text={m.glitch.sin_resultados} />
            <button type="button" className="btn" onClick={() => setParams(new URLSearchParams(), { replace: true })}>Ver todos</button>
          </div>
        )}

      </section>
    </>
  );
}
