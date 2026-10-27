from __future__ import annotations

import io
import json
from dataclasses import replace
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import ROOT, load_settings
from app.main import create_app

PIN = "1234-prueba"
H = {"X-Requested-With": "catalogo"}


def make_settings(tmp_path: Path, **kw):
    base = load_settings()
    return replace(base, data_dir=tmp_path / "data", storage="local", auth_mode=kw.pop("auth_mode", "pin"),
                   admin_pin=kw.pop("admin_pin", PIN), session_secret="secreto-de-prueba",
                   static_dir=tmp_path / "dist", cache_seconds=0, **kw)


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(make_settings(tmp_path)))


@pytest.fixture
def admin(client):
    r = client.post("/api/admin/login", json={"pin": PIN})
    assert r.status_code == 200
    client.headers.update(H)
    return client


@pytest.fixture
def seed() -> list[dict]:
    return json.loads((ROOT / "backend" / "seed" / "agentes.json").read_text(encoding="utf-8"))


def imagen(fmt="PNG", size=(40, 30), exif: bytes | None = None, mode="RGB") -> bytes:
    img = Image.new(mode, size, (102, 222, 127) if mode == "RGB" else None)
    buf = io.BytesIO()
    kw = {"exif": exif} if exif else {}
    img.save(buf, fmt, **kw)
    return buf.getvalue()


def agente_minimo(**kw) -> dict:
    d = {
        "slug": "agente-de-prueba",
        "nombre": "Agente de prueba",
        "familia": "copilot-studio",
        "tagline": "Una línea de valor.",
        "glitch_dice": "Hola, soy un agente de prueba.",
        "problema": "Un problema.",
        "que_hace": "Lo resuelve.",
        "pasos": ["Paso uno"],
        "beneficios": [{"texto": "Ahorra tiempo", "tipo": "estimado"}],
        "plataforma": "Copilot Studio",
        "tiempo_implementacion": "2 semanas",
        "madurez": "demo",
    }
    d.update(kw)
    return d
