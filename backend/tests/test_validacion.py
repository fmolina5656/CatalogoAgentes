import pytest

from .conftest import agente_minimo


@pytest.mark.parametrize("cambio,campo", [
    ({"slug": "Con Espacios"}, "slug"),
    ({"slug": "../etc"}, "slug"),
    ({"familia": "inventada"}, "familia"),
    ({"familia": "app-modernization"}, "subfamilia"),           # falta subfamilia
    ({"subfamilia": "foundry"}, "subfamilia"),                  # copilot-studio no tiene
    ({"plataforma": "Otra"}, "plataforma"),
    ({"madurez": "beta"}, "madurez"),
    ({"pasos": []}, "pasos"),
    ({"beneficios": [{"texto": "x", "tipo": "inventado"}]}, "beneficios"),
    ({"imagenes": [{"archivo": "../../x.webp", "alt": "ok ok", "etiqueta": "real"}]}, "imagenes"),
    ({"imagenes": [{"archivo": "a" * 32 + ".webp", "alt": "ok ok", "etiqueta": "otra"}]}, "imagenes"),
    ({"cta": {"texto": "Hola", "url": "javascript:alert(1)"}}, "cta"),
    ({"demo_url": "ftp://x"}, "demo_url"),
    ({"campo_raro": 1}, "campo_raro"),
])
def test_rechaza_fichas_invalidas(admin, cambio, campo):
    r = admin.post("/api/admin/agentes", json=agente_minimo(**cambio))
    assert r.status_code == 422, r.text
    assert campo in r.text


def test_arquitectura_valida_referencias(admin):
    arq = {"componentes": [{"id": "a", "nombre": "A", "tipo": "entrada"}, {"id": "b", "nombre": "B", "tipo": "ia"}],
           "conexiones": [["a", "c"]], "pasos": []}
    r = admin.post("/api/admin/agentes", json=agente_minimo(arquitectura=arq))
    assert r.status_code == 422 and "no existe" in r.text
    arq["conexiones"] = [["a", "b"]]
    arq["pasos"] = [{"texto": "Paso", "componentes": ["z"]}]
    assert admin.post("/api/admin/agentes", json=agente_minimo(arquitectura=arq)).status_code == 422
    arq["pasos"] = [{"texto": "Paso", "componentes": ["a", "b"]}]
    assert admin.post("/api/admin/agentes", json=agente_minimo(arquitectura=arq)).status_code == 201


def test_slug_unico(admin):
    assert admin.post("/api/admin/agentes", json=agente_minimo(slug="uno")).status_code == 201
    r = admin.post("/api/admin/agentes", json=agente_minimo(slug="uno"))
    assert r.status_code == 422 and "slug" in r.text


def test_imagen_debe_existir_en_el_servidor(admin):
    img = [{"archivo": "b" * 32 + ".webp", "alt": "Algo", "etiqueta": "real"}]
    r = admin.post("/api/admin/agentes", json=agente_minimo(imagenes=img))
    assert r.status_code == 400 and "no existen" in r.text


def test_los_campos_del_sistema_no_se_pueden_mandar(admin):
    r = admin.post("/api/admin/agentes", json=agente_minimo(id="c" * 32))
    assert r.status_code == 422


def test_editar_apaga_el_aviso_de_ejemplo(admin):
    lista = admin.get("/api/admin/agentes").json()["agentes"]
    ej = next(a for a in lista if a["es_ejemplo"])
    datos = {k: v for k, v in ej.items() if k not in {"id", "orden", "creado", "actualizado", "actualizado_por", "_version"}}
    r = admin.put(f"/api/admin/agentes/{ej['id']}", json=datos, headers={"If-Match": ej["_version"]})
    assert r.status_code == 200
    assert r.json()["agente"]["es_ejemplo"] is False
    assert r.json()["agente"]["actualizado_por"] == "admin-local"
