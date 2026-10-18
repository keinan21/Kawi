import type {
  AttemptSummary,
  CreateTugasInput,
  Participant,
  PelanggaranItem,
  PenilaianAI,
  QAItem,
  SessionDetail,
  TugasItem,
} from './guru-api'

// ---------------------------------------------------------------------------
// Data mock untuk konsol Guru. Hanya aktif bila env VITE_USE_MOCKS=true
// saat start dev/build (lihat guru-api.ts) — bukan fallback diam-diam.
// Waktu dibuat relatif terhadap saat modul dimuat agar status jendela
// (belum batas / mendekati batas / lewat batas) selalu masuk akal saat demo.
// ---------------------------------------------------------------------------

const MENIT = 60_000
const JAM = 60 * MENIT
const HARI = 24 * JAM
const now = Date.now()

const iso = (t: number) => new Date(t).toISOString()

function buatPelanggaran(
  id: string,
  type: PelanggaranItem['type'],
  detail: string,
  t: number,
): PelanggaranItem {
  return { id, type, detail, clientTs: iso(t), serverTs: iso(t + 400) }
}

function qaLengkap(prefix: string): QAItem[] {
  return [
    {
      id: `${prefix}-ideasi`,
      type: 'ideasi',
      question:
        'Dari mana ide utama tulisan ini berasal? Sebutkan inspirasi awalnya dan satu hal yang kamu ubah dari ide tersebut.',
      answer:
        'Ide awalnya dari tugas observasi warung di dekat kos yang sepi pembeli saat hujan. Saya mengubah fokusnya: bukan sekadar promosi, tapi sistem pesan-antar sederhana lewat grup chat agar warung tetap jalan saat cuaca buruk.',
    },
    {
      id: `${prefix}-isi`,
      type: 'isi',
      question:
        'Di bagian 3 kamu memilih skema bagi hasil 60:40, bukan 50:50. Jelaskan alasan angka itu dan risiko yang kamu pertimbangkan.',
      answer:
        'Saya pilih 60:40 karena pemilik warung menanggung bahan dan tempat, sedangkan pengantar hanya tenaga dan bensin. Risikonya kalau order sepi, pengantar bisa mundur — jadi saya usulkan jaminan minimal 5 order per minggu di bagian 4.',
    },
    {
      id: `${prefix}-harapan`,
      type: 'harapan',
      question:
        'Jika gagasan ini dilanjutkan satu semester ke depan, siapa yang paling terbantu dan apa langkah pertama yang akan kamu ambil?',
      answer:
        'Yang paling terbantu pemilik warung kecil di gang kos. Langkah pertama: uji coba 2 minggu di satu warung, catat order harian, lalu tawarkan ke 3 warung tetangga kalau angkanya masuk akal.',
    },
  ]
}

const penilaianBagus: PenilaianAI = {
  skorIdeasi: 82,
  skorIsi: 78,
  skorHarapan: 85,
  skorTotal: 82,
  ringkasan:
    'Jawaban konsisten dengan isi Unggahan: angka 60:40 dijelaskan dengan alasan biaya yang masuk akal, asal ide teridentifikasi jelas, dan rencana lanjutan konkret (uji 2 minggu di satu warung). Keyakinan sedang-tinggi; Guru tetap penilai utama.',
}

const penilaianRagu: PenilaianAI = {
  skorIdeasi: 55,
  skorIsi: 48,
  skorHarapan: 60,
  skorTotal: 54,
  ringkasan:
    'Jawaban umum dan minim detail spesifik dari Unggahan: angka bagi hasil tidak dijelaskan, asal ide kabur ("dari internet"), dan rencana lanjutan tidak konkret. Disarankan Guru memeriksa langsung bagian 3 dan 4 Unggahan.',
}

// --- Daftar Tugas ------------------------------------------------------------

