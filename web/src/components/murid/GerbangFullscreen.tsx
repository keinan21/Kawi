import { useState } from 'react'
import { apakahFullscreen, mintaFullscreen } from './fullscreen.ts'
import { Tombol } from '@/components/adw/adw'
import { Ikon } from '@/components/adw/ikon'

export interface GerbangFullscreenProps {
  /** Dipanggil setelah layar penuh benar-benar aktif. */
  onMasuk: () => void
}

/**
 * Gerbang layar penuh. Sesi hanya berjalan di mode layar penuh (DESIGN.md §7),
 * dan permintaan fullscreen harus datang dari klik pengguna — karena itu
 * alasannya dijelaskan sebelum tombolnya, dan konsekuensinya ditulis apa adanya.
 */
export function GerbangFullscreen({ onMasuk }: GerbangFullscreenProps) {
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)

  const mulai = async () => {
    setSibuk(true)
    const ok = await mintaFullscreen()
    setSibuk(false)
    if (!ok) {
      setGalat(
        'Browser menolak permintaan layar penuh. Izinkan pop-up untuk situs ini, lalu coba lagi.',
      )
      return
    }
    setGalat(null)
    onMasuk()
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Ikon nama="peta" ukuran={40} className="adw-dim" />

      <h1 className="mt-5 text-3xl leading-tight font-bold tracking-tight">
        Sesi ini berjalan di layar penuh
      </h1>
      <p className="mt-3 text-pretty text-adw-dim">
        Supaya tidak ada yang bisa dilihat selama Sesi, halaman ini memenuhi
        layar. Berpindah tab, kehilangan fokus, atau keluar layar penuh memberi
        hitung mundur 5 detik sebelum Sesi dikunci dan jawaban dikirim otomatis.
      </p>

      <div className="mt-6 adw-boxed adw-boxed--framed px-5 py-4">
        <p className="text-[0.9375rem] font-medium">Yang berubah dengan layar penuh</p>
        <ul className="mt-2.5 space-y-2 text-pretty text-adw-dim">
          <li className="flex items-start gap-2.5">
            <Ikon nama="peringatan" ukuran={15} className="mt-0.5 flex-none text-warning-text" />
            Keluar dari Sesi sebelum mengunggah Unggahan tetap aman — kamu bisa
            melanjutkan nanti lewat link yang sama.
          </li>
          <li className="flex items-start gap-2.5">
            <Ikon nama="jam" ukuran={15} className="mt-0.5 flex-none" />
            Timer menjawab baru berjalan setelah Unggahan diterima, bukan sekarang.
          </li>
          <li className="flex items-start gap-2.5">
            <Ikon nama="daftar" ukuran={15} className="mt-0.5 flex-none" />
            Pelanggaran yang tercatat terlihat oleh Guru, jadi harus dibaca bukan
            diabaikan.
          </li>
        </ul>
      </div>

      <div className="mt-7">
        <Tombol
          gaya="pill"
          label={apakahFullscreen() ? 'Layar penuh sudah aktif' : 'Masuk layar penuh & lanjut'}
          onClick={() => void mulai()}
          nonaktif={sibuk || apakahFullscreen()}
          lebar
          className="!min-h-12 !text-[1.05rem]"
        />
      </div>

      {galat ? (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 text-[0.875rem] text-pretty text-error-text"
        >
          <Ikon nama="peringatan" ukuran={15} className="mt-0.5 flex-none" />
          {galat}
        </p>
      ) : null}
    </main>
  )
}

export default GerbangFullscreen
