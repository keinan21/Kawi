/**
 * Non-component helpers for the Adwaita layer.
 *
 * Kept out of the component module so that file only exports components
 * (react-refresh/only-export-components).
 */

export function cx(...bagian: Array<string | false | null | undefined>): string {
  return bagian.filter(Boolean).join(' ')
}

/** Reads or writes the UI style preference on `<html data-adw-style>`. */
const KUNCI_GAYA = 'lms.adw.gaya'

export type GayaUI = 'system' | 'light' | 'dark'

export function bacaGayaUI(): GayaUI {
  try {
    const tersimpan = window.localStorage.getItem(KUNCI_GAYA)
    if (tersimpan === 'light' || tersimpan === 'dark' || tersimpan === 'system') {
      return tersimpan
    }
  } catch {
    /* localStorage diblokir — ikuti sistem. */
  }
  return 'system'
}

export function terapkanGayaUI(gaya: GayaUI): void {
  const akar = document.documentElement
  if (gaya === 'system') akar.removeAttribute('data-adw-style')
  else akar.setAttribute('data-adw-style', gaya)
  try {
    if (gaya === 'system') window.localStorage.removeItem(KUNCI_GAYA)
    else window.localStorage.setItem(KUNCI_GAYA, gaya)
  } catch {
    /* Preferensi hanya berlaku untuk sesi ini. */
  }
}
