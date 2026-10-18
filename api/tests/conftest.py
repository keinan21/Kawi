"""Fixture pytest — SQLite in-memory + TestClient.

Env diset di level modul SEBELUM `api.*` di-import, karena `Settings` di-cache
saat import pertama.

Autentikasi Clerk tidak dipanggil di test: `get_current_user` di-override lewat
`app.dependency_overrides` (fixture `login_as`), jadi tidak ada panggilan jaringan
ke Clerk sama sekali.
"""

from __future__ import annotations

import base64
import os
import secrets
import tempfile
import uuid
from collections.abc import Callable, Iterator

import pytest

# --- env harus lebih dulu dari import api.* ---
_TMP_UPLOADS = tempfile.mkdtemp(prefix="lms-test-uploads-")
os.environ["DATABASE_URL"] = "sqlite://"  # in-memory + StaticPool
os.environ["UPLOAD_DIR"] = _TMP_UPLOADS
os.environ["CLERK_SECRET_KEY"] = "sk_test_fake_for_pytest"
os.environ["CLERK_PUBLISHABLE_KEY"] = "pk_test_fake_for_pytest"
os.environ["CLERK_WEBHOOK_SECRET"] = (
    "whsec_" + base64.b64encode(secrets.token_bytes(32)).decode()
)

from fastapi.testclient import TestClient  # noqa: E402

from api.core.auth.deps import get_current_user  # noqa: E402
from api.core.db import SessionLocal, engine  # noqa: E402
from api.core.enums import UserRole  # noqa: E402
from api.core.models.base import Base  # noqa: E402
from api.core.models.user import User  # noqa: E402
from api.main import app  # noqa: E402

# PDF/PPTX palsu untuk uji unggah.
FAKE_PDF = b"%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n"
FAKE_PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


@pytest.fixture()
def session_factory() -> Callable[[], object]:
    """Fungsi session baru — jangan pegang session terbuka lintas request.

    SQLite in-memory memakai StaticPool (satu koneksi Database), jadi session
    yang masih terbuka akan memblokir session milik request berikutnya.
    """
    Base.metadata.create_all(engine)
    return SessionLocal


@pytest.fixture()
def db(session_factory):
    """Pakai sebagai `with db() as s:` di dalam test."""
    return session_factory


@pytest.fixture()
def client() -> Iterator[TestClient]:
    """TestClient dengan skema dibuat ulang untuk tiap test."""
    Base.metadata.create_all(engine)
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(engine)


def make_user(role: str | None = UserRole.MURID.value, **overrides) -> User:
    """Buat user lalu detach dari session (dipakai `login_as`)."""
    session = SessionLocal()
    try:
        fields = {
            "clerk_id": f"clerk_{uuid.uuid4().hex[:12]}",
            "role": role,
            "name": overrides.pop("name", f"User {role}"),
            "email": overrides.pop("email", f"{uuid.uuid4().hex[:8]}@example.test"),
        }
        fields.update(overrides)
        user = User(**fields)
        session.add(user)
        session.commit()
        session.refresh(user)
        session.expunge(user)
        return user
    finally:
        session.close()


@pytest.fixture()
def login_as(client) -> Iterator[Callable[..., User]]:
    """Override `get_current_user` -> `login_as(user)` atau `login_as('guru')`.

    Override selalu membaca user dari database (persis seperti `upsert_user` di
    produksi), jadi state yang berubah di request sebelumnya terlihat.
    """

    def _apply(user_or_role=None, **kwargs) -> User:
        if isinstance(user_or_role, str):
            user = make_user(user_or_role, **kwargs)
        elif user_or_role is None:
            user = make_user(None, **kwargs)
        else:
            user = user_or_role

        def _current_user() -> User:
            session = SessionLocal()
            try:
                return session.get(User, user.id)
            finally:
                session.close()

        client.app.dependency_overrides[get_current_user] = _current_user
        return user

    yield _apply
    client.app.dependency_overrides.clear()


@pytest.fixture()
def guru() -> User:
    """User Guru (belum login; panggil `login_as(guru)`)."""
    return make_user(UserRole.GURU.value)


@pytest.fixture()
def murid() -> User:
    """User Murid (belum login; panggil `login_as(murid)`)."""
    return make_user(UserRole.MURID.value)


# --- helper payload --------------------------------------------------------- #
def make_tugas(guru_user: User, session, **overrides):
    """Buat Tugas langsung lewat model (bypass HTTP)."""
    from api.core.models.tugas import Tugas
    from api.core.services.tokens import new_share_token

    fields = {
        "guru_id": guru_user.id,
        "token": new_share_token(),
        "brief": "Jelaskan analisis ekonomi digital.",
        "max_bytes": 2_000_000,
        "sesi_minutes": 10,
        "questions_per_type": 1,
        "file_types": [
            "application/pdf",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ],
    }
    fields.update(overrides)
    tugas = Tugas(**fields)
    session.add(tugas)
    session.commit()
    session.refresh(tugas)
    session.expunge(tugas)
    return tugas


def seed_questions(session, session_id: str, with_evidence: bool = True) -> list[str]:
    """Suntik tiga Pertanyaan fake — meniru output lane AI."""
    from api.core.enums import QuestionType
    from api.core.models.pertanyaan import Pertanyaan

    templates = {
        QuestionType.IDEASI: "Dari mana ide utama ini berasal?",
        QuestionType.ISI: "Bagian mana yang paling kamu revisi sendiri?",
        QuestionType.HARAPAN: "Siapa yang akan terdampak karya ini?",
    }
    ids: list[str] = []
    for seq, tipe in enumerate(QuestionType):
        item = Pertanyaan(
            session_id=session_id,
            type=tipe,
            seq=seq,
            text=templates[tipe],
            evidence="kutipan dari dokumen" if with_evidence else None,
        )
        session.add(item)
        session.flush()
        ids.append(item.id)
    session.commit()
    return ids


def make_session_row(session, tugas, murid_user: User, **overrides):
    """Buat baris Sesi langsung lewat model."""
    from api.core.enums import SessionStatus
    from api.core.models.session import SessionRow

    fields = {
        "tugas_id": tugas.id,
        "murid_id": murid_user.id,
        "attempt_no": 1,
        "status": SessionStatus.CREATED,
    }
    fields.update(overrides)
    row = SessionRow(**fields)
    session.add(row)
    session.commit()
    session.refresh(row)
    session.expunge(row)
    return row