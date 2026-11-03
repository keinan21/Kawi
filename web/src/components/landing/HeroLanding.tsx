import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Kotak } from '@/components/adw/adw'
import { PanelSesi } from './PanelSesi'
import { TombolDashboard } from './TombolDashboard'
import { ekstrakTokenTugas } from './tautan'

/**
 * Viewport pertama: satu keputusan, dua bobot.
 *
 * Aksi utama `TombolDashboard` — pil satu-satunya di halaman ini, besar dan
 * stabil posisinya (Hukum Fitts), dan satu-satunya kontrol yang boleh punya
 * alas keras agar terasa bisa ditekan. Di bawahnya, kolom link Murid tinggal
 * di dalam `Kotak` berbatas miliknya sendiri: region yang terbaca sebagai
 * "kolom", bukan tombol kedua (Common Region, Similarity). Keduanya adalah
 * satu-satunya pilihan di lipatan pertama (Hukum Hick: tepat 2).
 *
 * Latar datar. Skill melarang gradien latar; warna halaman dibawa oleh blok
 * (kartu pertanyaan, lencana langkah, band penutup), bukan oleh cahaya di
 * belakang teks. Heading memakai satu-satunya gradien yang diizinkan: pada
 * teksnya sendiri, dari warna dasar ke 40% nya (aturan B5).
 *
 * Di kanan, Sesi terkunci persis seperti yang ditemui Murid — satu permukaan
 * gelap, satu jangkar visual, bernapas pelan. Yang lain mundur (Prägnanz).
 */
export function HeroLanding() {
  const navigate = useNavigate()

  const [nilai, setNilai] = useState('')
  const [galat, setGalat] = useState<string | null>(null)

  const kirim = (e: FormEvent) => {
    e.preventDefault()
    const token = ekstrakTokenTugas(nilai)
    if (!token) {
      setGalat(
        'Link belum dikenali. Tempel link …/t/<kode>, atau kode Tugas-nya langsung.',
      )
      return
    }
    setGalat(null)
    void navigate({ to: '/t/$token', params: { token } })
  }

  return (
    <section className="lp-shell lp-sek--rapat pt-10 pb-12 sm:pt-16 lg:pt-20 lg:pb-16">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16">
        {/* --- Tawaran --------------------------------------------------------- */}
        <div className="min-w-0">
          <h1 className="lp-display lp-display-hero max-w-[680px]">
            Pastikan murid benar-benar paham tugasnya.
          </h1>

          <p className="lp-lead lp-dim mt-4">
            Satu link Tugas. Murid mengunggah satu berkas, lalu menjawab tiga
            pertanyaan yang disusun dari karyanya sendiri, masing-masing dengan
            kutipan yang bisa Guru cek.
          </p>

          <div className="mt-8">
            <TombolDashboard kelas="lp-cta lp-chunky" />
          </div>
          <p className="adw-caption lp-dim mt-4">
            Tanpa instalasi · satu link · satu berkas
          </p>

          {/* Pintu masuk Murid, dalam bentuknya yang bekerja: kolom yang
              menyelesaikan link, dibingkai terpisah dari aksi di atasnya. */}
          <Kotak dibingkai className="mt-6">
            <form onSubmit={kirim} className="p-3">
              <label htmlFor="link-tugas" className="lp-label mb-2 block">
                Murid? Tempel link dari gurumu
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="link-tugas"
                  type="text"
                  value={nilai}
                  onChange={(e) => setNilai(e.target.value)}
                  placeholder="Tempel link …/t/<kode> atau kodenya"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={galat ? 'true' : undefined}
                  aria-describedby={galat ? 'galat-link' : undefined}
                  className="adw-field"
                />
                <button type="submit" className="adw-btn flex-none">
                  Buka Tugas
                </button>
              </div>
              {galat ? (
                <p
                  id="galat-link"
                  role="alert"
                  className="mt-2 text-xs text-pretty text-error-text"
                >
                  {galat}
                </p>
              ) : null}
            </form>
          </Kotak>
        </div>

        {/* --- Mekanismenya, ditampilkan --------------------------------------- */}
        <div className="lp-float min-w-0">
          <PanelSesi />
        </div>
      </div>
    </section>
  )
}