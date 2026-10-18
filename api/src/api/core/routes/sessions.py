"""Endpoint Sesi + Unggahan + Pelanggaran — DESIGN.md §3, §5.

Dua kelompok client dengan dua bentuk payload berbeda (lihat `web/src/lib/`):

- Route **Murid** (`POST /sessions`, `/:id/unggahan`, `/questions`, `/answers`,
  `/violations`, `/status`) menjawab **snake_case** — `normalisasiSesi` /
  `normalisasiTugas` di `murid-api.ts`.
- Route **Guru** (`GET /:id`, `POST /:id/izin`, `GET /:id/unggahan`) menjawab
  **camelCase + nama Bahasa Indonesia** — `guru-api.ts` + `guru-mocks.ts`.

Semua handler yang menyentuh Sesi memanggil `enforce_timer` lebih dulu, sehingga
timer yang sudah habis menghasilkan `auto_submitted` di path mana pun
(idempoten, aman untuk background worker).
"""

from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from api.core.auth.deps import (
    CurrentUser,
    DbSession,
    GuruUser,
    MuridUser,
    load_guru_session,
    load_owned_session,
)
from api.core.clock import as_utc, is_expired, utcnow
from api.core.enums import PelanggaranType, QuestionType, SessionStatus
from api.core.models.pelanggaran import Pelanggaran
# Alias: modul di bawah juga punya schema Pydantic bernama `PenilaianAI`.
from api.core.models.penilaian_ai import PenilaianAI as PenilaianAIRow
from api.core.models.pertanyaan import Jawaban, Pertanyaan, expected_question_count
from api.core.models.session import SessionRow
from api.core.models.tugas import Tugas, file_types_out
from api.core.models.unggahan import Unggahan
from api.core.models.user import User
from api.core.schemas.guru import (
    AttemptSummary,
    IzinResult,
    MuridRef,
    PelanggaranItem,
    PenilaianAI,
    QAItem,
    SessionDetail,
    UnggahanInfo,
)
from api.core.schemas.requests import AnswersIn, SessionCreateIn, ViolationBatchIn
from api.core.schemas.responses import (
    PertanyaanMuridOut,
    QuestionsOut,
    SessionOut,
    SessionStatusOut,
    ViolationBatchOut,
)
from api.core.services.ai_hooks import schedule_assess, schedule_generate_questions
from api.core.services.session_state import (
    count_violations,
    enforce_timer,
    has_active_attempt,
    mark_answering_if_ready,
    start_generating,
)
from api.core.storage.uploads import UploadMimeError, UploadTooLargeError, store_upload

router = APIRouter(prefix="/sessions", tags=["sessions"])

# Guard anti-storm sisi server (DESIGN.md §7): satu type yang sama dalam 1 detik
# diabaikan, dan maksimal 20 event per menit per Sesi.
VIOLATION_DEDUP_SECONDS = 1.0
VIOLATION_RATE_LIMIT_PER_MINUTE = 20


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _uploaded_meta(db: Session, row: SessionRow) -> tuple[bool, str | None]:
    """(sudah mengunggah?, nama file) — dibaca `normalisasiSesi` di client."""
    if row.unggahan is not None:
        return True, row.unggahan.filename
    stored = db.scalar(select(Unggahan).where(Unggahan.session_id == row.id))
    return (stored is not None, stored.filename if stored is not None else None)


def _to_session_out(db: Session, row: SessionRow) -> SessionOut:
    uploaded, filename = _uploaded_meta(db, row)
    return SessionOut(
        id=row.id,
        tugas_id=row.tugas_id,
        attempt_no=row.attempt_no,
        status=row.status,
        started_at=row.started_at,
        uploaded_at=row.uploaded_at,
        timer_ends_at=row.timer_ends_at,
        submitted_at=row.submitted_at,
        uploaded=uploaded,
        filename=filename,
    )


def _to_status_out(db: Session, row: SessionRow) -> SessionStatusOut:
    """`GET /status` — `status` dipakai polling, sisanya untuk countdown bar."""
    uploaded, filename = _uploaded_meta(db, row)
    return SessionStatusOut(
        status=row.status,
        id=row.id,
        tugas_id=row.tugas_id,
        attempt_no=row.attempt_no,
        started_at=row.started_at,
        uploaded_at=row.uploaded_at,
        timer_ends_at=row.timer_ends_at,
        submitted_at=row.submitted_at,
        uploaded=uploaded,
        filename=filename,
    )


