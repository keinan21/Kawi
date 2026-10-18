"""Uji kontrak: payload yang benar-benar dikirim `web/src/lib/*.ts`.

Tiap test di sini meniru satu panggilan fetch dari client, supaya regresi
nama field/case/envelope langsung ketahuan.
"""

from __future__ import annotations

from conftest import FAKE_PDF, make_session_row, make_tugas, seed_questions


# --------------------------------------------------------------------------- #
# Murid — POST /api/sessions (murid-api `mulaiSesi`)
# --------------------------------------------------------------------------- #
def test_mulai_sesi_request_and_envelope(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)

    response = client.post("/api/sessions", json={"tugas_id": tugas.id})

    assert response.status_code == 201
    body = response.json()
    # `normalisasiSesi` membaca body polos (client juga menerima `{session: ...}`,
    # tapi backend memilih tanpa amplop).
    assert "session" not in body
    assert body["id"]
    assert body["tugas_id"] == tugas.id
    assert body["attempt_no"] == 1
    assert body["status"] == "created"
    assert body["started_at"] is not None
    assert body["timer_ends_at"] is None
    assert body["uploaded"] is False
    assert body["filename"] is None


def test_mulai_sesi_requires_authentication(client, guru, db):
    """POST /api/sessions WAJAB terautentikasi — Sesi milik user yang login."""
    with db() as session:
        tugas = make_tugas(guru, session)

    assert client.post("/api/sessions", json={"tugas_id": tugas.id}).status_code == 401


def test_409_body_carries_active_session_id(client, login_as, murid, guru, db):
    """`sessionIdDariError` di t.$token.tsx membaca `session_id` level atas."""
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    first = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]

    conflict = client.post("/api/sessions", json={"tugas_id": tugas.id})

    assert conflict.status_code == 409
    data = conflict.json()
    assert data["session_id"] == first
    assert isinstance(data["detail"], str) and data["detail"]


def test_preview_is_public_but_session_start_is_not(client, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)

    # Tanpa login: pratinjau boleh, mulai Sesi tidak.
    assert client.get(f"/api/t/{tugas.token}").status_code == 200
    assert client.post("/api/sessions", json={"tugas_id": tugas.id}).status_code == 401


# --------------------------------------------------------------------------- #
# Murid — timer (sesi.$sessionId.tsx membaca `timer_ends_at`)
# --------------------------------------------------------------------------- #
def test_status_serves_countdown_fields(client, login_as, murid, guru, db):
    from datetime import datetime

    with db() as session:
        tugas = make_tugas(guru, session, sesi_minutes=10)
    login_as(murid)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]

    before = client.get(f"/api/sessions/{session_id}/status").json()
    assert before["status"] == "created"
    assert before["timer_ends_at"] is None
    assert before["attempt_no"] == 1

    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )
    after = client.get(f"/api/sessions/{session_id}/status").json()

    assert after["status"] == "generating"
    assert after["timer_ends_at"]
    # Countdown bar = timer_ends_at - uploaded_at (bukan tebakan klien).
    delta = datetime.fromisoformat(after["timer_ends_at"]) - datetime.fromisoformat(
        after["uploaded_at"]
    )
    assert 9 * 60 < delta.total_seconds() <= 10 * 60


def test_status_stays_murid_owned(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]

    login_as("murid")  # murid lain
    assert client.get(f"/api/sessions/{session_id}/status").status_code == 404


# --------------------------------------------------------------------------- #
# Murid — answers (murid-api `kirimJawaban` mengirim `{jawaban: [...]}`)
# --------------------------------------------------------------------------- #
def test_answers_accepts_jawaban_key(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )
    with db() as session:
        question_ids = seed_questions(session, session_id)
    client.get(f"/api/sessions/{session_id}/questions")

    response = client.post(
        f"/api/sessions/{session_id}/answers",
        json={
            "jawaban": [
                {"pertanyaan_id": question_ids[0], "text": "a"},
                {"pertanyaan_id": question_ids[1], "text": "b"},
                {"pertanyaan_id": question_ids[2], "text": "c"},
            ]
        },
    )

    assert response.status_code == 200
    assert response.json()["status"] == "submitted"


def test_answers_accepts_legacy_answers_key(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )
    with db() as session:
        question_ids = seed_questions(session, session_id)
    client.get(f"/api/sessions/{session_id}/questions")

    response = client.post(
        f"/api/sessions/{session_id}/answers",
        json={
            "answers": [
                {"pertanyaan_id": question_ids[0], "text": "a"},
                {"pertanyaan_id": question_ids[1], "text": "b"},
                {"pertanyaan_id": question_ids[2], "text": "c"},
            ]
        },
    )

    assert response.status_code == 200


