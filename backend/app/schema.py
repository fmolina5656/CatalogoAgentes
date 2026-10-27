"""Esquema único de la ficha de un agente.

Es la fuente de verdad: el API valida con estos modelos, el front valida con el
JSON Schema que se exporta de aquí (GET /api/admin/schema) y el README los documenta.

Las familias, subfamilias y plataformas válidas salen del archivo de marca
(catalogo.config.json) y se validan pasando `context={"marca": ...}`.
"""
from __future__ import annotations

import re
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationInfo, field_validator, model_validator

Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
TextoCorto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
Item = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
Slug = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", max_length=80)]
IdComponente = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[a-z0-9][a-z0-9-]{0,39}$")]
# Nombre de archivo generado por el servidor: 32 hex + .webp. Nada más es válido.
ArchivoImagen = Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{32}\.webp$")]

Madurez = Literal["demo", "piloto", "produccion"]
Estado = Literal["borrador", "publicado"]
EtiquetaImagen = Literal["real", "anonimizada", "ia", "diagrama"]
TipoComponente = Literal["entrada", "ia", "codigo", "datos", "salida", "persona", "seguridad"]

ETIQUETAS_IMAGEN: dict[str, str] = {
    "real": "Captura real",
    "anonimizada": "Captura anonimizada",
    "ia": "Imagen ilustrativa (IA)",
    "diagrama": "Diagrama",
}
MADUREZ: dict[str, str] = {"demo": "Demo", "piloto": "Piloto", "produccion": "En producción"}

_URL = re.compile(r"^(https?://[^\s]+|mailto:[^\s]+)$", re.I)


def _lista(max_items: int = 30):
    return Field(default_factory=list, max_length=max_items)


class Modelo(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Beneficio(Modelo):
    texto: Item
    tipo: Literal["medido", "estimado"] = Field(description="'medido' solo si la cifra se midió en un proyecto real")


class Imagen(Modelo):
    archivo: ArchivoImagen
    alt: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=300)]
    etiqueta: EtiquetaImagen


class Componente(Modelo):
    id: IdComponente
    nombre: TextoCorto
    tipo: TipoComponente
    detalle: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] = ""


class PasoArquitectura(Modelo):
    texto: Item
    componentes: list[IdComponente] = _lista(20)


class Arquitectura(Modelo):
    componentes: list[Componente] = Field(default_factory=list, max_length=40)
    conexiones: list[tuple[IdComponente, IdComponente]] = Field(default_factory=list, max_length=80)
    pasos: list[PasoArquitectura] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def _referencias(self) -> "Arquitectura":
        ids = [c.id for c in self.componentes]
        if len(ids) != len(set(ids)):
            raise ValueError("Hay componentes con el mismo id")
        validos = set(ids)
        for desde, hasta in self.conexiones:
            if desde not in validos or hasta not in validos:
                raise ValueError(f"La conexión {desde} → {hasta} apunta a un componente que no existe")
            if desde == hasta:
                raise ValueError(f"La conexión {desde} → {hasta} no puede ir a sí misma")
        for i, paso in enumerate(self.pasos, 1):
            faltan = [c for c in paso.componentes if c not in validos]
            if faltan:
                raise ValueError(f"El paso {i} usa componentes que no existen: {', '.join(faltan)}")
        return self


class CTA(Modelo):
    texto: TextoCorto
    url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]

    @field_validator("url")
    @classmethod
    def _url(cls, v: str) -> str:
        if not _URL.match(v):
            raise ValueError("Debe empezar con https://, http:// o mailto:")
        return v


class AgenteEntrada(Modelo):
    """Lo que se carga desde el back (sin los campos que pone el sistema)."""

    # Identificación
    slug: Slug
    nombre: TextoCorto
    familia: TextoCorto
    subfamilia: TextoCorto | None = None
    tagline: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    # Narrativa
    glitch_dice: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=400)]
    problema: Texto
    que_hace: Texto
    pasos: list[Item] = Field(min_length=1, max_length=12)
    # Público
    para_quien: list[Item] = _lista(12)
    industrias: list[TextoCorto] = _lista(12)
    # Valor
    beneficios: list[Beneficio] = Field(min_length=1, max_length=12)
    # Técnica
    plataforma: TextoCorto
    tecnologias: list[TextoCorto] = _lista(30)
    integraciones: list[TextoCorto] = _lista(20)
    requisitos_licencias: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    seguridad_gobierno: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    # IA (agentes de Foundry)
    modelos: list[TextoCorto] = _lista(10)
    tipo_agente: Literal["uno", "varios"] | None = Field(None, description="'uno' = un agente solo; 'varios' = varios que colaboran")
    conocimiento: list[Item] = _lista(12)
    herramientas: list[Item] = _lista(20)
    guardrails: list[Item] = _lista(12)
    evaluacion_observabilidad: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    # Arquitectura (opcional)
    arquitectura: Arquitectura | None = None
    # Entrega
    tiempo_implementacion: TextoCorto
    madurez: Madurez
    demo_url: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
    # Imágenes
    imagenes: list[Imagen] = Field(default_factory=list, max_length=20)
    # Publicación
    cta: CTA | None = None
    estado: Estado = "borrador"
    destacado: bool = False
    es_ejemplo: bool = Field(False, description="Muestra el aviso 'Ejemplo: validar con el equipo'. Se apaga al guardar desde el back.")

    @field_validator("demo_url")
    @classmethod
    def _demo_url(cls, v: str | None) -> str | None:
        if v in (None, ""):
            return None
        if not re.match(r"^https?://\S+$", v, re.I):
            raise ValueError("Debe empezar con https:// o http://")
        return v

    @field_validator("imagenes")
    @classmethod
    def _imagenes_unicas(cls, v: list[Imagen]) -> list[Imagen]:
        nombres = [i.archivo for i in v]
        if len(nombres) != len(set(nombres)):
            raise ValueError("La misma imagen está cargada dos veces")
        return v

    @model_validator(mode="after")
    def _contra_marca(self, info: ValidationInfo) -> "AgenteEntrada":
        marca = (info.context or {}).get("marca") if info else None
        if not marca:
            return self
        familias = {f["id"]: f for f in marca["familias"]}
        fam = familias.get(self.familia)
        if not fam:
            raise ValueError(f"familia: '{self.familia}' no existe (válidas: {', '.join(familias)})")
        subs = [s["id"] for s in fam.get("subfamilias", [])]
        if subs and self.subfamilia not in subs:
            raise ValueError(f"subfamilia: para {fam['nombre']} debe ser una de {', '.join(subs)}")
        if not subs and self.subfamilia:
            raise ValueError(f"subfamilia: {fam['nombre']} no tiene subfamilias")
        if self.plataforma not in marca["plataformas"]:
            raise ValueError(f"plataforma: '{self.plataforma}' no existe (válidas: {', '.join(marca['plataformas'])})")
        return self


class Agente(AgenteEntrada):
    """La ficha completa, tal como se guarda."""

    id: Annotated[str, StringConstraints(pattern=r"^[a-f0-9]{32}$")]
    orden: int = 0
    creado: datetime
    actualizado: datetime
    actualizado_por: Annotated[str, StringConstraints(max_length=200)] = ""


CAMPOS_PRIVADOS = {"estado", "actualizado_por"}


def a_publico(agente: Agente) -> dict:
    """Lo único que ve el API público: sin estado ni datos del back."""
    return agente.model_dump(mode="json", exclude=CAMPOS_PRIVADOS)
