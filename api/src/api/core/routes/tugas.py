"""Endpoint Tugas — DESIGN.md §5.

Dua bentuk keluar dari file ini:

- Route Guru (`/api/tugas*`) memakai `TugasItem` (camelCase) karena itulah
  yang dibaca `web/src/lib/guru-api.ts`.
- Route publik `/api/t/:token` memakai `TugasPreview` (snake_case) karena itu
  yang dibaca `normalisasiTugas` di `web/src/lib/murid-api.ts`.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.core.auth.deps import DbSession, GuruUser, load_owned_tugas
from api.core.clock import is_expired, utcnow
from api.core.models.pelanggaran import Pelanggaran
from api.core.models.session import SessionRow
from api.core.models.tugas import (
    MAX_BYTES_DEFAULT,
    QUESTIONS_PER_TYPE_DEFAULT,
    SESI_MINUTES_DEFAULT,
    Tugas,
    file_types_out,
)
from api.core.models.user import User
from api.core.schemas.guru import (
    Participant,
    TugasCreateRequest,
    TugasItem,
    TugasPatchRequest,
    AttemptSummary,
    file_kinds_to_mimes,
    mimes_to_file_kinds,
)
from api.core.schemas.responses import TugasPreview
from api.core.services.tokens import new_share_token

router = APIRouter(tags=["tugas"])


def _assign_unique_token(db: Session) -> str:
    """Token share-link unik (kolomnya UNIQUE, tapi tetap retry)."""
    for _ in range(5):
        token = new_share_token()
        exists = db.scalar(select(Tugas.id).where(Tugas.token == token))
        if exists is None:
            return token
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="gagal membuat token share-link, coba lagi",
    )


def _statistik_tugas(db: Session, tugas_ids: list[str]) -> dict[str, tuple[int, int]]:
    """(muridCount, pelanggaranCount) per Tugas — untuk `TugasItem`."""
    if not tugas_ids:
        return {}

    murid_counts = dict(
        db.execute(
            select(SessionRow.tugas_id, func.count(func.distinct(SessionRow.murid_id)))
            .where(SessionRow.tugas_id.in_(tugas_ids))
            .group_by(SessionRow.tugas_id)
        ).all()
    )
    pelanggaran_counts = dict(
        db.execute(
            select(SessionRow.tugas_id, func.count(Pelanggaran.id))
            .join(Pelanggaran, Pelanggaran.session_id == SessionRow.id)
            .where(SessionRow.tugas_id.in_(tugas_ids))
            .group_by(SessionRow.tugas_id)
        ).all()
    )
    return {
        tugas_id: (int(murid_counts.get(tugas_id, 0)), int(pelanggaran_counts.get(tugas_id, 0)))
        for tugas_id in tugas_ids
    }


def _to_item(tugas: Tugas, *, murid_count: int = 0, pelanggaran_count: int = 0) -> TugasItem:
    return TugasItem(
        id=tugas.id,
        token=tugas.token,
        brief=tugas.brief,
        fileTypes=mimes_to_file_kinds(file_types_out(tugas.file_types)),
        maxBytes=tugas.max_bytes,
        deadlineAt=tugas.deadline_at,
        sesiMinutes=tugas.sesi_minutes,
        questionsPerType=tugas.questions_per_type,
        createdAt=tugas.created_at,
        muridCount=murid_count,
        pelanggaranCount=pelanggaran_count,
    )


@router.post("/tugas", response_model=TugasItem, status_code=status.HTTP_201_CREATED)
def create_tugas(
    payload: TugasCreateRequest,
    guru: GuruUser,
    db: DbSession,
) -> TugasItem:
    """Buat Tugas baru + token share-link. Body: `CreateTugasInput` (camelCase)."""
    tugas = Tugas(
        guru_id=guru.id,
        token=_assign_unique_token(db),
        brief=payload.brief,
        file_types=file_kinds_to_mimes(payload.fileTypes),
        max_bytes=payload.maxBytes or MAX_BYTES_DEFAULT,
        deadline_at=payload.deadlineAt,
        sesi_minutes=payload.sesiMinutes or SESI_MINUTES_DEFAULT,
        questions_per_type=payload.questionsPerType or QUESTIONS_PER_TYPE_DEFAULT,
    )
    db.add(tugas)
    try:
        db.commit()
    except IntegrityError as exc:  # pragma: no cover - extremely unlikely
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="token share-link bentrok, coba lagi",
        ) from exc
    db.refresh(tugas)
    return _to_item(tugas)


@router.get("/tugas", response_model=list[TugasItem])
def list_tugas(
    guru: GuruUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[TugasItem]:
    """Daftar Tugas milik Guru ini + jumlah Murid/Pelanggaran."""
    rows = db.scalars(
        select(Tugas).where(Tugas.guru_id == guru.id).order_by(Tugas.created_at.desc()).limit(limit)
    ).all()
    statistik = _statistik_tugas(db, [row.id for row in rows])
    return [
        _to_item(
            row,
            murid_count=statistik.get(row.id, (0, 0))[0],
            pelanggaran_count=statistik.get(row.id, (0, 0))[1],
        )
        for row in rows
    ]


@router.get("/tugas/{tugas_id}", response_model=TugasItem)
def get_tugas(tugas_id: str, guru: GuruUser, db: DbSession) -> TugasItem:
    """Detail satu Tugas milik Guru ini."""
    tugas = load_owned_tugas(db, tugas_id, guru)
    murid_count, pelanggaran_count = _statistik_tugas(db, [tugas.id]).get(tugas.id, (0, 0))
    return _to_item(
        tugas, murid_count=murid_count, pelanggaran_count=pelanggaran_count
    )


@router.patch("/tugas/{tugas_id}", response_model=TugasItem)
def update_tugas(
    tugas_id: str,
    payload: TugasPatchRequest,
    guru: GuruUser,
    db: DbSession,
) -> TugasItem:
    """Ubah konfigurasi Tugas. Body: `PatchTugasInput` (camelCase).

    Token share-link tidak pernah berubah.
    """
    tugas = load_owned_tugas(db, tugas_id, guru)

    updates: dict[str, Any] = payload.model_dump(exclude_unset=True)
    mapping = {"brief": "brief", "deadlineAt": "deadline_at", "sesiMinutes": "sesi_minutes"}
    for wire_name, column in mapping.items():
        if wire_name in updates:
            updates[column] = updates.pop(wire_name)

    if "brief" in updates and updates["brief"] is None:
        raise HTTPException(status_code=422, detail="brief tidak boleh null")

    for column, value in updates.items():
        setattr(tugas, column, value)

    db.commit()
    db.refresh(tugas)
    murid_count, pelanggaran_count = _statistik_tugas(db, [tugas.id]).get(tugas.id, (0, 0))
    return _to_item(
        tugas, murid_count=murid_count, pelanggaran_count=pelanggaran_count
    )


@router.get("/tugas/{tugas_id}/participants", response_model=list[Participant])
def list_participants(
    tugas_id: str,
    guru: GuruUser,
    db: DbSession,
) -> list[Participant]:
    """Ringkasan per Murid: attempt terbaru + riwayat + jumlah Pelanggaran."""
    load_owned_tugas(db, tugas_id, guru)

    rows = db.execute(
        select(SessionRow, User.name, User.email)
        .join(User, User.id == SessionRow.murid_id)
        .where(SessionRow.tugas_id == tugas_id)
        .order_by(SessionRow.murid_id, SessionRow.attempt_no)
    ).all()

    violations_by_session: dict[str, int] = dict(
        db.execute(
            select(Pelanggaran.session_id, func.count())
            .join(SessionRow, SessionRow.id == Pelanggaran.session_id)
            .where(SessionRow.tugas_id == tugas_id)
            .group_by(Pelanggaran.session_id)
        ).all()
    )

    peserta: list[Participant] = []
    index_by_murid: dict[str, int] = {}

    for session_row, name, email in rows:
        count = int(violations_by_session.get(session_row.id, 0))
        summary = AttemptSummary(
            sessionId=session_row.id,
            attemptNo=session_row.attempt_no,
            status=session_row.status,
            dimulaiAt=session_row.started_at,
            dikumpulAt=session_row.submitted_at,
            pelanggaranCount=count,
        )

        position = index_by_murid.get(session_row.murid_id)
        if position is None:
            # Attempt pertama yang terlihat = attempt terbaru.
            index_by_murid[session_row.murid_id] = len(peserta)
            peserta.append(
                Participant(
                    muridId=session_row.murid_id,
                    nama=name or "",
                    email=email or "",
                    sessionId=session_row.id,
                    attemptNo=session_row.attempt_no,
                    status=session_row.status,
                    pelanggaranCount=count,
                    terakhirAktif=session_row.started_at,
                    riwayat=[summary],
                )
            )
        else:
            # Attempt berikutnya: masukkan riwayat, geser ringkasan ke attempt terbaru.
            peserta[position].riwayat.append(summary)

    for item in peserta:
        terbaru = item.riwayat[-1]
        item.sessionId = terbaru.sessionId
        item.attemptNo = terbaru.attemptNo
        item.status = terbaru.status
        item.pelanggaranCount = terbaru.pelanggaranCount
        item.terakhirAktif = terbaru.dimulaiAt

    return peserta


@router.get("/t/{token}", response_model=TugasPreview)
def preview_tugas(token: str, db: DbSession) -> TugasPreview:
    """Pratinjau publik lewat share-link (tanpa auth): brief, aturan file, deadline."""
    tugas = db.scalar(select(Tugas).where(Tugas.token == token))
    if tugas is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tugas tidak ditemukan atau link sudah tidak berlaku",
        )

    guru = db.get(User, tugas.guru_id)
    return TugasPreview(
        id=tugas.id,
        token=tugas.token,
        brief=tugas.brief,
        file_types=file_types_out(tugas.file_types),
        max_bytes=tugas.max_bytes,
        deadline_at=tugas.deadline_at,
        sesi_minutes=tugas.sesi_minutes,
        questions_per_type=tugas.questions_per_type,
        guru_name=guru.name if guru else None,
        deadline_passed=is_expired(tugas.deadline_at, now=utcnow()),
    )