def _load_tugas(db: Session, tugas_id: str) -> Tugas:
    tugas = db.get(Tugas, tugas_id)
    if tugas is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tugas tidak ditemukan atau link sudah tidak berlaku",
        )
    return tugas


def _parse_client_ts(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError:
        return None


def _konflik_ada_sesi(detail: str, session_id: str) -> JSONResponse:
    """409 yang tetap terbaca client: `sessionIdDariError` mencari `session_id`.

    Body: `{"detail": "...", "session_id": "<id>"}` — kunci `session_id` diletakkan
    di level atas (bukan di dalam `detail`) karena client membacanya dari situ.
    """
    return JSONResponse(
        status_code=status.HTTP_409_CONFLICT,
        content={"detail": detail, "session_id": session_id},
    )


def _riwayat_attempts(db: Session, tugas_id: str, murid_id: str) -> list[AttemptSummary]:
    rows = db.scalars(
        select(SessionRow)
        .where(SessionRow.tugas_id == tugas_id, SessionRow.murid_id == murid_id)
        .order_by(SessionRow.attempt_no)
    ).all()
    return [
        AttemptSummary(
            sessionId=item.id,
            attemptNo=item.attempt_no,
            status=item.status,
            dimulaiAt=item.started_at,
            dikumpulAt=item.submitted_at,
            pelanggaranCount=count_violations(db, item.id),
        )
        for item in rows
    ]


# --------------------------------------------------------------------------- #
# Murid — mulai Sesi
# --------------------------------------------------------------------------- #
@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreateIn,
    murid: MuridUser,
    db: DbSession,
) -> SessionOut | JSONResponse:
    """Mulai Sesi milik user yang sedang login.

    Body `{tugas_id}` (murid-api `mulaiSesi`). Balasan **tanpa amplop**: objek
    `SessionOut` langsung, karena `normalisasiSesi` menerima bentuk itu.

    409 bila masih ada attempt aktif; body 409 memuat `session_id` supaya
    frontend bisa menampilkan tombol "Lanjutkan Sesi".
    """
    tugas = _load_tugas(db, payload.tugas_id)

    if has_active_attempt(db, tugas.id, murid.id):
        return _konflik_ada_sesi(
            "masih ada Sesi aktif untuk Tugas ini",
            _active_session_id(db, tugas.id, murid.id),
        )

    if is_expired(tugas.deadline_at):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="deadline Tugas sudah lewat",
        )

    attempt_no = int(
        db.scalar(
            select(SessionRow.attempt_no)
            .where(SessionRow.tugas_id == tugas.id, SessionRow.murid_id == murid.id)
            .order_by(SessionRow.attempt_no.desc())
            .limit(1)
        )
        or 0
    ) + 1

    row = SessionRow(tugas_id=tugas.id, murid_id=murid.id, attempt_no=attempt_no)
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        # Partial unique index (tugas_id, murid_id) WHERE status='created' —
        # race dua tab yang mulai Sesi bersamaan.
        db.rollback()
        return _konflik_ada_sesi(
            "Sesi sudah dibuat di tab lain", _active_session_id(db, tugas.id, murid.id)
        )
    db.refresh(row)
    return _to_session_out(db, row)


def _active_session_id(db: Session, tugas_id: str, murid_id: str) -> str:
    active = db.scalar(
        select(SessionRow.id)
        .where(
            SessionRow.tugas_id == tugas_id,
            SessionRow.murid_id == murid_id,
            SessionRow.status.in_(
                (
                    SessionStatus.CREATED,
                    SessionStatus.GENERATING,
                    SessionStatus.ANSWERING,
                )
            ),
        )
        .order_by(SessionRow.attempt_no.desc())
        .limit(1)
    )
    return active or ""


