// Utilitas gaya bersama konsol Guru (bukan komponen) — dipisah dari `ui.tsx`
// supaya berkas komponen itu hanya mengekspor komponen (react-refresh).

export { cx } from '@/components/adw/gaya'

/**
 * Kelas field teks. `adw-field` sudah membawa radius, border, warna view, dan
 * cincin fokus aksen — sehingga memfokuskan field tidak perlu utility focus
 * terpisah di setiap pemanggil.
 */
export const clsInput = 'adw-field'
export const clsArea = 'adw-field resize-y leading-relaxed'
