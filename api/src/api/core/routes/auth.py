"""Endpoint auth — DESIGN.md §5.

`POST /api/auth/onboard` adalah satu-satunya cara user menjadi Guru, dan peran
hanya bisa ditetapkan SATU KALI (balas 400 kalau sudah terkunci).
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from api.core.auth.deps import CurrentUser, DbSession
from api.core.models.user import User
from api.core.schemas.requests import OnboardingIn
from api.core.schemas.responses import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/onboard", response_model=UserOut)
def onboard(payload: OnboardingIn, user: CurrentUser, db: DbSession) -> UserOut:
    """Kunci peran user: `guru` atau `murid`. Sekali seumur akun."""
    if user.role is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="peran sudah ditetapkan dan tidak bisa diubah",
        )

    # Muat ulang lewat session request — objek user dari dependency mungkin
    # ter-detach (mis. Dio-override pada test).
    row = db.get(User, user.id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="user tidak ditemukan",
        )

    row.role = payload.role.value
    db.commit()
    db.refresh(row)
    return UserOut.model_validate(row)