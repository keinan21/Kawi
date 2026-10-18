"""Dependency auth + route guard (DESIGN.md §5).

- `get_current_user`  — verifikasi token Clerk + auto-upsert baris `users`.
- `require_guru`      — 403 kalau peran bukan Guru.
- `require_murid`     — login wajib;Murid yang belum onboard dianggap Murid.
- `owned_session`     — 404 kalau Sesi milik Murid lain (sembunyikan existence).

`get_current_user` adalah titik ekstensi tunggal untuk test: test meng-override
dependency ini, tanpa menyentuh kode produksi.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from api.core.auth.clerk import upsert_user, verify_session_token
from api.core.db import get_db
from api.core.enums import UserRole
from api.core.models.session import SessionRow
from api.core.models.tugas import Tugas
from api.core.models.user import User


def get_current_user(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> User:
    """User dari session token Clerk; baris `users` dibuat bila belum ada."""
    identity = verify_session_token(request)
    return upsert_user(db, identity)


def require_guru(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Guard route group Guru: akun universal — Guru dan Murid bisa sama."""
    return user


def require_murid(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    """Guard route group Murid: akun universal. Kepemilikan sesi dicek `load_owned_session`."""
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
GuruUser = Annotated[User, Depends(require_guru)]
MuridUser = Annotated[User, Depends(require_murid)]
DbSession = Annotated[Session, Depends(get_db)]


def _not_found() -> HTTPException:
    """404 seragam — jangan bocorkan keberadaan Sesi milik orang lain."""
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesi tidak ditemukan")


def load_owned_session(
    db: Session,
    session_id: str,
    user: User,
) -> SessionRow:
    """Ambil Sesi milik Murid `user`; 404 untuk sesi orang lain."""
    row = db.get(SessionRow, session_id)
    if row is None or row.murid_id != user.id:
        raise _not_found()
    return row


def load_owned_tugas(
    db: Session,
    tugas_id: str,
    user: User,
) -> Tugas:
    """Ambil Tugas milik Guru `user`; 404 untuk tugas orang lain."""
    row = db.get(Tugas, tugas_id)
    if row is None or row.guru_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tugas tidak ditemukan")
    return row


def load_guru_session(db: Session, session_id: str, user: User) -> SessionRow:
    """Ambil Sesi milik Murid dari Tugas milik Guru `user`."""
    row = db.get(SessionRow, session_id)
    if row is None:
        raise _not_found()
    tugas = db.get(Tugas, row.tugas_id)
    if tugas is None or tugas.guru_id != user.id:
        raise _not_found()
    return row