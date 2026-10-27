"""Almacenamiento clave → bytes con control de concurrencia por ETag.

Las dos implementaciones (disco y Azure Blob) cumplen el mismo contrato:
- put(..., if_match=etag) falla con Conflict si alguien escribió antes.
- put(..., if_none_match=True) falla con Conflict si la clave ya existe.
"""
from __future__ import annotations

import re
from typing import Protocol

# Claves internas: nunca vienen del usuario sin pasar por aquí.
CLAVE_VALIDA = re.compile(r"^(agentes/[a-f0-9]{32}\.json|orden\.json|media/[a-f0-9]{32}(-thumb)?\.webp)$")


class Conflict(Exception):
    """La versión cambió (o ya existía) desde que se leyó."""


def check_key(key: str) -> str:
    if not CLAVE_VALIDA.match(key):
        raise ValueError(f"Clave inválida: {key!r}")
    return key


class Store(Protocol):
    def get(self, key: str) -> tuple[bytes, str] | None: ...
    def put(self, key: str, data: bytes, *, content_type: str, if_match: str | None = None,
            if_none_match: bool = False) -> str: ...
    def delete(self, key: str, *, if_match: str | None = None) -> bool: ...
    def list(self, prefix: str) -> list[str]: ...
