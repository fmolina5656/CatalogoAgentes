import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { AgentePublico } from "../lib/types";
import { filtrar, leerFiltros } from "../lib/filters";
import { colorDe, useMarca } from "../lib/marca";
import { useTitle } from "../lib/hooks";
import { GlitchSays } from "../components/Glitch";
import { Aurora } from "../components/Layout";
import { EjemploBadge, FamiliaBadge, MadurezBadge } from "../components/Badges";
import { ArchDiagram } from "../components/ArchDiagram";
import { Qr } from "../components/Qr";
import { urlPublica } from "../components/AgentDetail";

type Slide =
  | { k: "portada" }
  | { k: "intro"; a: AgentePublico }
  | { k: "arq"; a: AgentePublico; paso: number }
  | { k: "valor"; a: AgentePublico }
  | { k: "cierre" };

function armar(agentes: AgentePublico[]): Slide[] {
  const s: Slide[] = [{ k: "portada" }];
  for (const a of agentes) {
    s.push({ k: "intro", a });
    const arq = a.arquitectura;
    if (arq && arq.componentes.length) {
      s.push({ k: "arq", a, paso: -1 });
      arq.pasos.forEach((_, i) => s.push({ k: "arq", a, paso: i }));
    }
    s.push({ k: "valor", a });
  }
  s.push({ k: "cierre" });
  return s;
}

/** Modo presentación para TV o tablet: avanza solo con clic, flechas o control remoto. Nada pasa solo. */
export function Present({ agentes }: { agentes: AgentePublico[] }) {
  const m = useMarca();
  useTitle(`Presentación · ${m.nombre}`);
  const [params] = useSearchParams();
  const lista = useMemo(() => {
    const uno = params.get("agente");
    if (uno) return agentes.filter((a) => a.slug === uno);
    const r = filtrar(agentes, leerFiltros(params));
    return [...r.filter((a) => a.destacado), ...r.filter((a) => !a.destacado)];
  }, [agentes, params]);
  const slides = useMemo(() => armar(lista), [lista]);
  const [i, setI] = useState(0);
  const total = slides.length;
  const ir = useCallback((n: number) => setI((x) => Math.min(total - 1, Math.max(0, x + n))), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, select, textarea")) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter"].includes(e.key)) {
        if (e.key === "Enter" && e.target instanceof HTMLElement && e.target.closest("button, a, [role=button]")) return;
        e.preventDefault(); ir(1);
      } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault(); ir(-1);
      } else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(total - 1);
      else if (e.key.toLowerCase() === "f") pantallaCompleta();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ir, total]);

  const s = slides[Math.min(i, total - 1)];
  const color = "a" in s ? colorDe(m, s.a.familia) : undefined;

  return (
    <div className="present" onClick={(e) => {
      if ((e.target as HTMLElement).closest("button, a, [role=button], .node, dialog")) return;
      ir(1);
    }}>
      <Aurora color={color} />
      <div className="present-top">
        <img src={m.logo.oscuro} alt={m.logo.alt} height={24} />
        {"a" in s && <FamiliaBadge a={s.a} />}
      </div>
      <div className="stage" key={i} aria-live="polite">
        <SlideView s={s} n={lista.length} />
      </div>
      <nav className="present-nav" aria-label="Controles de la presentación">
        <button type="button" className="btn" onClick={() => ir(-1)} disabled={i === 0} aria-label="Anterior">←</button>
        <span className="mono">{i + 1} / {total}</span>
        <button type="button" className="btn" onClick={() => ir(1)} disabled={i === total - 1} aria-label="Siguiente">→</button>
        <span className="hint mono">Clic, <kbd>←</kbd> <kbd>→</kbd> o control remoto</span>
        <button type="button" className="btn ghost" onClick={pantallaCompleta}>Pantalla completa</button>
        <Link to="/" className="btn ghost">Salir</Link>
      </nav>
      <div className="present-progress" style={{ width: `${((i + 1) / total) * 100}%` }} />
    </div>
  );
}

function pantallaCompleta() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => undefined);
}

function SlideView({ s, n }: { s: Slide; n: number }) {
  const m = useMarca();
  switch (s.k) {
    case "portada":
      return (
        <div className="slide slide-portada">
          <p className="kicker">{m.organizacion}</p>
          <h1><span className="grad">{m.nombre}</span></h1>
          <p className="sub">{n} {n === 1 ? "agente" : "agentes"} · {m.familias.map((f) => f.nombre).join(" · ")}</p>
          <GlitchSays text={m.glitch.presentacion} size="clamp(110px, 16vh, 200px)" />
        </div>
      );
    case "intro":
      return (
        <div className="slide slide-intro">
          <div className="slide-head">
            <div className="detail-meta"><MadurezBadge madurez={s.a.madurez} /><span className="time">{s.a.tiempo_implementacion}</span>{s.a.es_ejemplo && <EjemploBadge />}</div>
            <h1>{s.a.nombre}</h1>
            <p className="lead">{s.a.tagline}</p>
          </div>
          <GlitchSays text={s.a.glitch_dice} size="clamp(90px, 13vh, 170px)" />
          <div className="grid-2">
            <section className="card"><h3 className="label">El problema</h3><p>{s.a.problema}</p></section>
            <section className="card"><h3 className="label">Qué hace</h3><p>{s.a.que_hace}</p></section>
          </div>
        </div>
      );
    case "arq":
      return (
        <div className="slide slide-arq">
          <h2>{s.a.nombre} <span className="muted">· cómo funciona</span></h2>
          <ArchDiagram arq={s.a.arquitectura!} paso={s.paso} onPaso={() => undefined} compacto />
          <div className="arch-step-text big" aria-live="polite">
            {s.paso < 0 ? <span className="muted">Las piezas de la solución. Avanza para recorrer el flujo.</span>
              : <><b>{s.paso + 1}/{s.a.arquitectura!.pasos.length}</b> {s.a.arquitectura!.pasos[s.paso].texto}</>}
          </div>
        </div>
      );
    case "valor":
      return (
        <div className="slide slide-valor">
          <h2>{s.a.nombre}</h2>
          <div className="valor-grid">
            <div>
              <h3 className="label">Beneficios</h3>
              <ul className="benefits">
                {s.a.beneficios.map((b, i) => (
                  <li key={i}><span className="check" aria-hidden="true">✓</span><span>{b.texto}</span>
                    <span className={`bt bt-${b.tipo}`}>{b.tipo === "medido" ? "Medido" : "Estimado"}</span></li>
                ))}
              </ul>
              <div className="valor-facts">
                <div><span className="label">Implementación</span><b>{s.a.tiempo_implementacion}</b></div>
                <div><span className="label">Plataforma</span><b>{s.a.plataforma}</b></div>
              </div>
              <div className="tags">{s.a.tecnologias.slice(0, 6).map((t) => <span key={t} className="tag">{t}</span>)}</div>
            </div>
            <Qr url={urlPublica(s.a.slug)} size={190} label="Escanéalo para ver la ficha completa" />
          </div>
        </div>
      );
    case "cierre":
      return (
        <div className="slide slide-portada">
          <h1><span className="grad">¿Platicamos?</span></h1>
          <GlitchSays text={m.glitch.cierre} size="clamp(110px, 16vh, 200px)" />
          <div className="valor-grid cierre">
            <div className="contacto">
              <p className="lead">{m.contacto.email}</p>
              <p className="muted">{m.contacto.url.replace(/^https?:\/\//, "")}</p>
            </div>
            <Qr url={`${window.location.origin}/`} size={160} label="El catálogo completo" />
          </div>
        </div>
      );
  }
}
