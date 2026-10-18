import { Ikon } from '@/components/adw/ikon'

/**
 * The locked session, drawn as the Murid sees it.
 *
 * This is the page's one dark surface and its one authored moment: it appears
 * exactly once, in the hero, and it exists because a landing page that only
 * describes the mechanism has described nothing. Everything in here is true and
 * drawn from the product's own rules — the lock chip, the countdown, the timer
 * that starts only after the upload is accepted, the three question types in
 * order, and the source line under each question, which is what makes the
 * question answerable only by the author.
 *
 * The panel is live DOM rather than a screenshot, so it recolours with the style,
 * survives Large Text, and can be read by a screen reader.
 */

/** The three question types, fixed by DESIGN.md §6 — one per type, always. */
const PERTANYAAN = [
  {
    tipe: 'Ideasi',
    teks: 'Daripada ide apa ini, dan apa yang kamu ubah darinya?',
    sumber: '"…setelah membaca laporan sektor udara 2024, saya memindahkan…"',
  },
  {
    tipe: 'Isi',
    teks: 'Bagian mana yang paling kamu kerjakan sendiri, dan apa alasannya?',
    sumber: '“Metode yang saya pakai adalah replikasi dengan…”',
  },
  {
    tipe: 'Harapan',
    teks: 'Kalau ini dilanjutkan, siapa yang menurutmu paling terbantu?',
    sumber: '“…masih menjadi acuan bagi operator daerah…”',
  },
]

/** Remaining answer time, from the 10-minute window. */
const SISA_MENIT = 7
const SISA_DETIK = 42

function detik(d: number) {
  return String(d).padStart(2, '0')
}

export function PanelSesi() {
  return (
    <figure className="lp-osd m-0 w-full rounded-card p-0 shadow-[0_18px_48px_rgb(0_0_0/28%)]">
      <figcaption className="sr-only">
        Contoh tampilan Sesi terkunci: hitung mundur Pelanggaran, timer jawaban
        sepuluh menit, dan tiga pertanyaan yang disusun dari isi Unggahan Murid.
      </figcaption>

      {/* Session header: what is enforced, and how much is left of it. */}
      <div className="flex items-center gap-3 border-b border-[var(--lp-osd-lembut)] px-4 py-3">
        <span className="grid size-7 flex-none place-items-center rounded-[8px] bg-white/10">
          <Ikon nama="kunciLayar" ukuran={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-bold">Sesi terkunci</span>
          <span className="lp-osd-dim block text-[0.8125rem]">
            Layar penuh · satu berkas · dikirim sekali
          </span>
        </span>
        <span className="angka lp-osd-dim flex flex-none items-center gap-1.5 text-[0.8125rem]">
          <Ikon nama="jam" ukuran={13} />
          {SISA_MENIT}:{detik(SISA_DETIK)}
        </span>
      </div>

      <div className="px-4 py-4">
        {/* What is left of the answer window. */}
        <div className="mb-4">
          <div className="lp-osd-dim mb-1.5 flex items-baseline justify-between text-[0.8125rem]">
            <span>Sisa waktu menjawab</span>
            <span className="angka font-medium text-white">
              {SISA_MENIT} menit {SISA_DETIK} detik
            </span>
          </div>
          <div
            className="adw-progress"
            style={{ backgroundColor: 'rgb(255 255 255 / 0.16)' }}
            role="img"
            aria-label={`Sisa waktu menjawab: ${SISA_MENIT} menit ${SISA_DETIK} detik dari 10 menit`}
          >
            <span style={{ width: '78%', backgroundColor: '#ffffff' }} />
          </div>
          <p className="lp-osd-dim mt-1.5 text-[0.75rem] text-pretty">
            Timer baru berjalan setelah Unggahan diterima, bukan saat halaman dibuka.
          </p>
        </div>

        {/* The three questions, arriving in order. */}
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {PERTANYAAN.map((p) => (
            <li key={p.tipe} className="lp-osd-kartu lp-tanya px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Ikon
                  nama="pertanyaan"
                  ukuran={13}
                  className="flex-none text-[var(--adw-accent-fg-text)]"
                />
                <span className="lp-label !text-white/60">Pertanyaan {p.tipe}</span>
              </div>
              <p className="mt-1 text-[0.875rem] leading-snug font-medium text-pretty">
                {p.teks}
              </p>
              <p className="lp-osd-dim mt-1.5 flex gap-1.5 text-[0.75rem] leading-snug text-pretty">
                <Ikon nama="kutipan" ukuran={12} className="mt-px flex-none" />
                <span>
                  Disusun dari Unggahan Murid: <span className="italic">{p.sumber}</span>
                </span>
              </p>
            </li>
          ))}
        </ol>
      </div>

      {/* The consequence, stated before the click rather than after it. */}
      <p className="lp-osd-dim flex gap-2 border-t border-[var(--lp-osd-lembut)] px-4 py-3 text-[0.75rem] leading-snug text-pretty">
        <Ikon nama="manyWindow" ukuran={13} className="mt-px flex-none" />
        <span>
          Berpindah tab, keluar layar penuh, atau kehilangan fokus dicatat sebagai
          Pelanggaran lalu memicu hitung mundur 5 detik.
        </span>
      </p>
    </figure>
  )
}