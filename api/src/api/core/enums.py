"""Enum domain — cermin manual dari packages/shared/src/index.ts.

Hand-mirrored to packages/shared — keep in sync (DESIGN.md §8).
"""

from enum import StrEnum


class PelanggaranType(StrEnum):
    """Jenis Pelanggaran yang dilaporkan modul proctor (DESIGN.md §7)."""

    TAB_SWITCH = "tab_switch"
    WINDOW_BLUR = "window_blur"
    FULLSCREEN_EXIT = "fullscreen_exit"
    COPY_BLOCKED = "copy_blocked"
    PASTE_BLOCKED = "paste_blocked"
    CONTEXT_MENU_BLOCKED = "context_menu_blocked"
    SHORTCUT_BLOCKED = "shortcut_blocked"
    MULTI_TAB = "multi_tab"


class SessionStatus(StrEnum):
    """Status Sesi pada state machine (DESIGN.md §3)."""

    CREATED = "created"
    GENERATING = "generating"
    ANSWERING = "answering"
    SUBMITTED = "submitted"
    AUTO_SUBMITTED = "auto_submitted"


class QuestionType(StrEnum):
    """Tipe Pertanyaan yang di-generate AI (DESIGN.md §6)."""

    IDEASI = "ideasi"
    ISI = "isi"
    HARAPAN = "harapan"


class UserRole(StrEnum):
    """Peran user — enum internal api, bukan bagian kontrak proctor.

    Ditulis satu kali lewat `POST /api/auth/onboard` (lihat §5 Auth).
    """

    GURU = "guru"
    MURID = "murid"
