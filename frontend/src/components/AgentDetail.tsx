import type { AgentePublico } from "../lib/types";
import { colorDe, useMarca } from "../lib/marca";
import { GlitchSays } from "./Glitch";
import { EjemploBadge, FamiliaBadge, MadurezBadge } from "./Badges";
import { ArchDiagram } from "./ArchDiagram";
import { Gallery } from "./Gallery";
import { Qr } from "./Qr";

export function urlPublica(slug: string) {
  return `${window.location.origin}/agentes/${slug}`;
}

function Chips({ items }: { items: string[] }) {
  return <div className="tags">{items.map((t) => <span className="tag" key={t}>{t}</span>)}</div>;
}

function Bloque({ titulo, children, className = "" }: { titulo: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <h3 className="label">{titulo}</h3>
      {children}
    </section>
  );
}

export function CtaLink({ a, className = "btn primary big" }: { a: AgentePublico; className?: string }) {
  const m = useMarca();
  const cta = a.cta ?? { texto: m.contacto.cta_texto, url: m.contacto.cta_url };
  const externo = cta.url.startsWith("http");
  return (
    <a className={className} href={cta.url} {...(externo ? { target: "_blank", rel: "noreferrer" } : {})}>
      {cta.texto} →
    </a>
  );
}

/** El detalle completo de un agente. Lo usan la página pública y la vista previa del back. */
export function AgentDetailView({ a }: { a: AgentePublico }) {
  const m = useMarca();
  const tieneIA = a.modelos.length || a.tipo_agente || a.conocimiento.length || a.herramientas.length ||
    a.guardrails.length || a.evaluacion_observabilidad;
  return (
    <article className="detail" style={{ "--c": colorDe(m, a.familia) } as React.CSSProperties}>
      <header className="detail-hero">
        <div className="detail-meta">
          <FamiliaBadge a={a} />
          <MadurezBadge madurez={a.madurez} />
          <span className="time">
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            {a.tiempo_implementacion}
          </span>
          {a.es_ejemplo && <EjemploBadge />}
        </div>
        <h1>{a.nombre}</h1>
        <p className="lead">{a.tagline}</p>
        <GlitchSays text={a.glitch_dice} className="detail-glitch" />
      </header>

      <div className="grid-2">
        <Bloque titulo="El problema"><p>{a.problema}</p></Bloque>
        <Bloque titulo="Qué hace"><p>{a.que_hace}</p></Bloque>
      </div>

      <section className="section">
        <h2>Cómo funciona</h2>
        <ol className="steps">
          {a.pasos.map((p, i) => <li key={i}><span className="n">{i + 1}</span><span>{p}</span></li>)}
        </ol>
      </section>

      <section className="section">
        <h2>Beneficios</h2>
        <ul className="benefits">
          {a.beneficios.map((b, i) => (
            <li key={i}>
              <span className="check" aria-hidden="true">✓</span>
              <span>{b.texto}</span>
              <span className={`bt bt-${b.tipo}`} title={b.tipo === "medido" ? "Medido en un proyecto real" : "Estimación, no medido"}>
                {b.tipo === "medido" ? "Medido" : "Estimado"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {a.arquitectura && a.arquitectura.componentes.length > 0 && (
        <section className="section">
          <h2>Arquitectura</h2>
          <ArchDiagram arq={a.arquitectura} />
        </section>
      )}

      {tieneIA ? (
        <section className="section">
          <h2>La IA por dentro</h2>
          <div className="grid-3">
            {(a.modelos.length > 0 || a.tipo_agente) && (
              <Bloque titulo="Modelos y tipo de agente">
                {a.modelos.length > 0 && <Chips items={a.modelos} />}
                {a.tipo_agente && <p className="small">{a.tipo_agente === "varios" ? "Varios agentes que colaboran entre sí" : "Un solo agente"}</p>}
              </Bloque>
            )}
            {a.conocimiento.length > 0 && <Bloque titulo="Conocimiento"><ul className="dots">{a.conocimiento.map((x) => <li key={x}>{x}</li>)}</ul></Bloque>}
            {a.herramientas.length > 0 && <Bloque titulo="Herramientas"><ul className="dots">{a.herramientas.map((x) => <li key={x}>{x}</li>)}</ul></Bloque>}
            {a.guardrails.length > 0 && <Bloque titulo="Guardrails"><ul className="dots">{a.guardrails.map((x) => <li key={x}>{x}</li>)}</ul></Bloque>}
            {a.evaluacion_observabilidad && <Bloque titulo="Evaluación y observabilidad"><p>{a.evaluacion_observabilidad}</p></Bloque>}
          </div>
        </section>
      ) : null}

      <section className="section">
        <h2>Ficha técnica</h2>
        <div className="grid-3">
          <Bloque titulo="Plataforma"><p className="strong">{a.plataforma}</p></Bloque>
          {a.tecnologias.length > 0 && <Bloque titulo="Tecnologías"><Chips items={a.tecnologias} /></Bloque>}
          {a.integraciones.length > 0 && <Bloque titulo="Integraciones"><Chips items={a.integraciones} /></Bloque>}
          {a.para_quien.length > 0 && <Bloque titulo="Para quién"><Chips items={a.para_quien} /></Bloque>}
          {a.industrias.length > 0 && <Bloque titulo="Industrias"><Chips items={a.industrias} /></Bloque>}
          <Bloque titulo="Tiempo de implementación"><p className="strong">{a.tiempo_implementacion}</p></Bloque>
          {a.requisitos_licencias && <Bloque titulo="Requisitos y licencias" className="span-2"><p>{a.requisitos_licencias}</p></Bloque>}
          {a.seguridad_gobierno && <Bloque titulo="Seguridad y gobierno"><p>{a.seguridad_gobierno}</p></Bloque>}
        </div>
      </section>

      {a.imagenes.length > 0 && (
        <section className="section">
          <h2>Galería</h2>
          <Gallery imagenes={a.imagenes} />
        </section>
      )}

      <section className="cta-band">
        <div>
          <h2>¿Lo quieres para tu equipo?</h2>
          <p>{m.glitch.cierre}</p>
          <div className="cta-actions">
            <CtaLink a={a} />
            {a.demo_url && <a className="btn" href={a.demo_url} target="_blank" rel="noreferrer">Ver demo ↗</a>}
          </div>
        </div>
        <Qr url={urlPublica(a.slug)} />
      </section>
    </article>
  );
}
