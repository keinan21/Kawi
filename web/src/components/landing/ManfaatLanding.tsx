/**
 * Manfaat, lima baris, satu klaim per baris.
 *
 * Skill menempatkan manfaat tepat setelah hero: berorientasi hasil, bukan
 * fitur. Setiap baris memakai satu format — klaim tebal, lalu buktinya —
 * dipisahkan garis tipis (Proximity: klaim dan buktinya rapat, baris-baris
 *nya berjauhan). Bukan grid kartu: lima kartu berikon akan menyamakan lima
 * hal yang berbeda bobotnya (Similarity dipakai untuk yang setara saja).
 */
const MANFAAT = [
  {
    judul: 'Pertanyaan dari karya mereka sendiri',
    isi: 'Tiga pertanyaan, yaitu Ideasi, Isi, dan Harapan, disusun dari isi berkas yang diunggah. Tidak bisa ditebak dari luar, tidak bisa dihafal.',
  },
  {
    judul: 'Guru membaca, bukan mencari',
    isi: 'Setiap jawaban wajib berkutipan tepat dari berkasnya sendiri, dan kutipan itu dicek cocok sebelum dikirim.',
  },
  {
    judul: 'Semua gangguan tercatat',
    isi: 'Pindah tab, keluar layar penuh, kehilangan fokus: tercatat dari server dengan waktunya. Izin Unggah Ulang menambah percobaan baru, tidak menghapus yang lama.',
  },
  {
    judul: 'Satu link, tanpa instalasi',
    isi: 'Murid membuka link, mengunggah satu berkas, menjawab. Tidak ada akun khusus, tidak ada aplikasi.',
  },
  {
    judul: 'Batasnya diungkapkan',
    isi: 'Ini deterrensi plus jejak audit, bukan pencegahan. Penilaian AI adalah sinyal bantu, bukan vonis.',
  },
]

export function ManfaatLanding() {
  return (
    <section id="manfaat" className="lp-shell lp-sek border-t border-shade">
      <h2 className="lp-h2">Apa yang kamu dapatkan</h2>

      <ul className="m-0 mt-8 list-none p-0">
        {MANFAAT.map((m) => (
          <li key={m.judul} className="lp-manfaat">
            <span className="block text-lg font-semibold leading-7">{m.judul}</span>
            <span className="lp-dim mt-1 block text-base leading-6 text-pretty">
              {m.isi}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}