# --------------------------------------------------------------------------- #
# Murid — Unggah (sekali saja)
# --------------------------------------------------------------------------- #
@router.post("/{session_id}/unggahan", response_model=SessionOut)
def upload_unggahan(
    session_id: str,
    murid: MuridUser,
    db: DbSession,
    background: BackgroundTasks,
    file: UploadFile = File(..., description="PDF atau PPT/PPTX, ≤ max_bytes."),
) -> SessionOut:
    """Simpan Unggahan lalu mulai timer (`created` -> `generating`).

    Multipart field: `file` (murid-api `unggahUnggahan`).
    """
    row = load_owned_session(db, session_id, murid)
    enforce_timer(db, row, background=background)

    if row.status != SessionStatus.CREATED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unggahan hanya bisa satu kali per Sesi",
        )
    if row.unggahan is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Unggahan sudah ada di Sesi ini",
        )

    tugas = _load_tugas(db, row.tugas_id)
    if is_expired(tugas.deadline_at):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="deadline Tugas sudah lewat",
        )

    allowed = frozenset(file_types_out(tugas.file_types))
    try:
        # MIME dicek lebih dulu; body baru dibaca setelah itu, terpotong di
        # max_bytes (tidak pernah buffer penuh file oversized).
        stored = store_upload(file, max_bytes=tugas.max_bytes, allowed=allowed)
    except UploadMimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"MIME tidak diizinkan: {exc.mime}",
        ) from exc
    except UploadTooLargeError as exc:
        raise HTTPException(
            # 413 (Starlette menandai konstanta lamanya deprecated; angka tetap sama).
            status_code=413,
            detail=f"Ukuran Unggahan melebihi {exc.max_bytes} byte",
        ) from exc

    try:
        db.add(
            Unggahan(
                session_id=row.id,
                filename=stored.filename,
                mime=stored.mime,
                bytes=stored.size,
                storage_path=stored.storage_path,
                uploaded_at=utcnow(),
            )
        )
        start_generating(db, row, tugas.sesi_minutes)
    except BaseException:
        db.rollback()
        Path(stored.storage_path).unlink(missing_ok=True)
        raise

    schedule_generate_questions(background, row.id)
    return _to_session_out(db, row)


# --------------------------------------------------------------------------- #
# Murid — Pertanyaan
# --------------------------------------------------------------------------- #
@router.get("/{session_id}/questions", response_model=QuestionsOut)
def get_questions(
    session_id: str,
    murid: MuridUser,
    db: DbSession,
    background: BackgroundTasks,
) -> QuestionsOut:
    """Polling: `{status, questions: []}` saat `generating`, 3 soal saat `answering`.

    Serializer Murid TIDAK menyertakan `evidence` sama sekali. Bentuk amplop ini
    yang dipakai `normalisasiPertanyaan` (client juga menerima array langsung).
    """
    row = load_owned_session(db, session_id, murid)
    enforce_timer(db, row, background=background)
    mark_answering_if_ready(db, row)

    if row.status == SessionStatus.GENERATING:
        return QuestionsOut(status=row.status, questions=[])
    if row.status != SessionStatus.ANSWERING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pertanyaan tidak tersedia saat status {row.status}",
        )

    questions = db.scalars(
        select(Pertanyaan).where(Pertanyaan.session_id == row.id).order_by(Pertanyaan.seq)
    ).all()
    return QuestionsOut(
        status=row.status,
        questions=[PertanyaanMuridOut.model_validate(item) for item in questions],
    )


