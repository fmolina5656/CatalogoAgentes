import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Agente, AgenteEntrada, AgentePublico, Beneficio } from "../../lib/types";
import { admin, ApiError, erroresDe } from "../../lib/api";
import { useMarca } from "../../lib/marca";
import { useTitle } from "../../lib/hooks";
import { MediaBase } from "../../lib/media";
import { slugDe, validar, type Errores } from "../../lib/validate";
import { AgentCard } from "../../components/AgentCard";
import { AgentDetailView } from "../../components/AgentDetail";
import { ArchDiagram } from "../../components/ArchDiagram";
import { ListEditor, mover, RowTools, Select, Text } from "../../components/admin/fields";
import { ArqEditor } from "../../components/admin/ArqEditor";
import { ImagesEditor } from "../../components/admin/ImagesEditor";

const SISTEMA = ["id", "orden", "creado", "actualizado", "actualizado_por", "_version"];

export function vacio(): AgenteEntrada {
  return {
    slug: "", nombre: "", familia: "", subfamilia: null, tagline: "", glitch_dice: "", problema: "", que_hace: "",
    pasos: [""], para_quien: [], industrias: [], beneficios: [{ texto: "", tipo: "estimado" }], plataforma: "",
    tecnologias: [], integraciones: [], requisitos_licencias: "", seguridad_gobierno: "", modelos: [], tipo_agente: null,
    conocimiento: [], herramientas: [], guardrails: [], evaluacion_observabilidad: "", arquitectura: null,
    tiempo_implementacion: "", madurez: "demo", demo_url: null, imagenes: [], cta: null, estado: "borrador",
    destacado: false, es_ejemplo: false,
  };
}

function aEntrada(a: Agente): AgenteEntrada {
  const d = { ...a } as Record<string, unknown>;
  for (const k of SISTEMA) delete d[k];
  return d as unknown as AgenteEntrada;
}

/** Limpia lo opcional vacío antes de mandarlo al API. */
function paraEnviar(d: AgenteEntrada): AgenteEntrada {
  return {
    ...d,
    subfamilia: d.subfamilia || null,
    demo_url: d.demo_url?.trim() || null,
    cta: d.cta && (d.cta.texto.trim() || d.cta.url.trim()) ? d.cta : null,
    tipo_agente: d.tipo_agente || null,
  };
}

const SECCIONES: [string, string, string[]][] = [
  ["identificacion", "Identificación", ["slug", "nombre", "familia", "subfamilia", "tagline"]],
  ["narrativa", "Narrativa", ["glitch_dice", "problema", "que_hace", "pasos"]],
  ["publico", "Público y valor", ["para_quien", "industrias", "beneficios"]],
  ["tecnica", "Técnica", ["plataforma", "tecnologias", "integraciones", "requisitos_licencias", "seguridad_gobierno"]],
  ["ia", "IA (agentes de Foundry)", ["modelos", "tipo_agente", "conocimiento", "herramientas", "guardrails", "evaluacion_observabilidad"]],
  ["arquitectura", "Arquitectura", ["arquitectura"]],
  ["entrega", "Entrega", ["tiempo_implementacion", "madurez", "demo_url"]],
  ["imagenes", "Imágenes", ["imagenes"]],
  ["publicacion", "Publicación", ["cta", "estado", "destacado"]],
];

function Seccion({ id, titulo, errores, campos, children, abierta = true }: {
  id: string; titulo: string; errores: Errores; campos: string[]; children: React.ReactNode; abierta?: boolean;
}) {
  const n = Object.keys(errores).filter((k) => campos.some((c) => k === c || k.startsWith(c + "."))).length;
  return (
    <details className="form-section" id={`s-${id}`} open={abierta || n > 0}>
      <summary>
        <span>{titulo}</span>
        {n > 0 && <span className="err-count">{n} por corregir</span>}
      </summary>
      <div className="form-section-body">{children}</div>
    </details>
  );
}

