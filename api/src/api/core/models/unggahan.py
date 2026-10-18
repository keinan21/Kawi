"""Tabel `unggahan` — DESIGN.md §4.

Satu Unggahan per Sesi (`session_id` unik). Upload bersifat one-shot; percobaan
baru hanya lewat Izin Unggah Ulang yang membuat baris `sessions` baru.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.clock import utcnow
from api.core.models.base import Base, IdMixin, TimestampMixin


class Unggahan(IdMixin, TimestampMixin, Base):
    __tablename__ = "unggahan"

    session_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime: Mapped[str] = mapped_column(String(160), nullable=False)
    bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    sesi: Mapped["SessionRow"] = relationship(back_populates="unggahan")  # noqa: F821