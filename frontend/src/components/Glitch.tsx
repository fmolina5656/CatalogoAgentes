import { useEffect, useRef, useState } from "react";
import { useMarca } from "../lib/marca";
import { useReducedMotion } from "../lib/hooks";

/** Glitch flota y parpadea alternando dos imágenes (ojos abiertos / cerrados). */
export function Glitch({ talking = false, size }: { talking?: boolean; size?: string }) {
  const m = useMarca();
  const reduced = useReducedMotion();
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (reduced) return;
    let t: number;
    const loop = () => {
      t = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 140);
        loop();
      }, 2800 + Math.random() * 3200);
    };
    loop();
    return () => clearTimeout(t);
  }, [reduced]);
  return (
    <div className={`glitch${blink ? " blinking" : ""}${talking ? " talk" : ""}`} style={size ? { width: size } : undefined}>
      <img src={m.mascota.imagen} alt={m.mascota.alt} width={240} height={240} />
      <img className="blink" src={m.mascota.imagen_parpadeo} alt="" aria-hidden="true" width={240} height={240} />
    </div>
  );
}

/** Burbuja que se escribe sola, letra por letra; con clic (o Enter) se completa. */
export function Bubble({ text, speed = 24, onDone, who }: { text: string; speed?: number; onDone?: () => void; who?: string }) {
  const reduced = useReducedMotion();
  const [n, setN] = useState(reduced ? text.length : 0);
  const done = n >= text.length;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  useEffect(() => { setN(reduced ? text.length : 0); }, [text, reduced]);
  useEffect(() => {
    if (done) { doneRef.current?.(); return; }
    const ch = text[n];
    const pausa = ch === "." || ch === "?" || ch === "!" ? 260 : ch === "," ? 120 : speed;
    const t = window.setTimeout(() => setN((x) => x + 1), pausa);
    return () => clearTimeout(t);
  }, [n, done, text, speed]);
  const completar = (e: React.SyntheticEvent) => {
    if (!done) { e.stopPropagation(); setN(text.length); }
  };
  return (
    <div
      className="bubble"
      role="button"
      tabIndex={0}
      aria-label={done ? undefined : "Completar el texto de Glitch"}
      onClick={completar}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") completar(e); }}
    >
      {who && <span className="who">{who}</span>}
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.slice(0, n)}
        {!done && <span className="caret" />}
        <span className="ghost">{text.slice(n)}</span>
      </span>
    </div>
  );
}

export function GlitchSays({ text, size, className = "" }: { text: string; size?: string; className?: string }) {
  const m = useMarca();
  const [talking, setTalking] = useState(true);
  useEffect(() => setTalking(true), [text]);
  return (
    <div className={`glitch-row ${className}`}>
      <Glitch talking={talking} size={size} />
      <Bubble text={text} who={m.mascota.nombre} onDone={() => setTalking(false)} />
    </div>
  );
}
