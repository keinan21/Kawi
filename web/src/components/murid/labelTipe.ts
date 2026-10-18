import type { QuestionType } from '@lms/shared'

/** Label + penjelasan singkat tiap tipe Pertanyaan (CONTEXT.md). */
export const LABEL_TIPE: Record<QuestionType, { judul: string; keterangan: string }> = {
  ideasi: {
    judul: 'Pertanyaan Ideasi',
    keterangan:
      'Menelusuri asal gagasan dalam karyamu sendiri: ide berasal dari mana, dan apa yang kamu ubah.',
  },
  isi: {
    judul: 'Pertanyaan Isi',
    keterangan:
      'Memastikan kamu benar-benar mengerjakan isinya: keputusan, detail, dan pertimbangan di dalam dokumen.',
  },
  harapan: {
    judul: 'Pertanyaan Harapan',
    keterangan:
      'Menguji visi ke depan atas karyamu: dampak yang diinginkan, tahap selanjutnya, dan siapa yang dilayani.',
  },
}