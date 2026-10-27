import type { Agente, AgentePublico, Marca } from "./types";

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(typeof detail === "string" ? detail : `Error ${status}`);
  }
}

async function req<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== "GET") headers.set("X-Requested-With", "catalogo");
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const r = await fetch(url, { ...init, headers, credentials: "same-origin" });
  if (r.status === 204) return undefined as T;
  const tipo = r.headers.get("content-type") ?? "";
  const data = tipo.includes("json") ? await r.json() : await r.text();
  if (!r.ok) throw new ApiError(r.status, data?.detail ?? data);
  return data as T;
}

export const api = {
  config: () => req<Marca>("/api/config"),
  agentes: () => req<{ agentes: AgentePublico[] }>("/api/agentes").then((r) => r.agentes),
  agente: (slug: string) => req<AgentePublico>(`/api/agentes/${encodeURIComponent(slug)}`),
};

export interface Sesion {
  autenticado: boolean;
  usuario: { usuario: string; nombre: string; modo: string } | null;
  modo: "pin" | "entra";
  pin_configurado: boolean;
  login_url: string | null;
  logout_url: string | null;
}

export type AgenteAdmin = Agente & { _version: string };
export interface ConVersion { agente: Agente; version: string }

export const admin = {
  sesion: () => req<Sesion>("/api/admin/sesion"),
  login: (pin: string) => req("/api/admin/login", { method: "POST", body: JSON.stringify({ pin }) }),
  logout: () => req("/api/admin/logout", { method: "POST" }),
  schema: () => req<object>("/api/admin/schema"),
  lista: () => req<{ agentes: AgenteAdmin[]; version_orden: string | null }>("/api/admin/agentes"),
  obtener: (id: string) => req<ConVersion>(`/api/admin/agentes/${id}`),
  crear: (data: unknown) => req<ConVersion>("/api/admin/agentes", { method: "POST", body: JSON.stringify(data) }),
  guardar: (id: string, data: unknown, version: string) =>
    req<ConVersion>(`/api/admin/agentes/${id}`, { method: "PUT", body: JSON.stringify(data), headers: { "If-Match": version } }),
  borrar: (id: string, version: string) =>
    req<void>(`/api/admin/agentes/${id}`, { method: "DELETE", headers: { "If-Match": version } }),
  duplicar: (id: string) => req<ConVersion>(`/api/admin/agentes/${id}/duplicar`, { method: "POST" }),
  orden: (ids: string[], version: string | null) =>
    req<{ ids: string[]; version: string }>("/api/admin/orden", { method: "POST", body: JSON.stringify({ ids, version }) }),
  subirImagen: (file: File) => {
    const fd = new FormData();
    fd.append("archivo", file);
    return req<{ archivo: string; miniatura: string; ancho: number; alto: number }>("/api/admin/imagenes", { method: "POST", body: fd });
  },
  importar: (file: File, modo: "combinar" | "reemplazar") => {
    const fd = new FormData();
    fd.append("archivo", file);
    return req<{ importados: number; imagenes: number }>(`/api/admin/import?modo=${modo}`, { method: "POST", body: fd });
  },
};

/** Convierte el `detail` de un 422 de FastAPI/Pydantic en mensajes por campo. */
export function erroresDe(e: unknown): { campo: string; msg: string }[] {
  if (!(e instanceof ApiError)) return [{ campo: "", msg: String(e) }];
  if (Array.isArray(e.detail)) {
    return e.detail.map((d: { loc?: (string | number)[]; msg?: string }) => ({
      campo: (d.loc ?? []).filter((x) => x !== "body").join("."),
      msg: (d.msg ?? "").replace(/^Value error, /, ""),
    }));
  }
  return [{ campo: "", msg: typeof e.detail === "string" ? e.detail : e.message }];
}
