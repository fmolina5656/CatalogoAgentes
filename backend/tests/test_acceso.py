from fastapi.testclient import TestClient

from app.main import create_app

from .conftest import H, PIN, agente_minimo, make_settings

RUTAS_ADMIN = [
    ("get", "/api/admin/agentes"),
    ("post", "/api/admin/agentes"),
    ("get", "/api/admin/export"),
    ("post", "/api/admin/import"),
    ("post", "/api/admin/imagenes"),
    ("post", "/api/admin/orden"),
    ("get", "/api/admin/schema"),
    ("get", "/api/admin/media/" + "a" * 32 + ".webp"),
]


def test_admin_sin_sesion_responde_401(client):
    for metodo, ruta in RUTAS_ADMIN:
        r = getattr(client, metodo)(ruta, headers=H)
        assert r.status_code == 401, (metodo, ruta, r.status_code)


def test_pin_incorrecto_y_bloqueo(client):
    for _ in range(5):
        assert client.post("/api/admin/login", json={"pin": "mal"}).status_code == 401
    assert client.post("/api/admin/login", json={"pin": PIN}).status_code == 429


def test_login_con_pin_da_cookie_httponly(client):
    r = client.post("/api/admin/login", json={"pin": PIN})
    assert r.status_code == 200
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie
    assert client.get("/api/admin/sesion").json()["autenticado"] is True
    client.post("/api/admin/logout", headers=H)
    client.cookies.clear()
    assert client.get("/api/admin/agentes").status_code == 401


def test_cookie_falsificada_no_sirve(client):
    client.cookies.set("catalogo_admin", "eyJ1IjoiYWRtaW4iLCJleHAiOjk5OTk5OTk5OTl9.firma-falsa")
    assert client.get("/api/admin/agentes").status_code == 401


def test_mutaciones_exigen_encabezado_csrf(client):
    client.post("/api/admin/login", json={"pin": PIN})
    r = client.post("/api/admin/agentes", json=agente_minimo())
    assert r.status_code == 403
    r = client.post("/api/admin/agentes", json=agente_minimo(), headers=H)
    assert r.status_code == 201


def test_sin_pin_configurado_no_se_puede_entrar(tmp_path):
    c = TestClient(create_app(make_settings(tmp_path, admin_pin="")))
    assert c.post("/api/admin/login", json={"pin": ""}).status_code == 503
    assert c.get("/api/admin/agentes").status_code == 401


def _principal(email: str) -> str:
    import base64
    import json

    claims = [{"typ": "preferred_username", "val": email}, {"typ": "name", "val": "Persona"}]
    return base64.b64encode(json.dumps({"auth_typ": "aad", "claims": claims}).encode()).decode()


def test_modo_entra_usa_el_principal_y_respeta_dominios(tmp_path):
    s = make_settings(tmp_path, auth_mode="entra", allowed_domains=["readymind.com"])
    c = TestClient(create_app(s))
    assert c.get("/api/admin/agentes").status_code == 401
    assert c.post("/api/admin/login", json={"pin": PIN}).status_code == 404  # PIN apagado en Azure
    ok = {"X-MS-CLIENT-PRINCIPAL": _principal("ana@readymind.com")}
    r = c.get("/api/admin/agentes", headers=ok)
    assert r.status_code == 200
    otro = {"X-MS-CLIENT-PRINCIPAL": _principal("eve@otra.com")}
    assert c.get("/api/admin/agentes", headers=otro).status_code == 401
    r = c.post("/api/admin/agentes", json=agente_minimo(), headers={**ok, **H})
    assert r.status_code == 201
    assert r.json()["agente"]["actualizado_por"] == "ana@readymind.com"


def test_en_modo_pin_se_ignora_el_encabezado_de_entra(client):
    r = client.get("/api/admin/agentes", headers={"X-MS-CLIENT-PRINCIPAL": _principal("ana@readymind.com")})
    assert r.status_code == 401
