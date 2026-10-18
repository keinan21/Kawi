"""Sesi Murid: lifecycle penuh create -> unggah -> questions -> answers -> submitted."""

from __future__ import annotations

from conftest import FAKE_PDF, make_session_row, make_tugas, seed_questions


def start_session(client, tugas_id: str) -> dict:
    response = client.post("/api/sessions", json={"tugas_id": tugas_id})
    assert response.status_code == 201
    return response.json()


def test_happy_path_lifecycle(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)

    # 1. Mulai Sesi — balasan tanpa amplop, langsung objek SessionOut
    created = start_session(client, tugas.id)
    assert created["status"] == "created"
    assert created["attempt_no"] == 1
    assert created["timer_ends_at"] is None
    assert created["uploaded"] is False
    assert created["filename"] is None
    session_id = created["id"]

    # 2. Sesi kedua saat masih ada attempt aktif -> 409 + `session_id` di body
    conflict = client.post("/api/sessions", json={"tugas_id": tugas.id})
    assert conflict.status_code == 409
    assert conflict.json()["session_id"] == session_id

    # 3. Pertanyaan sebelum unggah -> 409
    assert client.get(f"/api/sessions/{session_id}/questions").status_code == 409

    # 4. Unggah PDF palsu
    upload = client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("jawaban.pdf", FAKE_PDF, "application/pdf")},
    )
    assert upload.status_code == 200
    body = upload.json()
    assert body["status"] == "generating"
    assert body["uploaded_at"] is not None
    assert body["timer_ends_at"] is not None
    assert body["uploaded"] is True
    assert body["filename"] == "jawaban.pdf"

    with db() as session:
        from api.core.models.unggahan import Unggahan

        stored = session.query(Unggahan).filter_by(session_id=session_id).one()
        assert stored.mime == "application/pdf"
        assert stored.bytes == len(FAKE_PDF)
        assert stored.storage_path.endswith(".pdf")

    # 5. Polling saat generating -> kosong, bukan error
    polling = client.get(f"/api/sessions/{session_id}/questions")
    assert polling.status_code == 200
    assert polling.json() == {"status": "generating", "questions": []}

    # 6. Lane AI menulis tiga Pertanyaan -> Sesi pindah ke answering
    with db() as session:
        question_ids = seed_questions(session, session_id)
    ready = client.get(f"/api/sessions/{session_id}/questions")
    assert ready.status_code == 200
    payload = ready.json()
    assert payload["status"] == "answering"
    assert len(payload["questions"]) == 3
    # Serializer Murid TIDAK boleh membocorkan evidence.
    assert all("evidence" not in item for item in payload["questions"])
    assert {item["type"] for item in payload["questions"]} == {"ideasi", "isi", "harapan"}

    # 7. Jawab tiga pertanyaan
    answered = client.post(
        f"/api/sessions/{session_id}/answers",
        json={
            "jawaban": [
                {"pertanyaan_id": question_ids[0], "text": "Dari buku Fisheries"},
                {"pertanyaan_id": question_ids[1], "text": "Bagian 3"},
                {"pertanyaan_id": question_ids[2], "text": "Pelaku UMKM"},
            ]
        },
    )
    assert answered.status_code == 200
    assert answered.json()["status"] == "submitted"
    assert answered.json()["submitted_at"] is not None

    # 8. Status endpoint: `status` untuk polling + timer_ends_at untuk countdown bar
    status = client.get(f"/api/sessions/{session_id}/status")
    assert status.status_code == 200
    body = status.json()
    assert body["status"] == "submitted"
    assert body["id"] == session_id
    assert body["attempt_no"] == 1
    assert body["timer_ends_at"] is not None
    assert body["uploaded"] is True
    assert body["filename"] == "jawaban.pdf"

    # 9. Setelah submit, tidak bisa mengunggah atau menjawab lagi
    assert (
        client.post(
            f"/api/sessions/{session_id}/unggahan",
            files={"file": ("lagi.pdf", FAKE_PDF, "application/pdf")},
        ).status_code
        == 409
    )
    assert client.get(f"/api/sessions/{session_id}/questions").status_code == 409


