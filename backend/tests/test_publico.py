from .conftest import agente_minimo


def test_semilla_cargada_y_solo_publicados(client, seed):
    r = client.get("/api/agentes")
    assert r.status_code == 200
    agentes = r.json()["agentes"]
    assert len(agentes) == len([a for a in seed if a.get("estado") == "publicado"])
    foundry = [a for a in agentes if a["subfamilia"] == "foundry"]
    assert len(foundry) == 6
    assert all(a["arquitectura"] and not a["es_ejemplo"] for a in foundry)


def test_api_publico_no_expone_datos_del_back(client):
    for a in client.get("/api/agentes").json()["agentes"]:
        assert "estado" not in a and "actualizado_por" not in a
    slug = client.get("/api/agentes").json()["agentes"][0]["slug"]
    d = client.get(f"/api/agentes/{slug}").json()
    assert "estado" not in d and "actualizado_por" not in d


def test_borrador_no_se_ve_en_lo_publico(admin):
    r = admin.post("/api/admin/agentes", json=agente_minimo(slug="secreto", estado="borrador"))
    assert r.status_code == 201
    creado = r.json()
    assert "secreto" not in [a["slug"] for a in admin.get("/api/agentes").json()["agentes"]]
    assert admin.get("/api/agentes/secreto").status_code == 404
    assert admin.get("/api/agentes?q=secreto").json()["agentes"] == []
    # al publicarlo aparece; al despublicarlo desaparece
    datos = {**agente_minimo(slug="secreto"), "estado": "publicado"}
    r = admin.put(f"/api/admin/agentes/{creado['agente']['id']}", json=datos,
                  headers={"If-Match": creado["version"]})
    assert r.status_code == 200
    assert admin.get("/api/agentes/secreto").status_code == 200


def test_imagen_de_borrador_no_es_publica(admin):
    from .conftest import imagen

    sub = admin.post("/api/admin/imagenes", files={"archivo": ("x.png", imagen(), "image/png")}).json()
    admin.post("/api/admin/agentes", json=agente_minimo(
        slug="con-imagen", imagenes=[{"archivo": sub["archivo"], "alt": "Captura", "etiqueta": "diagrama"}]))
    assert admin.get(f"/media/{sub['archivo']}").status_code == 404
    assert admin.get(f"/api/admin/media/{sub['archivo']}").status_code == 200


def test_filtros(client):
    def slugs(q):
        return {a["slug"] for a in client.get(f"/api/agentes?{q}").json()["agentes"]}

    assert len(slugs("familia=app-modernization&sub=foundry")) == 6
    assert slugs("madurez=demo&sub=foundry") == {"equipo-de-agentes-que-disena-soluciones"}
    assert "conciliacion-contable" in slugs("q=sap hana")
    assert "conciliacion-contable" in slugs("q=CONCILIACION")  # sin acentos ni mayúsculas
    assert slugs("industria=retail") == {"vision-en-tiendas"}
    assert slugs("plataforma=Copilot Studio") == {"help-desk-de-ti", "onboarding-de-colaboradores"}


def test_config_publica(client):
    c = client.get("/api/config").json()
    assert {f["id"] for f in c["familias"]} == {"app-modernization", "m365-copilot", "copilot-studio"}
    assert c["etiquetas_imagen"]["ia"] == "Imagen ilustrativa (IA)"


def test_spa_y_rutas_desconocidas(client):
    assert client.get("/api/no-existe").status_code == 404
    assert client.get("/media/../../etc/passwd").status_code == 404
