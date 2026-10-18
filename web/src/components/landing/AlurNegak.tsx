import { Baris, Kotak, Lencana } from '@/components/adw/adw'
import { Ikon } from '@/components/adw/ikon'

/**
 * The round trip, as one unbroken line.
 *
 * This is the Integrity Rail turned on its side. It replaces the four-card
 * "how it works" block the page used to carry: a row of equal cards is the
 * category's lazy container, and it would hide the one structural fact worth
 * drawing — the states are a *sequence*, and `auto_submitted` leaves the line
 * rather than sitting on it.
 */
const LANGKAH = [
  {
    keadaan: 'Dibuat',
    isi: 'Guru menulis perintah, format berkas, batas waktu, dan durasi Sesi.',
    ikon: 'tDicek' as const,
  },
  {
    keadaan: 'Mengunggah',
    isi: 'Murid masuk lewat link, Sesi terkunci, satu berkas dikirim. Timer belum jalan.',
    ikon: 'unggah' as const,
  },
  {
    keadaan: 'Menjawab',
    isi: 'Unggahan diterima → timer 10 menit mulai. AI menyusun tiga pertanyaan dari berkas itu.',
    ikon: 'pertanyaan' as const,
  },
  {
    keadaan: 'Terkumpul',
    isi: 'Jawaban masuk, Penilaian AI berjalan di belakang, riwayatnya tersimpan untuk Guru.',
    ikon: 'daftar' as const,
  },
]

const TIPE_TANYA = [
  {
    tipe: 'Ideasi',
    isi: 'Dari ide apa karya ini berangkat, dan apa yang diubah darinya.',
  },
  {
    tipe: 'Isi',
    isi: 'Bagian mana yang paling dikerjakan sendiri, dan mengapa.',
  },
  {
    tipe: 'Harapan',
    isi: 'Kalau karya ini dilanjutkan, siapa yang paling terbantu.',
  },
]

export function AlurNegak() {
  return (
    <section id="alur" className="lp-jangkar lp-shell lp-sek border-t border-shade">
      <h2 className="lp-h2">Empat keadaan, satu garis</h2>
      <p className="lp-prose mt-3 lp-dim">
        Sesi tidak punya tombol “batal” dan tidak punya jalan tengah. Ia bergerak
        maju, atau keluar dari garis di satu tempat saja.
      </p>

      <ol className="lp-relai mt-10 m-0 list-none p-0">
        {LANGKAH.map((l) => (
          <li key={l.keadaan} className="lp-relai__simpul">
            <span className="lp-relai__titik block" aria-hidden="true" />
            <div className="mt-4 flex items-center gap-2">
              <Ikon nama={l.ikon} ukuran={16} className="flex-none text-accent-text" />
              <h3 className="lp-h3 m-0">{l.keadaan}</h3>
            </div>
            <p className="lp-dim mt-1.5 text-[0.9375rem] leading-relaxed text-pretty">
              {l.isi}
            </p>
          </li>
        ))}
      </ol>

      {/* The branch. It leaves the line, and it is the only exit that does. */}
      <p className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-control bg-[color-mix(in_srgb,var(--adw-warning-bg)_14%,transparent)] px-3 py-2 text-[0.875rem] text-pretty text-warning-text">
        <Ikon nama="peringatan" ukuran={15} className="flex-none" />
        <span>
          <span className="font-bold">Dihidup otomatis</span> — Pelanggaran yang
          diabaikan, atau timer yang habis. Sesi terkirim tanpa Penilaian AI,
          karena jawaban parsial bukan sinyal pemahaman.
        </span>
      </p>

      {/* The product's core differentiator, compressed to one boxed list: three
          rows, identical treatment, one left edge (Similarity + Continuity).
          The hero's panel already shows these questions; here they are stated
          as the rule behind them. */}
      <div className="mt-12 lg:mt-16">
        <h3 className="lp-h3">Tiga pertanyaan, satu dari tiap tipe</h3>
        <p className="lp-prose lp-dim mt-2">
          AI membaca berkas yang diunggah, lalu menyusun satu Pertanyaan
          Ideasi, satu Isi, dan satu Harapan. Tiap pertanyaan membawa kutipan
          persis dari dokumen — dicek sebagai substring sebelum dikirim, dan
          diperbaiki bila tidak cocok.
        </p>
        <Kotak dibingkai className="lp-prose mt-5">
          {TIPE_TANYA.map((t) => (
            <Baris key={t.tipe}>
              <Lencana nada="aksen" ikon="pertanyaan" className="flex-none">
                {t.tipe}
              </Lencana>
              <span className="min-w-0 flex-1 text-[0.9375rem] leading-relaxed text-pretty">
                {t.isi}
              </span>
            </Baris>
          ))}
        </Kotak>
      </div>
    </section>
  )
}