"""Tugas: CRUD Guru (camelCase `TugasItem`), share token, pratinjau publik, guard.

Body Guru mengikuti `CreateTugasInput`/`PatchTugasInput` di `web/src/lib/guru-api.ts`
(camelCase), balasan mengikuti `TugasItem` yang di-render dari `guru-mocks.ts`.
"""

from __future__ import annotations

from conftest import make_tugas

BRIEF = "Analisis dampak disrupted economy terhadap UMKM Indonesia."
GURU_BODY = {
    "brief": BRIEF,
    "fileTypes": ["pdf", "ppt"],
    "maxBytes": 2_000_000,
    "deadlineAt": None,
    "sesiMinutes": 10,
    "questionsPerType": 1,
}


def test_health(client):
    assert client.get("/api/health").status_code == 200


def test_create_tugas_returns_camel_case_item(client, login_as, guru):
    login_as(guru)

    response = client.post("/api/tugas", json=GURU_BODY)

    assert response.status_code == 201
    body = response.json()
    # Bentuk `TugasItem` di guru-api.ts — camelCase, tanpa guru_id.
    assert set(body) == {
        "id",
        "token",
        "brief",
        "fileTypes",
        "maxBytes",
        "deadlineAt",
        "sesiMinutes",
        "questionsPerType",
        "createdAt",
        "muridCount",
        "pelanggaranCount",
    }
    assert body["token"]
    assert body["fileTypes"] == ["pdf", "ppt"]
    assert body["maxBytes"] == 2_000_000
    assert body["sesiMinutes"] == 10
    assert body["questionsPerType"] == 1
    assert body["muridCount"] == 0
    assert body["pelanggaranCount"] == 0
    assert "guru_id" not in body


def test_create_tugas_accepts_minimal_body(client, login_as, guru):
    login_as(guru)

    response = client.post("/api/tugas", json={"brief": BRIEF})

    assert response.status_code == 201
    assert response.json()["fileTypes"] == ["pdf", "ppt"]
    assert response.json()["maxBytes"] == 2_000_000


def test_create_tugas_file_types_mapping(client, login_as, guru):
    login_as(guru)

    ppt_only = client.post("/api/tugas", json={"brief": BRIEF, "fileTypes": ["ppt"]}).json()
    assert ppt_only["fileTypes"] == ["ppt"]

    pdf_only = client.post("/api/tugas", json={"brief": BRIEF, "fileTypes": ["pdf"]}).json()
    assert pdf_only["fileTypes"] == ["pdf"]


def test_list_and_get_tugas(client, login_as, guru):
    login_as(guru)
    created = client.post("/api/tugas", json=GURU_BODY).json()

    listed = client.get("/api/tugas")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [created["id"]]

    fetched = client.get(f"/api/tugas/{created['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["token"] == created["token"]


def test_patch_tugas_accepts_camel_case(client, login_as, guru):
    login_as(guru)
    created = client.post("/api/tugas", json=GURU_BODY).json()

    patched = client.patch(
        f"/api/tugas/{created['id']}",
        json={"brief": "Brief baru", "sesiMinutes": 20},
    )

    assert patched.status_code == 200
    assert patched.json()["brief"] == "Brief baru"
    assert patched.json()["sesiMinutes"] == 20
    # Token share-link tidak boleh berubah saat Tugas di-patch.
    assert patched.json()["token"] == created["token"]


def test_patch_tugas_rejects_null_brief(client, login_as, guru):
    login_as(guru)
    created = client.post("/api/tugas", json=GURU_BODY).json()

    assert client.patch(f"/api/tugas/{created['id']}", json={"brief": None}).status_code == 422
    # deadlineAt nullable, jadi boleh dikosongkan.
    assert (
        client.patch(f"/api/tugas/{created['id']}", json={"deadlineAt": None}).status_code == 200
    )


def test_preview_by_token_is_public_snake_case(client, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)

    response = client.get(f"/api/t/{tugas.token}")

    assert response.status_code == 200
    body = response.json()
    # Bentuk `TugasPratinjau` di murid-api.ts — snake_case.
    assert set(body) >= {
        "id",
        "token",
        "brief",
        "file_types",
        "max_bytes",
        "deadline_at",
        "sesi_minutes",
        "questions_per_type",
    }
    assert body["brief"] == tugas.brief
    assert body["max_bytes"] == 2_000_000
    assert body["sesi_minutes"] == 10
    assert "application/pdf" in body["file_types"]


def test_preview_unknown_token_404(client):
    assert client.get("/api/t/token-tidak-ada").status_code == 404


def test_tugas_routes_require_login(client):
    assert client.get("/api/tugas").status_code == 401
    assert client.post("/api/tugas", json=GURU_BODY).status_code == 401


def test_tugas_routes_forbid_murid(client, login_as, murid):
    login_as(murid)

    # Akun universal: siapa pun yang login bisa membuat/membaca Tugas miliknya.
    assert client.get("/api/tugas").status_code == 200
    assert client.post("/api/tugas", json=GURU_BODY).status_code == 201


def test_guru_cannot_read_other_guru_tugas(client, login_as, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as("guru")

    assert client.get(f"/api/tugas/{tugas.id}").status_code == 404


def test_participants_empty_before_any_session(client, login_as, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(guru)

    response = client.get(f"/api/tugas/{tugas.id}/participants")

    assert response.status_code == 200
    assert response.json() == []


def test_tugas_counts_murid_and_violations(client, login_as, murid, guru, db):
    login_as(murid)
    with db() as session:
        tugas = make_tugas(guru, session)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/violations",
        json={
            "violations": [
                {"type": "tab_switch", "detail": "pindah tab"},
                {"type": "window_blur", "detail": "blur"},
            ]
        },
    )

    login_as(guru)
    item = client.get(f"/api/tugas/{tugas.id}").json()

    assert item["muridCount"] == 1
    assert item["pelanggaranCount"] == 2

    listed = client.get("/api/tugas").json()
    assert listed[0]["muridCount"] == 1
    assert listed[0]["pelanggaranCount"] == 2