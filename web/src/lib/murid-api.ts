import type { QuestionType, SessionStatus } from '@lms/shared'
import type { PelanggaranPayload } from '@/proctor/index.ts'

/**
 * API client sisi Murid (DESIGN.md §5, route group role=murid).
 *
 * Catatan kontrak: `packages/shared` hanya memuat enum domain
 * (`PelanggaranType`, `SessionStatus`, `QuestionType`), sehingga bentuk payload
 * di bawah didefinisikan lokal di file ini — belum di-push ke shared
 * (lihat bagian laporan).
 */

const API_BASE = String(import.meta.env['VITE_API_BASE_URL'] ?? '/api').replace(/\/+$/, '')

export type Peran = 'murid' | 'guru'

/** Pratinjau Tugas dari `GET /api/t/:token`. */
export interface TugasPratinjau {
  id: string
  token: string
  brief: string
  file_types: string[]
  max_bytes: number
  deadline_at: string | null
  sesi_minutes: number
  questions_per_type: number
}

/** Ringkasan Sesi — dipakai halaman `/sesi/$sessionId`. */
export interface Sesi {
  id: string
  tugas_id: string
  attempt_no: number
  status: SessionStatus
  started_at: string | null
  /** ISO timestamp berakhirnya timer jawaban; null sebelum unggahan. */
  timer_ends_at: string | null
  uploaded: boolean
  filename: string | null
}

/** Pertanyaan untuk Murid — `evidence` sudah di-strip server (DESIGN.md §6). */
export interface PertanyaanMurid {
  id: string
  type: QuestionType
  seq: number
  text: string
}

export interface JawabanInput {
  pertanyaan_id: string
  text: string
}

export type PelanggaranInput = PelanggaranPayload

/** Error API dengan status + pesan Bahasa Indonesia. */
export class ApiError extends Error {
  readonly status: number
  readonly data: unknown

  constructor(status: number, message: string, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

const PETA_PESAN: Record<number, string> = {
  400: 'Permintaan ditolak server.',
  401: 'Sesi login sudah berakhir. Masuk ulang untuk melanjutkan.',
  403: 'Kamu tidak punya akses ke sumber daya ini.',
  404: 'Data tidak ditemukan atau sudah tidak tersedia.',
  409: 'Sudah ada langkah yang selesai sebelumnya untuk Sesi ini.',
  413: 'Ukuran file melebihi batas yang diizinkan.',
  415: 'Tipe file tidak didukung.',
  422: 'Data yang dikirim tidak valid.',
  423: 'Sesi sudah dikunci oleh sistem.',
  429: 'Terlalu banyak permintaan. Coba lagi sebentar.',
}

type TokenProvider = () => Promise<string | null>

let tokenProvider: TokenProvider | null = null

/** Dipasang dari komponen Clerk (lihat `components/murid/AuthBridge.tsx`). */
export function setMuridAuthTokenProvider(fn: TokenProvider | null): void {
  tokenProvider = fn
}

function pesanDari(status: number, data: unknown): string {
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail?: unknown }).detail
    if (typeof detail === 'string' && detail.length > 0) return detail
    if (Array.isArray(detail) && detail.length > 0) return 'Data yang dikirim tidak valid.'
  }
  return PETA_PESAN[status] ?? `Terjadi kesalahan (HTTP ${status}).`
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (tokenProvider) {
    const token = await tokenProvider()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (res.status === 204) return undefined as T

  const teks = await res.text()
  let data: unknown = null
  if (teks.length > 0) {
    try {
      data = JSON.parse(teks) as unknown
    } catch {
      data = teks
    }
  }

  if (!res.ok) throw new ApiError(res.status, pesanDari(res.status, data), data)
  return data as T
}

function sebagaiRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function teksAtau(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function isoAtauNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function normalisasiSesi(raw: unknown): Sesi {
  const r = sebagaiRecord(raw)
  const status = teksAtau(r['status'], 'created') as SessionStatus
  return {
    id: teksAtau(r['id'], ''),
    tugas_id: teksAtau(r['tugas_id'] ?? r['tugasId'], ''),
    attempt_no: typeof r['attempt_no'] === 'number' ? r['attempt_no'] : 1,
    status,
    started_at: isoAtauNull(r['started_at']),
    timer_ends_at: isoAtauNull(r['timer_ends_at']),
    uploaded: r['uploaded'] === true || Boolean(r['filename']),
    filename: isoAtauNull(r['filename']),
  }
}

export function normalisasiTugas(raw: unknown): TugasPratinjau {
  const r = sebagaiRecord(raw)
  const fileTypes = Array.isArray(r['file_types'])
    ? (r['file_types'] as unknown[]).filter((t): t is string => typeof t === 'string')
    : []
  const maxBytes = typeof r['max_bytes'] === 'number' ? r['max_bytes'] : 2_000_000
  return {
    id: teksAtau(r['id'], ''),
    token: teksAtau(r['token'], ''),
    brief: teksAtau(r['brief'], ''),
    file_types: fileTypes,
    max_bytes: maxBytes,
    deadline_at: isoAtauNull(r['deadline_at']),
    sesi_minutes: typeof r['sesi_minutes'] === 'number' ? r['sesi_minutes'] : 10,
    questions_per_type:
      typeof r['questions_per_type'] === 'number' ? r['questions_per_type'] : 1,
  }
}

/** Menerima array langsung maupun amplop `{questions: [...]}`. */
export function normalisasiPertanyaan(raw: unknown): PertanyaanMurid[] {
  const r = sebagaiRecord(raw)
  const list = Array.isArray(raw) ? raw : Array.isArray(r['questions']) ? r['questions'] : []
  return list
    .map((item, index) => {
      const q = sebagaiRecord(item)
      const type = teksAtau(q['type'], 'isi') as QuestionType
      return {
        id: teksAtau(q['id'] ?? q['pertanyaan_id'], `pertanyaan-${index + 1}`),
        type,
        seq: typeof q['seq'] === 'number' ? q['seq'] : index + 1,
        text: teksAtau(q['text'], ''),
      }
    })
    .filter((q) => q.text.length > 0)
}

/** `GET /api/t/:token` — pra-tampilan Tugas. */
export function ambilTugas(token: string): Promise<TugasPratinjau> {
  return request(`/t/${encodeURIComponent(token)}`).then(normalisasiTugas)
}

/** `POST /api/sessions` — mulai Sesi; 409 bila ada attempt aktif. */
export async function mulaiSesi(tugasId: string): Promise<Sesi> {
  const raw = await request('/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tugas_id: tugasId }),
  })
  return normalisasiSesi(sebagaiRecord(raw)['session'] ?? raw)
}

/**
 * `GET /api/sessions/:id` — dipakai Murid untuk `timer_ends_at` + `attempt_no`.
 * Tidak tercantum di DESIGN.md §5 route Murid (lihat laporan).
 */
export async function ambilSesi(sessionId: string): Promise<Sesi | null> {
  try {
    return normalisasiSesi(await request(`/sessions/${encodeURIComponent(sessionId)}`))
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null
    throw error
  }
}

/** `GET /api/sessions/:id/status` — hanya `{status}`. */
export async function ambilStatusSesi(sessionId: string): Promise<SessionStatus> {
  const raw = sebagaiRecord(
    await request(`/sessions/${encodeURIComponent(sessionId)}/status`),
  )
  return teksAtau(raw['status'], 'created') as SessionStatus
}

/** `GET /api/sessions/:id/questions` — poll saat `generating`, 3 soal saat `answering`. */
export function ambilPertanyaan(sessionId: string): Promise<PertanyaanMurid[]> {
  return request(`/sessions/${encodeURIComponent(sessionId)}/questions`).then(
    normalisasiPertanyaan,
  )
}

/** `POST /api/sessions/:id/unggahan` — multipart, sekali saja. */
export async function unggahUnggahan(sessionId: string, file: File): Promise<Sesi | null> {
  const form = new FormData()
  form.append('file', file)
  const raw = await request(`/sessions/${encodeURIComponent(sessionId)}/unggahan`, {
    method: 'POST',
    body: form,
  })
  if (raw === undefined || raw === null) return null
  return normalisasiSesi(sebagaiRecord(raw)['session'] ?? raw)
}

/** `POST /api/sessions/:id/answers` — 3 jawaban sekaligus. */
export async function kirimJawaban(
  sessionId: string,
  jawaban: JawabanInput[],
): Promise<void> {
  await request(`/sessions/${encodeURIComponent(sessionId)}/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jawaban }),
  })
}

/**
 * `POST /api/sessions/:id/violations` — fire-and-forget, dipakai IngestClient.
 * Sengaja memakai `keepalive` agar request tetap terkirim saat tab ditutup.
 */
export async function kirimPelanggaran(
  sessionId: string,
  batch: PelanggaranInput[],
): Promise<void> {
  await request(`/sessions/${encodeURIComponent(sessionId)}/violations`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ violations: batch }),
  })
}

/** `POST /api/auth/onboard` — set role sekali pada login pertama. */
export async function onboard(peran: Peran): Promise<void> {
  await request('/auth/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: peran }),
  })
}

/** Batas ukuran Unggahan default bila server tidak mengirim `max_bytes`. */
export const BATAS_UNGGAHAN_DEFAULT = 2_000_000

export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${Math.round((bytes / 1_000_000) * 10) / 10} MB`
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`
  return `${bytes} byte`
}

export { API_BASE }