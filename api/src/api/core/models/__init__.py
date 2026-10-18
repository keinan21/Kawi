"""Model SQLAlchemy — DESIGN.md §4.

Import modul ini mendaftarkan seluruh tabel ke `Base.metadata` supaya
`create_all()` (lihat `api.core.db`) melihat semuanya.
"""

from api.core.models.base import Base, IdMixin, TimestampMixin, new_id
from api.core.models.pelanggaran import Pelanggaran
from api.core.models.penilaian_ai import PenilaianAI, recompute_total
from api.core.models.pertanyaan import Jawaban, Pertanyaan
from api.core.models.session import (
    ACTIVE_STATUSES,
    TERMINAL_STATUSES,
    SessionRow,
)
from api.core.models.tugas import (
    DEFAULT_FILE_TYPES,
    MAX_BYTES_DEFAULT,
    SESI_MINUTES_DEFAULT,
    Tugas,
)
from api.core.models.unggahan import Unggahan
from api.core.models.user import User

__all__ = [
    "ACTIVE_STATUSES",
    "Base",
    "DEFAULT_FILE_TYPES",
    "IdMixin",
    "Jawaban",
    "MAX_BYTES_DEFAULT",
    "Pelanggaran",
    "PenilaianAI",
    "Pertanyaan",
    "recompute_total",
    "SESI_MINUTES_DEFAULT",
    "SessionRow",
    "TERMINAL_STATUSES",
    "Tugas",
    "TimestampMixin",
    "Unggahan",
    "User",
    "new_id",
]