/**
 * Mengambil token Tugas dari tempelan Murid.
 *
 * Menerima tiga bentuk: URL penuh (`https://situs/t/AbC123`), path
 * (`/t/AbC123`), atau kode mentah (`AbC123`). Token dibuat dari
 * `secrets.token_urlsafe`, jadi alfabetnya `[A-Za-z0-9_-]`.
 *
 * Mengembalikan token, atau `null` bila masukan tidak dikenali.
 */
export function ekstrakTokenTugas(masukan: string): string | null {
  const rapi = masukan.trim()
  if (!rapi) return null

  const dariPath = rapi.match(/\/t\/([A-Za-z0-9_-]+)/)
  if (dariPath?.[1]) return dariPath[1]

  if (/^[A-Za-z0-9_-]{4,64}$/.test(rapi)) return rapi

  return null
}
