import type { QuestionType } from '@lms/shared'
import { LABEL_TIPE } from './labelTipe.ts'
import { Lencana } from '@/components/adw/adw'
import { Ikon } from '@/components/adw/ikon'

export interface KartuPertanyaanProps {
  nomor: number
  tipe: QuestionType
  text: string
  nilai: string
  onUbah: (nilai: string) => void
}

/**
 * Satu Pertanyaan sebagai baris boxed list: label tipe, teks pertanyaan,
 * keterangan singkat tentang apa yang ditanyakan, lalu area jawaban.
 * Baris pertama Pertanyaan yang terisi mendapat fokus — jadi mengetik langsung
 * mungkin, tanpa mencari halaman dulu.
 */
export function KartuPertanyaan({
  nomor,
  tipe,
  text,
  nilai,
  onUbah,
}: KartuPertanyaanProps) {
  const label = LABEL_TIPE[tipe] ?? LABEL_TIPE.isi
  const id = `pertanyaan-${nomor}`

  return (
    <section aria-labelledby={`${id}-judul`} className="adw-boxed px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-center gap-2">
        <Lencana nada="aksen">{label.judul}</Lencana>
        <span className="angka adw-caption adw-dim">
          {nomor} dari 3
        </span>
      </div>

      <h2
        id={`${id}-judul`}
        className="mt-3 text-[1.05rem] leading-snug font-bold tracking-tight text-pretty"
      >
        {text}
      </h2>

      <p className="mt-1.5 text-pretty text-adw-dim">{label.keterangan}</p>

      <label htmlFor={id} className="mt-4 mb-1.5 block text-[0.875rem] font-medium">
        Jawabanmu
      </label>
      <textarea
        id={id}
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        rows={5}
        placeholder="Tulis jawabanmu di sini…"
        className="adw-field resize-y leading-relaxed"
      />
      <p className="adw-caption adw-dim mt-1.5 flex items-center gap-1.5">
        <Ikon nama="info" ukuran={13} className="flex-none" />
        Jawaban ini dibaca Guru bersama Penilaian AI-nya.
      </p>
    </section>
  )
}

export default KartuPertanyaan
