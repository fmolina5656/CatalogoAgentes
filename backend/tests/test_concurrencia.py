from .conftest import agente_minimo


def _sin_sistema(a):
    return {k: v for k, v in a.items() if k not in {"id", "orden", "creado", "actualizado", "actualizado_por", "_version"}}


def test_dos_personas_editando_no_se_pisan(admin):
    r = admin.post("/api/admin/agentes", json=agente_minimo()).json()
    aid, v1 = r["agente"]["id"], r["version"]
    datos = _sin_sistema(r["agente"])
    ok = admin.put(f"/api/admin/agentes/{aid}", json={**datos, "nombre": "Versión de Ana"}, headers={"If-Match": v1})
    assert ok.status_code == 200
    choque = admin.put(f"/api/admin/agentes/{aid}", json={**datos, "nombre": "Versión de Beto"}, headers={"If-Match": v1})
    assert choque.status_code == 409
    assert admin.get(f"/api/admin/agentes/{aid}").json()["agente"]["nombre"] == "Versión de Ana"


def test_put_y_delete_exigen_if_match(admin):
    r = admin.post("/api/admin/agentes", json=agente_minimo()).json()
    aid = r["agente"]["id"]
    assert admin.put(f"/api/admin/agentes/{aid}", json=_sin_sistema(r["agente"])).status_code == 428
    assert admin.delete(f"/api/admin/agentes/{aid}").status_code == 428
    assert admin.delete(f"/api/admin/agentes/{aid}", headers={"If-Match": '"vieja"'}).status_code == 409
    assert admin.delete(f"/api/admin/agentes/{aid}", headers={"If-Match": r["version"]}).status_code == 204
    assert admin.get(f"/api/admin/agentes/{aid}").status_code == 404


def test_orden_duplicar_y_destacado(admin):
    lista = admin.get("/api/admin/agentes").json()
    ids = [a["id"] for a in lista["agentes"]]
    nuevo = [ids[1], ids[0], *ids[2:]]
    r = admin.post("/api/admin/orden", json={"ids": nuevo, "version": lista["version_orden"]})
    assert r.status_code == 200
    # con la versión vieja del orden ya no se puede
    assert admin.post("/api/admin/orden", json={"ids": ids, "version": lista["version_orden"]}).status_code == 409
    assert [a["id"] for a in admin.get("/api/admin/agentes").json()["agentes"]] == nuevo
    publicos = [a["id"] for a in admin.get("/api/agentes").json()["agentes"]]
    assert publicos[:2] == nuevo[:2]
    # lista incompleta
    assert admin.post("/api/admin/orden", json={"ids": nuevo[:-1], "version": r.json()["version"]}).status_code == 400

    copia = admin.post(f"/api/admin/agentes/{ids[0]}/duplicar")
    assert copia.status_code == 201
    c = copia.json()["agente"]
    assert c["estado"] == "borrador" and c["slug"].endswith("-copia") and c["id"] != ids[0]
    otra = admin.post(f"/api/admin/agentes/{ids[0]}/duplicar").json()["agente"]
    assert otra["slug"].endswith("-copia-2")
