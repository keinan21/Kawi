import { useCallback, useEffect, useRef, useState } from 'react'
import { BilahKemajuan, Tombol } from '@/components/adw/adw'
import { Ikon } from '@/components/adw/ikon'
import { mintaFullscreen } from './fullscreen.ts'

export interface ViolationCountdownProps {
  /** Durasi hitung mundur dalam detik. Default 5 (DESIGN.md §7). */
  detik?: number
  /** Alasan spesifik Pelanggaran, ditampilkan agar Murid paham. */
  detail?: string
  /** Dipanggil setelah layar penuh berhasil dimasuki lagi. */
  onKembali: () => void
  /** Dipanggil saat hitung mundur habis — parent menjalankan alur auto-submit. */
  onExpired: () => void
}

/**
 * Overlay hitung mundur 5 detik (DESIGN.md §7), dalam gaya OSD Adwaita:
 * gelap, translusen, aksen putih, dan hanya satu jalan keluar — kembali ke layar
 * penuh. Diam → `onExpired`.
 *
 * OSD dipilih, bukan dialog biasa, karena ini bukan tugas yang perlu
 * dijawab — ini gangguan dari luar, dan isinya harus terbaca sekilas tanpa
 * terlihat seperti bagian dari form yang sedang diisi.
 */
export function ViolationCountdown({
  detik = 5,
  detail,
  onKembali,
  onExpired,
}: ViolationCountdownProps) {
  const [sisa, setSisa] = useState(detik)
  const tombolRef = useRef<HTMLButtonElement>(null)
  const selesaiRef = useRef(false)

  useEffect(() => {
    setSisa(detik)
    selesaiRef.current = false
    const id = window.setInterval(() => {
      setSisa((n) => {
        if (n <= 1) {
          window.clearInterval(id)
          if (!selesaiRef.current) {
            selesaiRef.current = true
            onExpired()
          }
          return 0
        }
        return n - 1
      })
    }, 1000)
    return () => window.clearInterval(id)
  }, [detik, onExpired])

  useEffect(() => {
    tombolRef.current?.focus()
  }, [])

  const kembali = useCallback(async () => {
    const ok = await mintaFullscreen()
    if (ok) onKembali()
  }, [onKembali])

  const persen = Math.max(0, Math.min(100, (sisa / detik) * 100))

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="hitung-mundur-judul"
      aria-describedby="hitung-mundur-detail"
      className="adw-osd fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
    >
      <div className="w-full max-w-md text-center">
        <p className="inline-flex items-center gap-2 text-[0.8125rem] font-bold text-[#ff8d80]">
          <Ikon nama="peringatan" ukuran={15} />
          Pelanggaran tercatat
        </p>

        <h2 id="hitung-mundur-judul" className="mt-4 text-2xl font-bold text-balance">
          Kembali ke layar penuh — Sesi akan dikunci
        </h2>

        {detail ? (
          <p id="hitung-mundur-detail" className="mt-2 text-pretty text-white/75">
            {detail}
          </p>
        ) : null}

        <p className="angka my-7 text-7xl font-bold text-[#ff8d80]" aria-live="assertive">
          {sisa}
        </p>

        <BilahKemajuan
          persen={persen}
          nada="galat"
          label="Sisa waktu sebelum Sesi dikunci"
          nilai={sisa}
          maks={detik}
        />

        <div className="mt-7">
          <Tombol
            ref={tombolRef}
            label="Kembali ke layar penuh"
            onClick={() => void kembali()}
            className="w-full !min-h-11 !text-[0.9375rem]"
          />
        </div>

        <p className="mt-4 text-pretty text-[0.8125rem] text-white/60">
          Kalau tidak ada tindakan, Sesi diakhiri otomatis dan jawaban terkirim apa
          adanya.
        </p>
      </div>
    </div>
  )
}

export default ViolationCountdown
