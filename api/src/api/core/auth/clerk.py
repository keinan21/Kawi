"""Integrasi Clerk: verifikasi session token + sinkronisasi user (DESIGN.md §5).

Alur:
1. `Authorization: Bearer <session_token>` diverifikasi lewat Clerk Backend API
   (verifikasi JWT langsung ke JWKS, atau lewat BAPI untuk instance dev).
2. Payload session token dipetakan ke baris `users` (auto-upsert saat request
   terautentikasi pertama). Peran default: belum ditentukan -> diperlakukan
   sebagai Murid sampai `POST /api/auth/onboard` mengunci peran.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

from fastapi import HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.core.config import get_settings
from api.core.enums import UserRole
from api.core.models.user import User

ROLE_VALUES = {role.value for role in UserRole}


class AuthError(HTTPException):
    """Autentikasi gagal (401)."""


@dataclass(frozen=True)
class ClerkIdentity:
    """Identitas hasil verifikasi token — sumber kebenaran untuk tabel `users`."""

    clerk_id: str
    name: str | None = None
    email: str | None = None
    public_metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def metadata_role(self) -> str | None:
        """Peran dari `publicMetadata` Clerk, kalau ada (DESIGN.md §5)."""
        raw = self.public_metadata.get("role")
        if isinstance(raw, str) and raw in ROLE_VALUES:
            return raw
        return None


@lru_cache(maxsize=1)
def get_clerk():
    """Client Clerk Backend API (dibuat lazily, hanya di environment terkonfigurasi)."""
    from clerk_backend_api import Clerk

    settings = get_settings()
    if not settings.clerk_secret_key:
        raise AuthError(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CLERK_SECRET_KEY belum dikonfigurasi",
        )
    return Clerk(bearer_auth=settings.clerk_secret_key)


def identity_from_payload(payload: dict[str, Any]) -> ClerkIdentity:
    """Ambil `sub`/nama/email dari payload session token Clerk."""
    clerk_id = payload.get("sub") or payload.get("user_id")
    if not clerk_id:
        raise AuthError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token tidak punya sub",
        )

    metadata = payload.get("public_metadata") or payload.get("publicMetadata") or {}
    if not isinstance(metadata, dict):
        metadata = {}

    name = (
        payload.get("name")
        or payload.get("username")
        or " ".join(
            part for part in (payload.get("given_name"), payload.get("family_name")) if part
        )
        or None
    )
    email_payload = payload.get("email") or payload.get("primary_email_address")
    email = email_payload.get("email_address") if isinstance(email_payload, dict) else email_payload

    return ClerkIdentity(
        clerk_id=str(clerk_id),
        name=name,
        email=email,
        public_metadata=metadata,
    )


def verify_session_token(request: Request) -> ClerkIdentity:
    """Verifikasi Authorization header dan kembalikan identitas."""
    header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not header or not header.lower().startswith("bearer "):
        raise AuthError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="header Authorization: Bearer <session token> wajib ada",
            headers={"WWW-Authenticate": "Bearer"},
        )

    clerk = get_clerk()
    from clerk_backend_api.security.types import AuthenticateRequestOptions

    state = clerk.authenticate_request(request, AuthenticateRequestOptions())
    if not state.is_signed_in or not state.payload:
        raise AuthError(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="session token tidak valid",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return identity_from_payload(state.payload)


def upsert_user(db: Session, identity: ClerkIdentity) -> User:
    """Buat/perbarui baris `users` dari identitas Clerk.

    - Baris baru: `role` NULL (artinya belum onboard -> diperlakukan Murid).
    - Baris lama: nama/email disegarkan, peran yang sudah dikunci tidak diubah.
    - `publicMetadata.role` dipakai kalau peran lokal belum ditentukan.
    """
    user = db.scalar(select(User).where(User.clerk_id == identity.clerk_id))

    if user is None:
        user = User(
            clerk_id=identity.clerk_id,
            role=identity.metadata_role,
            name=identity.name,
            email=identity.email,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    changed = False
    if identity.name and user.name != identity.name:
        user.name = identity.name
        changed = True
    if identity.email and user.email != identity.email:
        user.email = identity.email
        changed = True
    if user.role is None and identity.metadata_role:
        user.role = identity.metadata_role
        changed = True

    if changed:
        db.commit()
        db.refresh(user)
    return user


def sync_user_record(
    db: Session,
    clerk_id: str,
    *,
    name: str | None = None,
    email: str | None = None,
    public_metadata: dict[str, Any] | None = None,
) -> User | None:
    """Sinkron dari webhook Clerk (`user.created` / `user.updated`).

    Peran lokal yang sudah dikunci lewat onboarding tidak ditimpa.
    """
    user = db.scalar(select(User).where(User.clerk_id == clerk_id))
    if user is None:
        metadata_role = None
        if isinstance(public_metadata, dict):
            raw = public_metadata.get("role")
            metadata_role = raw if isinstance(raw, str) and raw in ROLE_VALUES else None
        user = User(clerk_id=clerk_id, role=metadata_role, name=name, email=email)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    changed = False
    if name is not None and user.name != name:
        user.name = name
        changed = True
    if email is not None and user.email != email:
        user.email = email
        changed = True
    if user.role is None and isinstance(public_metadata, dict):
        raw = public_metadata.get("role")
        if isinstance(raw, str) and raw in ROLE_VALUES:
            user.role = raw
            changed = True

    if changed:
        db.commit()
        db.refresh(user)
    return user


def delete_user_record(db: Session, clerk_id: str) -> bool:
    """Hapus baris user saat `user.deleted`. Unggahan ikut terhapus (cascade)."""
    user = db.scalar(select(User).where(User.clerk_id == clerk_id))
    if user is None:
        return False
    db.delete(user)
    db.commit()
    return True