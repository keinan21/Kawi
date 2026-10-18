/**
 * Pencocokan pintasan terblokir (DESIGN.md §7).
 *
 * Fungsi murni: menerima bentuk minimal KeyboardEvent agar unit test tidak
 * butuh DOM. Mengembalikan label Bahasa Indonesia untuk disimpan sebagai
 * `detail`, atau `null` bila kombinasi tidak terblokir.
 */

export interface ShortcutInput {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
}

const SHIFT_DEVTOOLS: Record<string, string> = {
  i: 'Alat Pengembang',
  j: 'Konsol',
  c: 'Inspector',
}

/** Pintasan modifier tunggal — Ctrl atau Cmd. */
const MODIFIER_PLAIN: Record<string, string> = {
  u: 'Lihat Sumber Halaman',
  p: 'Cetak',
  s: 'Simpan Halaman',
  a: 'Pilih Semua',
  c: 'Salin',
  v: 'Tempel',
}

export function matchShortcut(input: ShortcutInput): string | null {
  const key = (input.key ?? '').toLowerCase()

  if (key === 'f12') return 'F12 (Alat Pengembang)'

  const mod = input.ctrlKey === true || input.metaKey === true
  if (!mod) return null
  if (input.altKey === true) return null

  const label = input.metaKey === true && input.ctrlKey !== true ? 'Cmd' : 'Ctrl'

  if (input.shiftKey === true) {
    const nama = SHIFT_DEVTOOLS[key]
    return nama ? `${label}+Shift+${key.toUpperCase()} (${nama})` : null
  }

  const nama = MODIFIER_PLAIN[key]
  return nama ? `${label}+${key.toUpperCase()} (${nama})` : null
}