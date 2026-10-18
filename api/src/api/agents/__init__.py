"""Sub-app AI: extract, pipeline, assess, schemas, prompts (DESIGN.md §6).

Entry point yang dipakai backend ada di `api.agents.tasks`:
`generate_questions(session_id)` dan `assess_answers(session_id)` — keduanya
sinkron, punya session DB sendiri, idempoten, dan tidak pernah melempar
exception ke pemanggil.

Tidak ada HTTP mount: pipeline berjalan in-process lewat `BackgroundTasks`
(`core/services/ai_hooks.py`).
"""

from __future__ import annotations

__all__ = [
    "assess",
    "extract",
    "model_factory",
    "pipeline",
    "prompts",
    "schemas",
    "tasks",
]