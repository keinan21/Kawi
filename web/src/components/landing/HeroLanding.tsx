import { useState, type FormEvent } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Kotak } from '@/components/adw/adw'
import { PanelSesi } from './PanelSesi'
import { TombolDashboard } from './TombolDashboard'
import { ekstrakTokenTugas } from './tautan'

/**
 * The first viewport: one decision, in two weights.
 *
 * The primary action is `TombolDashboard` — the page's single suggested
 * pill, large and stable in position (Fitts's law). Below it, the Murid's
 * link field lives inside its own bounded `Kotak`, visually subordinate: a
 * quiet region that reads as "a field", never as a second button competing
 * for attention (Common Region + Similarity). Together they are the only two
 * choices above the fold (Hick's law: choice count here is exactly 2).
 *
 * Right of the offer, the locked session as the Murid will meet it — the
 * page's one dark surface and its one visual anchor. Everything else on the
 * page recedes behind it (Prägnanz / Figure–Ground).
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
    <section className="lp-shell lp-sek--rapat pt-10 pb-12 sm:pt-14 lg:pt-20 lg:pb-16">
      <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
        {/* --- The offer ---------------------------------------------------- */}
        <div className="min-w-0">
          <h1 className="lp-display">
            Tiga pertanyaan, semuanya dari karya Murid sendiri.
          </h1>

          <p className="lp-lead mt-5 lp-dim">
            Guru membuat satu Tugas dan membagikan satu link. Murid mengunggah
            satu berkas, lalu menjawab tiga pertanyaan yang disusun dari isi
            berkas itu.
          </p>

          <div className="mt-8">
            <TombolDashboard />
          </div>

          {/* The Murid's entry, in its working form: a field that resolves,
              boxed off from the action above so the two never read as peers. */}
          <Kotak dibingkai className="mt-4">
            <form onSubmit={kirim} className="p-3.5">
              <label htmlFor="link-tugas" className="lp-label mb-1.5 block">
                Punya link Tugas?
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
                  aria-describedby={galat ? 'galat-link' : 'petunjuk-link'}
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
                  className="mt-2 text-[0.8125rem] text-pretty text-error-text"
                >
                  {galat}
                </p>
              ) : (
                <p id="petunjuk-link" className="adw-caption lp-dim mt-2 text-pretty">
                  Kode di belakang /t/ juga bisa ditempel langsung.
                </p>
              )}
            </form>
          </Kotak>
        </div>

        {/* --- The mechanism, shown ------------------------------------------ */}
        <div className="min-w-0">
          <PanelSesi />
          <p className="adw-caption lp-dim mt-3 text-pretty">
            Contoh tampilan Murid setelah mengunggah: Sesi terkunci dan tiga
            pertanyaan yang disusun dari karyanya sendiri.
          </p>
        </div>
      </div>
    </section>
  )
}
