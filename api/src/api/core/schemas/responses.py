"""Kontrak Murid — cermin `web/src/lib/murid-api.ts` (ground truth, read-only).

Semua field Sesi/Tugas/Status di sini **snake_case** karena itu yang dibaca
`normalisasiSesi` / `normalisasiTugas` di client Murid. Kontrak Guru (camelCase +
nama Bahasa Indonesia) ada di `api.core.schemas.guru`.

Aturan paling penting: `PertanyaanMuridOut` tidak punya `evidence`, dan tidak
ada model skor apa pun untuk Murid (CONTEXT.md: Penilaian AI confidential).
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from api.core.enums import QuestionType, SessionStatus, UserRole


# --------------------------------------------------------------------------- #
# User / auth
# --------------------------------------------------------------------------- #
class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str | None = None
    email: str | None = None


class UserOut(UserBrief):
    """Balasan `POST /api/auth/onboard` (client mengabaikan body)."""

    role: UserRole | None = None
    created_at: datetime | None = None


# --------------------------------------------------------------------------- #
# Tugas (pratinjau publik)
# --------------------------------------------------------------------------- #
class TugasPreview(BaseModel):
    """`GET /api/t/:token` — publik, tanpa skor apa pun."""

    id: str
    token: str
    brief: str
    file_types: list[str]
    max_bytes: int
    deadline_at: datetime | None
    sesi_minutes: int
    questions_per_type: int
    guru_name: str | None = None
    deadline_passed: bool = False


# --------------------------------------------------------------------------- #
# Sesi
# --------------------------------------------------------------------------- #
class SessionOut(BaseModel):
    """Bentuk yang dibaca `normalisasiSesi` — snake_case, tanpa amplop.

    Dipakai oleh `POST /api/sessions`, `POST /api/sessions/:id/unggahan`, dan
    `GET /api/sessions/:id` bila pemanggil adalah Murid pemilik Sesi.
    """

    model_config = ConfigDict(from_attributes=True)

    id: str
    tugas_id: str
    attempt_no: int
    status: SessionStatus
    started_at: datetime | None = None
    uploaded_at: datetime | None = None
    timer_ends_at: datetime | None = None
    submitted_at: datetime | None = None
    uploaded: bool = False
    filename: str | None = None


class SessionStatusOut(BaseModel):
    """`GET /api/sessions/:id/status`.

    Selain `status`, Murid membaca `timer_ends_at` untuk bar countdown jawaban
    dan `attempt_no` untuk konteks — keduanya dikirim server, tidak dikira klien.
    """

    status: SessionStatus
    id: str
    tugas_id: str
    attempt_no: int
    started_at: datetime | None = None
    uploaded_at: datetime | None = None
    timer_ends_at: datetime | None = None
    submitted_at: datetime | None = None
    uploaded: bool = False
    filename: str | None = None


# --------------------------------------------------------------------------- #
# Pertanyaan
# --------------------------------------------------------------------------- #
class PertanyaanMuridOut(BaseModel):
    """Pertanyaan untuk Murid — `evidence` sengaja tidak ada di sini."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    type: QuestionType
    seq: int
    text: str


class QuestionsOut(BaseModel):
    """`GET /api/sessions/:id/questions` — amplop `{status, questions}`.

    Client (`normalisasiPertanyaan`) menerima amplop ini maupun array langsung;
    yang dipakai adalah amplop supaya status terlihat dalam satu round-trip.
    """

    status: SessionStatus
    questions: list[PertanyaanMuridOut] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Pelanggaran
# --------------------------------------------------------------------------- #
class ViolationBatchOut(BaseModel):
    """Balasan ingest Pelanggaran (fire-and-forget; klien tidak perlu detail)."""

    accepted: int
    dropped: int