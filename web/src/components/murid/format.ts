/** Format tampilan Bahasa Indonesia. */

const TANGGAL = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

const TANGGAL_JAM = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatTanggal(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return TANGGAL.format(d)
}

export function formatTanggalJam(iso: string | null): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '-'
  return TANGGAL_JAM.format(d)
}

/** Sisa waktu `mm:ss` (jam bila > 60 menit). */
export function formatHitungMundur(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const jam = Math.floor(total / 3600)
  const menit = Math.floor((total % 3600) / 60)
  const detik = total % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return jam > 0 ? `${jam}:${pad(menit)}:${pad(detik)}` : `${pad(menit)}:${pad(detik)}`
}

/** Waktu yang sudah berjalan `mm:ss`. */
export function formatHitungMaju(ms: number): string {
  return formatHitungMundur(ms)
}

/** Label tipe file untuk ditampilkan, mis. `application/pdf` → `PDF`. */
export function labelTipeFile(tipe: string): string {
  const dasar = tipe.includes('/') ? (tipe.split('/').pop() ?? tipe) : tipe
  return dasar.replace(/^\./, '').toUpperCase()
}