import { useEffect, useState } from "react";

export function useReducedMotion(): boolean {
  const q = "(prefers-reduced-motion: reduce)";
  const [v, setV] = useState(() => typeof matchMedia !== "undefined" && matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q);
    const on = () => setV(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return v;
}

export function useTitle(t: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = t;
    return () => { document.title = prev; };
  }, [t]);
}
