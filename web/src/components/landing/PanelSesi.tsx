import { useEffect, useState } from 'react'
import { Ikon } from '@/components/adw/ikon'

/**
 * Sesi terkunci, digambar seperti yang ditemui Murid.
 *
 * Ini satu-satunya permukaan gelap di halaman dan satu jangkar visualnya:
 * muncul tepat sekali, di hero, dan ada karena halaman yang hanya menjelaskan
 * mekanismenya belum menjelaskan apa pun. Semua isinya benar dan diambil dari
 * aturan produk sendiri — lencana kunci, jendela jawaban yang baru berjalan
 * setelah unggahan diterima, tiga tipe pertanyaan berurutan, dan baris sumber
 * di bawah tiap pertanyaan, yang membuat pertanyaan hanya bisa dijawab oleh
 * penulisnya.
 *
 * Hitung mundurnya benar-benar berjalan. "10:00" statis adalah gambar timer;
 * timer yang kehilangan satu detik tiap detik adalah mekanismenya sendiri, dan
 * itu halaman terkuat yang tidak membutuhkan kata. Bagi pembaca layar ia
 * adalah hiasan (`aria-hidden`) — aturan 10 menit dinyatakan sekali, statis.
 * Di bawah `prefers-reduced-motion` ia berhenti di 10:00.
 *
 * Panel ini DOM hidup, bukan screenshot: ia mengikuti gaya tampilan, bertahan
 * di Large Text, dan terbaca pembaca layar.
 */

/** Tiga tipe pertanyaan, tetap menurut DESIGN.md §6 — satu per tipe, selalu. */
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

/** Jendela jawaban, dalam detik. */
const JENDELA_DETIK = 600

/** Geometri cincin: r26 pada grid 64px, agar matematika dash tetap konstan. */
const JARI_JARI = 26
const KELILING = 2 * Math.PI * JARI_JARI

function detik(d: number) {
  return String(d).padStart(2, '0')
}

/** Hitung mundur hidup, kecuali pengunjung meminta gerak lebih sedikit. */
function useHitungMundur() {
  const [sisa, setSisa] = useState(JENDELA_DETIK)
  const [bolehJalan, setBolehJalan] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const terapkan = () => {
      setBolehJalan(!mq.matches)
      if (mq.matches) setSisa(JENDELA_DETIK)
    }
    terapkan()
    mq.addEventListener('change', terapkan)
    return () => mq.removeEventListener('change', terapkan)
  }, [])

  useEffect(() => {
    if (!bolehJalan) return
    const id = window.setInterval(() => {
      // Kembali ke jendela penuh daripada berhenti di 00:00: panel ini adalah
      // contoh sebuah Sesi, bukan Sesi yang kehabisan waktu di depan pengunjung.
      setSisa((s) => (s <= 1 ? JENDELA_DETIK : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [bolehJalan])

  return { sisa, bolehJalan }
}

export function PanelSesi() {
  const { sisa, bolehJalan } = useHitungMundur()

  const menit = Math.floor(sisa / 60)
  const sisaDetik = sisa % 60
  const pecahan = sisa / JENDELA_DETIK
  const offset = KELILING * (1 - pecahan)

  return (
    <figure className="lp-osd m-0 w-full rounded-card p-0 shadow-[0_18px_48px_rgb(0_0_0/28%)]">
      <figcaption className="sr-only">
        Contoh tampilan Sesi terkunci: satu berkas, timer jawaban sepuluh menit
        yang berjalan, dan tiga pertanyaan yang disusun dari isi Unggahan Murid.
      </figcaption>

      {/* Kepala sesi: apa yang dikunci, dan berapa sisa darinya. */}
      <div className="flex items-center gap-3 border-b border-[var(--lp-osd-lembut)] px-4 py-3">
        <span className="grid size-8 flex-none place-items-center rounded-lg bg-white/10">
          <Ikon nama="kunciLayar" ukuran={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold">Sesi terkunci</span>
          <span className="lp-osd-dim block text-xs">
            Layar penuh · satu berkas · dikirim sekali
          </span>
        </span>
        <span
          className="angka lp-osd-dim flex flex-none items-center gap-2 text-xs"
          aria-hidden="true"
        >
          <Ikon nama="jam" ukuran={13} />
          {menit}:{detik(sisaDetik)}
        </span>
      </div>

      <div className="px-4 py-4">
        {/* Jendela jawaban, sebagai jam yang berjalan: cincin yang menyusut
            bersamaan dengan jatuhnya angka. Gerak tereduksi, cincin penuh. */}
        <div className="mb-4 flex items-center gap-4">
          <div
            aria-hidden="true"
            className="relative grid flex-none place-items-center size-16"
          >
            <svg viewBox="0 0 64 64" className="size-full -rotate-90">
              <circle
                cx="32"
                cy="32"
                r={JARI_JARI}
                fill="none"
                stroke="rgb(255 255 255 / 0.18)"
                strokeWidth="6"
              />
              <circle
                cx="32"
                cy="32"
                r={JARI_JARI}
                fill="none"
                stroke="#ffffff"
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={KELILING}
                strokeDashoffset={bolehJalan ? offset : 0}
              />
            </svg>
            <span className="angka absolute text-sm font-bold text-white">
              {menit}:{detik(sisaDetik)}
            </span>
          </div>

          <div className="min-w-0">
            <span className="block text-base font-bold">Sisa waktu menjawab</span>
            <span
              className="lp-osd-dim block text-xs leading-5 text-pretty"
              role="img"
              aria-label="Jendela jawaban 10 menit, berjalan sejak Unggahan diterima"
            >
              Timer berjalan setelah Unggahan diterima, bukan saat halaman dibuka.
            </span>
          </div>
        </div>

        {/* Tiga pertanyaan, datang berurutan. */}
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {PERTANYAAN.map((p) => (
            <li key={p.tipe} className="lp-osd-kartu lp-tanya px-3 py-3">
              <div className="flex items-center gap-2">
                <Ikon
                  nama="pertanyaan"
                  ukuran={13}
                  className="flex-none text-[var(--adw-accent-fg-text)]"
                />
                <span className="lp-label !text-white/60">Pertanyaan {p.tipe}</span>
              </div>
              <p className="mt-1 text-sm leading-5 font-medium text-pretty">
                {p.teks}
              </p>
              <p className="lp-osd-dim mt-2 flex gap-2 text-xs leading-5 text-pretty">
                <Ikon nama="kutipan" ukuran={12} className="mt-px flex-none" />
                <span>
                  Disusun dari Unggahan Murid: <span>{p.sumber}</span>
                </span>
              </p>
            </li>
          ))}
        </ol>
      </div>

      {/* Akibatnya, dikatakan sebelum klik, bukan sesudahnya. */}
      <p className="lp-osd-dim flex gap-2 border-t border-[var(--lp-osd-lembut)] px-4 py-3 text-xs leading-5 text-pretty">
        <Ikon nama="manyWindow" ukuran={13} className="mt-px flex-none" />
        <span>
          Berpindah tab, keluar layar penuh, atau kehilangan fokus dicatat sebagai
          Pelanggaran lalu memicu hitung mundur 5 detik.
        </span>
      </p>
    </figure>
  )
}