"""Penyimpanan Unggahan di disk lokal (DESIGN.md §8).

Aturan yang dijaga modul ini:
1. MIME allow-list diperiksa **sebelum** body dibaca.
2. Body dibaca terpotong (chunked) dan langsung berhenti ketika melewati
   `max_bytes` — jadi file oversized tidak pernah ter-buffer utuh.
3. Nama file di disk dibangkitkan server (uuid); nama asli hanya disimpan di DB.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from fastapi import UploadFile

from api.core.config import get_settings
from api.core.models.tugas import DEFAULT_FILE_TYPES

CHUNK_SIZE = 64 * 1024

# MIME -> ekstensi; dipakai hanya untuk penamaan file di disk.
MIME_EXTENSIONS: dict[str, str] = {
    "application/pdf": ".pdf",
    "application/vnd.ms-powerpoint": ".ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
}


class UploadTooLargeError(Exception):
    """Unggahan melebihi `max_bytes` (dipetakan ke HTTP 413)."""

    def __init__(self, max_bytes: int) -> None:
        super().__init__(f"Unggahan melebihi batas {max_bytes} byte")
        self.max_bytes = max_bytes


class UploadMimeError(Exception):
    """MIME tidak ada di allow-list (dipetakan ke HTTP 415)."""

    def __init__(self, mime: str) -> None:
        super().__init__(f"MIME tidak diizinkan: {mime}")
        self.mime = mime


@dataclass(frozen=True)
class StoredUpload:
    """Hasil penyimpanan Unggahan."""

    storage_path: str
    filename: str
    mime: str
    size: int


def allowed_mimes() -> frozenset[str]:
    """Allow-list default (PDF/PPT/PPTX)."""
    return frozenset(DEFAULT_FILE_TYPES)


def ensure_upload_dir() -> Path:
    """Pastikan folder Unggahan ada dan kembalikan path-nya."""
    path = get_settings().upload_path
    path.mkdir(parents=True, exist_ok=True)
    return path


def check_mime(mime: str | None, allowed: frozenset[str] | None = None) -> str:
    """Validasi MIME sebelum body dibaca. Melempar `UploadMimeError`."""
    allowed = allowed or allowed_mimes()
    normalized = (mime or "").split(";")[0].strip().lower()
    if normalized not in allowed:
        raise UploadMimeError(normalized or "unknown")
    return normalized


def store_upload(
    upload: UploadFile,
    *,
    max_bytes: int,
    allowed: frozenset[str] | None = None,
) -> StoredUpload:
    """Simpan Unggahan ke `UPLOAD_DIR`.

    Lempar `UploadMimeError` / `UploadTooLargeError`; pada error file parsial
    sudah dibersihkan sebelum exception dilempar.
    """
    mime = check_mime(upload.content_type, allowed)

    dest_dir = ensure_upload_dir()
    suffix = MIME_EXTENSIONS.get(mime, Path(upload.filename or "").suffix.lower() or ".bin")
    filename = f"{uuid.uuid4().hex}{suffix}"
    final_path = dest_dir / filename
    partial_path = dest_dir / f".{filename}.part"

    written = 0
    try:
        with partial_path.open("wb") as handle:
            while chunk := upload.file.read(CHUNK_SIZE):
                written += len(chunk)
                if written > max_bytes:
                    raise UploadTooLargeError(max_bytes)
                handle.write(chunk)
        partial_path.replace(final_path)
    except BaseException:
        partial_path.unlink(missing_ok=True)
        raise

    return StoredUpload(
        storage_path=str(final_path),
        filename=upload.filename or final_path.name,
        mime=mime,
        size=written,
    )