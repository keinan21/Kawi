"""Entry point lane AI (DESIGN.md §6) — dipanggil dari `core/services/ai_hooks.py`.

`core` memanggil dua fungsi ini lewat `BackgroundTasks`:
- `generate_questions(session_id)` setelah Unggahan tersimpan (`generating`).
- `assess_answers(session_id)` setelah jawaban terkirim / timer habis.

Kontrak yang dipegang modul ini:

1. **Signature persis** `def <nama>(session_id: str) -> None` (sinkron) supaya
   BackgroundTasks bisa memanggilnya.
2. **Session DB sendiri** — instantiate `SessionLocal` sendiri, tidak
   monkeypatch, tidak memakai session request. Session selalu ditutup sebelum
   panggilan LLM (SQLite/Postgres tidak menahan lock selama menunggu jaringan).
3. **Idempoten** — kalau Pertanyaan sudah cukup banyak (atau Penilaian AI sudah
   ada), fungsi ini no-op. Aman dipanggil berulang.
4. **Crash tidak pernah naik ke pemanggil.** Semua exception ditangkap + di-log.
   Sesi tetap utuh: statusnya tetap `generating`, timer tetap berjalan, dan
   auto-submit adalah jaring pengaman kalau pipeline benar-benar mati.
"""

from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.agents import assess as assess_mod
from api.agents import extract, model_factory, pipeline
from api.core.clock import utcnow
from api.core.db import SessionLocal
from api.core.enums import QuestionType, SessionStatus
from api.core.models.penilaian_ai import PenilaianAI
from api.core.models.pertanyaan import Jawaban, Pertanyaan, expected_question_count
from api.core.models.session import SessionRow
from api.core.models.tugas import Tugas
from api.core.models.unggahan import Unggahan

logger = logging.getLogger(__name__)


class _NotReady(Exception):
    """Prasyarat belum terpenuhi — di-log sebagai info, bukan error."""


@dataclass(frozen=True)
class GenerationJob:
    """Semua yang dibutuhkan pipeline, dibaca sekali lalu session ditutup."""

    session_id: str
    brief: str
    questions_per_type: int
    required: int
    unggahan: Unggahan


# --------------------------------------------------------------------------- #
# Helper
# --------------------------------------------------------------------------- #
def _run_coroutine(factory):
    """Jalankan coroutine dari konteks sinkron.

    `BackgroundTasks` memanggil fungsi sinkron di thread pool, jadi `asyncio.run`
    aman. Kalau dipanggil dari dalam loop yang sedang berjalan (mis. script dev),
    eksekusi dipindah ke thread baru supaya tetap tidak error.
    """
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(factory())
    with ThreadPoolExecutor(max_workers=1) as pool:
        return pool.submit(lambda: asyncio.run(factory())).result()


def _count_questions(db: Session, session_id: str) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(Pertanyaan)
            .where(Pertanyaan.session_id == session_id)
        )
        or 0
    )


def _load_generation_job(db: Session, session_id: str) -> GenerationJob:
    """Baca prasyarat generate; lempar `_NotReady` kalau belum bisa jalan."""
    row = db.get(SessionRow, session_id)
    if row is None:
        raise _NotReady(f"Sesi {session_id} tidak ada")
    if row.status in (SessionStatus.SUBMITTED, SessionStatus.AUTO_SUBMITTED):
        raise _NotReady(f"Sesi sudah terminal ({row.status}) — Pertanyaan tidak dibuat")

    tugas = db.get(Tugas, row.tugas_id)
    if tugas is None:
        raise _NotReady(f"Tugas {row.tugas_id} tidak ada")

    per_type = max(1, int(tugas.questions_per_type or 1))
    required = expected_question_count(per_type)
    existing = _count_questions(db, session_id)
    if existing >= required:
        raise _NotReady(f"Pertanyaan sudah ada ({existing}/{required}) — lewati")

    unggahan = db.scalar(select(Unggahan).where(Unggahan.session_id == session_id))
    if unggahan is None:
        raise _NotReady("belum ada Unggahan")

    return GenerationJob(
        session_id=row.id,
        brief=tugas.brief or "",
        questions_per_type=per_type,
        required=required,
        unggahan=unggahan,
    )


