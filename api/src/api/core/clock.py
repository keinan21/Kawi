"""Jam UTC — satu-satunya sumber `now` di sisi server.

Model, service, dan route membandingkan waktu lewat sini supaya:
- kolom `DateTime(timezone=True)` yang dibaca dari SQLite (naive) tetap bisa
  dibandingkan dengan waktu sekarang (tz-aware);
- `server_ts` Pelanggaran selalu diisi server, tidak pernah dipercaya klien
  (DESIGN.md §7).
"""

from __future__ import annotations

from datetime import datetime, timezone


def utcnow() -> datetime:
    """Waktu sekarang sebagai datetime tz-aware UTC."""
    return datetime.now(timezone.utc)


def as_utc(value: datetime | None) -> datetime | None:
    """Normalisasi datetime dari driver mana pun ke tz-aware UTC."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def is_expired(deadline: datetime | None, *, now: datetime | None = None) -> bool:
    """True kalau `deadline` sudah lewat (None = belum di-set = belum lewat)."""
    normalized = as_utc(deadline)
    if normalized is None:
        return False
    return (now or utcnow()) >= normalized