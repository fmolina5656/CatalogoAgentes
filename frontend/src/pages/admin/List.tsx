import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { admin, erroresDe, type AgenteAdmin } from "../../lib/api";
import { colorDe, familiaDe, subfamiliaDe, useMarca } from "../../lib/marca";
import { useTitle } from "../../lib/hooks";
import { normalizar } from "../../lib/filters";

const SISTEMA = ["id", "orden", "creado", "actualizado", "actualizado_por", "_version"];

export function ListPage() {
  const m = useMarca();
  const nav = useNavigate();
  useTitle("Agentes · Back");
  const [agentes, setAgentes] = useState<AgenteAdmin[]>([]);
  const [versionOrden, setVersionOrden] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<{ t: "ok" | "error"; x: string } | null>(null);
  const [borrando, setBorrando] = useState<AgenteAdmin | null>(null);
  const [importando, setImportando] = useState<File | null>(null);
  const [modo, setModo] = useState<"combinar" | "reemplazar">("combinar");
  const [ocupado, setOcupado] = useState(false);
  const dlgBorrar = useRef<HTMLDialogElement>(null);
  const dlgImportar = useRef<HTMLDialogElement>(null);

  const cargar = () => admin.lista().then((r) => { setAgentes(r.agentes); setVersionOrden(r.version_orden); })
    .catch((e) => setMsg({ t: "error", x: erroresDe(e)[0].msg }));
  useEffect(() => { cargar(); }, []);
  useEffect(() => { if (borrando) dlgBorrar.current?.showModal(); else dlgBorrar.current?.close(); }, [borrando]);
  useEffect(() => { if (importando) dlgImportar.current?.showModal(); else dlgImportar.current?.close(); }, [importando]);

  const visibles = useMemo(() => {
    const t = normalizar(q.trim());
    return t ? agentes.filter((a) => normalizar(`${a.nombre} ${a.slug} ${a.tagline}`).includes(t)) : agentes;
  }, [agentes, q]);

  const accion = async (fn: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    try { await fn(); setMsg({ t: "ok", x: ok }); } catch (e) { setMsg({ t: "error", x: erroresDe(e).map((x) => x.msg).join(" ") }); }
    finally { setOcupado(false); await cargar(); }
  };

  const moverA = (i: number, d: number) => {
    const ids = agentes.map((a) => a.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setAgentes((xs) => { const c = [...xs]; [c[i], c[j]] = [c[j], c[i]]; return c; });
    accion(() => admin.orden(ids, versionOrden), "Orden actualizado.");
  };

  const alternarDestacado = (a: AgenteAdmin) => {
    const d = { ...a } as Record<string, unknown>;
    for (const k of SISTEMA) delete d[k];
    d.destacado = !a.destacado;
    accion(() => admin.guardar(a.id, d, a._version), a.destacado ? "Ya no está destacado." : "Marcado como destacado.");
  };

  return (
    <div className="wrap admin-list">
      <div className="list-head">
        <div>
          <h1>Agentes</h1>
          <p className="muted">{agentes.filter((a) => a.estado === "publicado").length} publicados · {agentes.filter((a) => a.estado === "borrador").length} borradores</p>
        </div>
        <div className="list-actions">
          <Link to="/admin/agentes/nuevo" className="btn primary">+ Nuevo agente</Link>
          <a href="/api/admin/export" className="btn" download>Exportar ZIP</a>
          <label className="btn">
            Importar ZIP
            <input type="file" accept=".zip,application/zip" className="sr-only" onChange={(e) => { setImportando(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          </label>
        </div>
      </div>

      {msg && <p className={`banner ${msg.t === "ok" ? "ok" : "error"}`} role={msg.t === "ok" ? "status" : "alert"}>{msg.x}</p>}

      <label className="search admin-search">
        <span className="sr-only">Buscar en la lista</span>
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.6" /></svg>
        <input type="search" placeholder="Buscar por nombre o slug" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      <ol className="admin-rows" aria-busy={ocupado}>
        {visibles.map((a) => {
          const i = agentes.indexOf(a);
          const fam = familiaDe(m, a.familia);
          const sub = subfamiliaDe(m, a);
          return (
            <li key={a.id} className="admin-row" style={{ "--c": colorDe(m, a.familia) } as React.CSSProperties}>
              <div className="order">
                <button type="button" className="icon" disabled={ocupado || !!q || i === 0} onClick={() => moverA(i, -1)} aria-label={`Subir ${a.nombre}`}>↑</button>
                <span className="mono">{i + 1}</span>
                <button type="button" className="icon" disabled={ocupado || !!q || i === agentes.length - 1} onClick={() => moverA(i, 1)} aria-label={`Bajar ${a.nombre}`}>↓</button>
              </div>
              <div className="row-main">
                <Link to={`/admin/agentes/${a.id}`} className="row-name" aria-label={`Editar ${a.nombre}`}>{a.nombre}</Link>
                <span className="row-sub">
                  <span className="fam"><span className="dot" />{fam?.nombre}{sub ? ` · ${sub.nombre}` : ""}</span>
                  <span className="mono muted">/{a.slug}</span>
                  {a.es_ejemplo && <span className="ejemplo">Ejemplo</span>}
                </span>
              </div>
              <span className={`estado est-${a.estado}`}>{a.estado === "publicado" ? "Publicado" : "Borrador"}</span>
              <button type="button" className={`icon star-btn${a.destacado ? " on" : ""}`} disabled={ocupado} onClick={() => alternarDestacado(a)}
                aria-pressed={a.destacado} aria-label={`${a.destacado ? "Quitar de destacados" : "Destacar"}: ${a.nombre}`}>★</button>
              <span className="row-date muted">
                {new Date(a.actualizado).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                <small>{a.actualizado_por}</small>
              </span>
              <div className="row-actions">
                <Link to={`/admin/agentes/${a.id}`} className="btn small" aria-hidden="true" tabIndex={-1}>Editar</Link>
                <button type="button" className="btn small" disabled={ocupado} onClick={() => accion(async () => {
                  const r = await admin.duplicar(a.id); nav(`/admin/agentes/${r.agente.id}`);
                }, "Duplicado como borrador.")}>Duplicar</button>
                <button type="button" className="btn small danger" disabled={ocupado} onClick={() => setBorrando(a)}>Borrar</button>
              </div>
            </li>
          );
        })}
      </ol>
      {!visibles.length && <p className="muted">No hay agentes que coincidan.</p>}

      <dialog ref={dlgBorrar} className="confirm" onClose={() => setBorrando(null)}>
        {borrando && (
          <form method="dialog" onSubmit={(e) => { e.preventDefault(); const a = borrando; setBorrando(null); accion(() => admin.borrar(a.id, a._version), `"${a.nombre}" se borró.`); }}>
            <h2>¿Borrar "{borrando.nombre}"?</h2>
            <p>Se borra la ficha y sus imágenes (si ningún otro agente las usa). No se puede deshacer. Si solo quieres ocultarla, pásala a borrador.</p>
            <div className="confirm-actions">
              <button type="button" className="btn" onClick={() => setBorrando(null)} autoFocus>Cancelar</button>
              <button type="submit" className="btn danger">Sí, borrar</button>
            </div>
          </form>
        )}
      </dialog>

      <dialog ref={dlgImportar} className="confirm" onClose={() => setImportando(null)}>
        {importando && (
          <form method="dialog" onSubmit={(e) => { e.preventDefault(); const f = importando; setImportando(null);
            accion(async () => { const r = await admin.importar(f, modo); setMsg({ t: "ok", x: `${r.importados} agentes y ${r.imagenes} imágenes importados.` }); }, "Importación lista."); }}>
            <h2>Importar {importando.name}</h2>
            <fieldset className="radios">
              <label><input type="radio" name="modo" checked={modo === "combinar"} onChange={() => setModo("combinar")} /> <span><b>Combinar</b>: agrega los nuevos y reemplaza los que tengan el mismo id.</span></label>
              <label><input type="radio" name="modo" checked={modo === "reemplazar"} onChange={() => setModo("reemplazar")} /> <span><b>Reemplazar todo</b>: borra el catálogo actual y deja solo lo importado.</span></label>
            </fieldset>
            <p className="hint">Antes de escribir nada se valida todo el ZIP. Si algo falla, no se cambia nada.</p>
            <div className="confirm-actions">
              <button type="button" className="btn" onClick={() => setImportando(null)}>Cancelar</button>
              <button type="submit" className={`btn ${modo === "reemplazar" ? "danger" : "primary"}`}>Importar</button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