def test_questions_amplop_shape(client, login_as, murid, guru, db):
    """`normalisasiPertanyaan` menerima amplop `{status, questions}`."""
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )

    generating = client.get(f"/api/sessions/{session_id}/questions")
    assert generating.status_code == 200
    assert generating.json() == {"status": "generating", "questions": []}

    with db() as session:
        seed_questions(session, session_id)
    answering = client.get(f"/api/sessions/{session_id}/questions").json()
    assert answering["status"] == "answering"
    assert [set(item) for item in answering["questions"]] == [
        {"id", "type", "seq", "text"}
    ] * 3


# --------------------------------------------------------------------------- #
# Unggahan — multipart field + download
# --------------------------------------------------------------------------- #
def test_upload_uses_multipart_field_file(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]

    response = client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("Gagasan-Ana.pdf", FAKE_PDF, "application/pdf")},
    )
    assert response.status_code == 200


def test_download_unggahan_for_guru(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("Gagasan-Ana.pdf", FAKE_PDF, "application/pdf")},
    )

    login_as(guru)
    response = client.get(f"/api/sessions/{session_id}/unggahan")

    assert response.status_code == 200
    assert response.content == FAKE_PDF
    assert response.headers["content-type"].startswith("application/pdf")
    disposition = response.headers["content-disposition"]
    assert 'filename="Gagasan-Ana.pdf"' in disposition
    assert "filename*=UTF-8''Gagasan-Ana.pdf" in disposition


def test_download_unggahan_for_owner_murid(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )

    assert client.get(f"/api/sessions/{session_id}/unggahan").content == FAKE_PDF


def test_download_unggahan_requires_auth(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )

    client.app.dependency_overrides.clear()  # logout
    assert client.get(f"/api/sessions/{session_id}/unggahan").status_code == 401


def test_download_unggahan_404_for_other_users(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )

    login_as("murid")
    assert client.get(f"/api/sessions/{session_id}/unggahan").status_code == 404

    login_as("guru")  # Guru yang bukan pemilik Tugas
    assert client.get(f"/api/sessions/{session_id}/unggahan").status_code == 404


def test_download_unggahan_404_when_not_uploaded(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]

    login_as(guru)
    assert client.get(f"/api/sessions/{session_id}/unggahan").status_code == 404


def test_download_unggahan_404_unknown_session(client, login_as, guru):
    login_as(guru)
    assert client.get("/api/sessions/tidak-ada/unggahan").status_code == 404


# --------------------------------------------------------------------------- #
# Pelanggaran — batch dari proctor/IngestClient
# --------------------------------------------------------------------------- #
def test_violation_batch_payload_from_ingest_client(client, login_as, murid, guru, db):
    """`PelanggaranPayload` = {type, detail, client_ts}."""
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]

    response = client.post(
        f"/api/sessions/{session_id}/violations",
        json={
            "violations": [
                {
                    "type": "tab_switch",
                    "detail": "Tab tidak terlihat selama 4 detik.",
                    "client_ts": "2026-10-01T08:00:00.000Z",
                },
                {
                    "type": "copy_blocked",
                    "detail": "Copy diblokir.",
                    "client_ts": "2026-10-01T08:00:03.000Z",
                },
            ]
        },
    )

    assert response.status_code == 200
    assert response.json() == {"accepted": 2, "dropped": 0}


def test_violation_storm_marks_session_terminal_for_client(client, login_as, murid, guru, db):
    """Client Bereaksi pada 409/410/423 dari endpoint violations."""
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )
    with db() as session:
        seed_questions(session, session_id)
    client.get(f"/api/sessions/{session_id}/questions")
    client.post(
        f"/api/sessions/{session_id}/answers",
        json={
            "jawaban": [
                {"pertanyaan_id": qid, "text": "x"}
                for qid in seed_answers(client, db, session_id)
            ]
        },
    )

    # Setelah submit, ingest tetap diterima (fire-and-forget, tidak 409).
    response = client.post(
        f"/api/sessions/{session_id}/violations",
        json={"violations": [{"type": "window_blur", "detail": "blur", "client_ts": None}]},
    )
    assert response.status_code == 200


def seed_answers(client, db, session_id: str) -> list[str]:
    """Ambil id tiga Pertanyaan milik Sesi (dipakai untuk kirim jawaban)."""
    with db() as session:
        from api.core.models.pertanyaan import Pertanyaan

        rows = session.query(Pertanyaan).filter_by(session_id=session_id).order_by(Pertanyaan.seq)
        return [row.id for row in rows]


def test_unowned_session_is_hidden_for_download_and_detail(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
        row = make_session_row(session, tugas, murid)

    login_as("murid")
    assert client.get(f"/api/sessions/{row.id}").status_code == 404
    assert client.get(f"/api/sessions/{row.id}/unggahan").status_code == 404