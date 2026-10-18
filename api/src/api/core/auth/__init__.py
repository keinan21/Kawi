"""Clerk auth: verifikasi token, dependency, dan sinkronisasi webhook (DESIGN.md §5)."""

from api.core.auth.clerk import (
    AuthError,
    ClerkIdentity,
    delete_user_record,
    get_clerk,
    identity_from_payload,
    sync_user_record,
    upsert_user,
    verify_session_token,
)
from api.core.auth.deps import (
    CurrentUser,
    DbSession,
    GuruUser,
    MuridUser,
    get_current_user,
    load_guru_session,
    load_owned_session,
    load_owned_tugas,
    require_guru,
    require_murid,
)

__all__ = [
    "AuthError",
    "ClerkIdentity",
    "CurrentUser",
    "DbSession",
    "GuruUser",
    "MuridUser",
    "delete_user_record",
    "get_clerk",
    "get_current_user",
    "identity_from_payload",
    "load_guru_session",
    "load_owned_session",
    "load_owned_tugas",
    "require_guru",
    "require_murid",
    "sync_user_record",
    "upsert_user",
    "verify_session_token",
]