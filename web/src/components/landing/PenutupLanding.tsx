import { Ikon } from '@/components/adw/ikon'
import { TombolDashboard } from './TombolDashboard'

/**
 * The close, and the footer under it.
 *
 * One band on `sidebar` — a different value of the same neutral, never the
 * accent colour (white on Adwaita blue only reaches 3.8:1). It carries the
 * whole honest boundary in two paragraphs: deterrence plus audit trail, not
 * prevention — and Penilaian AI as a signal, not a verdict. The two-column
 * "claimed / not claimed" band is gone; its essential lines live here, next
 * to the decision they justify (Proximity).
 *
 * The band repeats the page's one primary action, identical in label and
 * destination (Similarity) — the last of at most three sightings, and the
 * second the visitor can act on. The footer below is a single quiet column:
 * identity, one honest line, two anchors, and the attributions the page owes.
 */
export function PenutupLanding() {
  return (
    <>
      <section
        id="batas"
        aria-labelledby="judul-batas"
        className="lp-jangkar lp-shell lp-sek border-t border-shade"
      >
        <div className="rounded-card bg-sidebar px-6 py-10 text-sidebar-fg sm:px-10 sm:py-14">
          <div className="max-w-[68ch]">
            <h2 id="judul-batas" className="lp-h2">
              Batasnya disebut di awal
            </h2>
            <p className="lp-prose lp-dim mt-3">
              Produk ini tidak mencegah menyontek — tidak ada yang bisa. Yang
              dikerjakan adalah deterrensi plus jejak audit: setiap gangguan
              dicatat dengan waktunya dari server, dan riwayat setiap percobaan
              tersimpan. Izin Unggah Ulang menambah percobaan baru, bukan
              menghapus yang lama.
            </p>
            <p className="lp-prose lp-dim mt-3">
              Penilaian AI adalah sinyal bantu untuk membaca jawaban, bukan
              vonis. Nilai akhir tetap keputusan Guru, dan Murid tidak pernah
              melihat skor.
            </p>
            <div className="mt-7">
              <TombolDashboard />
            </div>
          </div>
        </div>
      </section>

      <footer className="lp-kaki">
        <div className="lp-shell py-10">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="grid size-6 flex-none place-items-center rounded-[7px] bg-accent text-accent-fg"
            >
              <Ikon nama="tDicek" ukuran={14} />
            </span>
            <span className="text-[0.9375rem] font-bold tracking-tight">
              Assignment Integrity Form
            </span>
          </div>
          <p className="adw-caption lp-dim mt-3 max-w-[68ch] text-pretty">
            Penilaian integritas tugas berbasis pemahaman.{' '}
            <a href="#alur">Cara kerja</a> · <a href="#batas">Batas</a>
          </p>

          {/* Attribution the icon theme's COPYING asks for, and the decision
              that governs how this product is allowed to talk about itself. */}
          <div className="mt-6 border-t border-shade pt-5">
            <p className="adw-caption lp-dim m-0 max-w-[72ch] text-pretty">
              Ikon simbolik dari{' '}
              <a
                href="https://github.com/GNOME/adwaita-icon-theme"
                className="underline"
                style={{ textUnderlineOffset: '0.1875em' }}
              >
                Adwaita icon theme
              </a>{' '}
              oleh GNOME Project (CC-BY-SA 3.0 / LGPL v3).
            </p>
            <p className="adw-caption lp-dim mt-2 m-0 max-w-[72ch] text-pretty">
              Penguncian Sesi adalah deterrensi dan jejak audit, bukan pencegahan —
              lihat{' '}
              <code className="rounded bg-[color-mix(in_srgb,currentColor_10%,transparent)] px-1 py-0.5 text-[0.75rem]">
                docs/adr/0001
              </code>
              .
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}
