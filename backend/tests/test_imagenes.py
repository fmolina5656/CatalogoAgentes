import io

from PIL import Image

from .conftest import imagen


def _subir(admin, datos, nombre="foto.jpg", tipo="image/jpeg"):
    return admin.post("/api/admin/imagenes", files={"archivo": (nombre, datos, tipo)})


def test_jpg_png_webp_validos(admin):
    for fmt, tipo in [("JPEG", "image/jpeg"), ("PNG", "image/png"), ("WEBP", "image/webp")]:
        r = _subir(admin, imagen(fmt), tipo=tipo)
        assert r.status_code == 201, r.text
        assert r.json()["archivo"].endswith(".webp")


def test_reduce_a_1600_y_genera_miniatura_600(admin):
    r = _subir(admin, imagen("PNG", size=(4000, 2000)), tipo="image/png").json()
    assert r["ancho"] == 1600 and r["alto"] == 800
    grande = Image.open(io.BytesIO(admin.get(f"/api/admin/media/{r['archivo']}").content))
    mini = Image.open(io.BytesIO(admin.get(f"/api/admin/media/{r['miniatura']}").content))
    assert grande.format == "WEBP" and max(grande.size) == 1600
    assert max(mini.size) == 600


def test_quita_exif(admin):
    exif = Image.Exif()
    exif[0x010F] = "CamaraSecreta"      # Make
    exif[0x8825] = {2: (19.0, 26.0, 0.0)}  # GPSInfo
    datos = imagen("JPEG", exif=exif.tobytes())
    assert b"CamaraSecreta" in datos
    r = _subir(admin, datos).json()
    guardada = admin.get(f"/api/admin/media/{r['archivo']}").content
    assert b"CamaraSecreta" not in guardada
    assert not Image.open(io.BytesIO(guardada)).getexif()


def test_nombre_lo_genera_el_servidor(admin):
    r = _subir(admin, imagen(), nombre="../../../etc/passwd.jpg").json()
    assert "passwd" not in r["archivo"] and "/" not in r["archivo"]
    assert len(r["archivo"]) == 32 + len(".webp")


def test_rechaza_archivo_que_no_es_imagen(admin):
    r = _subir(admin, b"<script>alert(1)</script>", nombre="x.jpg", tipo="image/jpeg")
    assert r.status_code == 415


def test_rechaza_tipo_no_permitido(admin):
    gif = io.BytesIO()
    Image.new("RGB", (5, 5)).save(gif, "GIF")
    assert _subir(admin, gif.getvalue(), nombre="x.gif", tipo="image/gif").status_code == 415
    # GIF disfrazado de PNG: se valida el contenido real
    assert _subir(admin, gif.getvalue(), nombre="x.png", tipo="image/png").status_code == 415


def test_rechaza_imagen_truncada(admin):
    datos = imagen("PNG", size=(300, 300))
    assert _subir(admin, datos[: len(datos) // 2], tipo="image/png").status_code == 415


def test_rechaza_mas_de_8_mb(admin):
    datos = imagen("PNG") + b"\0" * (8 * 1024 * 1024 + 10)
    assert _subir(admin, datos, tipo="image/png").status_code == 413


def test_media_rechaza_path_traversal(admin):
    assert admin.get("/api/admin/media/..%2F..%2Fagentes").status_code == 404
    assert admin.get("/media/..%2Forden.json").status_code == 404
