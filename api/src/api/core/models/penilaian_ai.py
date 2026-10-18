"""Tabel `penilaian_ai` — DESIGN.md §4, §6.

Confidential: hanya Guru yang boleh membacanya. `skor_total` di-recompute server
dari tiga skor aspek — nilai yang dideklarasikan model tidak dipercaya
(DESIGN.md §6 langkah 6).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.clock import utcnow
from api.core.models.base import Base, TimestampMixin


class PenilaianAI(TimestampMixin, Base):
    __tablename__ = "penilaian_ai"

    session_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        primary_key=True,
    )
    skor_ideasi: Mapped[int | None] = mapped_column(Integer, nullable=True)
    skor_isi: Mapped[int | None] = mapped_column(Integer, nullable=True)
    skor_harapan: Mapped[int | None] = mapped_column(Integer, nullable=True)
    skor_total: Mapped[int | None] = mapped_column(Float, nullable=True)
    ringkasan: Mapped[str | None] = mapped_column(Text, nullable=True)
    assessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    sesi: Mapped["SessionRow"] = relationship(back_populates="penilaian")  # noqa: F821


def recompute_total(skor_ideasi: int | None, skor_isi: int | None, skor_harapan: int | None) -> float | None:
    """Rata-rata tiga aspek; None kalau ada aspek yang belum dinilai."""
    aspects = [skor_ideasi, skor_isi, skor_harapan]
    if any(value is None for value in aspects):
        return None
    return round(sum(int(value) for value in aspects) / len(aspects), 2)  # type: ignore[arg-type]