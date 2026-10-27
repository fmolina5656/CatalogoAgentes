"""Procesamiento seguro de imágenes subidas.

- Se valida el contenido real con Pillow (no la extensión ni el Content-Type).
- Solo JPEG, PNG o WebP, hasta 8 MB y con un tope de píxeles (contra bombas de descompresión).
- Se aplica la orientación EXIF y se descartan todos los metadatos.
- Se guarda como WebP a 1600 px como máximo, más una miniatura de 600 px.
- El nombre lo genera el servidor (uuid4 en hex); el nombre original se ignora.
"""
from __future__ import annotations

import io
import uuid
import warnings
from dataclasses import dataclass

from PIL import Image, ImageOps

FORMATOS = {"JPEG", "PNG", "WEBP"}
MAX_LADO = 1600
MAX_MINIATURA = 600
MAX_PIXELES = 40_000_000

Image.MAX_IMAGE_PIXELS = MAX_PIXELES


class ImagenInvalida(ValueError):
    pass


@dataclass
class ImagenProcesada:
    nombre: str  # <hex>.webp
    nombre_miniatura: str  # <hex>-thumb.webp
    datos: bytes
    miniatura: bytes
    ancho: int
    alto: int


def _abrir(datos: bytes) -> Image.Image:
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            with Image.open(io.BytesIO(datos)) as probe:
                if probe.format not in FORMATOS:
                    raise ImagenInvalida("Solo se aceptan imágenes JPG, PNG o WebP")
                probe.verify()
            img = Image.open(io.BytesIO(datos))
            img.load()
        except ImagenInvalida:
            raise
        except (Image.DecompressionBombError, Image.DecompressionBombWarning) as e:
            raise ImagenInvalida("La imagen es demasiado grande en píxeles") from e
        except Exception as e:  # noqa: BLE001 — cualquier cosa que Pillow no entienda
            raise ImagenInvalida("El archivo no es una imagen válida") from e
    return img


def _a_webp(img: Image.Image, lado: int, calidad: int) -> bytes:
    copia = img.copy()
    copia.thumbnail((lado, lado), Image.Resampling.LANCZOS)
    out = io.BytesIO()
    # Sin exif, icc ni xmp: Pillow solo escribe metadatos si se le pasan.
    copia.save(out, "WEBP", quality=calidad, method=6)
    return out.getvalue()


def procesar(datos: bytes, max_bytes: int) -> ImagenProcesada:
    if len(datos) > max_bytes:
        raise ImagenInvalida(f"La imagen pesa más de {max_bytes // (1024 * 1024)} MB")
    if not datos:
        raise ImagenInvalida("El archivo está vacío")
    img = _abrir(datos)
    if getattr(img, "n_frames", 1) > 1:
        img.seek(0)
    img = ImageOps.exif_transpose(img)
    modo = "RGBA" if ("A" in img.getbands() or img.mode == "P" and "transparency" in img.info) else "RGB"
    img = img.convert(modo)
    img.info.clear()
    base = uuid.uuid4().hex
    grande = _a_webp(img, MAX_LADO, 84)
    mini = _a_webp(img, MAX_MINIATURA, 78)
    w, h = Image.open(io.BytesIO(grande)).size
    return ImagenProcesada(f"{base}.webp", f"{base}-thumb.webp", grande, mini, w, h)


def miniatura_de(nombre: str) -> str:
    return nombre.replace(".webp", "-thumb.webp")
