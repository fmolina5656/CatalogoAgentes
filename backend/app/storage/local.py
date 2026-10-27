"""Almacenamiento en disco para desarrollo local (sin Azure)."""
from __future__ import annotations

import hashlib
import os
import threading
from pathlib import Path

from .base import Conflict, check_key


def _etag(data: bytes) -> str:
    return '"' + hashlib.sha256(data).hexdigest()[:32] + '"'


class LocalStore:
    def __init__(self, root: Path):
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()

    def _path(self, key: str) -> Path:
        p = (self.root / check_key(key)).resolve()
        if self.root not in p.parents:
            raise ValueError("Ruta fuera del almacenamiento")
        return p

    def get(self, key):
        p = self._path(key)
        try:
            data = p.read_bytes()
        except FileNotFoundError:
            return None
        return data, _etag(data)

    def put(self, key, data, *, content_type, if_match=None, if_none_match=False):
        p = self._path(key)
        with self._lock:
            exists = p.exists()
            if if_none_match and exists:
                raise Conflict(key)
            if if_match is not None:
                if not exists or _etag(p.read_bytes()) != if_match:
                    raise Conflict(key)
            p.parent.mkdir(parents=True, exist_ok=True)
            tmp = p.with_suffix(p.suffix + ".tmp")
            tmp.write_bytes(data)
            os.replace(tmp, p)
        return _etag(data)

    def delete(self, key, *, if_match=None):
        p = self._path(key)
        with self._lock:
            if not p.exists():
                return False
            if if_match is not None and _etag(p.read_bytes()) != if_match:
                raise Conflict(key)
            p.unlink()
        return True

    def list(self, prefix):
        base = self.root / prefix
        if not base.is_dir():
            return []
        return sorted(f"{prefix}{f.name}" for f in base.iterdir() if f.is_file() and not f.name.endswith(".tmp"))
