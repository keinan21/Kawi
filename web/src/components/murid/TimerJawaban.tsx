import { useEffect, useState } from 'react'
import { BilahKemajuan } from '@/components/adw/adw'

export interface TimerJawabanProps {
  /** Epoch ms berakhirnya timer jawaban (dari `timer_ends_at` server). */
  berakhir: number
  /** Total durasi (ms) untuk bar progres. */
  total: number
  /** Dipanggil sekali saat waktu habis. */
  onHabis: () => void
}

/**
 * Timer jawaban — 10 menit sejak Unggahan (DESIGN.md §3).
 *
 * Bilah tipis menempel di tepi bawah header bar: pola HIG untuk progres yang
 * berjalan di latar belakang. Sisa waktu sudah tertulis di sebelahnya, jadi
 * bar-nya tidak perlu label kedua dan tidak boleh menarik perhatian dari
 * Pertanyaan.
 */
export function TimerJawaban({ berakhir, total, onHabis }: TimerJawabanProps) {
  const [sisa, setSisa] = useState(() => berakhir - Date.now())

  useEffect(() => {
    const hitung = () => {
      const s = berakhir - Date.now()
      setSisa(s)
      if (s <= 0) onHabis()
    }
    hitung()
    const id = window.setInterval(hitung, 1000)
    return () => window.clearInterval(id)
  }, [berakhir, onHabis])

  const persen = Math.max(0, Math.min(100, (sisa / total) * 100))
  const habis = sisa <= 0
  const hampirHabis = !habis && sisa < 60_000

  return (
    <div className="w-full pb-1">
      <div
        className="mx-auto flex max-w-3xl items-baseline justify-between gap-4 px-4 pt-2.5 sm:px-6"
        role="timer"
        aria-live="off"
      >
        <p className="adw-caption adw-dim text-pretty">
          {habis
            ? 'Waktu habis — Sesi ditutup sistem.'
            : 'Sisa waktu menjawab. Timer berjalan sejak Unggahan diterima.'}
        </p>
        <p
          className={`angka shrink-0 text-[1.05rem] font-bold ${
            habis || hampirHabis ? 'text-error-text' : ''
          }`}
        >
          {formatHitungMundur(sisa)}
        </p>
      </div>
      <div className="mt-1.5">
        <BilahKemajuan
          tipis
          persen={persen}
          nada={habis || hampirHabis ? 'galat' : 'aksen'}
          label="Sisa waktu menjawab"
          nilai={Math.max(0, sisa)}
          maks={total}
        />
      </div>
    </div>
  )
}

function formatHitungMundur(ms: number): string {
  const totalDetik = Math.max(0, Math.ceil(ms / 1000))
  const menit = Math.floor(totalDetik / 60)
  const detik = totalDetik % 60
  return `${menit}:${String(detik).padStart(2, '0')}`
}

export default TimerJawaban
