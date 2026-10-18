// Format tampilan untuk konsol Guru: tanggal presisi, ukuran berkas, status jendela.

const fmtTanggalWaktu = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const fmtJam = new Intl.DateTimeFormat('id-ID', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

const fmtTanggal = new Intl.DateTimeFormat('id-ID', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

/** "12 Okt 2026, 14.03.22" — dipakai di Log Pelanggaran (butuh presisi detik). */
export function formatTanggalWaktu(iso: string): string {
  return fmtTanggalWaktu.format(new Date(iso))
}

/** "14.03.22" — dipakai untuk label "Terakhir dimuat". */
export function formatJam(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate
  return fmtJam.format(d)
}

export function formatTanggal(iso: string): string {
  return fmtTanggal.format(new Date(iso))
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Potongan judul dari brief untuk baris tabel Daftar Tugas. */
export function cuplikanBrief(brief: string, panjang = 90): string {
  const satuBaris = brief.replace(/\s+/g, ' ').trim()
  return satuBaris.length <= panjang ? satuBaris : `${satuBaris.slice(0, panjang).trimEnd()}…`
}

export type StatusJendela = 'dibuka' | 'mendekati' | 'lewat' | 'tanpa-batas'

/**
 * Status jendela pengumpulan: dibuka (>24 jam ke deadline),
 * mendekati (<24 jam), lewat (deadline sudah lewat).
 */
export function statusJendela(deadlineAt: string | null): StatusJendela {
  if (!deadlineAt) return 'tanpa-batas'
  const sisa = new Date(deadlineAt).getTime() - Date.now()
  if (sisa < 0) return 'lewat'
  if (sisa < 24 * 60 * 60 * 1000) return 'mendekati'
  return 'dibuka'
}

export const STATUS_JENDELA_LABEL: Record<StatusJendela, string> = {
  dibuka: 'Belum batas waktu',
  mendekati: 'Mendekati batas',
  lewat: 'Lewat batas',
  'tanpa-batas': 'Tanpa batas waktu',
}

/** Link yang dibagikan ke Murid, gaya Google Forms. */
export function tautanTugas(token: string): string {
  return `${window.location.origin}/t/${token}`
}

/** Nilai awal input datetime-local dari ISO deadline. */
export function untukInputTanggal(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
