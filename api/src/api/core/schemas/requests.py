"""Skema Pydantic (payload masuk).

Nama field mengikuti apa yang benar-benar dikirim client:

- Murid (`web/src/lib/murid-api.ts`): `POST /sessions` -> `{tugas_id}`,
  `POST /sessions/:id/answers` -> `{jawaban: [{pertanyaan_id, text}]}`,
  `POST /sessions/:id/violations` -> `{violations: [{type, detail, client_ts}]}`,
  `POST /auth/onboard` -> `{role}`.
- Guru (`web/src/lib/guru-api.ts`): `POST /api/tugas` -> `{brief, fileTypes,
  deadlineAt, sesiMinutes, questionsPerType}`; `PATCH /api/tugas/:id` ->
  subset yang sama (lihat `api.core.schemas.guru`).

Nama utama field mengikuti apa yang dikirim client; nama lama hanya dipertahankan
sebagai alias agar request versi sebelumnya tidak langsung rusak.
"""

from __future__ import annotations

from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from api.core.enums import UserRole


class OnboardingIn(BaseModel):
    """`POST /api/auth/onboard` — peran diset SEKALI per user."""

    role: UserRole = Field(description="Peran yang dipakai selamanya: guru atau murid.")


class SessionCreateIn(BaseModel):
    """`POST /api/sessions` — mulai Sesi untuk satu Tugas."""

    model_config = ConfigDict(populate_by_name=True)

    tugas_id: str = Field(
        validation_alias=AliasChoices("tugas_id", "tugasId"),
        description="Id Tugas hasil dari share-link /t/:token.",
    )


class ViolationIn(BaseModel):
    """Satu event Pelanggaran dari modul proctor (DESIGN.md §7).

    `client_ts` hanya jejak audit; `server_ts` ditulis server.
    """

    type: str = Field(description="Salah satu nilai PelanggaranType (packages/shared).")
    detail: str | None = Field(default=None, max_length=1000, description="Alasan spesifik.")
    client_ts: str | None = Field(
        default=None,
        description="Timestamp klien (ISO-8601), opsional.",
    )


class ViolationBatchIn(BaseModel):
    """`POST /api/sessions/:id/violations` — batch fire-and-forget."""

    violations: list[ViolationIn] = Field(default_factory=list, max_length=200)


class AnswerIn(BaseModel):
    """Satu jawaban Murid untuk satu Pertanyaan."""

    pertanyaan_id: str
    text: str = Field(min_length=1, max_length=10_000)


class AnswersIn(BaseModel):
    """`POST /api/sessions/:id/answers` — tepat tiga jawaban.

    Client mengirim `{jawaban: [...]}`. `answers` diterima sebagai alias supaya
    payload versi sebelumnya tidak langsung 422.
    """

    model_config = ConfigDict(populate_by_name=True)

    jawaban: list[AnswerIn] = Field(
        validation_alias=AliasChoices("jawaban", "answers"),
        serialization_alias="jawaban",
        description="Tepat 3 jawaban, satu per tipe Pertanyaan.",
    )