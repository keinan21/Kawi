"""Kontrak Guru — cermin `web/src/lib/guru-api.ts` (ground truth, read-only).

Bentuk di sini WAJIB sama persis dengan `TugasItem`, `Participant`,
`SessionDetail`, `AttemptSummary`, `PelanggaranItem`, `QAItem`, `PenilaianAI`,
`UnggahanInfo`, dan `HasilIzin` di client Guru: camelCase, sebagian memakai
nama Bahasa Indonesia, dan seluruhnya non-null kecuali yang ditandai nullable.

Schema versi snake_case (sisi Murid) ada di `api.core.schemas.responses`.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from api.core.enums import PelanggaranType, QuestionType, SessionStatus

# `FileKind` di client Guru: 'pdf' | 'ppt'.
FileKind = str

MIME_PDF = "application/pdf"
MIME_PPT_LEGACY = "application/vnd.ms-powerpoint"
MIME_PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

PPT_MIMES: tuple[str, ...] = (MIME_PPT_LEGACY, MIME_PPTX)

# --------------------------------------------------------------------------- #
# Tugas
# --------------------------------------------------------------------------- #
class TugasItem(BaseModel):
    """`TugasItem` di guru-api.ts — list & detail Tugas milik Guru ini."""

    model_config = ConfigDict(populate_by_name=True)

    id: str
    token: str
    brief: str
    fileTypes: list[FileKind] = Field(default_factory=list, description="['pdf', 'ppt']")
    maxBytes: int
    deadlineAt: datetime | None = None
    sesiMinutes: int
    questionsPerType: int
    createdAt: datetime
    muridCount: int = 0
    pelanggaranCount: int = 0


class TugasCreateRequest(BaseModel):
    """`CreateTugasInput` — body `POST /api/tugas` (camelCase)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    brief: str = Field(min_length=1)
    fileTypes: list[FileKind] | None = Field(
        default=None, description="['pdf', 'ppt']; null = default PDF+PPT."
    )
    maxBytes: int | None = Field(default=None, gt=0)
    deadlineAt: datetime | None = None
    sesiMinutes: int | None = Field(default=None, gt=0, le=600)
    questionsPerType: int | None = Field(default=None, gt=0, le=5)


class TugasPatchRequest(BaseModel):
    """`PatchTugasInput` — body `PATCH /api/tugas/:id` (camelCase)."""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    brief: str | None = Field(default=None, min_length=1)
    deadlineAt: datetime | None = None
    sesiMinutes: int | None = Field(default=None, gt=0, le=600)


# --------------------------------------------------------------------------- #
# Peserta
# --------------------------------------------------------------------------- #
class AttemptSummary(BaseModel):
    """`AttemptSummary` — satu baris riwayat attempt."""

    sessionId: str
    attemptNo: int
    status: SessionStatus
    dimulaiAt: datetime
    dikumpulAt: datetime | None = None
    pelanggaranCount: int = 0


class Participant(BaseModel):
    """`Participant` — satu Murid di daftar peserta Tugas."""

    muridId: str
    nama: str = ""
    email: str = ""
    sessionId: str = ""
    attemptNo: int = 1
    status: SessionStatus = SessionStatus.CREATED
    pelanggaranCount: int = 0
    terakhirAktif: datetime
    riwayat: list[AttemptSummary] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
# Detail Sesi
# --------------------------------------------------------------------------- #
class PelanggaranItem(BaseModel):
    """`PelanggaranItem` — entri log Pelanggaran."""

    id: str
    type: PelanggaranType
    detail: str = ""
    clientTs: str = Field(default="", description="ISO-8601 dari klien; '' bila tidak ada.")
    serverTs: datetime


class QAItem(BaseModel):
    """`QAItem` — Pertanyaan digabung dengan jawabannya.

    `evidence` adalah tambahan di luar `guru-api.ts`: kutipan yang mem-ground
    Pertanyaan (DESIGN.md §4). Client Guru tidak membacanya, tapi tetap ada
    untuk audit. Field ini hanya pernah muncul di payload Guru.
    """

    id: str
    type: QuestionType
    question: str
    answer: str | None = None
    evidence: str | None = None


class PenilaianAI(BaseModel):
    """`PenilaianAI` — confidential; hanya Guru yang boleh membaca."""

    skorIdeasi: int = 0
    skorIsi: int = 0
    skorHarapan: int = 0
    skorTotal: float = 0.0
    ringkasan: str = ""


class UnggahanInfo(BaseModel):
    """`UnggahanInfo` — metadata berkas + URL unduh."""

    namaFile: str
    mime: str
    ukuranBytes: int
    diunggahAt: datetime
    url: str | None = None


class MuridRef(BaseModel):
    """Murid pada `SessionDetail` — client membacanya sebagai `{nama, email}`."""

    nama: str = ""
    email: str = ""


class SessionDetail(BaseModel):
    """`SessionDetail` — audit trail lengkap, bentuk yang di-render UI Guru."""

    id: str
    tugasId: str
    tugasBrief: str = ""
    attemptNo: int
    status: SessionStatus
    murid: MuridRef
    dimulaiAt: datetime
    batasJawabAt: datetime | None = None
    dikumpulAt: datetime | None = None
    unggahan: UnggahanInfo | None = None
    pelanggaran: list[PelanggaranItem] = Field(default_factory=list)
    tanyaJawab: list[QAItem] = Field(default_factory=list)
    penilaian: PenilaianAI | None = None
    riwayat: list[AttemptSummary] = Field(default_factory=list)


class IzinResult(BaseModel):
    """`HasilIzin` — balasan `POST /api/sessions/:id/izin`."""

    sessionIdBaru: str
    attemptNo: int


# --------------------------------------------------------------------------- #
# Pemetaan tipe berkas
# --------------------------------------------------------------------------- #
def file_kinds_to_mimes(kinds: list[str] | None) -> list[str]:
    """`['pdf', 'ppt']` -> daftar MIME untuk kolom `tugas.file_types`."""
    if not kinds:
        return [MIME_PDF, MIME_PPT_LEGACY, MIME_PPTX]
    lowered = {str(item).strip().lower() for item in kinds}
    mimes: list[str] = []
    if "pdf" in lowered:
        mimes.append(MIME_PDF)
    if lowered & {"ppt", "pptx", "powerpoint", "presentasi"}:
        mimes.extend(PPT_MIMES)
    return mimes or [MIME_PDF, MIME_PPT_LEGACY, MIME_PPTX]


def mimes_to_file_kinds(mimes: list[str] | None) -> list[FileKind]:
    """Kolom `file_types` -> `['pdf', 'ppt']` (kebalikan dari pemetaan di atas)."""
    if not mimes:
        return ["pdf", "ppt"]
    kinds: list[FileKind] = []
    lowered = {str(item).strip().lower() for item in mimes}
    if MIME_PDF in lowered:
        kinds.append("pdf")
    if lowered & set(PPT_MIMES):
        kinds.append("ppt")
    return kinds or ["pdf", "ppt"]