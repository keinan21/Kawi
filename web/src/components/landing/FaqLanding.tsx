/**
 * Tanya jawab, polos, di atas CTA akhir.
 *
 * Skill menempatkan penanganan keberatan sebagai section, bukan catatan kaki:
 * tawaran produk ini berhadapan dengan tiga keberatan nyata (apakah ini
 * mencegah menyontek, apakah AI yang menilai, apakah karya murid aman), dan
 * jawaban jujurnya adalah bagian dari penjualan, bukan pelengkap.
 *
 * Setiap jawaban adalah kebenaran produk yang sudah tertulis di DESIGN.md —
 * tidak ada yang diarang. `<details>` memberikan seluruh interaksi keyboard
 * dan pembaca layar tanpa satu baris pun JavaScript.
 */
const FAQ = [
  {
    tanya: 'Apakah ini mencegah menyontek?',
    jawab:
      'Tidak. Yang dikerjakan adalah deterrensi plus jejak audit: setiap gangguan dicatat dari server dengan waktunya, dan riwayat setiap percobaan tersimpan. Tidak ada sistem yang bisa menjanjikan pencegahan.',
  },
  {
    tanya: 'Dari mana pertanyaannya datang?',
    jawab:
      'Disusun dari isi berkas yang Murid unggah sendiri: satu Pertanyaan Ideasi, satu Isi, dan satu Harapan. Tiap pertanyaan membawa kutipan tepat dari dokumen itu.',
  },
  {
    tanya: 'Apakah AI yang menilai?',
    jawab:
      'Penilaian AI adalah sinyal bantu untuk membaca jawaban, bukan vonis. Nilai akhir tetap keputusan Guru, dan Murid tidak pernah melihat skor.',
  },
  {
    tanya: 'Perlu instalasi atau akun khusus?',
    jawab:
      'Tidak. Guru membuat Tugas dan membagikan satu link. Murid membukanya, mengunggah satu berkas, lalu menjawab. Akun yang sama bisa dipakai sebagai Guru maupun Murid.',
  },
  {
    tanya: 'Berapa lama waktu mengerjakannya?',
    jawab:
      'Sepuluh menit, dan timer baru berjalan setelah Unggahan diterima, bukan saat halaman dibuka.',
  },
  {
    tanya: 'Apa yang terjadi kalau Murid pindah tab?',
    jawab:
      'Berpindah tab, keluar layar penuh, atau kehilangan fokus dicatat sebagai Pelanggaran dan memicu hitung mundur 5 detik. Bila diabaikan, Sesi terkirim tanpa Penilaian AI.',
  },
  {
    tanya: 'Bisa dipakai untuk mata pelajaran apa saja?',
    jawab:
      'Ya, selama berbentuk berkas: laporan, esai, analisis, atau kode. Tiga tipe pertanyaannya menanyakan ide, pengerjaan, dan manfaat karyanya.',
  },
  {
    tanya: 'Bagaimana kalau Murid tidak punya laptop?',
    jawab:
      'Sesi terkunci hanya berjalan di laptop, demi penguncian layar penuh yang bisa diaudit. Tugas tetap bisa dikerjakan di mana saja, tetapi Sesi-nya di laptop.',
  },
  {
    tanya: 'Apa bedanya dengan pemeriksa plagiarisme?',
    jawab:
      'Pemeriksa plagiarisme membandingkan karya dengan sumber lain. Ini memverifikasi pemahaman dari karya sendiri: jawabannya harus menjelaskan bagian yang kutipannya ada di dalam berkasnya.',
  },
  {
    tanya: 'Apakah jawaban bisa dikumpulkan lebih dari sekali?',
    jawab:
      'Bisa, dengan Izin Unggah Ulang. Setiap izin menambah percobaan baru; percobaan lama tetap tersimpan dan tidak dihapus.',
  },
]

export function FaqLanding() {
  return (
    <section id="faq" className="lp-jangkar lp-shell lp-sek border-t border-shade">
      <h2 className="lp-h2">Pertanyaan yang sering diajukan</h2>

      <div className="mt-8">
        {FAQ.map((f) => (
          <details key={f.tanya} className="lp-faq group">
            <summary className="flex items-baseline justify-between gap-4 text-base font-medium">
              <span className="text-pretty">{f.tanya}</span>
              <span aria-hidden="true" className="flex-none text-[var(--adw-accent-fg-text)]">
                +
              </span>
            </summary>
            <p className="lp-dim m-0 pb-4 pr-8 text-base leading-6 text-pretty">
              {f.jawab}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}