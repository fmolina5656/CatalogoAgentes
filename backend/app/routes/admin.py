"""API del back. Todo exige sesión (ver auth.py)."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, Response, UploadFile
from pydantic import BaseModel

from ..auth import COOKIE, DURACION, cuenta_rechazada, exigir_admin, firmar, usuario_actual
from ..images import ImagenInvalida, procesar
from ..schema import AgenteEntrada

import hmac
import time

router = APIRouter(prefix="/api/admin")
publico = APIRouter(prefix="/api/admin")

ARCHIVO = re.compile(r"^[a-f0-9]{32}(-thumb)?\.webp$")
TIPOS_IMAGEN = {"image/jpeg", "image/png", "image/webp"}


def _con_version(agente, etag: str, response: Response) -> dict:
    response.headers["ETag"] = etag
    return {"agente": agente.model_dump(mode="json"), "version": etag}


def _if_match(if_match: str | None) -> str:
    if not if_match:
        raise HTTPException(428, "Falta If-Match con la versión que editaste")
    return if_match


# ---------- sesión (sin exigir login) ----------
class Login(BaseModel):
    pin: str


@publico.get("/sesion")
def sesion(request: Request):
    s = request.app.state.settings
    u = usuario_actual(request, s)
    if s.auth_mode == "entra":
        urls = {"login_url": "/.auth/login/aad?post_login_redirect_uri=/admin",
                "logout_url": "/.auth/logout?post_logout_redirect_uri=/"}
    else:
        urls = {"login_url": None, "logout_url": None}
    return {"autenticado": bool(u), "usuario": u, "modo": s.auth_mode,
            "pin_configurado": bool(s.admin_pin), "rechazado": None if u else cuenta_rechazada(request, s),
            **urls}


@publico.post("/login")
def login(body: Login, request: Request, response: Response):
    s = request.app.state.settings
    if s.auth_mode != "pin":
        raise HTTPException(404, "El acceso con PIN está apagado; entra con tu cuenta de Microsoft")
    if not s.admin_pin:
        raise HTTPException(503, "Define ADMIN_PIN para entrar al back en local")
    ip = request.client.host if request.client else "?"
    limite = request.app.state.limite
    if limite.bloqueado(ip):
        raise HTTPException(429, "Demasiados intentos. Espera unos minutos.")
    if not hmac.compare_digest(body.pin.encode(), s.admin_pin.encode()):
        limite.fallo(ip)
        raise HTTPException(401, "PIN incorrecto")
    limite.limpiar(ip)
    token = firmar({"u": "admin-local", "exp": int(time.time()) + DURACION}, s.session_secret)
    response.set_cookie(COOKIE, token, max_age=DURACION, httponly=True, samesite="strict",
                        secure=s.secure_cookies, path="/")
    return {"ok": True}


@publico.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}


# ---------- agentes ----------
@router.get("/schema")
def schema(_u=Depends(exigir_admin)):
    return AgenteEntrada.model_json_schema()


@router.get("/agentes")
def listar(request: Request, _u=Depends(exigir_admin)):
    repo = request.app.state.repo
    items = repo.todos()
    _, version_orden = repo.orden()
    return {"agentes": [{**a.model_dump(mode="json"), "_version": etag} for a, etag in items],
            "version_orden": version_orden}


@router.post("/agentes", status_code=201)
def crear(body: dict, request: Request, response: Response, u=Depends(exigir_admin)):
    agente, etag = request.app.state.repo.crear(body, u["usuario"])
    return _con_version(agente, etag, response)


@router.get("/agentes/{agente_id}")
def obtener(agente_id: str, request: Request, response: Response, _u=Depends(exigir_admin)):
    agente, etag = request.app.state.repo.obtener(agente_id)
    return _con_version(agente, etag, response)


@router.put("/agentes/{agente_id}")
def actualizar(agente_id: str, body: dict, request: Request, response: Response,
               if_match: str | None = Header(None), u=Depends(exigir_admin)):
    agente, etag = request.app.state.repo.actualizar(agente_id, body, _if_match(if_match), u["usuario"])
    return _con_version(agente, etag, response)


@router.delete("/agentes/{agente_id}", status_code=204)
def borrar(agente_id: str, request: Request, if_match: str | None = Header(None), _u=Depends(exigir_admin)):
    request.app.state.repo.borrar(agente_id, _if_match(if_match))
    return Response(status_code=204)


@router.post("/agentes/{agente_id}/duplicar", status_code=201)
def duplicar(agente_id: str, request: Request, response: Response, u=Depends(exigir_admin)):
    agente, etag = request.app.state.repo.duplicar(agente_id, u["usuario"])
    return _con_version(agente, etag, response)


class Orden(BaseModel):
    ids: list[str]
    version: str | None = None


@router.post("/orden")
def reordenar(body: Orden, request: Request, _u=Depends(exigir_admin)):
    ids, etag = request.app.state.repo.reordenar(body.ids, body.version)
    return {"ids": ids, "version": etag}


# ---------- imágenes ----------
@router.post("/imagenes", status_code=201)
async def subir_imagen(request: Request, archivo: UploadFile = File(...), _u=Depends(exigir_admin)):
    s = request.app.state.settings
    if archivo.content_type not in TIPOS_IMAGEN:
        raise HTTPException(415, "Solo se aceptan imágenes JPG, PNG o WebP")
    datos = await archivo.read(s.max_image_bytes + 1)
    if len(datos) > s.max_image_bytes:
        raise HTTPException(413, "La imagen pesa más de 8 MB")
    try:
        img = procesar(datos, s.max_image_bytes)
    except ImagenInvalida as e:
        raise HTTPException(415, str(e)) from e
    store = request.app.state.store
    store.put(f"media/{img.nombre}", img.datos, content_type="image/webp", if_none_match=True)
    store.put(f"media/{img.nombre_miniatura}", img.miniatura, content_type="image/webp", if_none_match=True)
    return {"archivo": img.nombre, "miniatura": img.nombre_miniatura, "ancho": img.ancho, "alto": img.alto}


@router.get("/media/{archivo}")
def media(archivo: str, request: Request, _u=Depends(exigir_admin)):
    if not ARCHIVO.match(archivo):
        raise HTTPException(404, "Imagen no encontrada")
    r = request.app.state.store.get(f"media/{archivo}")
    if not r:
        raise HTTPException(404, "Imagen no encontrada")
    return Response(r[0], media_type="image/webp",
                    headers={"Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"})