# --------------------------------------------------------------------------- #
# Murid — Jawaban
# --------------------------------------------------------------------------- #
@router.post("/{session_id}/answers", response_model=SessionOut)
def submit_answers(
    session_id: str,
    payload: AnswersIn,
    murid: MuridUser,
    db: DbSession,
    background: BackgroundTasks,
) -> SessionOut:
    """Simpan tiga jawaban, lalu `answering` -> `submitted`.

    Body: `{jawaban: [{pertanyaan_id, text}]}` (murid-api `kirimJawaban`).
    """
    row = load_owned_session(db, session_id, murid)

    # Timer habis saat menjawab = auto-submit paksa, Murid dapat 409.
    if enforce_timer(db, row, background=background):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="waktu menjawab habis, Sesi ditutup otomatis",
        )

    if row.status != SessionStatus.ANSWERING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"tidak bisa menjawab saat status {row.status}",
        )

    required = expected_question_count(_load_tugas(db, row.tugas_id).questions_per_type)
    answers = payload.jawaban
    if len(answers) != required:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"harus mengirim tepat {required} jawaban",
        )

    ids = [item.pertanyaan_id for item in answers]
    if len(set(ids)) != len(ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="pertanyaan_id duplikat",
        )

    questions = {
        item.id: item
        for item in db.scalars(
            select(Pertanyaan).where(
                Pertanyaan.session_id == row.id, Pertanyaan.id.in_(ids)
            )
        ).all()
    }
    if len(questions) != len(ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ada pertanyaan_id yang bukan milik Sesi ini",
        )

    types = {questions[item.pertanyaan_id].type for item in answers}
    if types != set(QuestionType):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="setiap tipe Pertanyaan (ideasi, isi, harapan) harus dijawab tepat satu",
        )

    for item in answers:
        existing = db.scalar(
            select(Jawaban).where(Jawaban.pertanyaan_id == item.pertanyaan_id)
        )
        if existing is None:
            db.add(Jawaban(pertanyaan_id=item.pertanyaan_id, text=item.text))
        else:
            existing.text = item.text

    row.status = SessionStatus.SUBMITTED
    row.submitted_at = utcnow()
    db.commit()
    db.refresh(row)

    schedule_assess(background, row.id)
    return _to_session_out(db, row)


# --------------------------------------------------------------------------- #
# Murid — Pelanggaran (ingest)
# --------------------------------------------------------------------------- #
@router.post("/{session_id}/violations", response_model=ViolationBatchOut)
def ingest_violations(
    session_id: str,
    payload: ViolationBatchIn,
    murid: MuridUser,
    db: DbSession,
) -> ViolationBatchOut:
    """Catat batch Pelanggaran. `server_ts` ditulis server, bukan klien.

    Body: `{violations: [{type, detail, client_ts}]}` (proctor `IngestClient`).
    Dedup (type, session) < 1 detik dan rate-limit 20/menit per Sesi: event yang
    di-drop sengaja tidak dikembalikan sebagai error (fire-and-forget).
    """
    row = load_owned_session(db, session_id, murid)

    known = {item.value for item in PelanggaranType}
    invalid = sorted({item.type for item in payload.violations if item.type not in known})
    if invalid:
        raise HTTPException(
            status_code=422,
            detail=f"tipe Pelanggaran tidak dikenal: {', '.join(invalid)}",
        )

    now = utcnow()
    window_start = now - timedelta(seconds=60)
    recent = db.execute(
        select(Pelanggaran.type, Pelanggaran.server_ts)
        .where(Pelanggaran.session_id == row.id, Pelanggaran.server_ts >= window_start)
        .order_by(Pelanggaran.server_ts)
    ).all()

    # SQLite membaca kolom DateTime(timezone=True) sebagai naive -> normalisasi
    # dulu supaya perbandingan dengan `now` (tz-aware) tidak meledak. Kunci dict
    # dinormalisasi ke string supaya cocok dengan `item.type` dari payload.
    last_seen: dict[str, datetime] = {}
    for tipe, ts in recent:
        normalized = as_utc(ts)
        if normalized is None:
            continue
        key = tipe.value if isinstance(tipe, PelanggaranType) else str(tipe)
        if key not in last_seen or normalized > last_seen[key]:
            last_seen[key] = normalized

    accepted = 0
    dropped = 0
    for item in payload.violations:
        if accepted + len(recent) >= VIOLATION_RATE_LIMIT_PER_MINUTE:
            dropped += 1
            continue

        previous = last_seen.get(item.type)
        if previous is not None and (now - previous).total_seconds() < VIOLATION_DEDUP_SECONDS:
            dropped += 1
            continue

        db.add(
            Pelanggaran(
                session_id=row.id,
                type=PelanggaranType(item.type),
                detail=item.detail,
                client_ts=_parse_client_ts(item.client_ts),
                server_ts=now,
            )
        )
        last_seen[item.type] = now
        accepted += 1

    db.commit()
    return ViolationBatchOut(accepted=accepted, dropped=dropped)


