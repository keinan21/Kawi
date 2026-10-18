"""Hook AI — titik sambung ke lane AI (DESIGN.md §6).

Lane AI mengimplementasikan `api/src/api/agents/tasks.py` dengan dua fungsi:
`generate_questions(session_id)` dan `assess_answers(session_id)`. Modul ini
hanya memanggilnya lewat BackgroundTasks dan diam-diam melewati ImportError
sampai lane tersebut ada.
"""

from __future__ import annotations

import logging

from fastapi import BackgroundTasks

logger = logging.getLogger(__name__)


def _run_generate_questions(session_id: str) -> None:
    """AI lane implements this."""
    try:
        from api.agents.tasks import generate_questions  # type: ignore[import-not-found]
    except ImportError:
        logger.info("ai lane belum aktif; lewati generate_questions(session=%s)", session_id)
        return
    try:
        generate_questions(session_id)
    except Exception:  # noqa: BLE001 — AI tidak boleh merusak alur Sesi
        logger.exception("generate_questions gagal untuk session=%s", session_id)


def _run_assess_answers(session_id: str) -> None:
    """AI lane implements this."""
    try:
        from api.agents.tasks import assess_answers  # type: ignore[import-not-found]
    except ImportError:
        logger.info("ai lane belum aktif; lewati assess_answers(session=%s)", session_id)
        return
    try:
        assess_answers(session_id)
    except Exception:  # noqa: BLE001
        logger.exception("assess_answers gagal untuk session=%s", session_id)


def schedule_generate_questions(background: BackgroundTasks, session_id: str) -> None:
    """Jalankan pipeline extract → plan → generate → verify → strip."""
    background.add_task(_run_generate_questions, session_id)


def schedule_assess(background: BackgroundTasks | None, session_id: str) -> None:
    """Jalankan Penilaian AI (async, setelah submit)."""
    if background is None:
        _run_assess_answers(session_id)
        return
    background.add_task(_run_assess_answers, session_id)