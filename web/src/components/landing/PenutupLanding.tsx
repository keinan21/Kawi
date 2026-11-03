import { Ikon } from '@/components/adw/ikon'
import { TombolDashboard } from './TombolDashboard'

/**
 * Penutup, dan footer di bawahnya.
 *
 * Satu band dengan volume penuh: biru Adwaita yang lebih dalam, datar — putih
 * hanya mencapai 3.8:1 pada langkah aksen, dan 6.3:1 pada langkah ini. Halaman
 * berakhir dengan energi, bukan memudar, dan band ini mengulang aksi utama
 * halaman dengan label dan tujuan yang identik (Similarity): penampakan
 * ketiga, dan yang kedua bisa ditindaklanjuti.
 *
 * Batas jujur tetap ada, karena ia bagian dari tawaran, bukan cetak kaki:
 * deterrensi plus jejak audit, bukan pencegahan; Penilaian AI sinyal bantu,
 * bukan vonis. Footer di bawahnya satu kolom tenang: identitas, satu baris
 * jujur, dua jangkar, dan atribusi yang produk ini hutang.
 */
export function PenutupLanding() {
  return (
    <>
      <section id="batas" aria-labelledby="judul-batas" className="lp-jangkar lp-pita">
        <div className="lp-shell py-16 sm:py-20">
          <div className="max-w-[62ch]">
            <h2 id="judul-batas" className="lp-h2">
              Siap mencoba?
            </h2>
            <p className="lp-lead mt-3">
              Buat tugas pertamamu dalam semenit. Murid cukup membuka satu link.
            </p>
            <div className="mt-8">
              <TombolDashboard
                kelas="lp-cta lp-chunky lp-chunky--terang"
                denganIkon={false}
              />
            </div>
            <p className="mt-6 max-w-[68ch] text-base leading-6 text-pretty text-white/85">
              Produk ini tidak mencegah menyontek — tidak ada yang bisa. Yang
              dikerjakan adalah deterrensi plus jejak audit: setiap gangguan
              dicatat dari server, dan setiap percobaan tersimpan. Izin Unggah
              Ulang menambah percobaan baru, bukan menghapus yang lama. Penilaian
              AI adalah sinyal bantu untuk membaca jawaban, bukan vonis — nilai
              akhir tetap keputusan Guru, dan Murid tidak pernah melihat skor.
            </p>
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
            <span className="text-base font-bold tracking-tight">
              Assignment Integrity Form
            </span>
          </div>
          <p className="adw-caption lp-dim mt-3 max-w-[68ch] text-pretty">
            Penilaian integritas tugas berbasis pemahaman.{' '}
            <a href="#alur">Cara kerja</a> · <a href="#batas">Batas</a>
          </p>

          {/* Atribusi yang diminta COPYING tema ikon, dan keputusan yang
              mengatur bagaimana produk ini boleh berbicara tentang dirinya. */}
          <div className="mt-6 border-t border-shade pt-4">
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
              <code className="rounded bg-[color-mix(in_srgb,currentColor_10%,transparent)] px-1 py-0.5 text-xs">
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