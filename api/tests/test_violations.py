"""Ingest Pelanggaran: server_ts server, dedup 1 detik, rate-limit 20/menit."""

from __future__ import annotations

from datetime import timedelta

from conftest import FAKE_PDF, make_tugas
from api.core.clock import utcnow
from api.core.enums import PelanggaranType


def new_session(client, tugas) -> str:
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )
    return session_id


def test_batch_ingest_records_server_timestamp(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = new_session(client, tugas)

    response = client.post(
        f"/api/sessions/{session_id}/violations",
        json={
            "violations": [
                {"type": "tab_switch", "detail": "keluar tab", "client_ts": "2020-01-01T00:00:00Z"},
                {"type": "copy_blocked"},
            ]
        },
    )

    assert response.status_code == 200
    assert response.json() == {"accepted": 2, "dropped": 0}

    from api.core.models.pelanggaran import Pelanggaran

    with db() as session:
        rows = session.query(Pelanggaran).filter_by(session_id=session_id).all()
        assert len(rows) == 2
        # server_ts ditulis server, bukan dari client_ts kiriman.
        assert all(row.server_ts.year >= 2026 for row in rows)
        detail = next(row for row in rows if row.type == PelanggaranType.TAB_SWITCH)
        assert detail.detail == "keluar tab"


def test_dedup_same_type_within_one_second(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = new_session(client, tugas)

    response = client.post(
        f"/api/sessions/{session_id}/violations",
        json={
            "violations": [
                {"type": "window_blur"},
                {"type": "window_blur"},
                {"type": "fullscreen_exit"},
            ]
        },
    )

    assert response.status_code == 200
    assert response.json() == {"accepted": 2, "dropped": 1}

    from api.core.models.pelanggaran import Pelanggaran

    with db() as session:
        rows = session.query(Pelanggaran).filter_by(session_id=session_id).all()
        assert sorted(row.type for row in rows) == [
            PelanggaranType.FULLSCREEN_EXIT,
            PelanggaranType.WINDOW_BLUR,
        ]


def test_dedup_against_previously_stored_event(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = new_session(client, tugas)

    first = client.post(
        f"/api/sessions/{session_id}/violations",
        json={"violations": [{"type": "paste_blocked"}]},
    )
    assert first.json()["accepted"] == 1

    second = client.post(
        f"/api/sessions/{session_id}/violations",
        json={"violations": [{"type": "paste_blocked"}]},
    )
    assert second.json() == {"accepted": 0, "dropped": 1}


def test_rate_limit_drops_extras_after_twenty_per_minute(client, login_as, murid, guru, db):
    from api.core.models.pelanggaran import Pelanggaran

    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = new_session(client, tugas)

    # Isi kuota 20/menit dengan event di luar dedup 1 detik.
    now = utcnow()
    with db() as session:
        for index in range(20):
            tipe = list(PelanggaranType)[index % len(PelanggaranType)]
            session.add(
                Pelanggaran(
                    session_id=session_id,
                    type=tipe,
                    detail=f"seed-{index}",
                    server_ts=now - timedelta(seconds=5),
                )
            )
        session.commit()

    response = client.post(
        f"/api/sessions/{session_id}/violations",
        json={"violations": [{"type": "multi_tab"}]},
    )

    assert response.status_code == 200
    assert response.json() == {"accepted": 0, "dropped": 1}

    with db() as session:
        assert session.query(Pelanggaran).filter_by(session_id=session_id).count() == 20


def test_unknown_violation_type_rejected(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = new_session(client, tugas)

    response = client.post(
        f"/api/sessions/{session_id}/violations",
        json={"violations": [{"type": "print_screen"}]},
    )

    assert response.status_code == 422

    from api.core.models.pelanggaran import Pelanggaran

    with db() as session:
        assert session.query(Pelanggaran).filter_by(session_id=session_id).count() == 0


def test_empty_batch_is_accepted(client, login_as, murid, guru, db):
    with db() as session:
        tugas = make_tugas(guru, session)
    login_as(murid)
    session_id = new_session(client, tugas)

    response = client.post(
        f"/api/sessions/{session_id}/violations",
        json={"violations": []},
    )
    assert response.status_code == 200
    assert response.json() == {"accepted": 0, "dropped": 0}