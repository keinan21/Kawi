/** Pembungkus permintaan layar penuh (Fullscreen API). */

export function apakahFullscreen(): boolean {
  return typeof document !== 'undefined' && Boolean(document.fullscreenElement)
}

/**
 * Meminta mode layar penuh. Harus dipanggil darigesture pengguna (klik) agar
 * browser mengizinkan. Mengembalikan true bila berhasil.
 */
export async function mintaFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false
  if (document.fullscreenElement) return true
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    return true
  } catch {
    try {
      // Beberapa browser menolak opsi navigationUI.
      await document.documentElement.requestFullscreen()
      return true
    } catch {
      return false
    }
  }
}

export async function keluarFullscreen(): Promise<void> {
  if (typeof document === 'undefined' || !document.fullscreenElement) return
  try {
    await document.exitFullscreen()
  } catch {
    // diabaikan — tidak ada aksi yang bisa dilakukan
  }
}