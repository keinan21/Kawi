"""Skema Pydantic untuk `output_schema` ADK (DESIGN.md §6).

`Field(description=...)` dipakai sebagai prompt engineering ke model — model
harus melihat arti setiap field, termasuk arti `evidence` (kutipan persis) dan
bahasa `ringkasan` (Bahasa Indonesia).

Skema `QuestionSet` dibangun dinamis lewat `question_set_schema(count)` supaya
`min=max=questions_per_type * 3` (constraint jumlah pertanyaan ala DeepTutor).
"""

from __future__ import annotations

from pydantic import BaseModel, Field, create_model

from api.core.enums import QuestionType

# Jumlah tipe Pertanyaan yang selalu ada (CONTEXT.md).
QUESTION_TYPES: tuple[QuestionType, ...] = tuple(QuestionType)

MIN_QUESTION_CHARS = 10
MIN_EVIDENCE_CHARS = 15
MIN_ANGLE_CHARS = 8


class PlanTemplate(BaseModel):
    """Satu rencana pertanyaan dari tahap plan."""

    type: QuestionType = Field(
        description="Tipe pertanyaan: ideasi, isi, atau harapan."
    )
    angle: str = Field(
        min_length=MIN_ANGLE_CHARS,
        max_length=240,
        description=(
            "Sudut pandang spesifik yang didukung materi untuk tipe ini, "
            "misalnya 'asal ide dari field research kelas'. Harus berbeda dari "
            "angle tipe lain."
        ),
    )
    alasan: str = Field(
        min_length=MIN_ANGLE_CHARS,
        max_length=400,
        description=(
            "Satu kalimat alasan kenapa sudut ini bisa dijawab Murid dari "
            "isi unggahan."
        ),
    )


class QuestionPlan(BaseModel):
    """Output tahap plan: satu template per tipe (tiga total)."""

    templates: list[PlanTemplate] = Field(
        min_length=len(QUESTION_TYPES),
        max_length=len(QUESTION_TYPES),
        description=(
            "Tepat tiga rencana pertanyaan: satu untuk ideasi, satu untuk isi, "
            "satu untuk harapan."
        ),
    )


def plan_schema(questions_per_type: int) -> type[QuestionPlan]:
    """Skema plan dengan `min=max=3 * questions_per_type` template.

    Default `tugas.questions_per_type = 1` -> tiga template, yaitu kasus yang
    dipakai DESIGN.md §6. Nilai lebih besar hanya dipakai kalau Guru meminta.
    """
    per_type = max(1, int(questions_per_type))
    total = per_type * len(QUESTION_TYPES)
    return create_model(
        "QuestionPlan",
        templates=(
            list[PlanTemplate],
            Field(
                min_length=total,
                max_length=total,
                description=(
                    f"Tepat {total} rencana: {per_type} untuk ideasi, {per_type} "
                    "untuk isi, dan "
                    f"{per_type} untuk harapan. Semua angle wajib berbeda."
                ),
            ),
        ),
        __base__=QuestionPlan,
    )


class DraftQuestion(BaseModel):
    """Satu pertanyaan hasil generate + kutipan buktinya."""

    type: QuestionType = Field(description="Tipe pertanyaan ini.")
    text: str = Field(
        min_length=MIN_QUESTION_CHARS,
        max_length=600,
        description="Kalimat pertanyaan yang akan dibaca Murid, dalam Bahasa Indonesia.",
    )
    evidence: str = Field(
        min_length=MIN_EVIDENCE_CHARS,
        max_length=400,
        description=(
            "Kutipan PERSIS dari materi unggahan yang membuat pertanyaan ini "
            "bisa dijawab. Salin karakter demi karakter dari materi, jangan "
            "meringkas dan jangan mengarang."
        ),
    )


class DraftQuestionSet(BaseModel):
    """Basis untuk `QuestionSet` dinamis (lihat `question_set_schema`)."""

    questions: list[DraftQuestion]


def question_set_schema(count: int) -> type[DraftQuestionSet]:
    """Skema `QuestionSet` dengan `min=max=count` (jumlah pertanyaan dikunci).

    Dipakai juga untuk perbaikan: `question_set_schema(1)` meminta tepat satu
    pertanyaan pengganti.
    """
    model = create_model(
        "QuestionSet",
        questions=(
            list[DraftQuestion],
            Field(
                min_length=count,
                max_length=count,
                description=(
                    f"Tepat {count} pertanyaan. Satu pertanyaan untuk setiap "
                    "rencana, dengan tipe dan evidence yang sesuai."
                ),
            ),
        ),
        __base__=DraftQuestionSet,
    )
    return model


class PenilaianAIDraft(BaseModel):
    """Output Penilaian AI — hanya untuk Guru (DESIGN.md §6 langkah 6).

    Batas 0..100 tidak dipaksakan di level skema: nilai di luar rentang masih
    berupa angka, jadi `assess.clamp_score` yang meng-clamp + mencatatnya.
    Menolak skemanya di sini akan membuang seluruh penilaian; runtime clamps
    lebih murah dan Penilaian AI yang "sedikit meleset" tetap berguna untuk Guru.
    Skor bukan angka tetap ditolak (tipe `int`).
    """

    skor_ideasi: int = Field(
        description=(
            "0 sampai 100. Seberapa jawaban tipe ideasi menunjukkan pemahaman "
            "Murid atas asal-usul ide dan inspirasinya sendiri."
        ),
    )
    skor_isi: int = Field(
        description=(
            "0 sampai 100. Seberapa jawaban tipe isi menunjukkan Murid "
            "benar-benar mengerjakan sendiri isi dokumen."
        ),
    )
    skor_harapan: int = Field(
        description=(
            "0 sampai 100. Seberapa jawaban tipe harapan menunjukkan Murid "
            "punya visi lanjutan terhadap karyanya."
        ),
    )
    skor_total: int = Field(
        default=0,
        description=(
            "Diabaikan server: nilai ini dihitung ulang dari tiga skor aspek. "
            "Isi dengan rata-rata kasar bila perlu."
        ),
    )
    ringkasan: str = Field(
        min_length=20,
        max_length=900,
        description=(
            "Ringkasan 2-4 kalimat dalam Bahasa Indonesia untuk Guru: pola "
            "jawaban Murid per aspek dan kelemahannya. Jangan menyebut skor "
            "angka di dalam ringkasan."
        ),
    )


__all__ = [
    "MIN_ANGLE_CHARS",
    "MIN_EVIDENCE_CHARS",
    "MIN_QUESTION_CHARS",
    "QUESTION_TYPES",
    "DraftQuestion",
    "DraftQuestionSet",
    "PenilaianAIDraft",
    "PlanTemplate",
    "QuestionPlan",
    "plan_schema",
    "question_set_schema",
]