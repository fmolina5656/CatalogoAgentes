import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Arquitectura, Componente, TipoComponente } from "../lib/types";

export const TIPOS: Record<TipoComponente, { nombre: string; color: string }> = {
  entrada: { nombre: "Entrada", color: "#b7c2d2" },
  persona: { nombre: "Persona", color: "#ffb547" },
  ia: { nombre: "IA", color: "#66de7f" },
  seguridad: { nombre: "Seguridad", color: "#ff7a7a" },
  codigo: { nombre: "Código", color: "#397ef6" },
  datos: { nombre: "Datos", color: "#53b6ad" },
  salida: { nombre: "Salida", color: "#c49bff" },
};

const COLUMNAS = ["Entrada", "IA", "Código y datos", "Salida"];

/** Columna de cada pieza: entrada → IA → código → salida.
 *  Una persona sin nada que le llegue es entrada; si recibe algo, está del lado de la salida. */
export function columnaDe(c: Componente, arq: Arquitectura): number {
  switch (c.tipo) {
    case "entrada": return 0;
    case "ia": case "seguridad": return 1;
    case "codigo": case "datos": return 2;
    case "salida": return 3;
    case "persona": return arq.conexiones.some(([, h]) => h === c.id) ? 3 : 0;
  }
}

interface Linea { d: string; desde: string; hasta: string }

function rutas(cont: HTMLElement, arq: Arquitectura, nodos: Map<string, HTMLElement>): Linea[] {
  const base = cont.getBoundingClientRect();
  const out: Linea[] = [];
  for (const [desde, hasta] of arq.conexiones) {
    const a = nodos.get(desde)?.getBoundingClientRect();
    const b = nodos.get(hasta)?.getBoundingClientRect();
    if (!a || !b) continue;
    const ax = a.left - base.left, ay = a.top - base.top, bx = b.left - base.left, by = b.top - base.top;
    const acx = ax + a.width / 2, acy = ay + a.height / 2, bcx = bx + b.width / 2, bcy = by + b.height / 2;
    let x1, y1, x2, y2, d;
    if (bx >= ax + a.width - 4) {            // a la derecha
      x1 = ax + a.width; y1 = acy; x2 = bx - 6; y2 = bcy;
      const k = Math.max(24, (x2 - x1) / 2);
      d = `M${x1},${y1} C${x1 + k},${y1} ${x2 - k},${y2} ${x2},${y2}`;
    } else if (bx + b.width <= ax + 4) {     // a la izquierda (regreso)
      x1 = ax; y1 = acy; x2 = bx + b.width + 6; y2 = bcy;
      const k = Math.max(24, (x1 - x2) / 2);
      d = `M${x1},${y1} C${x1 - k},${y1} ${x2 + k},${y2} ${x2},${y2}`;
    } else if (by >= ay + a.height - 4) {    // abajo (misma columna o vista apilada)
      x1 = acx; y1 = ay + a.height; x2 = bcx; y2 = by - 6;
      const k = Math.max(14, (y2 - y1) / 2);
      d = `M${x1},${y1} C${x1},${y1 + k} ${x2},${y2 - k} ${x2},${y2}`;
    } else {                                 // arriba
      x1 = acx; y1 = ay; x2 = bcx; y2 = by + b.height + 6;
      const k = Math.max(14, (y1 - y2) / 2);
      d = `M${x1},${y1} C${x1},${y1 - k} ${x2},${y2 + k} ${x2},${y2}`;
    }
    out.push({ d, desde, hasta });
  }
  return out;
}

