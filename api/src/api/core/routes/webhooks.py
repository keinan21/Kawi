"""Webhook Clerk — sinkronisasi user (DESIGN.md §5).

Event yang ditangani: `user.created`, `user.updated`, `user.deleted`.
Tanda tangan Svix diverifikasi terhadap `CLERK_WEBHOOK_SECRET` sebelum body
diparse — payload webhook tidak pernah dipercaya begitu saja.
"""

from __future__ import annotations

import json
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status

from api.core.auth.clerk import delete_user_record, sync_user_record
from api.core.auth.deps import DbSession
from api.core.auth.svix import SignatureError, verify_signature
from api.core.config import get_settings

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

def _user_fields(data: dict[str, Any]) -> tuple[str, dict[str, Any] | None, str | None]:
    clerk_id = str(data.get("id") or "")
    email = None
    addresses = data.get("email_addresses") or []
    primary = data.get("primary_email_address_id")
    for address in addresses:
        if isinstance(address, dict) and address.get("id") == primary:
            email = address.get("email_address")
            break
    if email is None and addresses and isinstance(addresses[0], dict):
        email = addresses[0].get("email_address")
    metadata = data.get("public_metadata")
    return clerk_id, metadata if isinstance(metadata, dict) else None, email


@router.post("/clerk")
async def clerk_webhook(request: Request, db: DbSession) -> dict[str, Any]:
    """Verifikasi tanda tangan, lalu sinkronkan baris `users`."""
    secret = get_settings().clerk_webhook_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="CLERK_WEBHOOK_SECRET belum dikonfigurasi",
        )

    body = await request.body()
    try:
        verify_signature(secret, body, request.headers)
    except SignatureError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"tanda tangan webhook tidak valid: {exc}",
        ) from exc

    try:
        event = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="body bukan JSON",
        ) from exc

    event_type = str(event.get("type") or "")
    data = event.get("data") or {}
    if not isinstance(data, dict):
        data = {}

    clerk_id, public_metadata, email = _user_fields(data)
    name = data.get("first_name"), data.get("last_name")
    full_name = " ".join(part for part in name if isinstance(part, str)) or None

    if event_type in ("user.created", "user.updated"):
        if not clerk_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="payload user tanpa id",
            )
        sync_user_record(
            db,
            clerk_id,
            name=full_name or data.get("username"),
            email=email,
            public_metadata=public_metadata,
        )
    elif event_type == "user.deleted":
        if not clerk_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="payload user tanpa id",
            )
        delete_user_record(db, clerk_id)
    else:
        # Event lain (session.*, organization.*) tidak relevan untuk MVP.
        return {"status": "ignored", "type": event_type}

    return {"status": "ok", "type": event_type}