export const mockTugas: TugasItem[] = [
  {
    id: 'tgs-01',
    token: 'ekonomi-kreatif-8f2k',
    brief:
      'Tugas 1 — Gagasan usaha kreatif di sekitar kampus. Tulis esai 3–5 halaman: masalah yang diamati, gagasan usaha, skema kerja sama, dan rencana uji coba 2 minggu. Format PDF atau PPT, maksimal 2 MB.',
    fileTypes: ['pdf', 'ppt'],
    maxBytes: 2_000_000,
    deadlineAt: iso(now + 6 * HARI),
    sesiMinutes: 10,
    questionsPerType: 1,
    createdAt: iso(now - 9 * HARI),
    muridCount: 4,
    pelanggaranCount: 3,
  },
  {
    id: 'tgs-02',
    token: 'umkm-digital-3q9a',
    brief:
      'Tugas 2 — Rencana digitalisasi satu UMKM. Buat slide presentasi 8–12 slide: profil usaha, masalah operasional, solusi digital yang diusulkan, dan perkiraan biaya. Format PPT saja, maksimal 2 MB.',
    fileTypes: ['ppt'],
    maxBytes: 2_000_000,
    deadlineAt: iso(now + 9 * JAM),
    sesiMinutes: 10,
    questionsPerType: 1,
    createdAt: iso(now - 5 * HARI),
    muridCount: 3,
    pelanggaranCount: 6,
  },
  {
    id: 'tgs-03',
    token: 'rantai-pasok-7m4d',
    brief:
      'Tugas 3 (arsip) — Analisis rantai pasok kantin kampus. Sudah lewat batas waktu; hanya untuk arsip bukti integritas semester lalu.',
    fileTypes: ['pdf'],
    maxBytes: 2_000_000,
    deadlineAt: iso(now - 12 * HARI),
    sesiMinutes: 15,
    questionsPerType: 1,
    createdAt: iso(now - 40 * HARI),
    muridCount: 2,
    pelanggaranCount: 0,
  },
]

// --- Peserta + riwayat Percobaan -----------------------------------------------

function riwayat(
  sessionId: string,
  attemptNo: number,
  status: AttemptSummary['status'],
  mulaiJamLalu: number,
  durasiMenit: number | null,
  pelanggaranCount: number,
): AttemptSummary {
  const mulai = now - mulaiJamLalu * JAM
  return {
    sessionId,
    attemptNo,
    status,
    dimulaiAt: iso(mulai),
    dikumpulAt: durasiMenit == null ? null : iso(mulai + durasiMenit * MENIT),
    pelanggaranCount,
  }
}

export const mockParticipants: Record<string, Participant[]> = {
  'tgs-01': [
    {
      muridId: 'm-ana',
      nama: 'Ana Pratiwi',
      email: 'ana.pratiwi@mail.com',
      sessionId: 'sesi-ana-2',
      attemptNo: 2,
      status: 'submitted',
      pelanggaranCount: 1,
      terakhirAktif: iso(now - 2 * JAM),
      riwayat: [
        riwayat('sesi-ana-1', 1, 'auto_submitted', 30, 4, 3),
        riwayat('sesi-ana-2', 2, 'submitted', 3, 9, 1),
      ],
    },
    {
      muridId: 'm-bima',
      nama: 'Bima Saputra',
      email: 'bima.s@mail.com',
      sessionId: 'sesi-bima-1',
      attemptNo: 1,
      status: 'answering',
      pelanggaranCount: 2,
      terakhirAktif: iso(now - 12 * MENIT),
      riwayat: [riwayat('sesi-bima-1', 1, 'answering', 0.4, null, 2)],
    },
    {
      muridId: 'm-citra',
      nama: 'Citra Lestari',
      email: 'citra.l@mail.com',
      sessionId: 'sesi-citra-1',
      attemptNo: 1,
      status: 'auto_submitted',
      pelanggaranCount: 5,
      terakhirAktif: iso(now - 26 * JAM),
      riwayat: [riwayat('sesi-citra-1', 1, 'auto_submitted', 26, 6, 5)],
    },
    {
      muridId: 'm-danu',
      nama: 'Danu Firmansyah',
      email: 'danu.f@mail.com',
      sessionId: 'sesi-danu-1',
      attemptNo: 1,
      status: 'created',
      pelanggaranCount: 0,
      terakhirAktif: iso(now - 50 * MENIT),
      riwayat: [riwayat('sesi-danu-1', 1, 'created', 1, null, 0)],
    },
  ],
  'tgs-02': [
    {
      muridId: 'm-eka',
      nama: 'Eka Nugroho',
      email: 'eka.n@mail.com',
      sessionId: 'sesi-eka-1',
      attemptNo: 1,
      status: 'generating',
      pelanggaranCount: 0,
      terakhirAktif: iso(now - 4 * MENIT),
      riwayat: [riwayat('sesi-eka-1', 1, 'generating', 0.1, null, 0)],
    },
    {
      muridId: 'm-fajar',
      nama: 'Fajar Ramadhan',
      email: 'fajar.r@mail.com',
      sessionId: 'sesi-fajar-1',
      attemptNo: 1,
      status: 'submitted',
      pelanggaranCount: 4,
      terakhirAktif: iso(now - 7 * JAM),
      riwayat: [riwayat('sesi-fajar-1', 1, 'submitted', 8, 10, 4)],
    },
    {
      muridId: 'm-gita',
      nama: 'Gita Amelia',
      email: 'gita.a@mail.com',
      sessionId: 'sesi-gita-1',
      attemptNo: 1,
      status: 'answering',
      pelanggaranCount: 2,
      terakhirAktif: iso(now - 6 * MENIT),
      riwayat: [riwayat('sesi-gita-1', 1, 'answering', 0.2, null, 2)],
    },
  ],
  'tgs-03': [
    {
      muridId: 'm-hadi',
      nama: 'Hadi Gunawan',
      email: 'hadi.g@mail.com',
      sessionId: 'sesi-hadi-1',
      attemptNo: 1,
      status: 'submitted',
      pelanggaranCount: 0,
      terakhirAktif: iso(now - 13 * HARI),
      riwayat: [riwayat('sesi-hadi-1', 1, 'submitted', 13 * 24, 11, 0)],
    },
    {
      muridId: 'm-intan',
      nama: 'Intan Permata',
      email: 'intan.p@mail.com',
      sessionId: 'sesi-intan-1',
      attemptNo: 1,
      status: 'submitted',
      pelanggaranCount: 0,
      terakhirAktif: iso(now - 14 * HARI),
      riwayat: [riwayat('sesi-intan-1', 1, 'submitted', 14 * 24, 9, 0)],
    },
  ],
}