export function ArchDiagram({ arq, paso: pasoExterno, onPaso, compacto = false }: {
  arq: Arquitectura;
  paso?: number;
  onPaso?: (n: number) => void;
  compacto?: boolean;
}) {
  const [pasoInterno, setPasoInterno] = useState(-1);
  const paso = pasoExterno ?? pasoInterno;
  const setPaso = onPaso ?? setPasoInterno;
  const [sel, setSel] = useState<string | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const cont = useRef<HTMLDivElement>(null);
  const nodos = useRef(new Map<string, HTMLElement>());

  const cols = useMemo(() => {
    const c: Componente[][] = [[], [], [], []];
    for (const comp of arq.componentes) c[columnaDe(comp, arq)].push(comp);
    return c;
  }, [arq]);

  const recalcular = useCallback(() => {
    if (cont.current) setLineas(rutas(cont.current, arq, nodos.current));
  }, [arq]);

  useLayoutEffect(recalcular, [recalcular]);
  useEffect(() => {
    if (!cont.current) return;
    const ro = new ResizeObserver(recalcular);
    ro.observe(cont.current);
    document.fonts?.ready.then(recalcular);
    return () => ro.disconnect();
  }, [recalcular]);

  const activo = paso >= 0 ? new Set(arq.pasos[paso]?.componentes ?? []) : null;
  const seleccionado = arq.componentes.find((c) => c.id === sel);
  const nombre = (id: string) => arq.componentes.find((c) => c.id === id)?.nombre ?? id;

  return (
    <div className={`arch${compacto ? " compacto" : ""}`}>
      <div className="arch-legend" aria-label="Tipos de pieza">
        {(Object.keys(TIPOS) as TipoComponente[])
          .filter((t) => arq.componentes.some((c) => c.tipo === t))
          .map((t) => (
            <span key={t} style={{ "--t": TIPOS[t].color } as React.CSSProperties}><i />{TIPOS[t].nombre}</span>
          ))}
      </div>
      <div className="arch-canvas" ref={cont}>
        <svg className="arch-lines" aria-hidden="true">
          <defs>
            <marker id="flecha" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#4d6894" />
            </marker>
            <marker id="flecha-on" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#66de7f" />
            </marker>
          </defs>
          {lineas.map((l, i) => {
            const on = activo ? activo.has(l.desde) && activo.has(l.hasta) : sel ? l.desde === sel || l.hasta === sel : false;
            const dim = (activo && !on) || (sel && !on);
            return <path key={i} d={l.d} className={`${on ? "on" : ""}${dim ? " dim" : ""}`} markerEnd={on ? "url(#flecha-on)" : "url(#flecha)"} />;
          })}
        </svg>
        {cols.map((col, ci) => (
          <div className="arch-col" key={ci}>
            <h4>{COLUMNAS[ci]}</h4>
            {col.map((c) => {
              const on = activo?.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  ref={(el) => { if (el) nodos.current.set(c.id, el); else nodos.current.delete(c.id); }}
                  className={`node${on ? " on" : ""}${activo && !on ? " dim" : ""}${sel === c.id ? " sel" : ""}`}
                  style={{ "--t": TIPOS[c.tipo].color } as React.CSSProperties}
                  onClick={(e) => { e.stopPropagation(); setSel(sel === c.id ? null : c.id); }}
                  aria-pressed={sel === c.id}
                  aria-label={`${c.nombre} (${TIPOS[c.tipo].nombre}). Ver detalle`}
                >
                  <small>{TIPOS[c.tipo].nombre}</small>
                  {c.nombre}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {seleccionado && (
        <div className="arch-ficha" role="dialog" aria-label={seleccionado.nombre} style={{ "--t": TIPOS[seleccionado.tipo].color } as React.CSSProperties}>
          <button type="button" className="x" onClick={() => setSel(null)} aria-label="Cerrar ficha">×</button>
          <small>{TIPOS[seleccionado.tipo].nombre}</small>
          <h4>{seleccionado.nombre}</h4>
          {seleccionado.detalle && <p>{seleccionado.detalle}</p>}
          <dl>
            {arq.conexiones.some(([, h]) => h === seleccionado.id) && (
              <><dt>Recibe de</dt><dd>{arq.conexiones.filter(([, h]) => h === seleccionado.id).map(([d]) => nombre(d)).join(", ")}</dd></>
            )}
            {arq.conexiones.some(([d]) => d === seleccionado.id) && (
              <><dt>Envía a</dt><dd>{arq.conexiones.filter(([d]) => d === seleccionado.id).map(([, h]) => nombre(h)).join(", ")}</dd></>
            )}
          </dl>
        </div>
      )}

      {arq.pasos.length > 0 && !compacto && (
        <div className="arch-steps">
          <div className="arch-step-text" aria-live="polite">
            {paso < 0 ? (
              <span className="muted">Recorre el flujo paso a paso, o toca cualquier pieza para ver su detalle.</span>
            ) : (
              <><b>{paso + 1}/{arq.pasos.length}</b> {arq.pasos[paso].texto}</>
            )}
          </div>
          <div className="arch-step-nav">
            <button type="button" className="btn" onClick={() => setPaso(Math.max(-1, paso - 1))} disabled={paso < 0}>
              ← Anterior
            </button>
            <button type="button" className="btn primary" onClick={() => setPaso(paso + 1 >= arq.pasos.length ? -1 : paso + 1)}>
              {paso < 0 ? "Recorrer el flujo →" : paso + 1 >= arq.pasos.length ? "Volver a empezar ↺" : "Siguiente →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
