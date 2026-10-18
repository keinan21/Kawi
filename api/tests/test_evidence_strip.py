"""Evidence tidak pernah keluar lewat API Murid (DESIGN.md §6).

Bukti brightest: tidak ada model/schema sisi Murid yang punya field `evidence`,
dan payload yang benar-benar dikirim ke browser Murid tidak memuat string
kutipan mana pun.
"""

from __future__ import annotations

from conftest import FAKE_PDF, make_tugas, seed_questions
from api.core.schemas.responses import (
    PertanyaanMuridOut,
    SessionOut,
    SessionStatusOut,
)


def test_murid_schema_has_no_evidence_field():
    assert "evidence" not in PertanyaanMuridOut.model_fields
    assert "evidence" not in SessionOut.model_fields
    assert "evidence" not in SessionStatusOut.model_fields


def test_murid_payload_strips_evidence(client, login_as, murid, guru, db):
    login_as(murid)
    with db() as session:
        tugas = make_tugas(guru, session)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("rahasia.pdf", FAKE_PDF, "application/pdf")},
    )
    with db() as session:
        seed_questions(session, session_id, with_evidence=True)

    murid_view = client.get(f"/api/sessions/{session_id}/questions")
    assert murid_view.status_code == 200
    assert "evidence" not in str(murid_view.json())
    assert all("evidence" not in item for item in murid_view.json()["questions"])

    # `GET /api/sessions/:id` untuk Murid pemilik juga tidak boleh memuatnya.
    summary = client.get(f"/api/sessions/{session_id}")
    assert summary.status_code == 200
    assert "evidence" not in str(summary.json())
    assert "tanyaJawab" not in summary.json()

    # Guru tetap boleh melihatnya untuk audit.
    login_as(guru)
    guru_view = client.get(f"/api/sessions/{session_id}")
    assert guru_view.status_code == 200
    qa = guru_view.json()["tanyaJawab"]
    assert len(qa) == 3
    assert all(item["evidence"] == "kutipan dari dokumen" for item in qa)


def test_murid_never_sees_penilaian_ai(client, login_as, murid, guru, db):
    """Penilaian AI confidential: tidak ada di schema Murid maupun payload."""
    from api.core.models.penilaian_ai import PenilaianAI

    login_as(murid)
    with db() as session:
        tugas = make_tugas(guru, session)
    session_id = client.post("/api/sessions", json={"tugas_id": tugas.id}).json()["id"]
    client.post(
        f"/api/sessions/{session_id}/unggahan",
        files={"file": ("a.pdf", FAKE_PDF, "application/pdf")},
    )
    with db() as session:
        session.add(
            PenilaianAI(
                session_id=session_id,
                skor_ideasi=50,
                skor_isi=50,
                skor_harapan=50,
                skor_total=50.0,
                ringkasan="Ringkasan harus bocor",
            )
        )
        session.commit()

    assert "penilaian_ai" not in SessionOut.model_fields
    assert "penilaian" not in SessionOut.model_fields

    payloads = [
        client.get(f"/api/sessions/{session_id}/status").text,
        client.get(f"/api/sessions/{session_id}/questions").text,
        client.get(f"/api/sessions/{session_id}").text,
    ]
    for payload in payloads:
        assert "skor" not in payload
        assert "Ringkasan harus bocor" not in payload