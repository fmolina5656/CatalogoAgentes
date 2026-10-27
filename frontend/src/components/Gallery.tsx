import { useEffect, useRef, useState } from "react";
import type { Imagen } from "../lib/types";
import { useMarca } from "../lib/marca";
import { useMediaUrl } from "../lib/media";

export function ImgTag({ etiqueta }: { etiqueta: Imagen["etiqueta"] }) {
  const m = useMarca();
  return <span className={`img-tag tag-${etiqueta}`}>{m.etiquetas_imagen[etiqueta]}</span>;
}

export function Gallery({ imagenes }: { imagenes: Imagen[] }) {
  const url = useMediaUrl();
  const [abierta, setAbierta] = useState<number | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    if (abierta !== null && !d.open) d.showModal();
    if (abierta === null && d.open) d.close();
  }, [abierta]);
  if (!imagenes.length) return null;
  const mover = (n: number) => setAbierta((i) => (i === null ? null : (i + n + imagenes.length) % imagenes.length));
  const actual = abierta !== null ? imagenes[abierta] : null;
  return (
    <>
      <div className="gallery">
        {imagenes.map((img, i) => (
          <button key={img.archivo} type="button" className="shot" onClick={() => setAbierta(i)} aria-label={`Ampliar: ${img.alt}`}>
            <img src={url(img.archivo, true)} alt={img.alt} loading="lazy" />
            <ImgTag etiqueta={img.etiqueta} />
          </button>
        ))}
      </div>
      <dialog
        ref={dlg}
        className="lightbox"
        onClose={() => setAbierta(null)}
        onClick={(e) => { if (e.target === dlg.current) setAbierta(null); }}
        onKeyDown={(e) => { if (e.key === "ArrowRight") mover(1); if (e.key === "ArrowLeft") mover(-1); }}
      >
        {actual && (
          <figure>
            <div className="lb-img">
              <img src={url(actual.archivo)} alt={actual.alt} />
              <ImgTag etiqueta={actual.etiqueta} />
            </div>
            <figcaption>
              <span>{actual.alt}</span>
              <span className="lb-nav">
                {imagenes.length > 1 && (
                  <>
                    <button type="button" className="btn" onClick={() => mover(-1)} aria-label="Anterior">←</button>
                    <span className="mono">{(abierta ?? 0) + 1}/{imagenes.length}</span>
                    <button type="button" className="btn" onClick={() => mover(1)} aria-label="Siguiente">→</button>
                  </>
                )}
                <button type="button" className="btn" onClick={() => setAbierta(null)}>Cerrar</button>
              </span>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}