def _mark_answering(db: Session, row: SessionRow) -> bool:
    """Pindah `generating` -> `answering` setelah Pertanyaan lengkap.

    Jalur utama: helper `core.services.session_state.mark_answering_if_ready`
    (read-repair yang sama dengan dipakai polling `GET /questions`). Kalau helper
    itu tidak ada di versi core yang terpasang, fallback ke transisi langsung —
    read-repair di backend tetap menutupi kalau transisi terlewat.
    """
    try:
        from api.core.services import session_state
    except ImportError:  # pragma: no cover - core selalu ada di repo ini
        session_state = None  # type: ignore[assignment]

    helper = getattr(session_state, "mark_answering_if_ready", None)
    if callable(helper):
        try:
            return bool(helper(db, row))
        except Exception:  # noqa: BLE001 — transisi tidak boleh menjatuhkan hasil
            db.rollback()
            logger.exception("mark_answering_if_ready gagal; fallback transisi langsung")

    if row.status == SessionStatus.GENERATING:
        row.status = SessionStatus.ANSWERING
        db.commit()
        return True
    return False


# --------------------------------------------------------------------------- #
# Entry point 1 — generate Pertanyaan
# --------------------------------------------------------------------------- #
def generate_questions(session_id: str) -> None:
    """Pipeline extract -> plan -> generate -> verify -> strip.

    Dipanggil `core.services.ai_hooks` setelah Unggahan tersimpan.
    """
    try:
        _run_coroutine(lambda: _generate_questions(session_id))
    except _NotReady as exc:
        logger.info("generate_questions dilewati untuk %s: %s", session_id, exc)
    except Exception:  # noqa: BLE001 — AI TIDAK BOLEH merusak alur Sesi
        # Kehati-hatian: exception apa pun di sini hanya menghasilkan Sesi tanpa
        # Pertanyaan. Status tetap `generating`, timer tetap jalan, dan
        # auto-submit (`enforce_timer`) menutup Sesi sebagai jaring pengaman.
        logger.exception(
            "generate_questions gagal untuk session=%s; Sesi tetap berjalan dan "
            "auto-submit menjadi jaring pengaman",
            session_id,
        )


async def _generate_questions(session_id: str) -> None:
    db = SessionLocal()
    try:
        job = _load_generation_job(db, session_id)
    finally:
        db.close()

    document = extract.extract_document(job.unggahan)
    logger.info(
        "ekstraksi %s: fast_path=%s chars=%d thin=%s truncated=%s error=%s",
        job.unggahan.filename,
        document.fast_path,
        len(document.markdown),
        document.is_thin,
        document.truncated,
        document.error,
    )

    client = model_factory.build_client()
    result = await pipeline.build_questions(
        client=client,
        brief=job.brief,
        document=document,
        questions_per_type=job.questions_per_type,
    )
    logger.info(
        "pipeline selesai session=%s: pertanyaan=%d plan_attempts=%d repairs=%d "
        "multimodal=%s unverified=%s",
        job.session_id,
        len(result.questions),
        result.plan_attempts,
        result.repairs,
        result.used_multimodal,
        list(result.unverified) or "-",
    )

    _store_questions(job, result)


def _store_questions(job: GenerationJob, result: pipeline.PipelineResult) -> None:
    """Tulis Pertanyaan (beserta `evidence`) lalu transisi status."""
    db = SessionLocal()
    try:
        row = db.get(SessionRow, job.session_id)
        if row is None:
            logger.warning("Sesi %s hilang saat pipeline berjalan", job.session_id)
            return
        if row.status in (SessionStatus.SUBMITTED, SessionStatus.AUTO_SUBMITTED):
            logger.info(
                "Sesi %s sudah terminal (%s); hasil pipeline dibuang", job.session_id, row.status
            )
            return

        # Idempotensi lagi (aman dari dua worker BackgroundTask).
        if _count_questions(db, job.session_id) >= job.required:
            logger.info("Pertanyaan sudah lengkap; hasil kedua dibuang")
            return

        for seq, item in enumerate(result.questions):
            db.add(
                Pertanyaan(
                    session_id=job.session_id,
                    type=item.type,
                    seq=seq,
                    text=item.text,
                    # evidence hanya untuk audit Guru (DESIGN.md §6 langkah 5)
                    evidence=item.evidence or None,
                )
            )
        try:
            db.commit()
        except IntegrityError:
            # Balapan dengan worker lain yang menulis Pertanyaan lebih dulu.
            db.rollback()
            logger.warning("Pertanyaan session=%s sudah ditulis worker lain", job.session_id)
            return

        transitioned = _mark_answering(db, row)
        logger.info(
            "Pertanyaan tersimpan session=%s jumlah=%d status=%s transisi_answering=%s",
            job.session_id,
            len(result.questions),
            row.status.value,
            transitioned,
        )
    finally:
        db.close()


