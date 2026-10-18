"""Skema payload API — DESIGN.md §5.

Dua keluarga bentuk, mengikuti dua client yang berbeda:

- `responses` — sisi Murid, **snake_case** (`web/src/lib/murid-api.ts`).
- `guru` — sisi Guru, camelCase + nama Bahasa Indonesia
  (`web/src/lib/guru-api.ts`, `web/src/lib/guru-mocks.ts`).
"""

from api.core.schemas.guru import (
    AttemptSummary,
    IzinResult,
    MuridRef,
    Participant,
    PelanggaranItem,
    PenilaianAI,
    QAItem,
    SessionDetail,
    TugasCreateRequest,
    TugasItem,
    TugasPatchRequest,
    UnggahanInfo,
    file_kinds_to_mimes,
    mimes_to_file_kinds,
)
from api.core.schemas.requests import (
    AnswerIn,
    AnswersIn,
    OnboardingIn,
    SessionCreateIn,
    ViolationBatchIn,
    ViolationIn,
)
from api.core.schemas.responses import (
    PertanyaanMuridOut,
    QuestionsOut,
    SessionOut,
    SessionStatusOut,
    TugasPreview,
    UserBrief,
    UserOut,
    ViolationBatchOut,
)

__all__ = [
    "AnswerIn",
    "AnswersIn",
    "AttemptSummary",
    "IzinResult",
    "MuridRef",
    "OnboardingIn",
    "Participant",
    "PelanggaranItem",
    "PenilaianAI",
    "PertanyaanMuridOut",
    "QAItem",
    "QuestionsOut",
    "SessionCreateIn",
    "SessionDetail",
    "SessionOut",
    "SessionStatusOut",
    "TugasCreateRequest",
    "TugasItem",
    "TugasPatchRequest",
    "TugasPreview",
    "UnggahanInfo",
    "UserBrief",
    "UserOut",
    "ViolationBatchIn",
    "ViolationBatchOut",
    "ViolationIn",
    "file_kinds_to_mimes",
    "mimes_to_file_kinds",
]