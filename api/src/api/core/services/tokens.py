"""Pembuatan token share-link Tugas (DESIGN.md §5).

Token = slug publik di URL `/t/:token` (gaya Google Forms). Panjang 12 char
base64url -> ~72 bit entropy, cukup untuk link yang dibagikan ke kelas.
"""

from __future__ import annotations

import secrets

TOKEN_BYTES = 9  # 9 byte -> 12 karakter base64url


def new_share_token() -> str:
    """Slug acak yang aman dipakai di URL."""
    return secrets.token_urlsafe(TOKEN_BYTES)