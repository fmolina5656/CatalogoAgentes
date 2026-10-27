import { createContext, useContext } from "react";

/** Lo público sirve desde /media/; el back previsualiza borradores desde /api/admin/media/. */
export const MediaBase = createContext("/media/");

export function useMediaUrl() {
  const base = useContext(MediaBase);
  return (archivo: string, mini = false) => base + (mini ? archivo.replace(/\.webp$/, "-thumb.webp") : archivo);
}
