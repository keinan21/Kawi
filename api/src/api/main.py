"""Titik masuk aplikasi FastAPI.

Struktur modul mengikuti DESIGN.md §2. Skema DB dibuat dengan `create_all` saat
startup — belum ada Alembic untuk MVP (lihat `api.core.db.create_all`).
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.core.config import get_settings
from api.core.db import create_all
from api.core.routes import api_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Buat tabel bila belum ada (pengganti Alembic, DESIGN.md §4).

    Aman untuk SQLite (test in-memory) maupun Postgres: `create_all` hanya
    membuat tabel yang hilang, tidak menimpa yang sudah ada.
    """
    create_all()
    logger.info("skema database siap")
    yield


def create_app() -> FastAPI:
    """App factory — dipakai uvicorn lewat `api.main:app`."""
    app = FastAPI(
        title="Assignment Integrity Form API",
        version="0.1.0",
        lifespan=lifespan,
    )

    # CORS — hanya aktif bila CORS_ORIGINS di-set (deploy web/api cross-origin).
    # Dev default: Vite proxy (sama origin), jadi daftar kosong = tanpa CORS.
    origins = get_settings().cors_origin_list
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_methods=["*"],
            allow_headers=["Authorization", "Content-Type"],
        )

    # Router utama: prefix /api (DESIGN.md §5).
    app.include_router(api_router)

    # agents sub-app mount (ADK) — see DESIGN.md §6
    # Nanti: app.mount("/agents", agents_app) dari api.agents
    return app


app = create_app()