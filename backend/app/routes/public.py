"""API público: solo lo publicado, sin datos del back."""
from __future__ import annotations

import unicodedata

from fastapi import APIRouter, HTTPException, Request, Response

from ..schema import ETIQUETAS_IMAGEN, MADUREZ, Agente, a_publico

router = APIRouter()


def normalizar(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower())
    return "".join(c for c in s if unicodedata.category(c) != "Mn")


def texto_busqueda(a: Agente) -> str:
    partes = [a.nombre, a.tagline, a.glitch_dice, a.problema, a.que_hace, a.plataforma, *a.pasos,
              *a.tecnologias, *a.integraciones, *a.industrias, *a.para_quien, *a.modelos,
              *a.herramientas, *a.conocimiento, *(b.texto for b in a.beneficios)]
    return normalizar(" ".join(partes))


def filtrar(agentes: list[Agente], familia=None, sub=None, plataforma=None, industria=None, madurez=None, q=None):
    out = []
    terminos = normalizar(q).split() if q else []
    for a in agentes:
        if familia and a.familia != familia:
            continue
        if sub and a.subfamilia != sub:
            continue
        if plataforma and a.plataforma != plataforma:
            continue
        if industria and normalizar(industria) not in {normalizar(i) for i in a.industrias}:
            continue
        if madurez and a.madurez != madurez:
            continue
        if terminos:
            t = texto_busqueda(a)
            if not all(x in t for x in terminos):
                continue
        out.append(a)
    return out


@router.get("/api/config")
def config(request: Request):
    marca = request.app.state.marca
    return {**marca, "etiquetas_imagen": ETIQUETAS_IMAGEN, "madurez": MADUREZ}


@router.get("/api/agentes")
def listar(request: Request, response: Response, familia: str | None = None, sub: str | None = None,
           plataforma: str | None = None, industria: str | None = None, madurez: str | None = None,
           q: str | None = None):
    response.headers["Cache-Control"] = "public, max-age=30"
    agentes = filtrar(request.app.state.repo.publicados(), familia, sub, plataforma, industria, madurez, q)
    return {"agentes": [a_publico(a) for a in agentes]}


@router.get("/api/agentes/{slug}")
def detalle(slug: str, request: Request, response: Response):
    for a in request.app.state.repo.publicados():
        if a.slug == slug:
            response.headers["Cache-Control"] = "public, max-age=30"
            return a_publico(a)
    raise HTTPException(404, "No encontramos ese agente")


@router.get("/media/{archivo}")
def media(archivo: str, request: Request):
    """Imágenes públicas: solo las de agentes publicados."""
    if archivo not in request.app.state.repo.imagenes_publicas():
        raise HTTPException(404, "Imagen no encontrada")
    r = request.app.state.store.get(f"media/{archivo}")
    if not r:
        raise HTTPException(404, "Imagen no encontrada")
    return Response(r[0], media_type="image/webp", headers={
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
    })
