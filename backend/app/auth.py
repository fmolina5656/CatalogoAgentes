"""Acceso al back.

- AUTH_MODE=entra (Azure): la autenticación integrada de Container Apps valida al usuario
  con Microsoft Entra ID y agrega el encabezado X-MS-CLIENT-PRINCIPAL. La plataforma
  descarta ese encabezado si viene del cliente, así que solo se le cree en este modo.
  Opcionalmente se limita por dominio o correo (ADMIN_ALLOWED_DOMAINS / ADMIN_ALLOWED_EMAILS).
- AUTH_MODE=pin (local): se entra con ADMIN_PIN y se recibe una cookie HttpOnly firmada.

Las peticiones que cambian algo exigen además el encabezado X-Requested-With: catalogo.
Un formulario de otro sitio no puede mandarlo sin pasar por CORS, que aquí no se habilita.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import threading
import time

from fastapi import HTTPException, Request

from .config import Settings

COOKIE = "catalogo_admin"
DURACION = 12 * 3600
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "catalogo"


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _unb64(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def firmar(payload: dict, secret: str) -> str:
    body = _b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = _b64(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{sig}"


def verificar(token: str, secret: str) -> dict | None:
    try:
        body, sig = token.split(".", 1)
        esperado = _b64(hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, esperado):
            return None
        payload = json.loads(_unb64(body))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:  # noqa: BLE001
        return None


class LimiteIntentos:
    """Bloquea una IP 5 minutos después de 5 PIN incorrectos."""

    def __init__(self, maximo: int = 5, ventana: float = 300):
        self.maximo, self.ventana = maximo, ventana
        self._fallos: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def bloqueado(self, ip: str) -> bool:
        with self._lock:
            ahora = time.time()
            f = [t for t in self._fallos.get(ip, []) if ahora - t < self.ventana]
            self._fallos[ip] = f
            return len(f) >= self.maximo

    def fallo(self, ip: str) -> None:
        with self._lock:
            self._fallos.setdefault(ip, []).append(time.time())

    def limpiar(self, ip: str) -> None:
        with self._lock:
            self._fallos.pop(ip, None)


def _principal_entra(request: Request) -> dict | None:
    raw = request.headers.get("x-ms-client-principal")
    if not raw:
        return None
    try:
        data = json.loads(base64.b64decode(raw))
    except Exception:  # noqa: BLE001
        return None
    claims = {c.get("typ"): c.get("val") for c in data.get("claims", [])}
    email = (
        claims.get("preferred_username")
        or claims.get("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress")
        or claims.get("email")
        or request.headers.get("x-ms-client-principal-name", "")
    )
    nombre = claims.get("name") or email
    return {"usuario": (email or "").lower(), "nombre": nombre, "modo": "entra"}


def _permitido(usuario: str, s: Settings) -> bool:
    if not s.allowed_domains and not s.allowed_emails:
        return True  # el registro de app es single-tenant: solo entran cuentas del tenant
    if usuario in s.allowed_emails:
        return True
    dominio = usuario.rsplit("@", 1)[-1] if "@" in usuario else ""
    return dominio in s.allowed_domains


def usuario_actual(request: Request, s: Settings) -> dict | None:
    if s.auth_mode == "entra":
        p = _principal_entra(request)
        if p and p["usuario"] and _permitido(p["usuario"], s):
            return p
        return None
    token = request.cookies.get(COOKIE)
    if not token or not s.admin_pin:
        return None
    payload = verificar(token, s.session_secret)
    if not payload:
        return None
    return {"usuario": payload["u"], "nombre": "Equipo (PIN local)", "modo": "pin"}


def exigir_admin(request: Request) -> dict:
    s: Settings = request.app.state.settings
    u = usuario_actual(request, s)
    if not u:
        raise HTTPException(401, "Necesitas iniciar sesión para entrar al back")
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        raise HTTPException(403, "Falta el encabezado X-Requested-With")
    return u