# --------------------------------------------------------------------------- #
# Murid — status + timer
# --------------------------------------------------------------------------- #
@router.get("/{session_id}/status", response_model=SessionStatusOut)
def get_status(
    session_id: str,
    murid: MuridUser,
    db: DbSession,
    background: BackgroundTasks,
) -> SessionStatusOut:
    """Status Sesi milik Murid + `timer_ends_at` untuk countdown bar.

    Tidak ada skor, evidence, maupun log Pelanggaran di sini.
    """
    row = load_owned_session(db, session_id, murid)
    enforce_timer(db, row, background=background)
    return _to_status_out(db, row)


# --------------------------------------------------------------------------- #
# Detail Sesi — Guru (audit trail) atau Murid pemilik (ringkasan)
# --------------------------------------------------------------------------- #
@router.get(
    "/{session_id}",
    response_model=None,
    summary="Detail Sesi (Guru: audit trail penuh; Murid pemilik: ringkasan)",
)
def get_session_detail(
    request: Request,
    session_id: str,
    user: CurrentUser,
    db: DbSession,
    background: BackgroundTasks,
) -> SessionDetail | SessionOut:
    """Dua bentuk satu endpoint:

    - **Guru pemilik Tugas** -> `SessionDetail` (camelCase, `guru-api.ts`):
      Unggahan, log Pelanggaran, `tanyaJawab` (Pertanyaan + Jawaban digabung),
      `penilaian` AI, dan `riwayat` semua attempt.
    - **Murid pemilik Sesi** -> `SessionOut` (snake_case, `murid-api.ts`):
      hanya ringkasan yang dipakai halaman `/sesi/$sessionId`
      (`timer_ends_at`, `attempt_no`, `uploaded`, `filename`).

    Selain keduanya: 404.
    """
    row = db.get(SessionRow, session_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Sesi tidak ditemukan"
        )

    if row.murid_id == user.id:
        enforce_timer(db, row, background=background)
        return _to_session_out(db, row)

    tugas = db.get(Tugas, row.tugas_id)
    if tugas is None or tugas.guru_id != user.id:
        # 404 (bukan 403) supaya Sesi Murid milik orang lain tidak bocor.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Sesi tidak ditemukan"
        )

    enforce_timer(db, row, background=background)
    return _guru_session_detail(request, db, row, tugas)


def _guru_session_detail(
    request: Request,
    db: Session,
    row: SessionRow,
    tugas: Tugas,
) -> SessionDetail:
    murid = db.get(User, row.murid_id)
    unggahan = db.scalar(select(Unggahan).where(Unggahan.session_id == row.id))
    pelanggaran = db.scalars(
        select(Pelanggaran)
        .where(Pelanggaran.session_id == row.id)
        .order_by(Pelanggaran.server_ts)
    ).all()

    questions = db.scalars(
        select(Pertanyaan).where(Pertanyaan.session_id == row.id).order_by(Pertanyaan.seq)
    ).all()
    question_ids = [item.id for item in questions]
    jawaban_by_question: dict[str, str] = {}
    if question_ids:
        for item in db.scalars(
            select(Jawaban).where(Jawaban.pertanyaan_id.in_(question_ids))
        ).all():
            jawaban_by_question[item.pertanyaan_id] = item.text

    penilaian_row = db.get(PenilaianAIRow, row.id)
    base_url = str(request.base_url).rstrip("/")

    return SessionDetail(
        id=row.id,
        tugasId=row.tugas_id,
        tugasBrief=tugas.brief,
        attemptNo=row.attempt_no,
        status=row.status,
        murid=MuridRef(nama=murid.name or "", email=murid.email or "") if murid else MuridRef(),
        dimulaiAt=row.started_at,
        batasJawabAt=row.timer_ends_at,
        dikumpulAt=row.submitted_at,
        unggahan=(
            UnggahanInfo(
                namaFile=unggahan.filename,
                mime=unggahan.mime,
                ukuranBytes=unggahan.bytes,
                diunggahAt=unggahan.uploaded_at,
                # Absolut terhadap origin API supaya aman saat web & api beda origin
                # (client memakai `unggahan.url ?? unduhUnggahanUrl(sesi.id)`).
                url=f"{base_url}/api/sessions/{row.id}/unggahan",
            )
            if unggahan is not None
            else None
        ),
        pelanggaran=[
            PelanggaranItem(
                id=item.id,
                type=item.type,
                detail=item.detail or "",
                clientTs=item.client_ts.isoformat() if item.client_ts else "",
                serverTs=item.server_ts,
            )
            for item in pelanggaran
        ],
        tanyaJawab=[
            QAItem(
                id=item.id,
                type=item.type,
                question=item.text,
                answer=jawaban_by_question.get(item.id),
                evidence=item.evidence,
            )
            for item in questions
        ],
        penilaian=(
            PenilaianAI(
                skorIdeasi=penilaian_row.skor_ideasi or 0,
                skorIsi=penilaian_row.skor_isi or 0,
                skorHarapan=penilaian_row.skor_harapan or 0,
                skorTotal=float(penilaian_row.skor_total or 0.0),
                ringkasan=penilaian_row.ringkasan or "",
            )
            if penilaian_row is not None
            else None
        ),
        riwayat=_riwayat_attempts(db, row.tugas_id, row.murid_id),
    )


