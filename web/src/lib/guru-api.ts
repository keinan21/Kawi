import type {
  PelanggaranType,
  QuestionType,
  SessionStatus,
} from '@lms/shared'

// ---------------------------------------------------------------------------
// Mode data. Default production: REST API sungguhan.
//   VITE_USE_MOCKS=true → mode demo (data mock + banner "mode demo").
//   Selain itu (default) → REST API. Request yang GAGAL tidak pernah fell back
//     ke mock: Guru harus melihat error + tombol retry, bukan angka palsu.
// Base URL API dibaca dari env VITE_API_BASE_URL (default '/api' → lewat proxy
// dev Vite; isi URL absolut untuk web & api beda origin).
// ---------------------------------------------------------------------------
export const USE_MOCKS = String(import.meta.env['VITE_USE_MOCKS'] ?? '') === 'true'

const API_BASE = (
  (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/api'
).replace(/\/+$/, '')

/** True hanya bila mode demo diaktifkan eksplisit lewat env. */
export function sedangModeDemo(): boolean {
  return USE_MOCKS
}

// --- Bentuk data (mirror DESIGN.md §4 + kontrak §5 guru group) ----------------

export type FileKind = 'pdf' | 'ppt'

export interface TugasItem {
  id: string
  token: string
  brief: string
  fileTypes: FileKind[]
  maxBytes: number
  deadlineAt: string | null
  sesiMinutes: number
  questionsPerType: number
  createdAt: string
  muridCount: number
  pelanggaranCount: number
}

export interface CreateTugasInput {
  brief: string
  fileTypes: FileKind[]
  deadlineAt: string | null
  sesiMinutes: number
  questionsPerType: number
}

export interface PatchTugasInput {
  brief?: string
  deadlineAt?: string | null
  sesiMinutes?: number
}

export interface AttemptSummary {
  sessionId: string
  attemptNo: number
  status: SessionStatus
  dimulaiAt: string
  dikumpulAt: string | null
  pelanggaranCount: number
}

export interface Participant {
  muridId: string
  nama: string
  email: string
  sessionId: string
  attemptNo: number
  status: SessionStatus
  pelanggaranCount: number
  terakhirAktif: string
  riwayat: AttemptSummary[]
}

export interface PelanggaranItem {
  id: string
  type: PelanggaranType
  detail: string
  clientTs: string
  serverTs: string
}

export interface QAItem {
  id: string
  type: QuestionType
  question: string
  answer: string | null
}

export interface PenilaianAI {
  skorIdeasi: number
  skorIsi: number
  skorHarapan: number
  skorTotal: number
  ringkasan: string
}

export interface UnggahanInfo {
  namaFile: string
  mime: string
  ukuranBytes: number
  diunggahAt: string
  /** URL unduh berkas; null di mode demo (berkas beneran hanya ada di server). */
  url: string | null
}

export interface SessionDetail {
  id: string
  tugasId: string
  tugasBrief: string
  attemptNo: number
  status: SessionStatus
  murid: { nama: string; email: string }
  dimulaiAt: string
  batasJawabAt: string | null
  dikumpulAt: string | null
  unggahan: UnggahanInfo | null
  pelanggaran: PelanggaranItem[]
  tanyaJawab: QAItem[]
  penilaian: PenilaianAI | null
  riwayat: AttemptSummary[]
}

// --- Label Bahasa Indonesia ----------------------------------------------------

export const STATUS_SESI_LABEL: Record<SessionStatus, string> = {
  created: 'Dibuat',
  generating: 'Menyiapkan pertanyaan',
  answering: 'Berlangsung',
  submitted: 'Terkumpul',
  auto_submitted: 'Terkumpul otomatis',
}

export const TIPE_PELANGGARAN_LABEL: Record<PelanggaranType, string> = {
  tab_switch: 'Pindah tab',
  window_blur: 'Jendela kehilangan fokus',
  fullscreen_exit: 'Keluar fullscreen',
  copy_blocked: 'Copy diblokir',
  paste_blocked: 'Paste diblokir',
  context_menu_blocked: 'Klik kanan diblokir',
  shortcut_blocked: 'Pintasan diblokir',
  multi_tab: 'Tab ganda',
}

export const TIPE_PERTANYAAN_LABEL: Record<QuestionType, string> = {
  ideasi: 'Pertanyaan Ideasi',
  isi: 'Pertanyaan Isi',
  harapan: 'Pertanyaan Harapan',
}

/**
 * URL endpoint Unggahan di API. Navigasi `<a href>` TIDAK bisa mengirim header
 * `Authorization`, jadi untuk data sungguhan pakai `unduhBlobUnggahan()`
 * (fetch ber-token → object URL) — lihat catatan di `guru.sesi.$sessionId.tsx`.
 */
export function unduhUnggahanUrl(sessionId: string): string {
  return `${API_BASE}/sessions/${sessionId}/unggahan`
}

// --- Lapisan fetch ---------------------------------------------------------------

/** Pesan Bahasa Indonesia per status; dipakai kalau server tidak kirim `detail`. */
const PETA_PESAN: Record<number, string> = {
  400: 'Permintaan ditolak server.',
  401: 'Sesi login sudah berakhir. Masuk ulang lalu muat ulang halaman.',
  403: 'Akun ini bukan Guru, atau Tugas bukan milikmu.',
  404: 'Data tidak ditemukan atau sudah tidak tersedia.',
  409: 'Ada langkah aktif yang belum selesai untuk Sesi ini.',
  413: 'Ukuran berkas melebihi batas yang diizinkan.',
  415: 'Tipe berkas tidak didukung.',
  422: 'Data yang dikirim tidak valid.',
  423: 'Sesi sudah dikunci oleh sistem.',
  429: 'Terlalu banyak permintaan. Coba lagi sebentar.',
}

type TokenProvider = () => Promise<string | null>

let tokenProvider: TokenProvider | null = null

/** Dipasang dari `components/murid/AuthBridge.tsx` (sumber token Clerk). */
export function setGuruAuthTokenProvider(fn: TokenProvider | null): void {
  tokenProvider = fn
}

/** Error API Guru: status + pesan siap tampil. */
export class GuruApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'GuruApiError'
    this.status = status
  }
}

