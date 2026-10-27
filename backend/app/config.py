"""Configuración: variables de entorno + archivo de marca (catalogo.config.json)."""
from __future__ import annotations

import json
import os
import secrets
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _env_list(name: str) -> list[str]:
    return [x.strip().lower() for x in os.getenv(name, "").split(",") if x.strip()]


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    storage: str  # "local" | "blob"
    blob_account_url: str
    blob_container: str
    auth_mode: str  # "pin" | "entra"
    admin_pin: str
    session_secret: str
    allowed_domains: list[str] = field(default_factory=list)
    allowed_emails: list[str] = field(default_factory=list)
    catalog_config_path: Path = ROOT / "catalogo.config.json"
    static_dir: Path = ROOT / "frontend" / "dist"
    seed_dir: Path = ROOT / "backend" / "seed"
    seed_on_empty: bool = True
    cache_seconds: float = 30.0
    max_image_bytes: int = 8 * 1024 * 1024
    max_import_bytes: int = 300 * 1024 * 1024
    secure_cookies: bool = False


def load_settings() -> Settings:
    blob_url = os.getenv("AZURE_STORAGE_ACCOUNT_URL", "").strip()
    storage = os.getenv("STORAGE", "blob" if blob_url else "local").strip().lower()
    auth_mode = os.getenv("AUTH_MODE", "pin").strip().lower()
    if auth_mode not in ("pin", "entra"):
        raise RuntimeError("AUTH_MODE debe ser 'pin' o 'entra'")
    return Settings(
        data_dir=Path(os.getenv("DATA_DIR", ROOT / "data")).resolve(),
        storage=storage,
        blob_account_url=blob_url,
        blob_container=os.getenv("AZURE_STORAGE_CONTAINER", "catalogo"),
        auth_mode=auth_mode,
        admin_pin=os.getenv("ADMIN_PIN", ""),
        # Si no se define, cada arranque invalida las sesiones: aceptable para local.
        session_secret=os.getenv("SESSION_SECRET") or secrets.token_hex(32),
        allowed_domains=_env_list("ADMIN_ALLOWED_DOMAINS"),
        allowed_emails=_env_list("ADMIN_ALLOWED_EMAILS"),
        catalog_config_path=Path(os.getenv("CATALOG_CONFIG", ROOT / "catalogo.config.json")),
        static_dir=Path(os.getenv("STATIC_DIR", ROOT / "frontend" / "dist")),
        seed_dir=Path(os.getenv("SEED_DIR", ROOT / "backend" / "seed")),
        seed_on_empty=os.getenv("SEED_ON_EMPTY", "true").lower() in ("1", "true", "yes", "si", "sí"),
        cache_seconds=float(os.getenv("CACHE_SECONDS", "30")),
        secure_cookies=os.getenv("SECURE_COOKIES", "false").lower() in ("1", "true", "yes"),
    )


@lru_cache
def load_brand(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)
