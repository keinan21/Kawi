/**
 * Cara kerjanya, dan apa yang ditanyakan.
 *
 * Tiga langkah, satu warna tiap langkah, satu angka besar tiap langkah:
 * perjalanan pulang pergi terbaca dalam sekali pandang. Bobot ketiganya sama
 * (Similarity) sehingga baris terbaca sebagai satu urutan, dan angka besarnya
 * yang membawa urutan — tidak ada yang bergantung pada membaca kata-kata
 * untuk tahu langkah mana yang lebih dulu.
 *
 * Di bawahnya, tiga tipe pertanyaan sebagai tiga kartu berbentuk: pembeda
 * inti produk, diucapkan sekali. Bentuknya dekorasi saja, karena setiap kartu
 * menyebut tipenya dalam teks — warna dan bentuk tidak pernah memikul makna
 * sendirian.
 */
const LANGKAH = [
  {
    judul: 'Guru bagikan link',
    isi: 'Buat tugas, lalu kirim satu link ke murid.',
    warna: 'var(--lp-biru)',
  },
  {
    judul: 'Murid unggah tugas',
    isi: 'Cukup satu berkas.',
    warna: 'var(--lp-hijau)',
  },
  {
    judul: 'Murid jawab 3 pertanyaan',
    isi: 'Disusun dari isi tugasnya sendiri.',
    warna: 'var(--lp-oranye)',
  },
]

const TIPE_TANYA = [
  {
    tipe: 'Ideasi',
    isi: 'Dari ide apa karya ini berangkat, dan apa yang diubah dari ide itu.',
    warna: 'lp-kartu--biru',
    bentuk: 'lp-bentuk--segitiga',
  },
  {
    tipe: 'Isi',
    isi: 'Bagian mana yang paling dikerjakan sendiri, dan mengapa.',
    warna: 'lp-kartu--hijau',
    bentuk: 'lp-bentuk--belah-kupat',
  },
  {
    tipe: 'Harapan',
    isi: 'Kalau karya ini dilanjutkan, siapa yang paling terbantu.',
    warna: 'lp-kartu--oranye',
    bentuk: 'lp-bentuk--lingkaran',
  },
]

export function AlurNegak() {
  return (
    <section id="alur" className="lp-jangkar lp-shell lp-sek border-t border-shade">
      <h2 className="lp-h2">Cara kerjanya</h2>

      <ol className="m-0 mt-8 grid list-none gap-6 p-0 sm:grid-cols-3">
        {LANGKAH.map((l, i) => (
          <li key={l.judul} className="min-w-0">
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-full text-base font-bold text-white"
              style={{ backgroundColor: l.warna }}
            >
              {i + 1}
            </span>
            <h3 className="lp-h3 mt-3">{l.judul}</h3>
            <p className="lp-dim mt-2 text-base leading-6 text-pretty">{l.isi}</p>
          </li>
        ))}
      </ol>

      <h2 className="lp-h2 mt-16 sm:mt-20">Tiga pertanyaan, satu dari tiap tipe</h2>
      <p className="lp-prose lp-dim mt-2 text-base">
        Ditanyakan dari isi tugas Murid sendiri, masing-masing dengan kutipan
        yang bisa Guru cek langsung.
      </p>

      <ul className="m-0 mt-6 grid list-none gap-3 p-0 sm:grid-cols-3">
        {TIPE_TANYA.map((t) => (
          <li key={t.tipe} className={`lp-kartu ${t.warna}`}>
            <span aria-hidden="true" className={`lp-bentuk ${t.bentuk}`} />
            <span className="min-w-0">
              <span className="block text-lg font-bold leading-7">{t.tipe}</span>
              <span className="mt-1 block text-sm leading-5 text-pretty opacity-90">
                {t.isi}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}