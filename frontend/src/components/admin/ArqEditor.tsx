import type { Arquitectura, Componente, TipoComponente } from "../../lib/types";
import type { Errores } from "../../lib/validate";
import { slugDe } from "../../lib/validate";
import { ArchDiagram, TIPOS } from "../ArchDiagram";
import { mover, RowTools } from "./fields";

const VACIA: Arquitectura = { componentes: [], conexiones: [], pasos: [] };

function idLibre(nombre: string, usados: string[]): string {
  const base = (slugDe(nombre) || "pieza").slice(0, 34);
  let id = base, n = 2;
  while (usados.includes(id)) id = `${base}-${n++}`;
  return id;
}

/** Editor simple de piezas, conexiones y pasos, con vista previa en vivo del diagrama. */
export function ArqEditor({ arq, onChange, errores }: { arq: Arquitectura | null; onChange: (a: Arquitectura | null) => void; errores: Errores }) {
  if (!arq) {
    return (
      <div className="arq-empty">
        <p className="hint">Muy recomendada en pro-code: el catálogo dibuja el diagrama a partir de estas piezas.</p>
        <button type="button" className="btn" onClick={() => onChange({ ...VACIA, componentes: [
          { id: "entrada", nombre: "Entrada", tipo: "entrada", detalle: "" },
          { id: "agente", nombre: "Agente", tipo: "ia", detalle: "" },
          { id: "salida", nombre: "Salida", tipo: "salida", detalle: "" },
        ], conexiones: [["entrada", "agente"], ["agente", "salida"]] })}>+ Agregar arquitectura</button>
      </div>
    );
  }
  const ids = arq.componentes.map((c) => c.id);
  const set = (p: Partial<Arquitectura>) => onChange({ ...arq, ...p });
  const setComp = (i: number, c: Partial<Componente>) => {
    const viejo = arq.componentes[i].id;
    const nuevo = { ...arq.componentes[i], ...c };
    const comps = arq.componentes.map((x, j) => (j === i ? nuevo : x));
    if (c.id !== undefined && c.id !== viejo) {
      // Renombrar el id actualiza conexiones y pasos.
      set({
        componentes: comps,
        conexiones: arq.conexiones.map(([a, b]) => [a === viejo ? c.id! : a, b === viejo ? c.id! : b]),
        pasos: arq.pasos.map((p) => ({ ...p, componentes: p.componentes.map((x) => (x === viejo ? c.id! : x)) })),
      });
    } else set({ componentes: comps });
  };
  const quitarComp = (i: number) => {
    const id = arq.componentes[i].id;
    set({
      componentes: arq.componentes.filter((_, j) => j !== i),
      conexiones: arq.conexiones.filter(([a, b]) => a !== id && b !== id),
      pasos: arq.pasos.map((p) => ({ ...p, componentes: p.componentes.filter((x) => x !== id) })),
    });
  };
  const nombre = (id: string) => arq.componentes.find((c) => c.id === id)?.nombre || id;

  return (
    <div className="arq-editor">
      <fieldset className="list-editor">
        <legend>Piezas</legend>
        <p className="hint">Cada pieza va en una columna según su tipo: entrada → IA → código y datos → salida.</p>
        {errores["arquitectura.componentes"] && <p className="error">{errores["arquitectura.componentes"]}</p>}
        <ol className="comp-list">
          {arq.componentes.map((c, i) => (
            <li key={i} className="comp" style={{ "--t": TIPOS[c.tipo].color } as React.CSSProperties}>
              <div className="comp-row">
                <input type="text" value={c.nombre} aria-label={`Nombre de la pieza ${i + 1}`} placeholder="Nombre"
                  onChange={(e) => setComp(i, { nombre: e.target.value })} />
                <select value={c.tipo} aria-label={`Tipo de la pieza ${i + 1}`} onChange={(e) => setComp(i, { tipo: e.target.value as TipoComponente })}>
                  {(Object.keys(TIPOS) as TipoComponente[]).map((t) => <option key={t} value={t}>{TIPOS[t].nombre}</option>)}
                </select>
                <RowTools i={i} n={arq.componentes.length} nombre="pieza" onMove={(d) => set({ componentes: mover(arq.componentes, i, d) })} onRemove={() => quitarComp(i)} />
              </div>
              <div className="comp-row">
                <input type="text" className="mono id" value={c.id} aria-label={`Id de la pieza ${i + 1}`}
                  onChange={(e) => setComp(i, { id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 40) })} />
                <input type="text" value={c.detalle} aria-label={`Detalle de la pieza ${i + 1}`} placeholder="Detalle (se ve al tocar la pieza)"
                  onChange={(e) => setComp(i, { detalle: e.target.value })} />
              </div>
              {Object.entries(errores).filter(([k]) => k.startsWith(`arquitectura.componentes.${i}`)).slice(0, 1).map(([k, v]) => <p key={k} className="error">{v}</p>)}
            </li>
          ))}
        </ol>
        <button type="button" className="btn small" onClick={() => set({ componentes: [...arq.componentes, { id: idLibre("pieza", ids), nombre: "", tipo: "codigo", detalle: "" }] })}>+ Pieza</button>
      </fieldset>

      <fieldset className="list-editor">
        <legend>Conexiones</legend>
        <ol>
          {arq.conexiones.map(([a, b], i) => (
            <li key={i} className={errores[`arquitectura.conexiones.${i}`] ? "has-error" : ""}>
              <select value={a} aria-label={`Conexión ${i + 1}: desde`} onChange={(e) => set({ conexiones: arq.conexiones.map((x, j) => (j === i ? [e.target.value, x[1]] : x)) })}>
                <option value="">Desde…</option>
                {ids.map((id) => <option key={id} value={id}>{nombre(id)}</option>)}
              </select>
              <span aria-hidden="true">→</span>
              <select value={b} aria-label={`Conexión ${i + 1}: hasta`} onChange={(e) => set({ conexiones: arq.conexiones.map((x, j) => (j === i ? [x[0], e.target.value] : x)) })}>
                <option value="">Hasta…</option>
                {ids.map((id) => <option key={id} value={id}>{nombre(id)}</option>)}
              </select>
              <button type="button" className="icon danger" aria-label={`Quitar conexión ${i + 1}`} onClick={() => set({ conexiones: arq.conexiones.filter((_, j) => j !== i) })}>✕</button>
              {errores[`arquitectura.conexiones.${i}`] && <p className="error">{errores[`arquitectura.conexiones.${i}`]}</p>}
            </li>
          ))}
        </ol>
        <button type="button" className="btn small" onClick={() => set({ conexiones: [...arq.conexiones, [ids[0] ?? "", ids[1] ?? ""]] })}>+ Conexión</button>
      </fieldset>

      <fieldset className="list-editor">
        <legend>Recorrido paso a paso</legend>
        <p className="hint">Cada paso ilumina las piezas que marques.</p>
        <ol>
          {arq.pasos.map((p, i) => (
            <li key={i} className={`paso${errores[`arquitectura.pasos.${i}`] || errores[`arquitectura.pasos.${i}.texto`] ? " has-error" : ""}`}>
              <span className="num mono">{i + 1}</span>
              <div className="paso-body">
                <input type="text" value={p.texto} placeholder="Qué pasa en este paso" aria-label={`Texto del paso ${i + 1}`}
                  onChange={(e) => set({ pasos: arq.pasos.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)) })} />
                <div className="checks" role="group" aria-label={`Piezas del paso ${i + 1}`}>
                  {arq.componentes.map((c) => (
                    <label key={c.id} className="check-chip">
                      <input type="checkbox" checked={p.componentes.includes(c.id)} onChange={(e) => set({
                        pasos: arq.pasos.map((x, j) => (j === i ? { ...x, componentes: e.target.checked ? [...x.componentes, c.id] : x.componentes.filter((y) => y !== c.id) } : x)),
                      })} />
                      {c.nombre || c.id}
                    </label>
                  ))}
                </div>
              </div>
              <RowTools i={i} n={arq.pasos.length} nombre="paso" onMove={(d) => set({ pasos: mover(arq.pasos, i, d) })} onRemove={() => set({ pasos: arq.pasos.filter((_, j) => j !== i) })} />
              {(errores[`arquitectura.pasos.${i}`] || errores[`arquitectura.pasos.${i}.texto`]) && <p className="error">{errores[`arquitectura.pasos.${i}`] || errores[`arquitectura.pasos.${i}.texto`]}</p>}
            </li>
          ))}
        </ol>
        <button type="button" className="btn small" onClick={() => set({ pasos: [...arq.pasos, { texto: "", componentes: [] }] })}>+ Paso</button>
      </fieldset>

      <div className="arq-preview">
        <p className="label">Vista previa en vivo</p>
        {arq.componentes.length ? <ArchDiagram arq={arq} /> : <p className="hint">Agrega piezas para ver el diagrama.</p>}
      </div>
      <button type="button" className="btn small danger" onClick={() => { if (confirm("¿Quitar toda la arquitectura de esta ficha?")) onChange(null); }}>Quitar arquitectura</button>
    </div>
  );
}