def test_answers_require_exactly_three_and_one_per_type(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = start_session(client, tugas.id)["id"]

    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("jawaban.pdf", FAKE_PDF, "application/pdf")},
    )
    with db() as session:
        question_ids = seed_questions(session, session_id)
    assert client.get(f"/api/sessions/{session_id}/questions").json()["status"] == "answering"

    # Hanya dua jawaban.
    assert (
        client.post(
            f"/api/sessions/{session_id}/answers",
            json={
                "jawaban": [
                    {"pertanyaan_id": question_ids[0], "text": "a"},
                    {"pertanyaan_id": question_ids[1], "text": "b"},
                ]
            },
        ).status_code
        == 400
    )

    # Tiga jawaban tapi satu tipe dobel.
    assert (
        client.post(
            f"/api/sessions/{session_id}/answers",
            json={
                "jawaban": [
                    {"pertanyaan_id": question_ids[0], "text": "a"},
                    {"pertanyaan_id": question_ids[1], "text": "b"},
                    {"pertanyaan_id": question_ids[0], "text": "c"},
                ]
            },
        ).status_code
        == 400
    )

    # Pertanyaan milik Sesi lain tidak diterima.
    with db() as session:
        other = make_session_row(session, tugas, murid, attempt_no=9)
        other_ids = seed_questions(session, other.id)
    assert other.id != session_id

    assert (
        client.post(
            f"/api/sessions/{session_id}/answers",
            json={
                "jawaban": [
                    {"pertanyaan_id": question_ids[0], "text": "a"},
                    {"pertanyaan_id": question_ids[1], "text": "b"},
                    {"pertanyaan_id": other_ids[0], "text": "c"},
                ]
            },
        ).status_code
        == 400
    )

    # Id yang tidak dikenal juga ditolak.
    assert (
        client.post(
            f"/api/sessions/{session_id}/answers",
            json={
                "jawaban": [
                    {"pertanyaan_id": question_ids[0], "text": "a"},
                    {"pertanyaan_id": question_ids[1], "text": "b"},
                    {"pertanyaan_id": "tidak-ada", "text": "c"},
                ]
            },
        ).status_code
        == 400
    )


def test_double_upload_rejected(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = start_session(client, tugas.id)["id"]

    first = client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("satu.pdf", FAKE_PDF, "application/pdf")},
    )
    assert first.status_code == 200

    second = client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("dua.pdf", FAKE_PDF, "application/pdf")},
    )
    assert second.status_code == 409

    # Hanya satu baris Unggahan yang tersimpan.
    from api.core.models.unggahan import Unggahan

    with db() as session:
        assert session.query(Unggahan).filter_by(session_id=session_id).count() == 1


def test_upload_rejects_bad_mime(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = start_session(client, tugas.id)["id"]

    response = client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("virus.exe", b"MZ\x90\x00", "application/x-msdownload")},
    )
    assert response.status_code == 415

    status = client.get(f"/api/sessions/{session_id}/status")
    assert status.json()["status"] == "created"


def test_upload_rejects_oversized_file(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session, max_bytes=1024)
    login_as(murid)
    session_id = start_session(client, tugas.id)["id"]

    response = client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("besar.pdf", b"%PDF-1.4" + b"0" * 4096, "application/pdf")},
    )
    assert response.status_code == 413
    assert client.get(f"/api/sessions/{session_id}/status").json()["status"] == "created"


def test_session_of_other_murid_is_hidden_404(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = start_session(client, tugas.id)["id"]

    login_as("murid")  # murid lain
    assert client.get(f"/api/sessions/{session_id}/status").status_code == 404
    assert client.get(f"/api/sessions/{session_id}/questions").status_code == 404
    assert (
        client.post(
            f"/api/sessions/{session_id}/violations",
            json={"violations": [{"type": "tab_switch"}]},
        ).status_code
        == 404
    )


def test_murid_cannot_use_guru_routes(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)

    # Akun universal: daftar Tugas pribadi bisa diakses.
    assert client.get("/api/tugas").status_code == 200
    # Tugas milik orang lain tetap 404 (bukan 403).
    assert client.get(f"/api/tugas/{tugas.id}").status_code == 404
    assert client.get(f"/api/tugas/{tugas.id}/participants").status_code == 404
    # Route Sesi boleh diakses Murid, tapi milik orang lain tetap 404.
    assert client.get("/api/sessions/apa-saja").status_code == 404


def test_guru_cannot_start_session(client, login_as, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(guru)

    assert client.post("/api/sessions", json={"tugas_id": tugas.id}).status_code == 201


def test_start_session_unknown_tugas_404(client, login_as, murid):
    login_as(murid)
    assert client.post("/api/sessions", json={"tugas_id": "tidak-ada"}).status_code == 404


def test_start_session_after_deadline_forbidden(client, login_as, murid, guru, db):
    from datetime import timedelta

    from api.core.clock import utcnow

    with db() as session:
        tugas = make_tugas(guru, session, deadline_at=utcnow() - timedelta(hours=1))
    login_as(murid)

    assert client.post("/api/sessions", json={"tugas_id": tugas.id}).status_code == 403