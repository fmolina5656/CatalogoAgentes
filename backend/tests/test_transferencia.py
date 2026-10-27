import io
import json
import zipfile

from fastapi.testclient import TestClient

from app.main import create_app

from .conftest import H, PIN, agente_minimo, imagen, make_settings


def _exportar_con_imagen(admin):
    sub = admin.post("/api/admin/imagenes", files={"archivo": ("x.png", imagen(), "image/png")}).json()
    admin.post("/api/admin/agentes", json=agente_minimo(
        slug="con-foto", estado="publicado",
        imagenes=[{"archivo": sub["archivo"], "alt": "Diagrama", "etiqueta": "diagrama"}]))
    r = admin.get("/api/admin/export")
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    return r.content, sub["archivo"]


def _otro_entorno(tmp_path, seed=False):
    c = TestClient(create_app(make_settings(tmp_path / "otro", seed_on_empty=seed)))
    c.post("/api/admin/login", json={"pin": PIN})
    c.headers.update(H)
    return c


def test_exporta_e_importa_en_otro_entorno(admin, tmp_path):
    zipdata, archivo = _exportar_con_imagen(admin)
    z = zipfile.ZipFile(io.BytesIO(zipdata))
    assert "catalogo.json" in z.namelist() and f"imagenes/{archivo}" in z.namelist()
    total = len(json.loads(z.read("catalogo.json"))["agentes"])

    otro = _otro_entorno(tmp_path)
    assert otro.get("/api/admin/agentes").json()["agentes"] == []
    r = otro.post("/api/admin/import?modo=reemplazar", files={"archivo": ("c.zip", zipdata, "application/zip")})
    assert r.status_code == 200, r.text
    assert r.json()["importados"] == total
    assert len(otro.get("/api/admin/agentes").json()["agentes"]) == total
    assert otro.get(f"/media/{archivo}").status_code == 200
    # el orden se conserva
    orig = [a["slug"] for a in admin.get("/api/admin/agentes").json()["agentes"]]
    nuevo = [a["slug"] for a in otro.get("/api/admin/agentes").json()["agentes"]]
    assert orig == nuevo


def test_importar_dos_veces_combinando_no_duplica(admin, tmp_path):
    zipdata, _ = _exportar_con_imagen(admin)
    n = len(admin.get("/api/admin/agentes").json()["agentes"])
    r = admin.post("/api/admin/import", files={"archivo": ("c.zip", zipdata, "application/zip")})
    assert r.status_code == 200
    assert len(admin.get("/api/admin/agentes").json()["agentes"]) == n


def _zip(entradas: dict[str, bytes]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for k, v in entradas.items():
            z.writestr(k, v)
    return buf.getvalue()


def test_import_rechaza_zips_maliciosos_o_invalidos(admin):
    doc = json.dumps({"formato": "catalogo-agentes/v1", "agentes": []}).encode()
    casos = [
        (b"no soy un zip", 400),
        (_zip({"otra.json": b"{}"}), 400),
        (_zip({"catalogo.json": doc, "../../evil.webp": b"x"}), 400),
        (_zip({"catalogo.json": doc, "imagenes/" + "a" * 32 + ".webp": b"no-es-imagen"}), 400),
        (_zip({"catalogo.json": json.dumps({"formato": "otro"}).encode()}), 400),
        (_zip({"catalogo.json": json.dumps({"formato": "catalogo-agentes/v1",
                                            "agentes": [{"slug": "x"}]}).encode()}), 422),
    ]
    antes = len(admin.get("/api/admin/agentes").json()["agentes"])
    for datos, esperado in casos:
        r = admin.post("/api/admin/import", files={"archivo": ("c.zip", datos, "application/zip")})
        assert r.status_code == esperado, (r.status_code, r.text)
    assert len(admin.get("/api/admin/agentes").json()["agentes"]) == antes


def test_import_rechaza_imagenes_faltantes(admin, tmp_path):
    zipdata, archivo = _exportar_con_imagen(admin)
    z = zipfile.ZipFile(io.BytesIO(zipdata))
    sin_img = _zip({"catalogo.json": z.read("catalogo.json")})
    otro = _otro_entorno(tmp_path)
    r = otro.post("/api/admin/import", files={"archivo": ("c.zip", sin_img, "application/zip")})
    assert r.status_code == 400 and archivo in r.text