async function detailDari(res: Response): Promise<string | null> {
  try {
    const data: unknown = await res.json()
    if (data && typeof data === 'object' && 'detail' in data) {
      const detail = (data as { detail?: unknown }).detail
      if (typeof detail === 'string' && detail.length > 0) return detail
    }
  } catch {
    // Body bukan JSON — pakai peta pesan bawaan.
  }
  return null
}

/** Header request + token Clerk (Bearer) bila provider sudah dipasang. */
async function headerBertoken(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init)
  if (tokenProvider) {
    const token = await tokenProvider()
    if (token) headers.set('Authorization', `Bearer ${token}`)
  }
  return headers
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await headerBertoken(init?.headers)
  headers.set('Content-Type', 'application/json')

  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...init, headers })
  } catch {
    // Jaringan gagal / API mati. TIDAK jatuh ke mock — Guru harus tahu.
    throw new GuruApiError(0, `Tidak bisa menghubungi API di ${API_BASE}.`)
  }

  if (!res.ok) {
    throw new GuruApiError(
      res.status,
      (await detailDari(res)) ?? PETA_PESAN[res.status] ?? `Terjadi kesalahan (HTTP ${res.status}).`,
    )
  }
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/**
 * Ambil berkas Unggahan sebagai `Blob` (header Authorization ikut terkirim),
 * lalu kembalikan object URL. Endpoint-nya butuh Bearer token, sedangkan
 * navigasi `<a href>` tidak pernah mengirim header — jadi link biasa akan
 * selalu 401. Caller wajib `URL.revokeObjectURL` setelah selesai.
 */
