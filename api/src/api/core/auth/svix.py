"""Verifikasi tanda tangan webhook (format Svix/Clerk).

Clerk mengirim header `svix-id`, `svix-timestamp`, `svix-signature`. Tanda
tangan = base64(HMAC-SHA256(secret, "{svix_id}.{svix_timestamp}.{body}")).
Implementasi lokal supaya tidak menambah dependensi runtime; uji lewat
`tests/test_auth_webhook.py`.
"""

from __future__ import annotations

import base64
import hmac
import time
from hashlib import sha256
from typing import Mapping

# Toleransi timestamp (detik) — mencegah replay webhook lama.
TOLERANCE_SECONDS = 5 * 60

HEADER_ID = "svix-id"
HEADER_TIMESTAMP = "svix-timestamp"
HEADER_SIGNATURE = "svix-signature"


class SignatureError(Exception):
    """Tanda tangan webhook tidak valid."""


def decode_secret(secret: str) -> bytes:
    """Secret webhook Svix berawalan `whsec_` berisi base64 key."""
    raw = secret.strip()
    if raw.startswith("whsec_"):
        raw = raw[len("whsec_") :]
    try:
        return base64.b64decode(raw, validate=True)
    except (ValueError, TypeError) as exc:  # noqa: PERF203
        raise SignatureError("CLERK_WEBHOOK_SECRET bukan base64 yang valid") from exc


def signed_content(svix_id: str, timestamp: str, body: bytes) -> bytes:
    return f"{svix_id}.{timestamp}.".encode() + body


def compute_signature(secret: bytes, svix_id: str, timestamp: str, body: bytes) -> str:
    digest = hmac.new(secret, signed_content(svix_id, timestamp, body), sha256).digest()
    return base64.b64encode(digest).decode()


def verify_signature(
    secret: str,
    body: bytes,
    headers: Mapping[str, str],
    *,
    tolerance_seconds: int = TOLERANCE_SECONDS,
) -> None:
    """Braise `SignatureError` kalau tanda tangan tidak sah / kedaluwarsa."""
    key = decode_secret(secret)

    svix_id = headers.get(HEADER_ID)
    timestamp = headers.get(HEADER_TIMESTAMP)
    signature_header = headers.get(HEADER_SIGNATURE)
    if not svix_id or not timestamp or not signature_header:
        raise SignatureError("header svix tidak lengkap")

    try:
        sent_at = int(timestamp)
    except ValueError as exc:
        raise SignatureError("svix-timestamp bukan angka") from exc

    if abs(int(time.time()) - sent_at) > tolerance_seconds:
        raise SignatureError("svix-timestamp di luar toleransi")

    expected = compute_signature(key, svix_id, timestamp, body)
    for part in signature_header.split():
        version, _, value = part.partition(",")
        if version != "v1" or not value:
            continue
        if hmac.compare_digest(value, expected):
            return
    raise SignatureError("tanda tangan tidak cocok")