"""WARR timer: auto-submit saat habis, idempoten, dan memaksa 409 saat menjawab."""

from __future__ import annotations

from datetime import datetime, timedelta

from conftest import FAKE_PDF, make_session_row, make_tugas, seed_questions
from api.core.clock import utcnow
from api.core.enums import SessionStatus


def expire_timer(db, session_id: str) -> None:
    """Set `timer_ends_at` ke masa lalu (simulasi timer habis)."""
    from api.core.models.session import SessionRow

    with db() as session:
        row = session.get(SessionRow, session_id)
        row.timer_ends_at = utcnow() - timedelta(seconds=1)
        session.commit()


def test_status_read_auto_submits_when_timer_expired(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)

    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )
    expire_timer(db, session_id)

    status = client.get(f"/api/sessions/{session_id}/status")
    assert status.status_code == 200
    body = status.json()
    assert body["status"] == "auto_submitted"
    # Countdown bar tetap terbaca walau Sesi sudah tertutup.
    assert body["timer_ends_at"] is not None
    assert body["submitted_at"] is not None

    # Idempoten: pembacaan kedua tetap auto_submitted.
    assert client.get(f"/api/sessions/{session_id}/status").json()["status"] == "auto_submitted"


def test_questions_after_timer_expiry_returns_409(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)

    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )
    expire_timer(db, session_id)

    assert client.get(f"/api/sessions/{session_id}/questions").status_code == 409


def test_submit_after_timer_expiry_forces_auto_submit(client, login_as, murid, guru, db):
    from api.core.models.pertanyaan import Jawaban

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
    assert client.get(f"/api/sessions/{session_id}/questions").json()["status"] == "answering"

    expire_timer(db, session_id)

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
    assert response.status_code == 409
    # Auto-submit paksa terjadi, jawaban TIDAK tersimpan.
    assert client.get(f"/api/sessions/{session_id}/status").json()["status"] == "auto_submitted"
    # Cliente yang mengirim `{jawaban: [...]}` tidak boleh gagal diam-diam.

    with db() as session:
        assert session.query(Jawaban).filter_by(pertanyaan_id=question_ids[0]).count() == 0


def test_timer_starts_at_upload_not_at_session_start(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session, sesi_minutes=7)
    login_as(murid)

    created = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()
    assert created["timer_ends_at"] is None

    uploaded = client.post(
        f"/api/sessions/{created['id']}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    ).json()

    assert uploaded["uploaded_at"] is not None
    started = datetime.fromisoformat(uploaded["uploaded_at"])
    ends = datetime.fromisoformat(uploaded["timer_ends_at"])
    delta = ends - started
    assert timedelta(minutes=6, seconds=55) <= delta <= timedelta(minutes=7, seconds=1)


def test_enforce_timer_transitions_once_and_is_idempotent(db, guru, murid):
    """Helper timer boleh dipanggil berulang (aman untuk background worker)."""
    from api.core.services.session_state import enforce_timer

    with db() as session:
        tugas = make_tugas(guru, session)
        row = make_session_row(
            session,
            tugas,
            murid,
            status=SessionStatus.ANSWERING,
            timer_ends_at=utcnow() - timedelta(seconds=5),
        )
        session_id = row.id

    with db() as session:
        from api.core.models.session import SessionRow

        live = session.get(SessionRow, session_id)
        assert enforce_timer(session, live) is True
        assert live.status == SessionStatus.AUTO_SUBMITTED
        assert live.submitted_at is not None

        # Panggilan kedua tidak mengubah apa pun.
        assert enforce_timer(session, live) is False
        assert live.status == SessionStatus.AUTO_SUBMITTED