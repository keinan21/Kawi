import type { SessionStatus } from '@lms/shared'
import { Link } from '@tanstack/react-router'
import { Ikon } from '@/components/adw/ikon'

export interface LayarTerminalProps {
  status: Extract<SessionStatus, 'submitted' | 'auto_submitted'>
  /** Berapa kali percobaan (attempt_no) untuk konteks. */
  attemptNo?: number
}

/**
 * Layar terminal Sesi: `submitted` (Terkirim — dalam penilaian) dan
 * `auto_submitted` (Sesi diakhiri sistem). Murid tidak melihat skor apa pun
 * (DESIGN.md §5 — `/status` hanya mengembalikan status).
 *
 * Placeholder page simbolik: keadaan akhir yang kosong tapi memang pernah berisi
 * konten, jadi ikonnya monokrom dan tonenya netral — bukan sorotan.
 */
export function LayarTerminal({ status, attemptNo }: LayarTerminalProps) {
  if (status === 'submitted') {
    return (
      <main className="grid min-h-dvh place-items-center bg-window px-6 py-16">
        <div className="max-w-md text-center">
          <Ikon nama="tDicek" ukuran={56} className="mx-auto text-success-text" />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-balance">
            Terkirim — sedang dinilai
          </h1>
          <p className="mt-3 text-pretty text-adw-dim">
            Jawabanmu sudah diterima dan sedang dinilai. Penilaian akhir tetap di
            tangan Guru, dan kamu tidak akan melihat angkanya di sini.
          </p>
          {attemptNo && attemptNo > 1 ? (
            <p className="mt-2 text-pretty text-adw-dim">
              Ini percobaan ke-{attemptNo}. Riwayat percobaan sebelumnya tetap
              tercatat sebagai bukti.
            </p>
          ) : null}
          <p className="mt-6 text-pretty text-adw-dim">
            Kamu boleh menutup halaman ini. Sesi tidak bisa dilanjutkan tanpa izin
            Guru.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-window px-6 py-16">
      <div className="max-w-md text-center">
        <Ikon nama="peringatan" ukuran={56} className="mx-auto text-error-text" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-balance">
          Sesi diakhiri sistem
        </h1>
        <p className="mt-3 text-pretty text-adw-dim">
          Sesi ditutup otomatis, jadi jawaban terkirim apa adanya — termasuk yang
          belum terisi. Pelanggaran yang tercatat sudah terlihat oleh Guru.
        </p>
        <p className="mt-2 text-pretty text-adw-dim">
          Kalau menurutmu ini keliru, hubungi Guru dan minta Izin Unggah Ulang.
        </p>
        <div className="mt-7">
          <Link to="/" className="adw-btn">
            Kembali ke halaman awal
          </Link>
        </div>
      </div>
    </main>
  )
}

export default LayarTerminal
