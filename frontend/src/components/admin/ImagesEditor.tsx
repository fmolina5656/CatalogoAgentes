import { useRef, useState } from "react";
import type { EtiquetaImagen, Imagen } from "../../lib/types";
import type { Errores } from "../../lib/validate";
import { admin, erroresDe } from "../../lib/api";
import { useMarca } from "../../lib/marca";
import { mover, RowTools } from "./fields";

const TIPOS = ["image/jpeg", "image/png", "image/webp"];
const MAX = 8 * 1024 * 1024;

/** Carga de imágenes: arrastrar y soltar, elegir archivo o tomar foto con la cámara del celular. */
export function ImagesEditor({ imagenes, onChange, errores }: { imagenes: Imagen[]; onChange: (v: Imagen[]) => void; errores: Errores }) {
  const m = useMarca();
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(0);
  const [msg, setMsg] = useState<string[]>([]);
  const actual = useRef(imagenes);
  actual.current = imagenes;

  const subir = async (files: FileList | File[]) => {
    const errores: string[] = [];
    for (const f of Array.from(files)) {
      if (!TIPOS.includes(f.type)) { errores.push(`${f.name}: solo JPG, PNG o WebP.`); continue; }
      if (f.size > MAX) { errores.push(`${f.name}: pesa más de 8 MB.`); continue; }
      setSubiendo((n) => n + 1);
      try {
        const r = await admin.subirImagen(f);
        actual.current = [...actual.current, { archivo: r.archivo, alt: "", etiqueta: "" as EtiquetaImagen }];
        onChange(actual.current);
      } catch (e) {
        errores.push(`${f.name}: ${erroresDe(e).map((x) => x.msg).join(" ")}`);
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
    setMsg(errores);
  };

  const set = (i: number, p: Partial<Imagen>) => onChange(imagenes.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <div className="images-editor">
      <div
        className={`dropzone${arrastrando ? " over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true); }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => { e.preventDefault(); setArrastrando(false); subir(e.dataTransfer.files); }}
      >
        <p><b>Arrastra imágenes aquí</b> o</p>
        <div className="dz-actions">
          <label className="btn">
            Elegir archivo
            <input type="file" accept={TIPOS.join(",")} multiple className="sr-only" onChange={(e) => { if (e.target.files) subir(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="btn">
            📷 Tomar foto
            <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { if (e.target.files) subir(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        <p className="hint">JPG, PNG o WebP, hasta 8 MB. El servidor les quita los metadatos (EXIF) y las convierte a WebP. Sin nombres de clientes: anonimiza antes de subir.</p>
        {subiendo > 0 && <p className="hint" aria-live="polite">Subiendo {subiendo}…</p>}
        {msg.map((x) => <p key={x} className="error" role="alert">{x}</p>)}
      </div>

      {imagenes.length > 0 && (
        <ol className="img-list">
          {imagenes.map((img, i) => (
            <li key={img.archivo}>
              <div className="img-thumb">
                <img src={`/api/admin/media/${img.archivo.replace(/\.webp$/, "-thumb.webp")}`} alt="" />
                {i === 0 && <span className="portada mono">Portada</span>}
              </div>
              <div className="img-fields">
                <label className={errores[`imagenes.${i}.alt`] ? "has-error" : ""}>
                  <span>Texto alternativo *</span>
                  <input type="text" value={img.alt} placeholder="Describe lo que se ve" onChange={(e) => set(i, { alt: e.target.value })} />
                  {errores[`imagenes.${i}.alt`] && <span className="error">{errores[`imagenes.${i}.alt`]}</span>}
                </label>
                <label className={errores[`imagenes.${i}.etiqueta`] ? "has-error" : ""}>
                  <span>Etiqueta *</span>
                  <select value={img.etiqueta} onChange={(e) => set(i, { etiqueta: e.target.value as EtiquetaImagen })}>
                    <option value="">Elige…</option>
                    {(Object.keys(m.etiquetas_imagen) as EtiquetaImagen[]).map((k) => <option key={k} value={k}>{m.etiquetas_imagen[k]}</option>)}
                  </select>
                  {errores[`imagenes.${i}.etiqueta`] && <span className="error">{errores[`imagenes.${i}.etiqueta`]}</span>}
                </label>
              </div>
              <RowTools i={i} n={imagenes.length} nombre="imagen" onMove={(d) => onChange(mover(imagenes, i, d))} onRemove={() => onChange(imagenes.filter((_, j) => j !== i))} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
