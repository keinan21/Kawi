"""Tabel `pelanggaran` — DESIGN.md §4, §7.

Log append-only. `server_ts` selalu ditulis server (klien tidak dipercaya),
`client_ts` disimpan terpisah hanya sebagai jejak audit. Count dibaca via
`GROUP BY` di sisi baca — volume kecil, tidak perlu tabel counter.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.clock import utcnow
from api.core.enums import PelanggaranType
from api.core.models.base import Base, IdMixin, TimestampMixin


class Pelanggaran(IdMixin, TimestampMixin, Base):
    __tablename__ = "pelanggaran"
    __table_args__ = (
        Index("ix_pelanggaran_session_server_ts", "session_id", "server_ts"),
        Index("ix_pelanggaran_session_type", "session_id", "type"),
    )

    session_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[PelanggaranType] = mapped_column(
        SAEnum(
            PelanggaranType,
            name="pelanggaran_type",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
            native_enum=False,
            validate_strings=True,
            length=32,
        ),
        nullable=False,
    )
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    client_ts: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    server_ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )

    sesi: Mapped["SessionRow"] = relationship(back_populates="pelanggaran")  # noqa: F821