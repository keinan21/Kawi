"""Tabel `users` — DESIGN.md §4.

Satu baris per user Clerk. `role` boleh NULL: baris dibuat otomatis saat
permintaan terautentikasi pertama dengan peran default Murid, lalu diisi satu
kali lewat `POST /api/auth/onboard` (atau dari `publicMetadata` Clerk).
"""

from __future__ import annotations

from sqlalchemy import CheckConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from api.core.enums import UserRole
from api.core.models.base import Base, IdMixin, TimestampMixin

# Disimpan sebagai VARCHAR + CHECK (bukan native enum Postgres) supaya skema
# sama persis di SQLite (test) dan Postgres (produksi) — DESIGN.md §8.
ROLE_VALUES = ", ".join(f"'{role.value}'" for role in UserRole)


class User(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            f"role IS NULL OR role IN ({ROLE_VALUES})",
            name="ck_users_role",
        ),
    )

    clerk_id: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    role: Mapped[str | None] = mapped_column(String(16), nullable=True, default=None)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)

    @property
    def is_guru(self) -> bool:
        return self.role == UserRole.GURU.value

    @property
    def role_or_murid(self) -> str:
        """Peran efektif: belum onboard diperlakukan sebagai Murid."""
        return self.role or UserRole.MURID.value