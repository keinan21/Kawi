"""Tabel `tugas` — DESIGN.md §4.

`token` adalah slug share-link (gaya Google Forms). `file_types` disimpan sebagai
JSON, bukan ARRAY, supaya portabel SQLite/Postgres.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from api.core.models.base import Base, IdMixin, TimestampMixin

# MIME yang boleh diunggah Unggahan (DESIGN.md §5, allow-list).
DEFAULT_FILE_TYPES: tuple[str, ...] = (
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
)

MAX_BYTES_DEFAULT = 2_000_000
SESI_MINUTES_DEFAULT = 10
QUESTIONS_PER_TYPE_DEFAULT = 1


class Tugas(IdMixin, TimestampMixin, Base):
    __tablename__ = "tugas"

    guru_id: Mapped[str] = mapped_column(
        String(32),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    brief: Mapped[str] = mapped_column(Text, nullable=False)
    file_types: Mapped[list[str]] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: list(DEFAULT_FILE_TYPES),
    )
    max_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=MAX_BYTES_DEFAULT)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sesi_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=SESI_MINUTES_DEFAULT)
    questions_per_type: Mapped[int] = mapped_column(
        Integer, nullable=False, default=QUESTIONS_PER_TYPE_DEFAULT
    )

    sesi: Mapped[list["SessionRow"]] = relationship(  # noqa: F821
        back_populates="tugas",
        cascade="all, delete-orphan",
    )


def file_types_out(value: Any) -> list[str]:
    """Normalisasi kolom `file_types` jadi list[str]."""
    if not value:
        return list(DEFAULT_FILE_TYPES)
    if isinstance(value, list):
        return [str(item) for item in value]
    return list(DEFAULT_FILE_TYPES)