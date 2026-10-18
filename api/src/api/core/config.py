"""Konfigurasi runtime — DESIGN.md §8.

Semua env dikumpulkan di sini supaya tidak ada pembacaan `os.environ` liar di
modul lain. Nilai diambil dari env proses atau file `api/.env` (lihat
`.env.example`).
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# api/src/api/core/config.py -> lms/
#   [0]=core [1]=api(paket) [2]=src [3]=api [4]=lms
REPO_ROOT = Path(__file__).resolve().parents[4]


class Settings(BaseSettings):
    """Env aplikasi.

    Default sengaja memakai SQLite lokal supaya app tetap boot tanpa `.env`;
    produksi menunjuk `DATABASE_URL` ke Neon Postgres (DESIGN.md §8).
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Database (DESIGN.md §4, §8) ---
    database_url: str = "sqlite:///./var/lms.db"

    # --- Penyimpanan Unggahan di disk lokal (DESIGN.md §8) ---
    upload_dir: Path = Path("./var/uploads")

    # --- Clerk (DESIGN.md §5) ---
    clerk_secret_key: str = ""
    clerk_publishable_key: str = ""
    clerk_webhook_secret: str = ""

    # --- Pipeline AI (DESIGN.md §8) — lane AI, dideklarasikan agar env tidak liar ---
    litellm_base_url: str | None = None
    model: str | None = None
    mistral_api_key: str = ""

    # --- CORS (DESIGN.md §5) — kosong = dev via Vite proxy, tidak butuh CORS ---
    cors_origins: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        """Daftar origin yang diizinkan, dipisah koma (mis. `https://app.example.com`)."""
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def upload_path(self) -> Path:
        """Folder Unggahan absolut; path relatif di-resolve relatif repo root."""
        path = self.upload_dir
        if not path.is_absolute():
            path = REPO_ROOT / path
        return path.resolve()

    @property
    def sqlite_url(self) -> bool:
        return self.database_url.startswith("sqlite")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Settings singleton — cache supaya env dibaca sekali per proses."""
    return Settings()