// --- Detail Sesi -----------------------------------------------------------------

export const mockSessions: Record<string, SessionDetail> = {
  'sesi-ana-2': {
    id: 'sesi-ana-2',
    tugasId: 'tgs-01',
    tugasBrief: mockTugas[0].brief,
    attemptNo: 2,
    status: 'submitted',
    murid: { nama: 'Ana Pratiwi', email: 'ana.pratiwi@mail.com' },
    dimulaiAt: iso(now - 3 * JAM),
    batasJawabAt: iso(now - 3 * JAM + 10 * MENIT),
    dikumpulAt: iso(now - 3 * JAM + 9 * MENIT),
    unggahan: {
      namaFile: 'Gagasan-Warung-Antar-Ana.pdf',
      mime: 'application/pdf',
      ukuranBytes: 1_240_512,
      diunggahAt: iso(now - 3 * JAM + 2 * MENIT),
      url: null,
    },
    pelanggaran: [
      buatPelanggaran(
        'plg-ana-1',
        'tab_switch',
        'Tab tidak terlihat selama 4 detik; Murid kembali sebelum hitung mundur habis.',
        now - 3 * JAM + 5 * MENIT,
      ),
    ],
    tanyaJawab: qaLengkap('sesi-ana-2'),
    penilaian: penilaianBagus,
    riwayat: mockParticipants['tgs-01'][0].riwayat,
  },
  'sesi-ana-1': {
    id: 'sesi-ana-1',
    tugasId: 'tgs-01',
    tugasBrief: mockTugas[0].brief,
    attemptNo: 1,
    status: 'auto_submitted',
    murid: { nama: 'Ana Pratiwi', email: 'ana.pratiwi@mail.com' },
    dimulaiAt: iso(now - 30 * JAM),
    batasJawabAt: iso(now - 30 * JAM + 10 * MENIT),
    dikumpulAt: iso(now - 30 * JAM + 4 * MENIT),
    unggahan: {
      namaFile: 'Gagasan-Warung-Antar-v1-Ana.pdf',
      mime: 'application/pdf',
      ukuranBytes: 980_112,
      diunggahAt: iso(now - 30 * JAM + 1 * MENIT),
      url: null,
    },
    pelanggaran: [
      buatPelanggaran(
        'plg-ana0-1',
        'fullscreen_exit',
        'Keluar dari layar penuh 2 kali dalam 1 menit.',
        now - 30 * JAM + 2 * MENIT,
      ),
      buatPelanggaran(
        'plg-ana0-2',
        'tab_switch',
        'Tab tidak terlihat; hitung mundur 5 detik tidak dihiraukan sehingga Sesi diakhiri otomatis dan jawaban terkirim apa adanya.',
        now - 30 * JAM + 4 * MENIT,
      ),
      buatPelanggaran(
        'plg-ana0-3',
        'window_blur',
        'Jendela kehilangan fokus tepat sebelum pengumpulan otomatis.',
        now - 30 * JAM + 4 * MENIT + 30_000,
      ),
    ],
    tanyaJawab: [
      {
        id: 'sesi-ana-1-ideasi',
        type: 'ideasi',
        question: 'Dari mana ide utama tulisan ini berasal?',
        answer: null,
      },
      {
        id: 'sesi-ana-1-isi',
        type: 'isi',
        question: 'Jelaskan alasan skema bagi hasil yang kamu pilih.',
        answer: null,
      },
      {
        id: 'sesi-ana-1-harapan',
        type: 'harapan',
        question: 'Siapa yang paling terbantu jika gagasan ini dilanjutkan?',
        answer: null,
      },
    ],
    penilaian: null,
    riwayat: mockParticipants['tgs-01'][0].riwayat,
  },
  'sesi-citra-1': {
    id: 'sesi-citra-1',
    tugasId: 'tgs-01',
    tugasBrief: mockTugas[0].brief,
    attemptNo: 1,
    status: 'auto_submitted',
    murid: { nama: 'Citra Lestari', email: 'citra.l@mail.com' },
    dimulaiAt: iso(now - 26 * JAM),
    batasJawabAt: iso(now - 26 * JAM + 10 * MENIT),
    dikumpulAt: iso(now - 26 * JAM + 6 * MENIT),
    unggahan: {
      namaFile: 'Usaha-Kreatif-Citra.pptx',
      mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ukuranBytes: 1_870_400,
      diunggahAt: iso(now - 26 * JAM + 1 * MENIT),
      url: null,
    },
    pelanggaran: [
      buatPelanggaran(
        'plg-citra-1',
        'tab_switch',
        'Tab tidak terlihat selama 3 detik; Murid kembali sebelum hitung mundur habis.',
        now - 26 * JAM + 2 * MENIT,
      ),
      buatPelanggaran(
        'plg-citra-2',
        'copy_blocked',
        'Upaya menyalin teks pada kolom jawaban diblokir.',
        now - 26 * JAM + 3 * MENIT,
      ),
      buatPelanggaran(
        'plg-citra-3',
        'paste_blocked',
        'Upaya menempel teks pada kolom jawaban diblokir.',
        now - 26 * JAM + 3 * MENIT + 20_000,
      ),
      buatPelanggaran(
        'plg-citra-4',
        'shortcut_blocked',
        'Pintasan Ctrl+Shift+I (alat pengembang) diblokir.',
        now - 26 * JAM + 4 * MENIT,
      ),
      buatPelanggaran(
        'plg-citra-5',
        'multi_tab',
        'Terdeteksi 2 tab aktif untuk Sesi yang sama; hitung mundur tidak dihiraukan sehingga Sesi diakhiri otomatis dan jawaban terkirim apa adanya.',
        now - 26 * JAM + 6 * MENIT,
      ),
    ],
    tanyaJawab: [
      {
        id: 'sesi-citra-1-ideasi',
        type: 'ideasi',
        question: 'Dari mana ide utama tulisan ini berasal? Apa yang kamu ubah dari inspirasi awalnya?',
        answer: 'Dari internet. Saya ubah sedikit bagian pembuka.',
      },
      {
        id: 'sesi-citra-1-isi',
        type: 'isi',
        question: 'Di bagian 3 kamu menulis skema 60:40. Jelaskan alasan angka itu.',
        answer: 'Karena itu yang umum dipakai.',
      },
      {
        id: 'sesi-citra-1-harapan',
        type: 'harapan',
        question: 'Jika dilanjutkan, siapa yang paling terbantu dan apa langkah pertamamu?',
        answer: null,
      },
    ],
    penilaian: penilaianRagu,
    riwayat: mockParticipants['tgs-01'][2].riwayat,
  },
  'sesi-bima-1': {
    id: 'sesi-bima-1',
    tugasId: 'tgs-01',
    tugasBrief: mockTugas[0].brief,
    attemptNo: 1,
    status: 'answering',
    murid: { nama: 'Bima Saputra', email: 'bima.s@mail.com' },
    dimulaiAt: iso(now - 24 * MENIT),
    batasJawabAt: iso(now - 24 * MENIT + 10 * MENIT),
    dikumpulAt: null,
    unggahan: {
      namaFile: 'Esai-Usaha-Bima.pdf',
      mime: 'application/pdf',
      ukuranBytes: 640_220,
      diunggahAt: iso(now - 22 * MENIT),
      url: null,
    },
    pelanggaran: [
      buatPelanggaran(
        'plg-bima-1',
        'window_blur',
        'Jendela kehilangan fokus selama 2 detik; Murid kembali sebelum hitung mundur habis.',
        now - 18 * MENIT,
      ),
      buatPelanggaran(
        'plg-bima-2',
        'context_menu_blocked',
        'Klik kanan pada halaman jawaban diblokir.',
        now - 15 * MENIT,
      ),
    ],
    tanyaJawab: qaLengkap('sesi-bima-1').map((qa) => ({ ...qa, answer: null })),
    penilaian: null,
    riwayat: mockParticipants['tgs-01'][1].riwayat,
  },
  'sesi-danu-1': {
    id: 'sesi-danu-1',
    tugasId: 'tgs-01',
    tugasBrief: mockTugas[0].brief,
    attemptNo: 1,
    status: 'created',
    murid: { nama: 'Danu Firmansyah', email: 'danu.f@mail.com' },
    dimulaiAt: iso(now - 60 * MENIT),
    batasJawabAt: null,
    dikumpulAt: null,
    unggahan: null,
    pelanggaran: [],
    tanyaJawab: [],
    penilaian: null,
    riwayat: mockParticipants['tgs-01'][3].riwayat,
  },
}