export function EditPage() {
  const { id } = useParams();
  const nuevo = !id || id === "nuevo";
  const m = useMarca();
  const nav = useNavigate();
  const [d, setD] = useState<AgenteEntrada>(vacio);
  const [meta, setMeta] = useState<{ id: string; version: string; actualizado: string; actualizado_por: string } | null>(null);
  const [cargando, setCargando] = useState(!nuevo);
  const [intentado, setIntentado] = useState(false);
  const [servidor, setServidor] = useState<Errores>({});
  const [general, setGeneral] = useState<string>("");
  const [conflicto, setConflicto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState("");
  const [sucio, setSucio] = useState(false);
  const [vista, setVista] = useState<"tarjeta" | "detalle" | "arquitectura">("tarjeta");
  const slugTocado = useRef(!nuevo);
  useTitle(`${nuevo ? "Nuevo agente" : d.nombre || "Editar"} · Back`);

  const cargar = () => {
    if (nuevo) return;
    setCargando(true);
    admin.obtener(id!).then((r) => {
      setD(aEntrada(r.agente));
      setMeta({ id: r.agente.id, version: r.version, actualizado: r.agente.actualizado, actualizado_por: r.agente.actualizado_por });
      setSucio(false); setConflicto(false); setServidor({}); setGeneral("");
    }).catch((e) => setGeneral(erroresDe(e)[0].msg)).finally(() => setCargando(false));
  };
  useEffect(cargar, [id]);

  useEffect(() => {
    if (!sucio) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [sucio]);

  const errLocales = useMemo(() => validar(paraEnviar(d), m), [d, m]);
  const errores: Errores = intentado ? { ...servidor, ...errLocales } : servidor;
  const e = (k: string) => errores[k];

  const set = <K extends keyof AgenteEntrada>(k: K, v: AgenteEntrada[K]) => {
    setSucio(true); setAviso("");
    setServidor((s) => { const c = { ...s }; for (const x of Object.keys(c)) if (x === k || x.startsWith(`${String(k)}.`)) delete c[x]; return c; });
    setD((x) => {
      const n = { ...x, [k]: v };
      if (k === "nombre" && !slugTocado.current) n.slug = slugDe(String(v));
      if (k === "familia") {
        const fam = m.familias.find((f) => f.id === v);
        n.subfamilia = fam?.subfamilias.length ? (fam.subfamilias.some((s) => s.id === x.subfamilia) ? x.subfamilia : fam.subfamilias[0].id) : null;
      }
      return n;
    });
  };

  const guardar = async (estado: AgenteEntrada["estado"]) => {
    setIntentado(true);
    const datos = paraEnviar({ ...d, estado });
    const locales = validar(datos, m);
    if (Object.keys(locales).length) {
      setGeneral("Revisa los campos marcados antes de guardar.");
      requestAnimationFrame(() => document.querySelector(".has-error")?.scrollIntoView({ behavior: "smooth", block: "center" }));
      return;
    }
    setGuardando(true); setGeneral(""); setServidor({});
    try {
      const r = nuevo ? await admin.crear(datos) : await admin.guardar(meta!.id, datos, meta!.version);
      setD(aEntrada(r.agente));
      setMeta({ id: r.agente.id, version: r.version, actualizado: r.agente.actualizado, actualizado_por: r.agente.actualizado_por });
      setSucio(false); setIntentado(false);
      setAviso(estado === "publicado" ? "Guardado y publicado." : "Guardado como borrador.");
      if (nuevo) nav(`/admin/agentes/${r.agente.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && typeof err.detail === "string") setConflicto(true);
      const lista = erroresDe(err);
      const porCampo: Errores = {};
      const sueltos: string[] = [];
      for (const x of lista) {
        if (x.campo) porCampo[x.campo] = x.msg;
        else sueltos.push(x.msg);
      }
      setServidor(porCampo);
      setGeneral(sueltos.join(" ") || "El servidor rechazó algunos campos: revísalos.");
    } finally {
      setGuardando(false);
    }
  };

  const preview: AgentePublico = useMemo(() => ({
    ...paraEnviar(d),
    nombre: d.nombre || "Nombre del agente",
    tagline: d.tagline || "La línea de valor aparece aquí.",
    glitch_dice: d.glitch_dice || "Aquí va la frase con la que te presento.",
    familia: d.familia || m.familias[0].id,
    pasos: d.pasos.filter(Boolean).length ? d.pasos.filter(Boolean) : ["Primer paso"],
    beneficios: d.beneficios.filter((b) => b.texto).length ? d.beneficios.filter((b) => b.texto) : [{ texto: "Beneficio", tipo: "estimado" }],
    imagenes: d.imagenes.filter((i) => i.etiqueta),
    slug: d.slug || "vista-previa",
    id: meta?.id ?? "nuevo", orden: 0, creado: "", actualizado: "",
  }), [d, meta, m]);

  if (cargando) return <div className="wrap loading">Cargando…</div>;

  const famActual = m.familias.find((f) => f.id === d.familia);
  const esFoundry = d.subfamilia === "foundry" || d.plataforma === "Microsoft Foundry";
  const nErr = Object.keys(errores).length;

  return (
    <div className="editor wrap">
      <div className="editor-head">
        <div>
          <Link to="/admin" className="btn ghost small">← Agentes</Link>
          <h1>{nuevo ? "Nuevo agente" : d.nombre || "Editar agente"}</h1>
          {meta && <p className="muted small">Actualizado {new Date(meta.actualizado).toLocaleString("es-MX")} por {meta.actualizado_por || "—"}</p>}
        </div>
        <div className="editor-actions">
          <span className={`estado est-${d.estado}`}>{d.estado === "publicado" ? "Publicado" : "Borrador"}</span>
          {!nuevo && d.estado === "publicado" && <a className="btn small" href={`/agentes/${d.slug}`} target="_blank" rel="noreferrer">Ver publicado ↗</a>}
        </div>
      </div>

      {d.es_ejemplo && <p className="banner warn">Esta ficha es un <b>ejemplo</b>. Al guardarla desde aquí se da por validada y se quita el aviso "Ejemplo: validar con el equipo".</p>}
      {conflicto && (
        <div className="banner error" role="alert">
          Alguien más guardó cambios en esta ficha mientras la editabas. Para no pisarlos, recarga la versión actual y vuelve a aplicar tus cambios.
          <button type="button" className="btn small" onClick={cargar}>Recargar la versión actual</button>
        </div>
      )}

      <div className="editor-grid">
        <form className="editor-form" onSubmit={(ev) => { ev.preventDefault(); guardar(d.estado); }} noValidate>
          <nav className="section-nav" aria-label="Secciones del formulario">
            {SECCIONES.map(([sid, t]) => <a key={sid} href={`#s-${sid}`}>{t}</a>)}
          </nav>

          <Seccion id="identificacion" titulo="Identificación" errores={errores} campos={SECCIONES[0][2]}>
            <Text label="Nombre" req value={d.nombre} onChange={(v) => set("nombre", v)} error={e("nombre")} max={160} />
            <Text label="Slug (URL)" req value={d.slug} hint={`Se verá en /agentes/${d.slug || "mi-agente"}`} error={e("slug")} max={80}
              onChange={(v) => { slugTocado.current = true; set("slug", v.toLowerCase()); }} />
            <div className="row-2">
              <Select label="Familia" req value={d.familia} vacio="Elige…" error={e("familia")} onChange={(v) => set("familia", v)}
                options={m.familias.map((f) => ({ v: f.id, t: `${f.nombre} (${f.grupo})` }))} />
              {famActual && famActual.subfamilias.length > 0 && (
                <Select label="Subfamilia" req value={d.subfamilia ?? ""} error={e("subfamilia")} onChange={(v) => set("subfamilia", v)}
                  options={famActual.subfamilias.map((s) => ({ v: s.id, t: s.nombre }))} />
              )}
            </div>
            <Text label="Línea de valor (tagline)" req value={d.tagline} onChange={(v) => set("tagline", v)} error={e("tagline")} max={200}
              hint="Una frase: qué logra el agente." />
          </Seccion>

          <Seccion id="narrativa" titulo="Narrativa" errores={errores} campos={SECCIONES[1][2]}>
            <Text label="Glitch dice" req multiline value={d.glitch_dice} onChange={(v) => set("glitch_dice", v)} error={e("glitch_dice")} max={400}
              hint="Español de México, cercano y con algo de humor. Nunca de vendedor agresivo." />
            <Text label="El problema" req multiline value={d.problema} onChange={(v) => set("problema", v)} error={e("problema")} />
            <Text label="Qué hace" req multiline value={d.que_hace} onChange={(v) => set("que_hace", v)} error={e("que_hace")} />
            <ListEditor label="Cómo funciona (pasos)" req items={d.pasos} onChange={(v) => set("pasos", v)} errores={errores} campo="pasos" agregar="Paso" />
          </Seccion>

          <Seccion id="publico" titulo="Público y valor" errores={errores} campos={SECCIONES[2][2]}>
            <ListEditor label="Para quién (roles)" items={d.para_quien} onChange={(v) => set("para_quien", v)} errores={errores} campo="para_quien" agregar="Rol" />
            <ListEditor label="Industrias" items={d.industrias} onChange={(v) => set("industrias", v)} errores={errores} campo="industrias" agregar="Industria"
              hint="Usa siempre el mismo nombre (ej. Retail, Manufactura, Transversal) para que el filtro funcione." />
            <fieldset className={`list-editor${e("beneficios") ? " has-error" : ""}`}>
              <legend>Beneficios<span className="req" aria-hidden="true"> *</span></legend>
              <p className="hint">Honestidad: "Medido" solo si la cifra salió de un proyecto real. Si no, "Estimado".</p>
              <ol>
                {d.beneficios.map((b, i) => (
                  <li key={i} className={e(`beneficios.${i}.texto`) ? "has-error" : ""}>
                    <span className="num mono">{i + 1}</span>
                    <input type="text" value={b.texto} aria-label={`Beneficio ${i + 1}`}
                      onChange={(ev) => set("beneficios", d.beneficios.map((x, j) => (j === i ? { ...x, texto: ev.target.value } : x)))} />
                    <select value={b.tipo} aria-label={`Tipo del beneficio ${i + 1}`}
                      onChange={(ev) => set("beneficios", d.beneficios.map((x, j) => (j === i ? { ...x, tipo: ev.target.value as Beneficio["tipo"] } : x)))}>
                      <option value="estimado">Estimado</option>
                      <option value="medido">Medido</option>
                    </select>
                    <RowTools i={i} n={d.beneficios.length} nombre="beneficio" onMove={(dd) => set("beneficios", mover(d.beneficios, i, dd))}
                      onRemove={() => set("beneficios", d.beneficios.filter((_, j) => j !== i))} />
                    {e(`beneficios.${i}.texto`) && <p className="error">{e(`beneficios.${i}.texto`)}</p>}
                  </li>
                ))}
              </ol>
              <button type="button" className="btn small" onClick={() => set("beneficios", [...d.beneficios, { texto: "", tipo: "estimado" }])}>+ Beneficio</button>
              {e("beneficios") && <p className="error">{e("beneficios")}</p>}
            </fieldset>
          </Seccion>

          <Seccion id="tecnica" titulo="Técnica" errores={errores} campos={SECCIONES[3][2]}>
            <Select label="Plataforma" req value={d.plataforma} vacio="Elige…" error={e("plataforma")} onChange={(v) => set("plataforma", v)}
              options={m.plataformas.map((p) => ({ v: p, t: p }))} />
            <ListEditor label="Tecnologías" items={d.tecnologias} onChange={(v) => set("tecnologias", v)} errores={errores} campo="tecnologias" agregar="Tecnología" />
            <ListEditor label="Integraciones" items={d.integraciones} onChange={(v) => set("integraciones", v)} errores={errores} campo="integraciones" agregar="Integración" />
            <Text label="Requisitos y licencias" multiline value={d.requisitos_licencias} onChange={(v) => set("requisitos_licencias", v)} error={e("requisitos_licencias")} />
            <Text label="Seguridad y gobierno" multiline value={d.seguridad_gobierno} onChange={(v) => set("seguridad_gobierno", v)} error={e("seguridad_gobierno")} />
          </Seccion>

          <Seccion id="ia" titulo={esFoundry ? "IA (agentes de Foundry)" : "IA (opcional)"} errores={errores} campos={SECCIONES[4][2]} abierta={esFoundry}>
            <ListEditor label="Modelos" items={d.modelos} onChange={(v) => set("modelos", v)} errores={errores} campo="modelos" agregar="Modelo" />
            <Select label="Tipo de agente" value={d.tipo_agente ?? ""} vacio="Sin especificar" onChange={(v) => set("tipo_agente", (v || null) as AgenteEntrada["tipo_agente"])}
              options={[{ v: "uno", t: "Un solo agente" }, { v: "varios", t: "Varios agentes que colaboran" }]} />
            <ListEditor label="Conocimiento (fuentes y búsqueda)" items={d.conocimiento} onChange={(v) => set("conocimiento", v)} errores={errores} campo="conocimiento" agregar="Fuente" />
            <ListEditor label="Herramientas" items={d.herramientas} onChange={(v) => set("herramientas", v)} errores={errores} campo="herramientas" agregar="Herramienta" />
            <ListEditor label="Guardrails" items={d.guardrails} onChange={(v) => set("guardrails", v)} errores={errores} campo="guardrails" agregar="Guardrail" />
            <Text label="Evaluación y observabilidad" multiline value={d.evaluacion_observabilidad} onChange={(v) => set("evaluacion_observabilidad", v)} error={e("evaluacion_observabilidad")} />
          </Seccion>

          <Seccion id="arquitectura" titulo="Arquitectura" errores={errores} campos={SECCIONES[5][2]} abierta={!!d.arquitectura}>
            <ArqEditor arq={d.arquitectura} onChange={(v) => set("arquitectura", v)} errores={errores} />
          </Seccion>

          <Seccion id="entrega" titulo="Entrega" errores={errores} campos={SECCIONES[6][2]}>
            <div className="row-2">
              <Text label="Tiempo de implementación" req value={d.tiempo_implementacion} placeholder="ej. 10 semanas" onChange={(v) => set("tiempo_implementacion", v)} error={e("tiempo_implementacion")} />
              <Select label="Madurez" req value={d.madurez} error={e("madurez")} onChange={(v) => set("madurez", v as AgenteEntrada["madurez"])}
                options={Object.entries(m.madurez).map(([v, t]) => ({ v, t }))} />
            </div>
            <Text label="URL de la demo (opcional)" value={d.demo_url ?? ""} placeholder="https://…" onChange={(v) => set("demo_url", v)} error={e("demo_url")} />
          </Seccion>

          <Seccion id="imagenes" titulo="Imágenes" errores={errores} campos={SECCIONES[7][2]}>
            <ImagesEditor imagenes={d.imagenes} onChange={(v) => set("imagenes", v)} errores={errores} />
          </Seccion>

          <Seccion id="publicacion" titulo="Publicación" errores={errores} campos={SECCIONES[8][2]}>
            <div className="row-2">
              <Text label="Texto del botón de contacto" value={d.cta?.texto ?? ""} placeholder={m.contacto.cta_texto}
                onChange={(v) => set("cta", { texto: v, url: d.cta?.url ?? "" })} error={e("cta.texto")} />
              <Text label="Enlace del botón" value={d.cta?.url ?? ""} placeholder={m.contacto.cta_url}
                onChange={(v) => set("cta", { texto: d.cta?.texto ?? "", url: v })} error={e("cta.url") || e("cta")}
                hint="Si lo dejas vacío se usa el contacto general del catálogo." />
            </div>
            <label className="toggle">
              <input type="checkbox" checked={d.destacado} onChange={(ev) => set("destacado", ev.target.checked)} />
              <span>Destacado (aparece primero en el catálogo)</span>
            </label>
          </Seccion>

          <div className="save-bar">
            {general && <p className="error" role="alert">{general}{intentado && nErr > 0 ? ` (${nErr})` : ""}</p>}
            {aviso && <p className="ok" role="status">{aviso}</p>}
            <div className="save-actions">
              <button type="button" className="btn" disabled={guardando} onClick={() => guardar("borrador")}>
                {d.estado === "publicado" && !nuevo ? "Pasar a borrador" : "Guardar borrador"}
              </button>
              <button type="button" className="btn primary" disabled={guardando} onClick={() => guardar("publicado")}>
                {guardando ? "Guardando…" : d.estado === "publicado" && !nuevo ? "Guardar cambios" : "Publicar"}
              </button>
            </div>
          </div>
        </form>

        <aside className="editor-preview" aria-label="Vista previa">
          <div className="preview-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={vista === "tarjeta"} className={vista === "tarjeta" ? "on" : ""} onClick={() => setVista("tarjeta")}>Tarjeta</button>
            <button type="button" role="tab" aria-selected={vista === "detalle"} className={vista === "detalle" ? "on" : ""} onClick={() => setVista("detalle")}>Detalle</button>
            <button type="button" role="tab" aria-selected={vista === "arquitectura"} className={vista === "arquitectura" ? "on" : ""} onClick={() => setVista("arquitectura")}>Arquitectura</button>
          </div>
          <p className="hint">Así se verá publicado.</p>
          <MediaBase.Provider value="/api/admin/media/">
            <div className={`preview-frame ${vista}`}>
              {vista === "tarjeta" && <div className="preview-card"><AgentCard a={preview} link={false} /></div>}
              {vista === "detalle" && <AgentDetailView a={preview} />}
              {vista === "arquitectura" && (d.arquitectura?.componentes.length
                ? <ArchDiagram arq={d.arquitectura} />
                : <p className="hint">Esta ficha todavía no tiene arquitectura. Agrégala en la sección "Arquitectura".</p>)}
            </div>
          </MediaBase.Provider>
        </aside>
      </div>
    </div>
  );
}
