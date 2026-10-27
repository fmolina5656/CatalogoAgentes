"""Aplicación FastAPI: API + archivos de la SPA en el mismo contenedor."""
from __future__ import annotations

import json
import logging
import os

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from pydantic import ValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from .auth import LimiteIntentos
from .config import Settings, load_brand, load_settings
from .repo import NoEncontrado, Repo, SlugDuplicado
from .routes import admin, public, transfer
from .storage import Conflict, make_store

log = logging.getLogger("catalogo")

CSP = (
    "default-src 'self'; img-src 'self' data: blob:; "
    "style-src 'self' 'unsafe-inline' https://api.fontshare.com; "
    "font-src 'self' https://api.fontshare.com https://cdn.fontshare.com; "
    "script-src 'self'; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
)


def _telemetria() -> None:
    if os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING"):
        try:
            from azure.monitor.opentelemetry import configure_azure_monitor

            configure_azure_monitor(logger_name="catalogo")
        except Exception:  # noqa: BLE001 — la telemetría nunca debe tumbar la app
            log.exception("No se pudo configurar Application Insights")


def create_app(settings: Settings | None = None) -> FastAPI:
    s = settings or load_settings()
    _telemetria()
    app = FastAPI(title="Catálogo de agentes", docs_url="/api/docs" if s.auth_mode == "pin" else None,
                  redoc_url=None, openapi_url="/api/openapi.json" if s.auth_mode == "pin" else None)
    marca = load_brand(str(s.catalog_config_path))
    store = make_store(s)
    repo = Repo(store, marca, s.cache_seconds)
    app.state.settings, app.state.marca, app.state.store, app.state.repo = s, marca, store, repo
    app.state.limite = LimiteIntentos()

    if s.seed_on_empty:
        n = repo.sembrar_si_vacio(s.seed_dir / "agentes.json")
        if n:
            log.warning("Catálogo vacío: se cargaron %s agentes de la semilla", n)

    # ---------- errores con mensajes claros ----------
    @app.exception_handler(ValidationError)
    async def _validacion(_req: Request, exc: ValidationError):
        return JSONResponse({"detail": json.loads(exc.json(include_url=False, include_input=False))}, 422)

    @app.exception_handler(Conflict)
    async def _conflicto(_req: Request, _exc: Conflict):
        return JSONResponse({"detail": "Alguien más guardó cambios antes que tú. Recarga para ver la versión actual."}, 409)

    @app.exception_handler(SlugDuplicado)
    async def _slug(_req: Request, exc: SlugDuplicado):
        return JSONResponse({"detail": [{"loc": ["slug"], "msg": f"Ya existe un agente con el slug '{exc}'",
                                         "type": "slug_duplicado"}]}, 422)

    @app.exception_handler(NoEncontrado)
    async def _no_encontrado(_req: Request, _exc: NoEncontrado):
        return JSONResponse({"detail": "No encontramos ese agente"}, 404)

    @app.exception_handler(ValueError)
    async def _valor(_req: Request, exc: ValueError):
        return JSONResponse({"detail": str(exc)}, 400)

    # ---------- límites y encabezados ----------
    @app.middleware("http")
    async def _limites(request: Request, call_next):
        largo = request.headers.get("content-length")
        if largo and largo.isdigit():
            tope = s.max_import_bytes + 1024 * 1024 if request.url.path == "/api/admin/import" \
                else s.max_image_bytes + 1024 * 1024
            if int(largo) > tope:
                return JSONResponse({"detail": "El archivo es demasiado grande"}, 413)
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if not request.url.path.startswith("/api/docs"):  # Swagger (solo en local) usa una CDN
            response.headers.setdefault("Content-Security-Policy", CSP)
        if request.url.path.startswith("/api/admin"):
            response.headers["Cache-Control"] = "no-store"
        return response

    app.include_router(public.router)
    app.include_router(admin.publico)
    app.include_router(admin.router)
    app.include_router(transfer.router)

    @app.get("/api/salud")
    def salud():
        return {"ok": True}

    # ---------- SPA ----------
    dist = s.static_dir.resolve()
    index = dist / "index.html"

    @app.api_route("/{ruta:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def spa(ruta: str):
        if ruta.startswith(("api/", "media/")):
            raise StarletteHTTPException(404)
        if ruta:
            archivo = (dist / ruta).resolve()
            if dist in archivo.parents and archivo.is_file():
                cache = "public, max-age=31536000, immutable" if ruta.startswith("assets/") else "public, max-age=3600"
                return FileResponse(archivo, headers={"Cache-Control": cache})
        if not index.is_file():
            return JSONResponse({"detail": "El front no está compilado. Corre `npm run build` o usa `npm run dev`."}, 404)
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    return app