# --------------------------------------------------------------------------- #
# Entry point 2 — Penilaian AI
# --------------------------------------------------------------------------- #
def assess_answers(session_id: str) -> None:
    """Penilaian AI setelah jawaban lengkap; hanya kalau `submitted`.

    Penilaian AI confidential: hanya Guru yang membacanya (serializer Murid sudah
    menstrip fieldnya). Sesi yang belum `submitted` dilewati diam-diam.
    """
    try:
        _run_coroutine(lambda: _assess_answers(session_id))
    except _NotReady as exc:
        logger.info("assess_answers dilewati untuk %s: %s", session_id, exc)
    except Exception:  # noqa: BLE001 — Penilaian AI tidak boleh merusak alur Sesi
        logger.exception(
            "assess_answers gagal untuk session=%s; jawaban Murid tetap aman", session_id
        )


async def _assess_answers(session_id: str) -> None:
    db = SessionLocal()
    try:
        brief, pairs = _load_assessment_input(db, session_id)
    finally:
        db.close()

    client = model_factory.build_client()
    assessment = await assess_mod.assess_document(client=client, brief=brief, pairs=pairs)
    logger.info(
        "penilaian session=%s: ideasi=%s isi=%s harapan=%s total=%s "
        "(total model=%s diabaikan)",
        session_id,
        assessment.skor_ideasi,
        assessment.skor_isi,
        assessment.skor_harapan,
        assessment.skor_total,
        assessment.declared_total,
    )
    _store_assessment(session_id, assessment)


def _load_assessment_input(db: Session, session_id: str) -> tuple[str, list[assess_mod.AnswerPair]]:
    """Baca brief + pasangan pertanyaan/jawaban; lempar `_NotReady` kalau belum."""
    row = db.get(SessionRow, session_id)
    if row is None:
        raise _NotReady(f"Sesi {session_id} tidak ada")
    if row.status != SessionStatus.SUBMITTED:
        raise _NotReady(
            f"status {row.status.value} — Penilaian AI hanya untuk status submitted"
        )
    if db.get(PenilaianAI, session_id) is not None:
        raise _NotReady("Penilaian AI sudah ada")

    tugas = db.get(Tugas, row.tugas_id)
    required = expected_question_count(tugas.questions_per_type if tugas else 1)
    questions = list(
        db.scalars(
            select(Pertanyaan)
            .where(Pertanyaan.session_id == session_id)
            .order_by(Pertanyaan.seq)
        )
    )
    if len(questions) < required:
        raise _NotReady(f"Pertanyaan belum lengkap ({len(questions)}/{required})")

    answers = {
        item.pertanyaan_id: item.text
        for item in db.scalars(
            select(Jawaban).where(Jawaban.pertanyaan_id.in_([q.id for q in questions]))
        )
    }
    missing = [q.id for q in questions if q.id not in answers]
    if missing:
        raise _NotReady(f"jawaban belum lengkap ({len(missing)} pertanyaan tanpa jawaban)")

    pairs = [
        assess_mod.AnswerPair(
            question_type=question.type,
            question_text=question.text,
            answer_text=answers[question.id],
        )
        for question in questions
    ]
    types = {item.question_type for item in pairs}
    if types != set(QuestionType):
        raise _NotReady(f"set tipe Pertanyaan tidak lengkap: {sorted(t.value for t in types)}")

    return (tugas.brief if tugas else ""), pairs


def _store_assessment(session_id: str, assessment: assess_mod.Assessment) -> None:
    db = SessionLocal()
    try:
        if db.get(PenilaianAI, session_id) is not None:
            logger.info("Penilaian AI session=%s sudah ada; lewati", session_id)
            return
        db.add(
            PenilaianAI(
                session_id=session_id,
                assessed_at=utcnow(),
                **assessment.as_columns(),
            )
        )
        db.commit()
        logger.info("Penilaian AI tersimpan session=%s total=%s", session_id, assessment.skor_total)
    except IntegrityError:  # pragma: no cover - balapan dua worker
        db.rollback()
        logger.warning("Penilaian AI session=%s sudah ditulis worker lain", session_id)
    finally:
        db.close()


__all__ = ["assess_answers", "generate_questions"]