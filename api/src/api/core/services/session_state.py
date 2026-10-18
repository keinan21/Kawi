"""State machine Sesi + WARR timer (DESIGN.md §3).

Dua aturan yang ditegakkan di sini, dipanggil setiap route membaca/menulis
status Sesi:

- `enforce_timer`: kalau `timer_ends_at` sudah lewat saat status masih
  `generating`/`answering`, Sesi langsung `auto_submitted`. Idempoten — dipanggil
  berulang aman, dan boleh dipanggil di background worker.
- `mark_answering_if_ready`: saat pipeline AI selesai menulis Pertanyaan, Sesi
  pindah `generating` -> `answering` (read-repair, idempoten).
"""

from __future__ import annotations

from datetime import timedelta

from fastapi import BackgroundTasks
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from api.core.clock import as_utc, utcnow
from api.core.enums import SessionStatus
from api.core.models.pelanggaran import Pelanggaran
from api.core.models.pertanyaan import Pertanyaan, expected_question_count
from api.core.models.session import SessionRow
from api.core.models.tugas import Tugas
from api.core.services.ai_hooks import schedule_assess


def enforce_timer(
    db: Session,
    row: SessionRow,
    *,
    background: BackgroundTasks | None = None,
) -> bool:
    """Auto-submit kalau timer habis. True kalau terjadi transisi.

    Idempoten dan aman dipanggil dari background worker maupun request biasa.
    """
    if row.status not in (SessionStatus.GENERATING, SessionStatus.ANSWERING):
        return False

    deadline = as_utc(row.timer_ends_at)
    if deadline is None or utcnow() < deadline:
        return False

    row.status = SessionStatus.AUTO_SUBMITTED
    row.submitted_at = utcnow()
    db.commit()
    schedule_assess(background, row.id)
    return True


def start_generating(db: Session, row: SessionRow, sesi_minutes: int) -> None:
    """Transisi `created` -> `generating`; timer mulai di sini (upload sukses)."""
    now = utcnow()
    row.status = SessionStatus.GENERATING
    row.uploaded_at = now
    row.timer_ends_at = now + timedelta(minutes=sesi_minutes)
    db.commit()


def mark_answering_if_ready(db: Session, row: SessionRow) -> bool:
    """Pindah ke `answering` begitu jumlah Pertanyaan mencukupi.

    Dipakai endpoint polling dan test yang menyuntik Pertanyaan langsung.
    """
    if row.status != SessionStatus.GENERATING:
        return False

    tugas = db.get(Tugas, row.tugas_id)
    required = expected_question_count(tugas.questions_per_type if tugas else 1)
    count = db.scalar(
        select(func.count())
        .select_from(Pertanyaan)
        .where(Pertanyaan.session_id == row.id)
    )
    if not count or count < required:
        return False

    row.status = SessionStatus.ANSWERING
    db.commit()
    return True


def has_active_attempt(db: Session, tugas_id: str, murid_id: str) -> bool:
    """True kalau Murid punya attempt yang belum terminal untuk Tugas ini."""
    count = db.scalar(
        select(func.count())
        .select_from(SessionRow)
        .where(
            SessionRow.tugas_id == tugas_id,
            SessionRow.murid_id == murid_id,
            SessionRow.status.in_(
                (
                    SessionStatus.CREATED,
                    SessionStatus.GENERATING,
                    SessionStatus.ANSWERING,
                )
            ),
        )
    )
    return bool(count)


def count_violations(db: Session, session_id: str) -> int:
    """Jumlah Pelanggaran satu Sesi (count di sisi baca — DESIGN.md §4)."""
    count = db.scalar(
        select(func.count())
        .select_from(Pelanggaran)
        .where(Pelanggaran.session_id == session_id)
    )
    return int(count or 0)