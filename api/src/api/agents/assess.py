"""Penilaian AI — async setelah submit (DESIGN.md §6 langkah 6).

Satu panggilan terstruktur -> `PenilaianAIDraft` (3 skor aspek + total + ringkasan
Bahasa Indonesia). Aturan desain yang dipegang modul ini:

- **Recompute, jangan percaya model.** `skor_total` yang dideklarasikan model
  dibuang; nilai yang disimpan dihitung ulang dari tiga skor aspek (fungsi
  `recompute_total` milik core, dipakai ulang agar tidak ada dua implementasi).
- **Validasi 0..100.** Skor di-clamp dan dicatat kalau di luar rentang.
- **Confidential.** Penilaian hanya dibaca serializer Guru; modul ini hanya
  menulis barisnya (lihat `tasks.assess_answers`).

Evidence sengaja TIDAK ikut ke prompt: `evidence` adalah bahan audit Guru, bukan
bahan penilaian.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from api.agents.model_factory import StructuredLlmClient
from api.agents.prompts import assess_prompt
from api.agents.schemas import PenilaianAIDraft
from api.core.enums import QuestionType
from api.core.models.penilaian_ai import recompute_total

logger = logging.getLogger(__name__)

MIN_SCORE = 0
MAX_SCORE = 100


class AssessmentError(RuntimeError):
    """Penilaian gagal: output model tidak bisa dipakai sama sekali."""


@dataclass(frozen=True)
class AnswerPair:
    """Satu pasang pertanyaan + jawaban Murid."""

    question_type: QuestionType
    question_text: str
    answer_text: str


@dataclass(frozen=True)
class Assessment:
    """Penilaian siap tulis ke `penilaian_ai`."""

    skor_ideasi: int
    skor_isi: int
    skor_harapan: int
    skor_total: float
    ringkasan: str
    declared_total: int
    clamped: tuple[str, ...] = ()

    def as_columns(self) -> dict[str, object]:
        """Nilai siap `PenilaianAI(**...)`."""
        return {
            "skor_ideasi": self.skor_ideasi,
            "skor_isi": self.skor_isi,
            "skor_harapan": self.skor_harapan,
            "skor_total": self.skor_total,
            "ringkasan": self.ringkasan,
        }


def clamp_score(value: object, name: str, *, clamped: list[str] | None = None) -> int:
    """Amankan satu skor ke rentang 0..100; catat kalau harus di-clamp."""
    try:
        number = int(round(float(value)))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        raise AssessmentError(f"skor {name} bukan angka: {value!r}") from None
    if not MIN_SCORE <= number <= MAX_SCORE:
        fixed = max(MIN_SCORE, min(MAX_SCORE, number))
        logger.warning("skor %s=%s di luar 0..100; di-clamp jadi %s", name, number, fixed)
        if clamped is not None:
            clamped.append(name)
        return fixed
    return number


async def assess_document(
    *,
    client: StructuredLlmClient,
    brief: str,
    pairs: list[AnswerPair],
) -> Assessment:
    """Panggil model sekali, validasi, lalu hitung ulang totalnya."""
    if not pairs:
        raise AssessmentError("tidak ada jawaban untuk dinilai")

    draft = await client.complete(
        prompt=assess_prompt(
            brief=brief,
            pairs=[(item.question_type, item.question_text, item.answer_text) for item in pairs],
        ),
        schema=PenilaianAIDraft,
    )
    if not isinstance(draft, PenilaianAIDraft):  # pragma: no cover - jaga tipe
        raise AssessmentError(f"skema penilaian tidak sesuai: {type(draft)!r}")

    clamped: list[str] = []
    skor_ideasi = clamp_score(draft.skor_ideasi, "skor_ideasi", clamped=clamped)
    skor_isi = clamp_score(draft.skor_isi, "skor_isi", clamped=clamped)
    skor_harapan = clamp_score(draft.skor_harapan, "skor_harapan", clamped=clamped)

    total = recompute_total(skor_ideasi, skor_isi, skor_harapan)
    if total is None:  # pragma: no cover - ketiga skor sudah non-None
        raise AssessmentError("total tidak bisa dihitung ulang")

    ringkasan = " ".join((draft.ringkasan or "").split())
    if not ringkasan:
        raise AssessmentError("ringkasan kosong")

    if float(draft.skor_total) != float(total):
        logger.info(
            "skor_total model=%s diabaikan; dihitung ulang jadi %s", draft.skor_total, total
        )

    return Assessment(
        skor_ideasi=skor_ideasi,
        skor_isi=skor_isi,
        skor_harapan=skor_harapan,
        skor_total=float(total),
        ringkasan=ringkasan,
        declared_total=int(draft.skor_total),
        clamped=tuple(clamped),
    )


__all__ = [
    "MAX_SCORE",
    "MIN_SCORE",
    "AnswerPair",
    "Assessment",
    "AssessmentError",
    "assess_document",
    "clamp_score",
]