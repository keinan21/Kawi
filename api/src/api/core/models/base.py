"""Deklarasi dasar model SQLAlchemy 2.0 (typed).

Skema mengikuti DESIGN.md §4. ID bertipe string uuid supaya portabel antara
SQLite (test) dan Postgres (produksi).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from api.core.clock import utcnow


def new_id() -> str:
    """Primary key uuid4 dalam bentuk string (portabel SQLite/Postgres)."""
    return uuid.uuid4().hex


class Base(DeclarativeBase):
    """Base deklaratif untuk seluruh tabel."""


class IdMixin:
    """Kolom `id` string uuid."""

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)


class TimestampMixin:
    """`created_at` diisi otomatis di sisi aplikasi (bukan server_default)."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        nullable=False,
    )


__all__ = ["Base", "IdMixin", "TimestampMixin", "new_id"]