// --- Mutasi mock (agar Buat Tugas & Izin Unggah Ulang terasa nyata di demo) ----

let hitungTugas = mockTugas.length

export function buatTugasMock(input: CreateTugasInput): TugasItem {
  hitungTugas += 1
  const tugas: TugasItem = {
    id: `tgs-${String(hitungTugas).padStart(2, '0')}-demo`,
    token: `tugas-baru-${hitungTugas}-demo`,
    brief: input.brief,
    fileTypes: input.fileTypes,
    maxBytes: 2_000_000,
    deadlineAt: input.deadlineAt,
    sesiMinutes: input.sesiMinutes,
    questionsPerType: input.questionsPerType,
    createdAt: iso(Date.now()),
    muridCount: 0,
    pelanggaranCount: 0,
  }
  mockTugas.unshift(tugas)
  mockParticipants[tugas.id] = []
  return tugas
}

export function beriIzinMock(sessionId: string): SessionDetail {
  const lama = mockSessions[sessionId]
  if (!lama) throw new Error('Sesi tidak ditemukan di data mock')
  const noBaru = lama.attemptNo + 1
  const baru: SessionDetail = {
    ...lama,
    id: `${sessionId}-a${noBaru}`,
    attemptNo: noBaru,
    status: 'created',
    dimulaiAt: iso(Date.now()),
    batasJawabAt: null,
    dikumpulAt: null,
    unggahan: null,
    pelanggaran: [],
    tanyaJawab: [],
    penilaian: null,
    riwayat: [
      ...lama.riwayat,
      {
        sessionId: `${sessionId}-a${noBaru}`,
        attemptNo: noBaru,
        status: 'created',
        dimulaiAt: iso(Date.now()),
        dikumpulAt: null,
        pelanggaranCount: 0,
      },
    ],
  }
  mockSessions[baru.id] = baru
  mockSessions[sessionId] = { ...lama, riwayat: baru.riwayat }
  // Arahkan peserta ke Sesi terbaru.
  for (const daftar of Object.values(mockParticipants)) {
    const peserta = daftar.find((p) => p.sessionId === sessionId)
    if (peserta) {
      peserta.sessionId = baru.id
      peserta.attemptNo = noBaru
      peserta.status = 'created'
      peserta.pelanggaranCount = 0
      peserta.terakhirAktif = iso(Date.now())
      peserta.riwayat = baru.riwayat
      break
    }
  }
  return baru
}
