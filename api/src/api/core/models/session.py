"""Tabel `sessions` — DESIGN.md §3, §4.

State machine: created -> generating -> answering -> submitted | auto_submitted.
`timer_ends_at` di-set saat transisi ke `generating` (upload sukses) — bukan
saat Sesi dibuat.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.clock import utcnow
from api.core.enums import SessionStatus
from api.core.models.base import Base, IdMixin
from api.core.models.tugas import Tugas

ACTIVE_STATUSES: tuple[SessionStatus, ...] = (
    SessionStatus.CREATED,
    SessionStatus.GENERATING,
    SessionStatus.ANSWERING,
)

TERMINAL_STATUSES: tuple[SessionStatus, ...] = (
    SessionStatus.SUBMITTED,
    SessionStatus.AUTO_SUBMITTED,
)


class SessionRow(IdMixin, Base):
    """Baris Sesi. Satu baris per attempt; attempt_no naik tiap Izin Unggah Ulang."""

    __tablename__ = "sessions"
    __table_args__ = (
        UniqueConstraint(
            "tugas_id",
            "murid_id",
            "attempt_no",
            name="uq_sessions_tugas_murid_attempt",
        ),
        # Partial unique ala Proctora: satu Sesi aktif (status='created') per
        # (tugas, murid). Didukung SQLite >= 3.8 dan Postgres.
        Index(
            "uq_sessions_active_per_tugas_murid",
            "tugas_id",
            "murid_id",
            unique=True,
            sqlite_where=text("status = 'created'"),
            postgresql_where=text("status = 'created'"),
        ),
        Index("ix_sessions_tugas_murid", "tugas_id", "murid_id"),
        Index("ix_sessions_murid", "murid_id"),
    )

    tugas_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("tugas.id", ondelete="CASCADE"),
        nullable=False,
    )
    murid_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    status: Mapped[SessionStatus] = mapped_column(
        # native_enum=False -> VARCHAR + CHECK di kedua dialect, nilai enum
        # disimpan sebagai *value* (lowercase) supaya cocok dengan kontrak TS.
        SAEnum(
            SessionStatus,
            name="session_status",
            values_callable=lambda enum_cls: [item.value for item in enum_cls],
            native_enum=False,
            validate_strings=True,
            length=16,
        ),
        nullable=False,
        default=SessionStatus.CREATED,
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utcnow
    )
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    timer_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tugas: Mapped[Tugas] = relationship(back_populates="sesi")
    unggahan: Mapped["Unggahan | None"] = relationship(  # noqa: F821
        back_populates="sesi",
        cascade="all, delete-orphan",
        uselist=False,
    )
    pelanggaran: Mapped[list["Pelanggaran"]] = relationship(  # noqa: F821
        back_populates="sesi",
        cascade="all, delete-orphan",
    )
    pertanyaan: Mapped[list["Pertanyaan"]] = relationship(  # noqa: F821
        back_populates="sesi",
        cascade="all, delete-orphan",
    )
    penilaian: Mapped["PenilaianAI | None"] = relationship(  # noqa: F821
        back_populates="sesi",
        cascade="all, delete-orphan",
        uselist=False,
    )

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_STATUSES

    @property
    def is_active(self) -> bool:
        """'Aktif' = masih boleh dikerjakan Murid (termasuk attempt berjalan)."""
        return self.status in ACTIVE_STATUSES