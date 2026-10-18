"""Guru: audit trail Sesi (`SessionDetail`), participants, Izin Unggah Ulang.

Semua bentuk di sini mengikuti `web/src/lib/guru-api.ts` + `guru-mocks.ts`:
camelCase, nama Bahasa Indonesia (`tanyaJawab`, `penilaian`, `riwayat`,
`dimulaiAt`, `batasJawabAt`, `dikumpulAt`, `sessionIdBaru`).
"""

from __future__ import annotations

from conftest import FAKE_PDF, make_session_row, make_tugas, seed_questions


def run_murid_to_submitted(client, db, guru, murid, **tugas_kwargs) -> str:
    """Murid menyelesaikan satu attempt penuh; balikan id Sesi."""
    with db() as session:
        tugas = make_tugas(guru, session, **tugas_kwargs)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("Gagasan-Ana.pdf", FAKE_PDF, "application/pdf")},
    )
    client.post(
        f"/api/sessions/{session_id}/violations",
        json={"violations": [{"type": "tab_switch", "detail": "pindah tab"}]},
    )
    with db() as session:
        question_ids = seed_questions(session, session_id)
    client.get(f"/api/sessions/{session_id}/questions")
    client.post(
        f"/api/sessions/{session_id}/answers",
        json={
            "jawaban": [
                {"pertanyaan_id": question_ids[0], "text": "jawab ideasi"},
                {"pertanyaan_id": question_ids[1], "text": "jawab isi"},
                {"pertanyaan_id": question_ids[2], "text": "jawab harapan"},
            ]
        },
    )
    return session_id


def test_session_detail_for_guru_matches_frontend_shape(client, login_as, murid, guru, db):
    from api.core.models.penilaian_ai import PenilaianAI

    login_as(murid)
    with db() as session:
        tugas = make_tugas(guru, session)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("Gagasan-Ana.pdf", FAKE_PDF, "application/pdf")},
    )
    client.post(
        f"/api/sessions/{session_id}/violations",
        json={
            "violations": [
                {"type": "tab_switch", "detail": "pindah tab", "client_ts": "2026-01-01T10:00:00Z"}
            ]
        },
    )
    with db() as session:
        question_ids = seed_questions(session, session_id)
        session.add(
            PenilaianAI(
                session_id=session_id,
                skor_ideasi=82,
                skor_isi=78,
                skor_harapan=85,
                skor_total=81.67,
                ringkasan="Konsisten dengan isi Unggahan.",
            )
        )
        session.commit()
    client.get(f"/api/sessions/{session_id}/questions")
    client.post(
        f"/api/sessions/{session_id}/answers",
        json={
            "jawaban": [
                {"pertanyaan_id": question_ids[0], "text": "jawab ideasi"},
                {"pertanyaan_id": question_ids[1], "text": "jawab isi"},
                {"pertanyaan_id": question_ids[2], "text": "jawab harapan"},
            ]
        },
    )

    login_as(guru)
    response = client.get(f"/api/sessions/{session_id}")
    assert response.status_code == 200
    body = response.json()

    # Kunci persis seperti `SessionDetail` di guru-api.ts.
    assert set(body) == {
        "id",
        "tugasId",
        "tugasBrief",
        "attemptNo",
        "status",
        "murid",
        "dimulaiAt",
        "batasJawabAt",
        "dikumpulAt",
        "unggahan",
        "pelanggaran",
        "tanyaJawab",
        "penilaian",
        "riwayat",
    }
    assert body["id"] == session_id
    assert body["tugasId"] == tugas.id
    assert body["tugasBrief"] == tugas.brief
    assert body["attemptNo"] == 1
    assert body["status"] == "submitted"
    assert set(body["murid"]) == {"nama", "email"}

    assert body["dimulaiAt"]
    assert body["batasJawabAt"]
    assert body["dikumpulAt"]

    assert set(body["unggahan"]) == {
        "namaFile",
        "mime",
        "ukuranBytes",
        "diunggahAt",
        "url",
    }
    assert body["unggahan"]["namaFile"] == "Gagasan-Ana.pdf"
    assert body["unggahan"]["ukuranBytes"] == len(FAKE_PDF)
    assert body["unggahan"]["url"].endswith(f"/api/sessions/{session_id}/unggahan")

    assert set(body["pelanggaran"][0]) == {"id", "type", "detail", "clientTs", "serverTs"}
    assert body["pelanggaran"][0]["type"] == "tab_switch"
    assert body["pelanggaran"][0]["detail"] == "pindah tab"
    assert body["pelanggaran"][0]["clientTs"].startswith("2026-01-01")

    assert len(body["tanyaJawab"]) == 3
    assert all(set(item) >= {"id", "type", "question", "answer"} for item in body["tanyaJawab"])
    assert all(item["evidence"] == "kutipan dari dokumen" for item in body["tanyaJawab"])
    assert {item["type"] for item in body["tanyaJawab"]} == {"ideasi", "isi", "harapan"}

    assert body["penilaian"] == {
        "skorIdeasi": 82,
        "skorIsi": 78,
        "skorHarapan": 85,
        "skorTotal": 81.67,
        "ringkasan": "Konsisten dengan isi Unggahan.",
    }

    assert len(body["riwayat"]) == 1
    assert set(body["riwayat"][0]) == {
        "sessionId",
        "attemptNo",
        "status",
        "dimulaiAt",
        "dikumpulAt",
        "pelanggaranCount",
    }
    assert body["riwayat"][0]["pelanggaranCount"] == 1


