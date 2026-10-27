"""Lógica del catálogo sobre el almacenamiento: agentes, orden, imágenes y caché pública."""
from __future__ import annotations

import json
import threading
import time
import uuid
from datetime import datetime, timezone

from pydantic import ValidationError

from .images import miniatura_de
from .schema import Agente, AgenteEntrada
from .storage import Conflict, Store

ORDEN = "orden.json"


def ahora() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def _clave(agente_id: str) -> str:
    return f"agentes/{agente_id}.json"


class SlugDuplicado(ValueError):
    pass


class NoEncontrado(LookupError):
    pass


class Repo:
    def __init__(self, store: Store, marca: dict, cache_seconds: float = 30.0):
        self.store = store
        self.marca = marca
        self.cache_seconds = cache_seconds
        self._cache: tuple[float, list[Agente]] | None = None
        self._lock = threading.Lock()

    # ---------- lectura ----------
    def _leer(self, agente_id: str) -> tuple[Agente, str] | None:
        r = self.store.get(_clave(agente_id))
        if not r:
            return None
        data, etag = r
        return Agente.model_validate_json(data), etag

    def orden(self) -> tuple[list[str], str | None]:
        r = self.store.get(ORDEN)
        if not r:
            return [], None
        return json.loads(r[0]), r[1]

    def todos(self) -> list[tuple[Agente, str]]:
        """Todos los agentes (con su ETag), en el orden del catálogo."""
        items = []
        for key in self.store.list("agentes/"):
            r = self.store.get(key)
            if r:
                items.append((Agente.model_validate_json(r[0]), r[1]))
        ids, _ = self.orden()
        pos = {i: n for n, i in enumerate(ids)}
        items.sort(key=lambda t: (pos.get(t[0].id, len(pos)), t[0].creado))
        for n, (a, _) in enumerate(items):
            a.orden = n
        return items

    def obtener(self, agente_id: str) -> tuple[Agente, str]:
        r = self._leer(agente_id) if len(agente_id) == 32 else None
        if not r:
            raise NoEncontrado(agente_id)
        ids, _ = self.orden()
        r[0].orden = ids.index(agente_id) if agente_id in ids else len(ids)
        return r

    def publicados(self) -> list[Agente]:
        """Solo lo publicado, con caché corta en memoria."""
        with self._lock:
            if self._cache and time.monotonic() - self._cache[0] < self.cache_seconds:
                return self._cache[1]
        lista = [a for a, _ in self.todos() if a.estado == "publicado"]
        with self._lock:
            self._cache = (time.monotonic(), lista)
        return lista

    def invalidar(self) -> None:
        with self._lock:
            self._cache = None

    def imagenes_publicas(self) -> set[str]:
        nombres: set[str] = set()
        for a in self.publicados():
            for img in a.imagenes:
                nombres.update((img.archivo, miniatura_de(img.archivo)))
        return nombres

    # ---------- escritura ----------
    def _validar(self, data: dict) -> AgenteEntrada:
        return AgenteEntrada.model_validate(data, context={"marca": self.marca})

    def _slug_libre(self, slug: str, excepto: str | None = None) -> None:
        for a, _ in self.todos():
            if a.slug == slug and a.id != excepto:
                raise SlugDuplicado(slug)

    def _imagenes_existen(self, entrada: AgenteEntrada) -> None:
        faltan = [i.archivo for i in entrada.imagenes if not self.store.get(f"media/{i.archivo}")]
        if faltan:
            raise ValueError(f"Imágenes que no existen en el servidor: {', '.join(faltan)}")

    def crear(self, data: dict, usuario: str, *, conservar_ejemplo: bool = False) -> tuple[Agente, str]:
        entrada = self._validar(data)
        self._slug_libre(entrada.slug)
        self._imagenes_existen(entrada)
        t = ahora()
        campos = entrada.model_dump()
        if not conservar_ejemplo:
            campos["es_ejemplo"] = False
        agente = Agente(**campos, id=uuid.uuid4().hex, creado=t, actualizado=t, actualizado_por=usuario)
        etag = self.store.put(_clave(agente.id), agente.model_dump_json(indent=2).encode(),
                              content_type="application/json", if_none_match=True)
        self._agregar_al_orden(agente.id)
        self.invalidar()
        return self.obtener(agente.id)[0], etag

    def actualizar(self, agente_id: str, data: dict, if_match: str, usuario: str) -> tuple[Agente, str]:
        actual, _ = self.obtener(agente_id)
        entrada = self._validar(data)
        self._slug_libre(entrada.slug, excepto=agente_id)
        self._imagenes_existen(entrada)
        campos = entrada.model_dump()
        # Cualquier edición desde el back cuenta como "validado con el equipo".
        campos["es_ejemplo"] = False
        agente = Agente(**campos, id=agente_id, creado=actual.creado, actualizado=ahora(), actualizado_por=usuario)
        etag = self.store.put(_clave(agente_id), agente.model_dump_json(indent=2).encode(),
                              content_type="application/json", if_match=if_match)
        self.invalidar()
        return self.obtener(agente_id)[0], etag

    def borrar(self, agente_id: str, if_match: str) -> None:
        actual, _ = self.obtener(agente_id)
        if not self.store.delete(_clave(agente_id), if_match=if_match):
            raise NoEncontrado(agente_id)
        self._quitar_del_orden(agente_id)
        en_uso = {i.archivo for a, _ in self.todos() for i in a.imagenes}
        for img in actual.imagenes:
            if img.archivo not in en_uso:
                self.store.delete(f"media/{img.archivo}")
                self.store.delete(f"media/{miniatura_de(img.archivo)}")
        self.invalidar()

    def duplicar(self, agente_id: str, usuario: str) -> tuple[Agente, str]:
        actual, _ = self.obtener(agente_id)
        slugs = {a.slug for a, _ in self.todos()}
        base = f"{actual.slug}-copia"[:72]
        slug, n = base, 2
        while slug in slugs:
            slug, n = f"{base}-{n}", n + 1
        data = actual.model_dump(include=set(AgenteEntrada.model_fields))
        data.update(slug=slug, nombre=f"{actual.nombre} (copia)"[:160], estado="borrador", destacado=False)
        return self.crear(data, usuario, conservar_ejemplo=True)

    def reordenar(self, ids: list[str], if_match: str | None) -> tuple[list[str], str]:
        existentes = {a.id for a, _ in self.todos()}
        if set(ids) != existentes or len(ids) != len(existentes):
            raise ValueError("La lista debe tener todos los agentes, una vez cada uno")
        _, etag_actual = self.orden()
        if etag_actual is not None and if_match != etag_actual:
            raise Conflict(ORDEN)
        etag = self._escribir_orden(ids, etag_actual)
        self.invalidar()
        return ids, etag

    def _escribir_orden(self, ids: list[str], if_match: str | None) -> str:
        data = json.dumps(ids).encode()
        if if_match is None:
            return self.store.put(ORDEN, data, content_type="application/json", if_none_match=True)
        return self.store.put(ORDEN, data, content_type="application/json", if_match=if_match)

    def _agregar_al_orden(self, agente_id: str) -> None:
        for _ in range(5):
            ids, etag = self.orden()
            if agente_id in ids:
                return
            try:
                self._escribir_orden(ids + [agente_id], etag)
                return
            except Conflict:
                continue
        raise Conflict(ORDEN)

    def _quitar_del_orden(self, agente_id: str) -> None:
        for _ in range(5):
            ids, etag = self.orden()
            if agente_id not in ids:
                return
            try:
                self._escribir_orden([i for i in ids if i != agente_id], etag)
                return
            except Conflict:
                continue

    # ---------- semilla ----------
    def sembrar_si_vacio(self, archivo) -> int:
        if self.store.list("agentes/"):
            return 0
        # Crear orden.json funciona como candado: si otra réplica ya está sembrando, esta no lo hace.
        try:
            self.store.put(ORDEN, b"[]", content_type="application/json", if_none_match=True)
        except Conflict:
            return 0
        datos = json.loads(archivo.read_text(encoding="utf-8"))
        n = 0
        for d in datos:
            try:
                self.crear(d, "semilla", conservar_ejemplo=True)
                n += 1
            except (ValidationError, ValueError) as e:
                raise RuntimeError(f"Semilla inválida en '{d.get('slug')}': {e}") from e
        return n
