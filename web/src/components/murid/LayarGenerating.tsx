import { useEffect, useState } from 'react'
import { formatHitungMaju } from './format.ts'
import { Spinner } from '@/components/adw/adw'
import { Ikon } from '@/components/adw/ikon'

export interface LayarGeneratingProps {
  /** Waktu Unggahan diterima (epoch ms) — penghitung berjalan naik. */
  mulai: number
}

/**
 * Layar tunggu saat AI membuat Pertanyaan (status `generating`).
 *
 *_spinner_, bukan progress bar: proporsi pekerjaan tidak diketahui dan waktu
 * tersisa juga tidak (HIG, Spinners). Yang ditunjukkan hanya satu tugas yang
 * sedang berjalan, dengan konteks waktu sejak Unggahan supaya Murid tahu
 * halaman tidak macet.
 */
export function LayarGenerating({ mulai }: LayarGeneratingProps) {
  const [lama, setLama] = useState(() => Date.now() - mulai)

  useEffect(() => {
    const id = window.setInterval(() => setLama(Date.now() - mulai), 1000)
    return () => window.clearInterval(id)
  }, [mulai])

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <div className="flex items-center gap-3">
        <Spinner ukuran={22} />
        <span className="text-[0.9375rem] font-medium">Menyusun Pertanyaan</span>
      </div>

      <h1 className="mt-5 text-3xl leading-tight font-bold tracking-tight text-balance">
        AI sedang membaca karyamu
      </h1>
      <p className="mt-3 text-pretty text-adw-dim">
        Sistem mengambil isi Unggahan lalu menyusun tiga Pertanyaan yang merujuk
        langsung ke dokumenmu. Jangan tutup halaman ini — langkah berikutnya sudah
        berjalan di belakang layar.
      </p>

      <div className="mt-7 adw-boxed px-5 py-4">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[0.9375rem]">Waktu sejak Unggahan</span>
          <span className="angka text-[0.9375rem] font-medium">
            {formatHitungMaju(lama)}
          </span>
        </div>
        <p className="adw-caption adw-dim mt-3 flex items-start gap-2 text-pretty">
          <Ikon nama="info" ukuran={13} className="mt-0.5 flex-none" />
          Timer menjawab 10 menit baru mulai setelah Pertanyaan siap — waktu
          menunggu ini tidak mengurangi durasi menjawabmu.
        </p>
      </div>
    </main>
  )
}

export default LayarGenerating
