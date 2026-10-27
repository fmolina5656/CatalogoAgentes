// Espejo en TypeScript del esquema único (backend/app/schema.py).
// Si cambias el esquema, actualiza también este archivo.

export type Madurez = "demo" | "piloto" | "produccion";
export type Estado = "borrador" | "publicado";
export type EtiquetaImagen = "real" | "anonimizada" | "ia" | "diagrama";
export type TipoComponente = "entrada" | "ia" | "codigo" | "datos" | "salida" | "persona" | "seguridad";

export interface Beneficio { texto: string; tipo: "medido" | "estimado" }
export interface Imagen { archivo: string; alt: string; etiqueta: EtiquetaImagen }
export interface Componente { id: string; nombre: string; tipo: TipoComponente; detalle: string }
export interface PasoArquitectura { texto: string; componentes: string[] }
export interface Arquitectura {
  componentes: Componente[];
  conexiones: [string, string][];
  pasos: PasoArquitectura[];
}
export interface CTA { texto: string; url: string }

export interface AgenteEntrada {
  slug: string;
  nombre: string;
  familia: string;
  subfamilia: string | null;
  tagline: string;
  glitch_dice: string;
  problema: string;
  que_hace: string;
  pasos: string[];
  para_quien: string[];
  industrias: string[];
  beneficios: Beneficio[];
  plataforma: string;
  tecnologias: string[];
  integraciones: string[];
  requisitos_licencias: string;
  seguridad_gobierno: string;
  modelos: string[];
  tipo_agente: "uno" | "varios" | null;
  conocimiento: string[];
  herramientas: string[];
  guardrails: string[];
  evaluacion_observabilidad: string;
  arquitectura: Arquitectura | null;
  tiempo_implementacion: string;
  madurez: Madurez;
  demo_url: string | null;
  imagenes: Imagen[];
  cta: CTA | null;
  estado: Estado;
  destacado: boolean;
  es_ejemplo: boolean;
}

/** Lo que devuelve el API público (sin estado ni actualizado_por). */
export type AgentePublico = Omit<AgenteEntrada, "estado"> & {
  id: string;
  orden: number;
  creado: string;
  actualizado: string;
};

export interface Agente extends AgenteEntrada {
  id: string;
  orden: number;
  creado: string;
  actualizado: string;
  actualizado_por: string;
}

export interface Subfamilia { id: string; nombre: string; etiqueta: string; descripcion: string }
export interface Familia {
  id: string;
  nombre: string;
  grupo: string;
  color: string;
  descripcion: string;
  subfamilias: Subfamilia[];
}

export interface Marca {
  nombre: string;
  organizacion: string;
  descripcion: string;
  idioma: string;
  logo: { oscuro: string; claro: string; alt: string };
  favicon: string;
  mascota: { nombre: string; imagen: string; imagen_parpadeo: string; alt: string };
  paleta: Record<string, string>;
  glitch: { portada: string[]; sin_resultados: string; presentacion: string; cierre: string };
  familias: Familia[];
  plataformas: string[];
  contacto: { email: string; url: string; cta_texto: string; cta_url: string };
  etiquetas_imagen: Record<EtiquetaImagen, string>;
  madurez: Record<Madurez, string>;
}
