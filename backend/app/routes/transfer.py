"""Exportar e importar todo el catálogo: catalogo.json + imagenes/ en un ZIP."""
from __future__ import annotations

import io
import json
import re
import zipfile
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, Response, UploadFile
from pydantic import TypeAdapter, ValidationError

from ..auth import exigir_admin
from ..images import ImagenInvalida, _abrir, miniatura_de
from ..schema import Agente

router = APIRouter(prefix="/api/admin")

FORMATO = "catalogo-agentes/v1"
ENTRADA_IMAGEN = re.compile(r"^imagenes/([a-f0-9]{32}(?:-thumb)?\.webp)$")
MAX_ENTRADAS = 2000
MAX_DESCOMPRIMIDO = 600 * 1024 * 1024


@router.get("/export")
def exportar(request: Request, _u=Depends(exigir_admin)):
    repo, store = request.app.state.repo, request.app.state.store
    agentes = [a for a, _ in repo.todos()]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        doc = {
            "formato": FORMATO,
            "exportado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "agentes": [a.model_dump(mode="json") for a in agentes],
        }
        z.writestr("catalogo.json", json.dumps(doc, ensure_ascii=False, indent=2))
        for nombre in sorted({i.archivo for a in agentes for i in a.imagenes}):
            for n in (nombre, miniatura_de(nombre)):
                r = store.get(f"media/{n}")
                if r:
                    z.writestr(f"imagenes/{n}", r[0], compress_type=zipfile.ZIP_STORED)
    fecha = datetime.now().strftime("%Y%m%d-%H%M")
    return Response(buf.getvalue(), media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="catalogo-{fecha}.zip"'})


@router.post("/import")
async def importar(request: Request, archivo: UploadFile = File(...),
                   modo: str = Query("combinar", pattern="^(combinar|reemplazar)$"), u=Depends(exigir_admin)):
    """Valida todo antes de escribir nada.

    combinar: agrega los nuevos y reemplaza los que tengan el mismo id.
    reemplazar: borra el catálogo actual y deja solo lo importado.
    """
    s, repo, store = request.app.state.settings, request.app.state.repo, request.app.state.store
    datos = await archivo.read(s.max_import_bytes + 1)
    if len(datos) > s.max_import_bytes:
        raise HTTPException(413, "El ZIP es demasiado grande")
    try:
        z = zipfile.ZipFile(io.BytesIO(datos))
    except zipfile.BadZipFile as e:
        raise HTTPException(400, "El archivo no es un ZIP válido") from e

    infos = z.infolist()
    if len(infos) > MAX_ENTRADAS or sum(i.file_size for i in infos) > MAX_DESCOMPRIMIDO:
        raise HTTPException(400, "El ZIP tiene demasiados archivos o pesa demasiado descomprimido")
    imagenes: dict[str, bytes] = {}
    catalogo = None
    for info in infos:
        if info.is_dir():
            continue
        if info.filename == "catalogo.json":
            catalogo = z.read(info)
            continue
        m = ENTRADA_IMAGEN.match(info.filename)
        if not m:
            raise HTTPException(400, f"Archivo no permitido en el ZIP: {info.filename[:120]}")
        contenido = z.read(info)
        try:
            img = _abrir(contenido)
        except ImagenInvalida as e:
            raise HTTPException(400, f"{info.filename}: {e}") from e
        if img.format != "WEBP":
            raise HTTPException(400, f"{info.filename}: debe ser WebP")
        imagenes[m.group(1)] = contenido
    if catalogo is None:
        raise HTTPException(400, "Falta catalogo.json en el ZIP")
    try:
        doc = json.loads(catalogo)
    except json.JSONDecodeError as e:
        raise HTTPException(400, "catalogo.json no es JSON válido") from e
    if not isinstance(doc, dict) or doc.get("formato") != FORMATO:
        raise HTTPException(400, f"catalogo.json debe tener formato '{FORMATO}'")

    try:
        agentes = TypeAdapter(list[Agente]).validate_python(doc.get("agentes", []), context={"marca": repo.marca})
    except ValidationError as e:
        raise HTTPException(422, json.loads(e.json(include_url=False, include_input=False))) from e

    # Coherencia: ids y slugs únicos, imágenes presentes.
    existentes = {a.id: a for a, _ in repo.todos()}
    finales = {} if modo == "reemplazar" else dict(existentes)
    for a in agentes:
        finales[a.id] = a
    slugs = [a.slug for a in finales.values()]
    if len(slugs) != len(set(slugs)):
        raise HTTPException(409, "Hay slugs repetidos entre el catálogo actual y el importado")
    if len({a.id for a in agentes}) != len(agentes):
        raise HTTPException(400, "Hay ids repetidos en catalogo.json")
    for a in agentes:
        for img in a.imagenes:
            if img.archivo not in imagenes and not store.get(f"media/{img.archivo}"):
                raise HTTPException(400, f"Falta la imagen {img.archivo} de '{a.slug}'")

    # Escritura.
    for nombre, contenido in imagenes.items():
        store.put(f"media/{nombre}", contenido, content_type="image/webp")
    for nombre in {i.archivo for a in agentes for i in a.imagenes}:
        mini = miniatura_de(nombre)
        if not store.get(f"media/{mini}") and nombre in imagenes:
            store.put(f"media/{mini}", imagenes[nombre], content_type="image/webp")
    if modo == "reemplazar":
        for viejo in existentes:
            if viejo not in finales:
                store.delete(f"agentes/{viejo}.json")
    for a in agentes:
        store.put(f"agentes/{a.id}.json", a.model_dump_json(indent=2).encode(), content_type="application/json")
    importados = sorted(agentes, key=lambda a: a.orden)
    if modo == "reemplazar":
        ids = [a.id for a in importados]
    else:
        actuales, _ = repo.orden()
        ids = actuales + [a.id for a in importados if a.id not in actuales]
    _, etag = repo.orden()
    repo._escribir_orden(ids, etag)
    repo.invalidar()
    return {"importados": len(agentes), "imagenes": len(imagenes), "modo": modo, "usuario": u["usuario"]}