# --------------------------------------------------------------------------- #
# Unggahan — unduh berkas
# --------------------------------------------------------------------------- #
@router.get(
    "/{session_id}/unggahan",
    response_class=FileResponse,
    summary="Unduh berkas Unggahan (Guru pemilik Tugas atau Murid pemilik Sesi)",
)
def download_unggahan(
    session_id: str,
    user: CurrentUser,
    db: DbSession,
) -> FileResponse:
    """Stream berkas Unggahan dari `UPLOAD_DIR`.

    URL ini yang dipakai `unduhUnggahanUrl()` di client Guru. 404 untuk sesi milik
    orang lain atau saat Unggahan belum ada — keduanya tidak dibedakan supaya
    keberadaan Sesi tidak bocor.
    """
    row = db.get(SessionRow, session_id)
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Unggahan tidak ditemukan"
        )

    if row.murid_id != user.id:
        tugas = db.get(Tugas, row.tugas_id)
        if tugas is None or tugas.guru_id != user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Unggahan tidak ditemukan"
            )

    unggahan = db.scalar(select(Unggahan).where(Unggahan.session_id == row.id))
    if unggahan is None or not Path(unggahan.storage_path).is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Unggahan tidak ditemukan"
        )

    return FileResponse(
        path=unggahan.storage_path,
        media_type=unggahan.mime,
        headers={
            # `filename*` (RFC 5987) untuk nama Unicode; `filename` sebagai fallback ASCII.
            "Content-Disposition": (
                f'attachment; filename="{_ascii_filename(unggahan.filename)}"; '
                f"filename*=UTF-8''{quote(unggahan.filename)}"
            )
        },
    )


def _ascii_filename(name: str) -> str:
    """Nama file ASCII aman untuk header (anti header-injection)."""
    cleaned = "".join(char if 32 <= ord(char) < 127 and char not in '"\\' else "_" for char in name)
    return cleaned or "unggahan"


# --------------------------------------------------------------------------- #
# Guru — Izin Unggah Ulang
# --------------------------------------------------------------------------- #
@router.post("/{session_id}/izin", response_model=IzinResult, status_code=status.HTTP_201_CREATED)
def grant_retry_permission(
    session_id: str,
    guru: GuruUser,
    db: DbSession,
) -> IzinResult:
    """Buka attempt berikutnya (`attempt_no + 1`, status `created`).

    Balasan: `{sessionIdBaru, attemptNo}` (guru-api `HasilIzin`).
    Pertanyaan/Jawaban attempt lama TIDAK dihapus — riwayat = evidence.
    """
    row = load_guru_session(db, session_id, guru)

    if has_active_attempt(db, row.tugas_id, row.murid_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Murid masih punya attempt aktif",
        )

    last_attempt = int(
        db.scalar(
            select(SessionRow.attempt_no)
            .where(SessionRow.tugas_id == row.tugas_id, SessionRow.murid_id == row.murid_id)
            .order_by(SessionRow.attempt_no.desc())
            .limit(1)
        )
        or row.attempt_no
    )

    next_row = SessionRow(
        tugas_id=row.tugas_id,
        murid_id=row.murid_id,
        attempt_no=last_attempt + 1,
        status=SessionStatus.CREATED,
    )
    db.add(next_row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="attempt aktif sudah ada",
        ) from exc
    db.refresh(next_row)
    return IzinResult(sessionIdBaru=next_row.id, attemptNo=next_row.attempt_no)