export async function unduhBlobUnggahan(sessionId: string): Promise<string> {
  const headers = await headerBertoken()
  let res: Response
  try {
    res = await fetch(`${API_BASE}/sessions/${sessionId}/unggahan`, {
      credentials: 'include',
      headers,
    })
  } catch {
    throw new GuruApiError(0, `Tidak bisa menghubungi API di ${API_BASE}.`)
  }
  if (!res.ok) {
    throw new GuruApiError(
      res.status,
      (await detailDari(res)) ??
        PETA_PESAN[res.status] ??
        `Gagal mengunduh berkas (HTTP ${res.status}).`,
    )
  }
  return URL.createObjectURL(await res.blob())
}

const jedaMock = () => new Promise((r) => setTimeout(r, 220))

/**
 * Pilih sumber data secara EKSPLISIT: mock hanya bila `USE_MOCKS` aktif.
 * Tidak ada fallback diam-diam — request gagal apa adanya diteruskan ke
 * pemanggil supaya halaman menampilkan error + retry.
 */
async function mockAtauApi<T>(mock: () => T | Promise<T>, nyata: () => Promise<T>): Promise<T> {
  if (USE_MOCKS) return mock()
  return nyata()
}

export function daftarTugas(): Promise<TugasItem[]> {
  return mockAtauApi(async () => {
    await jedaMock()
    const { mockTugas } = await import('./guru-mocks')
    return [...mockTugas]
  }, () => api<TugasItem[]>('/tugas'))
}

export function detailTugas(tugasId: string): Promise<TugasItem> {
  return mockAtauApi(async () => {
    await jedaMock()
    const { mockTugas } = await import('./guru-mocks')
    const ketemu = mockTugas.find((t) => t.id === tugasId)
    if (!ketemu) throw new Error('Tugas tidak ditemukan')
    return ketemu
  }, () => api<TugasItem>(`/tugas/${tugasId}`))
}

export function buatTugas(input: CreateTugasInput): Promise<TugasItem> {
  return mockAtauApi(async () => {
    await jedaMock()
    const { buatTugasMock } = await import('./guru-mocks')
    return buatTugasMock(input)
  }, () =>
    api<TugasItem>('/tugas', { method: 'POST', body: JSON.stringify(input) }),
  )
}

export function ubahTugas(tugasId: string, input: PatchTugasInput): Promise<TugasItem> {
  return mockAtauApi(async () => {
    await jedaMock()
    const { mockTugas } = await import('./guru-mocks')
    const ketemu = mockTugas.find((t) => t.id === tugasId)
    if (!ketemu) throw new Error('Tugas tidak ditemukan')
    if (input.brief !== undefined) ketemu.brief = input.brief
    if (input.deadlineAt !== undefined) ketemu.deadlineAt = input.deadlineAt
    if (input.sesiMinutes !== undefined) ketemu.sesiMinutes = input.sesiMinutes
    return ketemu
  }, () =>
    api<TugasItem>(`/tugas/${tugasId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  )
}

export function daftarPeserta(tugasId: string): Promise<Participant[]> {
  return mockAtauApi(async () => {
    await jedaMock()
    const { mockParticipants } = await import('./guru-mocks')
    return [...(mockParticipants[tugasId] ?? [])]
  }, () => api<Participant[]>(`/tugas/${tugasId}/participants`))
}

export function detailSesi(sessionId: string): Promise<SessionDetail> {
  return mockAtauApi(async () => {
    await jedaMock()
    const { mockSessions } = await import('./guru-mocks')
    const ketemu = mockSessions[sessionId]
    if (!ketemu) throw new Error('Sesi tidak ditemukan')
    return ketemu
  }, () => api<SessionDetail>(`/sessions/${sessionId}`))
}

export interface HasilIzin {
  sessionIdBaru: string
  attemptNo: number
}

export function beriIzinUnggahUlang(sessionId: string): Promise<HasilIzin> {
  return mockAtauApi(async () => {
    await jedaMock()
    const { beriIzinMock } = await import('./guru-mocks')
    const baru = beriIzinMock(sessionId)
    return { sessionIdBaru: baru.id, attemptNo: baru.attemptNo }
  }, () => api<HasilIzin>(`/sessions/${sessionId}/izin`, { method: 'POST' }))
}