def test_session_detail_without_upload_and_penilaian(client, login_as, murid, guru, db):
    login_as(murid)
    with db() as session:
        tugas = make_tugas(guru, session)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]

    login_as(guru)
    body = client.get(f"/api/sessions/{session_id}").json()

    assert body["status"] == "created"
    assert body["unggahan"] is None
    assert body["penilaian"] is None
    assert body["batasJawabAt"] is None
    assert body["dikumpulAt"] is None
    assert body["tanyaJawab"] == []
    assert body["pelanggaran"] == []


def test_murid_gets_compact_summary_from_session_detail(client, login_as, murid, guru, db):
    login_as(murid)
    with db() as session:
        tugas = make_tugas(guru, session)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )

    summary = client.get(f"/api/sessions/{session_id}")

    assert summary.status_code == 200
    body = summary.json()
    # Bentuk snake_case `Sesi` di murid-api.ts — bukan `SessionDetail` Guru.
    assert set(body) == {
        "id",
        "tugas_id",
        "attempt_no",
        "status",
        "started_at",
        "uploaded_at",
        "timer_ends_at",
        "submitted_at",
        "uploaded",
        "filename",
    }
    assert body["timer_ends_at"] is not None
    assert body["uploaded"] is True


def test_guru_cannot_read_session_of_other_tugas(client, login_as, murid, guru, db):
    login_as(murid)
    with db() as session:
        tugas = make_tugas(guru, session)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]

    login_as("guru")
    assert client.get(f"/api/sessions/{session_id}").status_code == 404


def test_izin_returns_session_id_baru(client, login_as, murid, guru, db):
    from api.core.enums import SessionStatus
    from api.core.models.pertanyaan import Jawaban

    login_as(murid)
    session_id = run_murid_to_submitted(client, db, guru, murid)

    login_as(guru)
    response = client.post(f"/api/sessions/{session_id}/izin")
    assert response.status_code == 201
    retry = response.json()
    # `HasilIzin` di guru-api.ts.
    assert set(retry) == {"sessionIdBaru", "attemptNo"}
    assert retry["attemptNo"] == 2
    assert retry["sessionIdBaru"] != session_id

    # Baris baru benar-benar berstatus created.
    from api.core.models.session import SessionRow

    with db() as session:
        baru = session.get(SessionRow, retry["sessionIdBaru"])
        assert baru.status == SessionStatus.CREATED
        assert baru.attempt_no == 2
        assert baru.timer_ends_at is None
        # Riwayat attempt lama utuh (Pertanyaan + Jawaban tidak dihapus).
        assert session.query(Jawaban).count() == 3

    detail = client.get(f"/api/sessions/{session_id}").json()
    assert [item["attemptNo"] for item in detail["riwayat"]] == [1, 2]

    # Attempt baru yang aktif -> izin kedua ditolak.
    assert client.post(f"/api/sessions/{session_id}/izin").status_code == 409


def test_izin_conflicts_with_active_attempt(client, login_as, murid, guru, db):
    login_as(murid)
    with db() as session:
        tugas = make_tugas(guru, session)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]

    login_as(guru)
    assert client.post(f"/api/sessions/{session_id}/izin").status_code == 409


def test_izin_requires_guru(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
        row = make_session_row(session, tugas, murid)

    login_as(murid)
    # Izin (Guru) pada Sesi yang bukan milik Tugas user ini → 404 (bukan 403
    # karena kelas akses universal).
    assert client.post(f"/api/sessions/{row.id}/izin").status_code == 404


def test_participants_matches_frontend_shape(client, login_as, murid, guru, db):
    login_as(murid)
    with db() as session:
        tugas = make_tugas(guru, session, )
    first = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{first}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )
    client.post(
        f"/api/sessions/{first}/violations",
        json={
            "violations": [
                {"type": "tab_switch"},
                {"type": "window_blur"},
                {"type": "multi_tab"},
            ]
        },
    )

    login_as(guru)
    response = client.get(f"/api/tugas/{tugas.id}/participants")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert set(body[0]) == {
        "muridId",
        "nama",
        "email",
        "sessionId",
        "attemptNo",
        "status",
        "pelanggaranCount",
        "terakhirAktif",
        "riwayat",
    }
    assert body[0]["muridId"] == murid.id
    assert body[0]["nama"] == murid.name
    assert body[0]["email"] == murid.email
    assert body[0]["sessionId"] == first
    assert body[0]["attemptNo"] == 1
    assert body[0]["status"] == "generating"
    assert body[0]["pelanggaranCount"] == 3
    assert body[0]["terakhirAktif"]
    assert len(body[0]["riwayat"]) == 1


def test_participants_shows_latest_attempt_with_history(client, login_as, murid, guru, db):
    from api.core.enums import SessionStatus
    from api.core.models.session import SessionRow

    login_as(murid)
    with db() as session:
        tugas = make_tugas(guru, session)
    first = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{first}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )
    client.post(
        f"/api/sessions/{first}/violations",
        json={"violations": [{"type": "tab_switch"}]},
    )

    # Paksa attempt pertama terminal supaya izin bisa diberikan.
    with db() as session:
        row = session.get(SessionRow, first)
        row.status = SessionStatus.SUBMITTED
        session.commit()

    login_as(guru)
    retry = client.post(f"/api/sessions/{first}/izin").json()
    assert retry["attemptNo"] == 2

    body = client.get(f"/api/tugas/{tugas.id}/participants").json()
    assert len(body) == 1
    # Ringkasan menunjuk attempt terbaru; riwayat memuat keduanya.
    assert body[0]["sessionId"] == retry["sessionIdBaru"]
    assert body[0]["attemptNo"] == 2
    assert body[0]["status"] == "created"
    assert body[0]["pelanggaranCount"] == 0
    assert [item["attemptNo"] for item in body[0]["riwayat"]] == [1, 2]
    assert body[0]["riwayat"][0]["pelanggaranCount"] == 1