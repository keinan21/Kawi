"""Pipeline plan -> generate -> verify -> strip (DESIGN.md §6 langkah 2-5).

Pola plan-then-generate (DeepTutor, Apache-2.0 — pola dipinjam, kode ditulis
ulang sendiri; lihat DESIGN.md §9):

1. **Plan** — 1 panggilan LLM tanpa tool -> tiga template `{type, angle, alasan}`.
   Angle wajib berbeda antar tipe; kalau bentrok, re-plan **satu kali** dengan
   feedback. Kalau masih bentrok -> `PipelineError` (Sesi tetap aman: timer
   auto-submit adalah jaring pengaman).
2. **Generate** — satu panggilan terstruktur `QuestionSet` (min=max=`questions_per_type*3`).
3. **Verify** — normalisasi evidence (casefold, spasi, nomor baris, bullet) lalu
   substring check terhadap dokumen. Gagal -> repair pertanyaan itu (maks 2x).
   Kalau tetap gagal -> best effort: simpan draft terakhir + log.
4. **Strip** — `evidence` dibawa keluar sebagai field terpisah; penyimpanannya
   ke `pertanyaan.evidence` dikerjakan `tasks.py` (satu-satunya tempat DB
   disentuh).

Modul ini tidak menyentuh database dan tidak membaca env — client LLM
disuntikkan, jadi seluruh pipeline bisa diuji tanpa jaringan.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from dataclasses import dataclass, field

from api.agents.extract import ExtractedDocument
from api.agents.model_factory import InlineData, StructuredLlmClient
from api.agents.prompts import generate_prompt, plan_prompt, repair_prompt
from api.agents.schemas import (
    QUESTION_TYPES,
    DraftQuestion,
    QuestionPlan,
    plan_schema,
    question_set_schema,
)
from api.core.enums import QuestionType

logger = logging.getLogger(__name__)

# Maksimum percobaan repair per pertanyaan (DESIGN.md §6 langkah 4).
MAX_REPAIR_ATTEMPTS = 2

# Jumlah plan ulang kalau angle bentrok (DESIGN.md §6 langkah 2).
MAX_PLAN_ATTEMPTS = 2

MIN_EVIDENCE_CHARS = 15

# Nomor baris / bullet di awal baris: "12. ", "3) ", "- ", "* ", "• ".
_LINE_PREFIX = re.compile(r"^\s*(?:\d{1,4}[.)]|[-*+•‣▪◦])\s+")
_WHITESPACE = re.compile(r"\s+")
_QUOTE_MAP = str.maketrans(
    {
        "\u2018": "'",
        "\u2019": "'",
        "\u201a": "'",
        "\u201b": "'",
        "\u201c": '"',
        "\u201d": '"',
        "\u201e": '"',
        "\u2010": "-",
        "\u2011": "-",
        "\u2012": "-",
        "\u2013": "-",
        "\u2014": "-",
        "\u00a0": " ",
    }
)


class PipelineError(RuntimeError):
    """Pipeline gagal secara fatal (mis. plan tetap bentrok setelah re-plan)."""


@dataclass(frozen=True)
class GeneratedQuestion:
    """Satu Pertanyaan siap simpan; `evidence` hanya untuk audit Guru."""

    type: QuestionType
    text: str
    evidence: str
    angle: str
    verified: bool = False
    repair_attempts: int = 0


@dataclass(frozen=True)
class PipelineResult:
    """Hasil akhir pipeline untuk satu Sesi."""

    questions: tuple[GeneratedQuestion, ...]
    plan: tuple[tuple[QuestionType, str, str], ...]
    used_multimodal: bool = False
    doc_chars: int = 0
    plan_attempts: int = 1
    repairs: int = 0
    unverified: tuple[str, ...] = field(default=())


# --------------------------------------------------------------------------- #
# Verifikasi evidence
# --------------------------------------------------------------------------- #
def normalize_for_match(text: str) -> str:
    """Normalisasi teks supaya substring check tahan variasi penulisan.

    Dilakukan simetris pada evidence dan dokumen: casefold, buang nomor baris
    dan bullet di awal baris, rapikan spasi, samakan tanda kutip/strip.
    """
    lines: list[str] = []
    for raw_line in (text or "").replace("\r\n", "\n").split("\n"):
        stripped = _LINE_PREFIX.sub("", raw_line.strip())
        if stripped:
            lines.append(stripped)
    joined = " ".join(lines)
    joined = unicodedata.normalize("NFKC", joined)
    joined = joined.translate(_QUOTE_MAP)
    joined = joined.replace("\u00ad", "")
    return _WHITESPACE.sub(" ", joined).strip().casefold()


def verify_evidence(evidence: str, document: str) -> bool:
    """True kalau kutipan benar-benar ada di dokumen (setelah normalisasi)."""
    needle = normalize_for_match(evidence)
    if len(needle) < MIN_EVIDENCE_CHARS:
        return False
    haystack = normalize_for_match(document)
    if not haystack:
        return False
    return needle in haystack


def _reject_reason(evidence: str, document: str) -> str | None:
    """Alasan penolakan evidence, atau None kalau lolos."""
    if not (evidence or "").strip():
        return "evidence kosong"
    if len(normalize_for_match(evidence)) < MIN_EVIDENCE_CHARS:
        return f"evidence terlalu pendek (<{MIN_EVIDENCE_CHARS} karakter)"
    if not normalize_for_match(document):
        return "dokumen kosong setelah normalisasi"
    if normalize_for_match(evidence) not in normalize_for_match(document):
        return "kutipan tidak ditemukan di dalam dokumen (kemungkinan dikarang)"
    return None


# --------------------------------------------------------------------------- #
# Validasi plan
# --------------------------------------------------------------------------- #
def validate_plan(
    templates: list[tuple[QuestionType, str, str]],
    questions_per_type: int = 1,
) -> str | None:
    """Cek plan: tiap tipe punya `questions_per_type` template + angle berbeda.

    Mengembalikan alasan penolakan, atau None kalau plan valid.
    """
    per_type = max(1, int(questions_per_type))
    expected = per_type * len(QUESTION_TYPES)
    if len(templates) != expected:
        return f"harus ada tepat {expected} template, dapat {len(templates)}"

    counts: dict[QuestionType, int] = {}
    for tipe, _angle, _alasan in templates:
        counts[tipe] = counts.get(tipe, 0) + 1
    wrong = {
        item.value: counts.get(item, 0)
        for item in QUESTION_TYPES
        if counts.get(item, 0) != per_type
    }
    if wrong:
        return f"jumlah template per tipe harus {per_type}; aktual {wrong}"

    angles: dict[str, str] = {}
    for tipe, angle, _alasan in templates:
        key = normalize_for_match(angle)
        if not key:
            return f"angle untuk tipe {tipe.value} kosong"
        if key in angles:
            return (
                f"angle tipe {tipe.value} sama dengan angle tipe {angles[key]} "
                "(harus berbeda)"
            )
        angles[key] = tipe.value
    return None


# --------------------------------------------------------------------------- #
# Tahap plan
# --------------------------------------------------------------------------- #
async def _plan_once(
    *,
    client: StructuredLlmClient,
    brief: str,
    doc_markdown: str,
    inline_parts: tuple[InlineData, ...],
    feedback: str | None,
    questions_per_type: int,
) -> list[tuple[QuestionType, str, str]]:
    prompt = plan_prompt(
        brief=brief,
        doc_markdown=doc_markdown,
        feedback=feedback,
        questions_per_type=questions_per_type,
    )
    plan = await client.complete(
        prompt=prompt,
        schema=plan_schema(questions_per_type),
        inline_parts=inline_parts,
    )
    if not isinstance(plan, QuestionPlan):  # pragma: no cover - jaga tipe
        raise PipelineError(f"skema plan tidak sesuai: {type(plan)!r}")
    return [
        (item.type, " ".join(item.angle.split()), " ".join(item.alasan.split()))
        for item in plan.templates
    ]


async def plan_questions(
    *,
    client: StructuredLlmClient,
    brief: str,
    doc_markdown: str,
    inline_parts: tuple[InlineData, ...] = (),
    questions_per_type: int = 1,
) -> tuple[list[tuple[QuestionType, str, str]], int]:
    """Tahap plan: sampai `MAX_PLAN_ATTEMPTS` kali, lalu error kalau tetap bentrok."""
    per_type = max(1, int(questions_per_type))
    feedback: str | None = None
    last_reason = "tidak diketahui"
    for attempt in range(1, MAX_PLAN_ATTEMPTS + 1):
        templates = await _plan_once(
            client=client,
            brief=brief,
            doc_markdown=doc_markdown,
            inline_parts=inline_parts,
            feedback=feedback,
            questions_per_type=per_type,
        )
        reason = validate_plan(templates, per_type)
        if reason is None:
            return templates, attempt
        logger.warning("plan percobaan %d ditolak: %s", attempt, reason)
        last_reason = reason
        feedback = reason
    raise PipelineError(
        f"plan tetap tidak valid setelah {MAX_PLAN_ATTEMPTS} percobaan: {last_reason}"
    )


# --------------------------------------------------------------------------- #
# Tahap generate + verify + repair
# --------------------------------------------------------------------------- #
def _order_drafts(drafts: list[DraftQuestion]) -> list[DraftQuestion]:
    """Urutkan draft sesuai urutan tipe enum, stabil per tipe."""

    def sort_key(item: DraftQuestion) -> tuple[int, str]:
        try:
            index = list(QUESTION_TYPES).index(item.type)
        except ValueError:  # tipe di luar enum -> taruh di akhir
            index = len(QUESTION_TYPES)
        return index, item.text

    return sorted(drafts, key=sort_key)


async def _repair_question(
    *,
    client: StructuredLlmClient,
    tipe: QuestionType,
    angle: str,
    draft: DraftQuestion,
    reason: str,
    brief: str,
    doc_markdown: str,
    inline_parts: tuple[InlineData, ...],
) -> tuple[DraftQuestion, bool, int]:
    """Regenerate satu pertanyaan yang evidence-nya gagal diverifikasi.

    Mengembalikan `(draft_terakhir, terverifikasi, jumlah_percobaan)`.
    """
    current = draft
    for attempt in range(1, MAX_REPAIR_ATTEMPTS + 1):
        prompt = repair_prompt(
            tipe=tipe,
            angle=angle,
            question=current.text,
            evidence=current.evidence,
            reason=reason,
            doc_markdown=doc_markdown,
        )
        repaired = await client.complete(
            prompt=prompt,
            schema=question_set_schema(1),
            inline_parts=inline_parts,
        )
        questions = getattr(repaired, "questions", None) or []
        if not questions:
            logger.warning("repair %s percobaan %d: model tidak mengembalikan soal", tipe.value, attempt)
            continue
        candidate = questions[0]
        new_reason = _reject_reason(candidate.evidence, doc_markdown)
        if new_reason is None:
            return candidate, True, attempt
        logger.warning(
            "repair %s percobaan %d masih ditolak: %s", tipe.value, attempt, new_reason
        )
        current, reason = candidate, new_reason
    return current, False, MAX_REPAIR_ATTEMPTS


async def build_questions(
    *,
    client: StructuredLlmClient,
    brief: str,
    document: ExtractedDocument,
    questions_per_type: int = 1,
) -> PipelineResult:
    """Jalankan plan -> generate -> verify -> strip untuk satu Sesi."""
    per_type = max(1, int(questions_per_type))
    expected = per_type * len(QUESTION_TYPES)
    doc_markdown = document.markdown

    # Fallback multimodal hanya kalau teksnya tipis, dan hanya kalau model
    # memang bisa menerima binary (lihat `model_factory.ModelSpec`).
    inline_parts: tuple[InlineData, ...] = ()
    used_multimodal = False
    if document.is_thin:
        inline = document.inline_data()
        if inline is None:
            logger.warning("materi tipis tapi berkas kosong; fallback multimodal dilewati")
        elif client.supports_inline_data:
            inline_parts = (inline,)
            used_multimodal = True
            logger.info("materi tipis — mengirim berkas mentah sebagai inline_data")
        else:
            logger.warning(
                "materi tipis (%d karakter) dan model tidak mendukung inline data; "
                "lanjut dengan teks tipis apa adanya",
                len(doc_markdown),
            )

    templates, plan_attempts = await plan_questions(
        client=client,
        brief=brief,
        doc_markdown=doc_markdown,
        inline_parts=inline_parts,
        questions_per_type=per_type,
    )

    generated = await client.complete(
        prompt=generate_prompt(brief=brief, doc_markdown=doc_markdown, templates=templates),
        schema=question_set_schema(expected),
        inline_parts=inline_parts,
    )
    drafts = _order_drafts(list(getattr(generated, "questions", None) or []))
    if len(drafts) < expected:
        raise PipelineError(
            f"generate mengembalikan {len(drafts)} pertanyaan, minimal {expected} diminta"
        )
    drafts = drafts[:expected]

    # Samakan urutan draft dengan urutan plan supaya tipe selalu pas.
    by_type: dict[QuestionType, list[DraftQuestion]] = {item: [] for item in QUESTION_TYPES}
    for draft in drafts:
        by_type.setdefault(draft.type, []).append(draft)

    # Substring check hanya bermakna kalau teks materi benar-benar ada. Kalau
    # model membaca berkas binary (fallback multimodal) atau teksnya kosong
    # sama sekali, verifikasi dilewati (best effort) — membandingkan kutipan
    # dengan dokumen kosong akan menolak semua pertanyaan tanpa guna.
    verification_enabled = bool(normalize_for_match(doc_markdown)) and not used_multimodal
    if not verification_enabled:
        logger.warning(
            "verifikasi evidence dilewati: materi dibaca multimodal atau teksnya kosong; "
            "evidence disimpan apa adanya untuk audit Guru"
        )

    results: list[GeneratedQuestion] = []
    repairs = 0
    unverified: list[str] = []
    for tipe, angle, _alasan in templates:
        bucket = by_type.get(tipe) or []
        if not bucket:
            raise PipelineError(f"tidak ada pertanyaan hasil generate untuk tipe {tipe.value}")
        draft = bucket.pop(0)
        reason = _reject_reason(draft.evidence, doc_markdown) if verification_enabled else None
        verified = reason is None
        attempts = 0
        if not verified:
            logger.warning("evidence %s ditolak: %s", tipe.value, reason)
            draft, verified, attempts = await _repair_question(
                client=client,
                tipe=tipe,
                angle=angle,
                draft=draft,
                reason=str(reason),
                brief=brief,
                doc_markdown=doc_markdown,
                inline_parts=inline_parts,
            )
            repairs += attempts
        if not verified:
            # Best effort: tetap simpan, tandai supaya Guru bisa curiga.
            unverified.append(tipe.value)
            logger.error(
                "evidence %s tetap gagal setelah %d repair; best effort disimpan",
                tipe.value,
                attempts,
            )
        results.append(
            GeneratedQuestion(
                type=tipe,
                text=" ".join(draft.text.split()),
                evidence=draft.evidence.strip(),
                angle=angle,
                verified=verified,
                repair_attempts=attempts,
            )
        )

    return PipelineResult(
        questions=tuple(results),
        plan=tuple(templates),
        used_multimodal=used_multimodal,
        doc_chars=len(doc_markdown),
        plan_attempts=plan_attempts,
        repairs=repairs,
        unverified=tuple(unverified),
    )


__all__ = [
    "MAX_PLAN_ATTEMPTS",
    "MAX_REPAIR_ATTEMPTS",
    "MIN_EVIDENCE_CHARS",
    "GeneratedQuestion",
    "PipelineError",
    "PipelineResult",
    "build_questions",
    "normalize_for_match",
    "plan_questions",
    "validate_plan",
    "verify_evidence",
]