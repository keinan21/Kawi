"""Ekstraksi Unggahan -> markdown (DESIGN.md §6 langkah 1).

MIME allow-list sudah ditegakkan di `core/storage/uploads.py` sebelum file
disimpan, jadi modul ini cukup memetakan MIME ke parser:

- PDF  -> fast path `markitdown` (pdfminer/pdfplumber).
- PPTX -> fast path `python-pptx`.
- PPT (biner lama) -> tidak ada parser cepat; teks dibiarkan tipis.

Kalau teks hasil ekstraksi di bawah `MIN_TEXT_CHARS` (slide berat gambar,
scan, PDF hasil scan), pipeline memutuskan fallback multimodal: byte mentah
dikirim sebagai `Part inline_data`. Konteks dipotong di `MAX_CONTEXT_CHARS`.

Semua error parser ditangkap — file rusak tidak boleh menjatuhkan Sesi.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from api.agents.model_factory import InlineData
from api.core.config import get_settings
from api.core.models.unggahan import Unggahan

logger = logging.getLogger(__name__)

MIME_PDF = "application/pdf"
MIME_PPT = "application/vnd.ms-powerpoint"
MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

# Di bawah ambang ini materi dianggap terlalu tipis -> kandidat fallback
# multimodal (DESIGN.md §6 langkah 1).
MIN_TEXT_CHARS = 500

# Batas konteks yang dikirim ke model (~50k karakter).
MAX_CONTEXT_CHARS = 50_000

TRUNCATION_MARKER = (
    "\n\n[... MATERI DIPOTONG PADA BATAS {limit} KARAKTER. "
    "Bagian setelah titik ini tidak tersedia. ...]"
)

_WHITESPACE = re.compile(r"\s+")


@dataclass(frozen=True)
class ExtractedDocument:
    """Hasil ekstraksi satu Unggahan."""

    markdown: str
    mime: str
    filename: str
    size_bytes: int
    raw_bytes: bytes
    fast_path: str | None = None
    error: str | None = None
    truncated: bool = False

    @property
    def is_thin(self) -> bool:
        """True kalau teksnya terlalu tipis untuk dijadikan konteks utama."""
        return len(_WHITESPACE.sub(" ", self.markdown).strip()) < MIN_TEXT_CHARS

    def inline_data(self) -> InlineData | None:
        """Byte mentah sebagai lampiran multimodal (hanya dipakai bila `is_thin`)."""
        if not self.raw_bytes:
            return None
        return InlineData(data=self.raw_bytes, mime_type=self.mime)


class UploadMissingError(FileNotFoundError):
    """Berkas Unggahan tidak ada di disk (sudah terhapus / redeploy)."""


def normalize_text(text: str) -> str:
    """Rapis whitespace; dipakai untuk cek "materi tipis"."""
    return _WHITESPACE.sub(" ", text or "").strip()


def truncate_for_context(text: str, *, limit: int = MAX_CONTEXT_CHARS) -> tuple[str, bool]:
    """Potong konteks di `limit` karakter dan tandai dengan marker.

    Mengembalikan `(teks, terpotong)`.
    """
    if len(text) <= limit:
        return text, False
    marker = TRUNCATION_MARKER.format(limit=limit)
    return text[:limit].rstrip() + marker, True


def resolve_storage_path(unggahan: Unggahan) -> Path:
    """Path absolut berkas Unggahan.

    `storage_path` disimpan absolut saat upload, tapi kalau proses pindah mesin
    (dev lama) path itu bisa stale — fallback ke `UPLOAD_DIR/<filename>`.
    """
    stored = Path(unggahan.storage_path)
    if stored.is_absolute():
        return stored
    candidate = get_settings().upload_path / stored.name
    return candidate


def read_upload_bytes(unggahan: Unggahan) -> bytes:
    """Baca byte mentah Unggahan dari `UPLOAD_DIR`."""
    path = resolve_storage_path(unggahan)
    if not path.exists():
        fallback = get_settings().upload_path / (unggahan.filename or "")
        if fallback.exists():
            path = fallback
        else:
            raise UploadMissingError(f"berkas Unggahan tidak ditemukan: {path}")
    return path.read_bytes()


def _pdf_to_markdown(raw: bytes) -> str:
    """Fast path PDF: `markitdown` (MIT, DESIGN.md §9)."""
    from markitdown import MarkItDown

    converter = MarkItDown(enable_plugins=False)
    result = converter.convert_stream(BytesIO(raw), file_extension=".pdf")
    return result.text_content or ""


def _pptx_to_markdown(raw: bytes) -> str:
    """Fast path PPTX: `python-pptx`, slide demi slide.

    Slide ditulis sebagai `## Slide N` + teks shape (paragraf bernomor) +
    catatan pembicara kalau ada.
    """
    from pptx import Presentation

    presentation = Presentation(BytesIO(raw))
    chunks: list[str] = []
    for index, slide in enumerate(presentation.slides, start=1):
        chunks.append(f"## Slide {index}")
        for shape in slide.shapes:
            if not getattr(shape, "has_text_frame", False):
                continue
            lines = [para.text.strip() for para in shape.text_frame.paragraphs]
            lines = [line for line in lines if line]
            if lines:
                chunks.append("\n".join(f"- {line}" for line in lines))
        if slide.has_notes_slide:
            notes = slide.notes_slide.notes_text_frame
            note_text = normalize_text(notes.text) if notes is not None else ""
            if note_text:
                chunks.append(f"- Catatan pembicara: {note_text}")
    return "\n\n".join(chunks)


def extract_document(unggahan: Unggahan) -> ExtractedDocument:
    """Baca + ekstrak Unggahan. Tidak pernah melempar error parser.

    Error I/O (berkas hilang) tetap dilempar; error parser hanya dicatat di
    `ExtractedDocument.error` supaya pipeline bisa lanjut dengan teks tipis.
    """
    raw = read_upload_bytes(unggahan)
    mime = (unggahan.mime or "").split(";")[0].strip().lower()

    markdown = ""
    fast_path: str | None = None
    error: str | None = None

    if mime == MIME_PDF:
        fast_path = "markitdown"
        try:
            markdown = _pdf_to_markdown(raw)
        except Exception as exc:  # noqa: BLE001 — PDF rusak tidak boleh menjatuhkan Sesi
            error = f"markitdown gagal: {exc}"
            logger.warning("ekstraksi PDF gagal untuk %s: %s", unggahan.filename, exc)
    elif mime == MIME_PPTX:
        fast_path = "python-pptx"
        try:
            markdown = _pptx_to_markdown(raw)
        except Exception as exc:  # noqa: BLE001
            error = f"python-pptx gagal: {exc}"
            logger.warning("ekstraksi PPTX gagal untuk %s: %s", unggahan.filename, exc)
    elif mime == MIME_PPT:
        error = "tidak ada parser cepat untuk PPT biner lama"
        logger.info("PPTX/PPT biner tanpa fast path: %s", unggahan.filename)
    else:
        error = f"MIME tidak dikenal untuk ekstraksi: {mime}"
        logger.warning("MIME unggahan tidak dikenal: %s", mime)

    text, truncated = truncate_for_context(normalize_blank_lines(markdown))
    document = ExtractedDocument(
        markdown=text,
        mime=mime,
        filename=unggahan.filename,
        size_bytes=len(raw),
        raw_bytes=raw,
        fast_path=fast_path,
        error=error,
        truncated=truncated,
    )

    if document.is_thin:
        logger.info(
            "materi tipis (%d karakter) dari %s — fallback multimodal%s",
            len(normalize_text(document.markdown)),
            unggahan.filename,
            " AKAN dipakai" if document.inline_data() else " TIDAK tersedia (file kosong)",
        )
    if truncated:
        logger.info("konteks dipotong ke %d karakter", MAX_CONTEXT_CHARS)
    return document


def normalize_blank_lines(text: str) -> str:
    """Buang baris kosong berlebih; pertahankan baris sebagai baris."""
    if not text:
        return ""
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").split("\n")]
    out: list[str] = []
    blank = 0
    for line in lines:
        if not line.strip():
            blank += 1
            if blank > 1:
                continue
        else:
            blank = 0
        out.append(line)
    return "\n".join(out).strip()


__all__ = [
    "MAX_CONTEXT_CHARS",
    "MIN_TEXT_CHARS",
    "MIME_PDF",
    "MIME_PPT",
    "MIME_PPTX",
    "ExtractedDocument",
    "InlineData",
    "UploadMissingError",
    "extract_document",
    "normalize_text",
    "read_upload_bytes",
    "resolve_storage_path",
    "truncate_for_context",
]