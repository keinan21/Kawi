"""Router utama aplikasi, di-mount dengan prefix `/api` (DESIGN.md §5)."""

from fastapi import APIRouter

from api.core.routes.auth import router as auth_router
from api.core.routes.health import router as health_router
from api.core.routes.sessions import router as sessions_router
from api.core.routes.tugas import router as tugas_router
from api.core.routes.webhooks import router as webhooks_router

api_router = APIRouter(prefix="/api")

# health & webhook tidak butuh auth Clerk.
api_router.include_router(health_router)
api_router.include_router(webhooks_router)

# Guard peran dipasang di tiap route lewat dependency (require_guru/require_murid).
api_router.include_router(auth_router)
api_router.include_router(tugas_router)
api_router.include_router(sessions_router)

__all__ = ["api_router"]