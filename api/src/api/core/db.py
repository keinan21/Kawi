"""Engine + Session SQLAlchemy.

Skema dibuat dengan `create_all` saat startup — belum ada Alembic (DESIGN.md §4
MVP). Kalau skema nanti perlu dimigrasi, titik ingressinya `Base.metadata`
di `core/models/__init__.py`.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from api.core.clock import as_utc, utcnow
from api.core.config import REPO_ROOT, get_settings
from api.core.models.base import Base

__all__ = [
    "SessionLocal",
    "as_utc",
    "create_all",
    "create_engine_for",
    "engine",
    "get_db",
    "utcnow",
]


def _is_sqlite_memory(url: str) -> bool:
    return url.startswith("sqlite") and (":memory:" in url or url in ("sqlite://", "sqlite:///"))


def _resolve_sqlite_path(url: str) -> str:
    """Path SQLite relatif di-resolve relatif repo root (bukan cwd).

    `api/` dan repo root tidak selalu cwd yang sama (`uvicorn --app-dir src`
    dijalankan dari `api/`, sementara `var/uploads` ada di root).
    """
    prefix = "sqlite:///"
    if not url.startswith(prefix):
        return url
    rest = url[len(prefix) :]
    if rest == "" or rest.startswith("/") or ":memory:" in rest:
        return url
    resolved = (REPO_ROOT / rest).resolve()
    resolved.parent.mkdir(parents=True, exist_ok=True)
    return prefix + str(resolved)


def create_engine_for(url: str, **overrides: Any) -> Engine:
    """Buat engine yang portabel SQLite/Postgres."""
    url = _resolve_sqlite_path(url)
    kwargs: dict[str, Any] = {"future": True, **overrides}
    if url.startswith("sqlite"):
        # Starlette TestClient/uvicorn bisa buka koneksi dari thread berbeda.
        kwargs.setdefault("connect_args", {"check_same_thread": False})
        if _is_sqlite_memory(url):
            # SQLite in-memory hidup per-koneksi; StaticPool menahan satu
            # koneksi supaya semua session melihat database yang sama.
            kwargs.setdefault("poolclass", StaticPool)
    return create_engine(url, **kwargs)


engine: Engine = create_engine_for(get_settings().database_url)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    expire_on_commit=False,
    class_=Session,
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_connection: Any, _record: Any) -> None:
    """Aktifkan foreign key enforcement di SQLite (default-nya OFF)."""
    if engine.dialect.name != "sqlite":
        return
    cursor = dbapi_connection.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys=ON")
    finally:
        cursor.close()


def get_db() -> Iterator[Session]:
    """Dependency FastAPI — satu session per request, commit oleh route."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_all() -> None:
    """Buat seluruh tabel bila belum ada (pengganti Alembic untuk MVP)."""
    import api.core.models  # noqa: F401  — pastikan semua model terdaftar

    Base.metadata.create_all(bind=engine)