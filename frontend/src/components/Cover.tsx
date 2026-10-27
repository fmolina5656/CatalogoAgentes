import type { AgentePublico } from "../lib/types";
import { colorDe, useMarca } from "../lib/marca";
import { useMediaUrl } from "../lib/media";

/** Portada de la tarjeta: la primera imagen o, si no hay, una portada generada de los datos. */
export function Cover({ a, mini = true }: { a: AgentePublico; mini?: boolean }) {
  const m = useMarca();
  const url = useMediaUrl();
  const img = a.imagenes[0];
  if (img) {
    return (
      <div className="cover">
        <img src={url(img.archivo, mini)} alt={img.alt} loading="lazy" />
        <span className={`img-tag tag-${img.etiqueta}`}>{m.etiquetas_imagen[img.etiqueta]}</span>
      </div>
    );
  }
  const c = colorDe(m, a.familia);
  const piezas = (a.arquitectura?.componentes ?? []).slice(0, 4).map((x) => x.nombre);
  const fichas = piezas.length ? piezas : a.tecnologias.slice(0, 4);
  return (
    <div className="cover generated" style={{ "--c": c } as React.CSSProperties} aria-hidden="true">
      <svg className="cover-grid" viewBox="0 0 400 225" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`g-${a.slug}`} cx="80%" cy="10%" r="90%">
            <stop offset="0" stopColor={c} stopOpacity=".55" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="225" fill={`url(#g-${a.slug})`} />
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={i} x1={i * 50} y1="0" x2={i * 50} y2="225" stroke="currentColor" strokeOpacity=".06" />
        ))}
      </svg>
      <div className="cover-chain">
        {fichas.map((p, i) => (
          <span key={i}>{p}</span>
        ))}
      </div>
    </div>
  );
}
