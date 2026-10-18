"""Endpoint kesehatan — placeholder untuk scaffold."""

from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Cek hidup proses api."""
    return {"status": "ok"}
