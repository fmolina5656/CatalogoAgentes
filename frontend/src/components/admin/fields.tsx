import { useId } from "react";
import type { Errores } from "../../lib/validate";

export function Field({ label, hint, error, children, req = false, className = "" }: {
  label: string; hint?: string; error?: string; children: (id: string, describedBy?: string) => React.ReactNode;
  req?: boolean; className?: string;
}) {
  const id = useId();
  const hintId = hint ? `${id}-h` : undefined;
  const errId = error ? `${id}-e` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field${error ? " has-error" : ""} ${className}`}>
      <label htmlFor={id}>{label}{req && <span className="req" aria-hidden="true"> *</span>}</label>
      {children(id, describedBy)}
      {hint && <p className="hint" id={hintId}>{hint}</p>}
      {error && <p className="error" id={errId} role="alert">{error}</p>}
    </div>
  );
}

export function Text({ label, value, onChange, error, hint, req, multiline, placeholder, max, className }: {
  label: string; value: string; onChange: (v: string) => void; error?: string; hint?: string; req?: boolean;
  multiline?: boolean; placeholder?: string; max?: number; className?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error} req={req} className={className}>
      {(id, d) => multiline ? (
        <textarea id={id} aria-describedby={d} aria-invalid={!!error} value={value} rows={4} maxLength={max}
          placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} type="text" aria-describedby={d} aria-invalid={!!error} value={value} maxLength={max}
          placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

export function Select({ label, value, onChange, options, error, hint, req, vacio }: {
  label: string; value: string; onChange: (v: string) => void; options: { v: string; t: string }[];
  error?: string; hint?: string; req?: boolean; vacio?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error} req={req}>
      {(id, d) => (
        <select id={id} aria-describedby={d} aria-invalid={!!error} value={value} onChange={(e) => onChange(e.target.value)}>
          {vacio !== undefined && <option value="">{vacio}</option>}
          {options.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select>
      )}
    </Field>
  );
}

export function mover<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const c = [...arr];
  [c[i], c[j]] = [c[j], c[i]];
  return c;
}

export function RowTools({ i, n, onMove, onRemove, nombre }: {
  i: number; n: number; onMove: (d: number) => void; onRemove: () => void; nombre: string;
}) {
  return (
    <span className="row-tools">
      <button type="button" className="icon" onClick={() => onMove(-1)} disabled={i === 0} aria-label={`Subir ${nombre} ${i + 1}`}>↑</button>
      <button type="button" className="icon" onClick={() => onMove(1)} disabled={i === n - 1} aria-label={`Bajar ${nombre} ${i + 1}`}>↓</button>
      <button type="button" className="icon danger" onClick={onRemove} aria-label={`Quitar ${nombre} ${i + 1}`}>✕</button>
    </span>
  );
}

/** Lista editable de textos: agregar, quitar y reordenar. */
export function ListEditor({ label, items, onChange, errores, campo, hint, placeholder, agregar = "Agregar", req, multiline }: {
  label: string; items: string[]; onChange: (v: string[]) => void; errores: Errores; campo: string;
  hint?: string; placeholder?: string; agregar?: string; req?: boolean; multiline?: boolean;
}) {
  const general = errores[campo];
  return (
    <fieldset className={`list-editor${general ? " has-error" : ""}`}>
      <legend>{label}{req && <span className="req" aria-hidden="true"> *</span>}</legend>
      {hint && <p className="hint">{hint}</p>}
      {items.length > 0 && (
        <ol>
          {items.map((it, i) => (
            <li key={i} className={errores[`${campo}.${i}`] ? "has-error" : ""}>
              <span className="num mono">{i + 1}</span>
              {multiline ? (
                <textarea rows={2} value={it} aria-label={`${label} ${i + 1}`} placeholder={placeholder}
                  onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
              ) : (
                <input type="text" value={it} aria-label={`${label} ${i + 1}`} placeholder={placeholder}
                  onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />
              )}
              <RowTools i={i} n={items.length} nombre={label} onMove={(d) => onChange(mover(items, i, d))}
                onRemove={() => onChange(items.filter((_, j) => j !== i))} />
              {errores[`${campo}.${i}`] && <p className="error">{errores[`${campo}.${i}`]}</p>}
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="btn small" onClick={() => onChange([...items, ""])}>+ {agregar}</button>
      {general && <p className="error" role="alert">{general}</p>}
    </fieldset>
  );
}
