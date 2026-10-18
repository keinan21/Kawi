import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import type { PelanggaranType, QuestionType, SessionStatus } from '@lms/shared'

import {
  ApiError,
  ambilPertanyaan,
  ambilSesi,
  ambilStatusSesi,
  kirimJawaban,
  kirimPelanggaran,
  unggahUnggahan,
  type JawabanInput,
  type PertanyaanMurid,
  type Sesi,
} from '@/lib/murid-api.ts'
import { adalahLive, IngestClient, ProctorSession } from '@/proctor/index.ts'
import { DialogKonfirmasi } from '@/components/murid/DialogKonfirmasi.tsx'
import { GerbangFullscreen } from '@/components/murid/GerbangFullscreen.tsx'
import { GerbangLaptop } from '@/components/murid/MobileGate.tsx'
import { useLayarSempit } from '@/components/murid/useLayarSempit.ts'
import { KartuPertanyaan } from '@/components/murid/KartuPertanyaan.tsx'
import { LayarGenerating } from '@/components/murid/LayarGenerating.tsx'
import { LayarTerminal } from '@/components/murid/LayarTerminal.tsx'
import { TanggaMurid } from '@/components/murid/TanggaMurid.tsx'
import { TimerJawaban } from '@/components/murid/TimerJawaban.tsx'
import { ViolationCountdown } from '@/components/murid/ViolationCountdown.tsx'
import { ZonaUnggah } from '@/components/murid/ZonaUnggah.tsx'
import { HeaderBar, Kotak, Lencana, Pemuat, Tombol } from '@/components/adw/adw'
import { Ikon } from '@/components/adw/ikon'

export const Route = createFileRoute('/sesi/$sessionId')({
  component: SesiMurid,
})

/** Durasi jawaban fallback bila `timer_ends_at` tidak dikirim server. */
const DURASI_JAWABAN_MS = 10 * 60_000
const URUTAN_TIPE: QuestionType[] = ['ideasi', 'isi', 'harapan']

interface CountdownAktif {
  type: PelanggaranType
  detail: string
}

function SesiMurid() {
  const { sessionId } = Route.useParams()
  const sempit = useLayarSempit()

  const [sesi, setSesi] = useState<Sesi | null>(null)
  const [status, setStatus] = useState<SessionStatus>('created')
  const [statusPaksa, setStatusPaksa] = useState<SessionStatus | null>(null)
  const [memuat, setMemuat] = useState(true)
  const [galat, setGalat] = useState<string | null>(null)
  const [berhenti, setBerhenti] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)

  const [file, setFile] = useState<File | null>(null)
  const [dialog, setDialog] = useState<'unggah' | 'kirim' | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [dialogBerkas, setDialogBerkas] = useState(false)

  const [pertanyaan, setPertanyaan] = useState<PertanyaanMurid[]>([])
  const [jawaban, setJawaban] = useState<Record<string, string>>({})
  const [galatJawaban, setGalatJawaban] = useState<string | null>(null)
  const [mulaiGenerating, setMulaiGenerating] = useState(() => Date.now())

  const [countdown, setCountdown] = useState<CountdownAktif | null>(null)
  const [pemberitahuan, setPemberitahuan] = useState<string | null>(null)

  const sessionRef = useRef<ProctorSession | null>(null)
  const ingestRef = useRef<IngestClient | null>(null)

  const statusBerjalan = statusPaksa ?? status

  // --------------------------------------------------------------- pemuatan
  useEffect(() => {
    let batal = false
    setMemuat(true)
    ambilSesi(sessionId)
      .then((data) => {
        if (batal) return
        if (!data) {
          setGalat('Sesi tidak ditemukan atau sudah tidak bisa diakses.')
          return
        }
        setSesi(data)
        setStatus(data.status)
        if (data.status === 'generating') setMulaiGenerating(Date.now())
      })
      .catch((error: unknown) => {
        if (batal) return
        setGalat(error instanceof Error ? error.message : 'Gagal memuat Sesi.')
      })
      .finally(() => {
        if (!batal) setMemuat(false)
      })
    return () => {
      batal = true
    }
  }, [sessionId])

  // ------------------------------------------------- proctor + violation ingest
  const tandaiSesiSelesai = useCallback(() => {
    setCountdown(null)
    setStatusPaksa('auto_submitted')
  }, [])

  const onViolation = useCallback((type: PelanggaranType, detail: string) => {
    if (adalahLive(type)) {
      setCountdown({ type, detail })
      return
    }
    setPemberitahuan(detail)
  }, [])

  useEffect(() => {
    const proctor = new ProctorSession({ onViolation })
    const ingest = new IngestClient({
      sessionId,
      send: async (id, batch) => {
        try {
          await kirimPelanggaran(id, batch)
        } catch (error) {
          // 409/410/423 = Sesi sudah dikunci server → tampilkan status terminal.
          if (error instanceof ApiError && [409, 410, 423].includes(error.status)) {
            tandaiSesiSelesai()
          }
          throw error
        }
      },
    })
    proctor.attachIngest(ingest)
    sessionRef.current = proctor
    ingestRef.current = ingest

    return () => {
      proctor.stop()
      ingest.stop()
      sessionRef.current = null
      ingestRef.current = null
    }
  }, [onViolation, sessionId, tandaiSesiSelesai])

  // Proctor aktif setelah layar penuh diberikan (created) atau langsung pada
  // status lanjutan — DESIGN.md §7.
  useEffect(() => {
    const proctor = sessionRef.current
    if (!proctor) return
    if (fullscreen || statusBerjalan !== 'created') proctor.start()
  }, [fullscreen, statusBerjalan])

  // Suppression guard: countdown aktif atau dialog berkas terbuka.
  useEffect(() => {
    sessionRef.current?.setSuppressed(countdown !== null || dialogBerkas)
  }, [countdown, dialogBerkas])

  useEffect(() => {
    if (!pemberitahuan) return
    const id = window.setTimeout(() => setPemberitahuan(null), 4_000)
    return () => window.clearTimeout(id)
  }, [pemberitahuan])

  // --------------------------------------- poll status (generating/answering)
  const cekStatus = useCallback(async (): Promise<SessionStatus> => {
    const baru = await ambilStatusSesi(sessionId)
    setStatus(baru)
    return baru
  }, [sessionId])

  useEffect(() => {
    if (statusBerjalan !== 'generating' && statusBerjalan !== 'answering') return
    const id = window.setInterval(() => {
      void cekStatus().catch(() => undefined)
    }, statusBerjalan === 'generating' ? 3_000 : 10_000)
    return () => window.clearInterval(id)
  }, [statusBerjalan, cekStatus])

  // Poll Pertanyaan saat masih `generating` (DESIGN.md §5).
  useEffect(() => {
    if (statusBerjalan !== 'generating') return
    const id = window.setInterval(() => {
      void ambilPertanyaan(sessionId)
        .then((list) => {
          if (list.length >= 3) setPertanyaan(urut(list))
        })
        .catch(() => undefined)
    }, 6_000)
    return () => window.clearInterval(id)
  }, [statusBerjalan, sessionId])

  useEffect(() => {
    if (statusBerjalan !== 'answering') return
    let batal = false
    void ambilPertanyaan(sessionId)
      .then((list) => {
        if (!batal) setPertanyaan(urut(list))
      })
      .catch((error: unknown) => {
        if (!batal) setGalatJawaban(pesan(error))
      })
    return () => {
      batal = true
    }
  }, [statusBerjalan, sessionId])

  // ----------------------------------------------------------- timer jawaban
  const [berakhir, setBerakhir] = useState<number | null>(null)
  useEffect(() => {
    if (statusBerjalan !== 'answering') return
    const dariServer = sesi?.timer_ends_at ? Date.parse(sesi.timer_ends_at) : Number.NaN
    if (Number.isNaN(dariServer)) {
      // Celah kontrak: §5 tidak menyertakan timer_ends_at untuk Murid.
      console.warn('[sesi] timer_ends_at tidak tersedia, memakai estimasi klien')
      setBerakhir(Date.now() + DURASI_JAWABAN_MS)
    } else {
      setBerakhir(dariServer)
    }
  }, [statusBerjalan, sesi?.timer_ends_at])

  const setelahHitungMundur = useCallback(async () => {
    ingestRef.current?.flush()
    for (let i = 0; i < 5; i += 1) {
      try {
        const baru = await cekStatus()
        if (baru === 'auto_submitted' || baru === 'submitted') {
          setStatusPaksa(baru)
          return
        }
      } catch {
        break
      }
      await jeda(2_000)
    }
    setBerhenti(true)
  }, [cekStatus])

  const onWaktuHabis = useCallback(() => {
    void setelahHitungMundur()
  }, [setelahHitungMundur])

  // ------------------------------------------------------------------ aksi
  const unggah = async () => {
    if (!file) return
    setSibuk(true)
    try {
      const hasil = await unggahUnggahan(sessionId, file)
      if (hasil) setSesi(hasil)
      setMulaiGenerating(Date.now())
      setStatus('generating')
      setDialog(null)
      setBerakhir(null)
    } catch (error) {
      setGalat(pesan(error))
      setDialog(null)
    } finally {
      setSibuk(false)
    }
  }

  const kirim = async () => {
    setGalatJawaban(null)
    const kosong = pertanyaan.filter((p) => (jawaban[p.id] ?? '').trim().length === 0)
    if (kosong.length > 0) {
      setGalatJawaban('Semua Pertanyaan harus dijawab sebelum dikirim.')
      return
    }
    const payload: JawabanInput[] = pertanyaan.map((p) => ({
      pertanyaan_id: p.id,
      text: jawaban[p.id] ?? '',
    }))

    setSibuk(true)
    try {
      await kirimJawaban(sessionId, payload)
      setDialog(null)
      setStatusPaksa('submitted')
    } catch (error) {
      setGalatJawaban(pesan(error))
      setDialog(null)
    } finally {
      setSibuk(false)
    }
  }

  const masukFullscreen = useCallback(() => {
    setFullscreen(true)
  }, [])

  const kembaliFullscreen = useCallback(() => setCountdown(null), [])

  const terisiSemua = useMemo(
    () => pertanyaan.length > 0 && pertanyaan.every((p) => (jawaban[p.id] ?? '').trim().length > 0),
    [pertanyaan, jawaban],
  )

  const dijawab = useMemo(
    () => pertanyaan.filter((p) => (jawaban[p.id] ?? '').trim().length > 0).length,
    [pertanyaan, jawaban],
  )

  // ----------------------------------------------------------------- render
  if (sempit) return <GerbangLaptop judul="Sesi terkunci hanya berjalan di laptop." />

  if (memuat) return <Pemuat teks="Memuat Sesi" />

  if (galat && !sesi) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <Ikon nama="peringatan" ukuran={44} className="text-error-text" />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Sesi tidak bisa dibuka</h1>
        <p className="mt-2 text-pretty text-adw-dim">{galat}</p>
      </main>
    )
  }

  if (statusBerjalan === 'submitted' || statusBerjalan === 'auto_submitted') {
    return <LayarTerminal status={statusBerjalan} attemptNo={sesi?.attempt_no} />
  }

  if (berhenti) return <LayarSesiBerhenti />

  if (statusBerjalan === 'created' && !fullscreen) {
    return <GerbangFullscreen onMasuk={masukFullscreen} />
  }

  const tahap = statusBerjalan === 'created' ? 2 : statusBerjalan === 'answering' ? 3 : 2

  return (
    <div className="flex min-h-dvh flex-col bg-window">
      <HeaderBar
        judul={<span className="truncate">Sesi terkunci</span>}
        awal={<TanggaMurid tahap={tahap} />}
        aksen={
          <Lencana nada="netral" ikon="gembok">
            <span className="hidden sm:inline">Terkunci</span>
            <span className="sr-only sm:hidden">Sesi terkunci</span>
          </Lencana>
        }
      >
        {/* Thin progress bar on the header bar's lower edge: the HIG pattern for
            background progress. Answering is the only stage with a clock, so the
            bar appears only when there is something left to count down. */}
        {statusBerjalan === 'answering' && berakhir ? (
          <TimerJawaban
            berakhir={berakhir}
            total={DURASI_JAWABAN_MS}
            onHabis={onWaktuHabis}
          />
        ) : null}
      </HeaderBar>

      {countdown ? (
        <ViolationCountdown
          detail={countdown.detail}
          onKembali={kembaliFullscreen}
          onExpired={() => void setelahHitungMundur()}
        />
      ) : null}

      {pemberitahuan ? (
        <div
          role="status"
          className="adw-entrance adw-osd fixed bottom-6 left-1/2 z-30 flex max-w-[min(32rem,calc(100vw-3rem))] -translate-x-1/2 items-center gap-2 rounded-[15px] px-4 py-2.5 text-pretty text-[0.9375rem]"
        >
          <Ikon nama="info" ukuran={15} className="flex-none" />
          {pemberitahuan}
        </div>
      ) : null}

      {statusBerjalan === 'created' ? (
        <LayarUnggah
          file={file}
          onPilih={setFile}
          onDialogBerkas={setDialogBerkas}
          onKirim={() => setDialog('unggah')}
        />
      ) : null}

      {statusBerjalan === 'generating' ? (
        <LayarGenerating mulai={mulaiGenerating} />
      ) : null}

      {statusBerjalan === 'answering' ? (
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-7 sm:px-6">
          <h1 className="text-[1.7rem] leading-tight font-bold tracking-tight">
            Jawab Pertanyaan
          </h1>
          <p className="mt-1.5 text-pretty text-adw-dim">
            Tiga Pertanyaan ini disusun dari isi Unggahanmu. Jawab dengan kalimatmu
            sendiri — jawaban yang tidak nyambung dengan karyamu akan terlihat saat
            penilaian.
          </p>

          <div className="mt-6 space-y-4">
            {pertanyaan.map((p, i) => (
              <KartuPertanyaan
                key={p.id}
                nomor={i + 1}
                tipe={p.type}
                text={p.text}
                nilai={jawaban[p.id] ?? ''}
                onUbah={(v) => setJawaban((lama) => ({ ...lama, [p.id]: v }))}
              />
            ))}
          </div>

          {pertanyaan.length === 0 ? (
            <p className="mt-6 text-pretty text-adw-dim">
              Pertanyaan belum siap. Tunggu sebentar — halaman akan memuat ulang
              sendiri.
            </p>
          ) : null}

          {galatJawaban ? (
            <p
              role="alert"
              className="mt-5 flex items-start gap-2 text-[0.9375rem] text-pretty text-error-text"
            >
              <Ikon nama="peringatan" ukuran={15} className="mt-0.5 flex-none" />
              {galatJawaban}
            </p>
          ) : null}

          <Kotak className="mt-6 flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="angka text-[0.9375rem] font-medium">
                {dijawab} dari {pertanyaan.length || 3} Pertanyaan terjawab
              </p>
              <p className="adw-caption adw-dim mt-0.5 text-pretty">
                {terisiSemua
                  ? 'Semua Pertanyaan sudah terisi. Jawaban yang dikirim tidak bisa diubah.'
                  : 'Isi ketiga Pertanyaan dulu sebelum mengirim.'}
              </p>
            </div>
            <Tombol
              gaya="saran"
              label="Kirim jawaban"
              onClick={() => setDialog('kirim')}
              nonaktif={!terisiSemua}
              className="!min-h-11 !px-6 !text-[0.9375rem]"
            />
          </Kotak>
        </main>
      ) : null}

      <DialogKonfirmasi
        terbuka={dialog === 'unggah'}
        judul="Unggah sekali saja"
        labelKonfirmasi="Unggah & kunci Unggahan"
        merusak
        sibuk={sibuk}
        onBatal={() => setDialog(null)}
        onKonfirmasi={() => void unggah()}
      >
        <p>
          Setelah diunggah tidak bisa diulang kecuali izin Guru. Berkas yang salah
          tetap tercatat sebagai percobaan yang gagal.
        </p>
        <p>
          Timer {DURASI_JAWABAN_MS / 60_000} menit mulai berjalan begitu Unggahan
          diterima.
        </p>
      </DialogKonfirmasi>

      <DialogKonfirmasi
        terbuka={dialog === 'kirim'}
        judul="Kirim jawaban?"
        labelKonfirmasi="Kirim sekarang"
        sibuk={sibuk}
        onBatal={() => setDialog(null)}
        onKonfirmasi={() => void kirim()}
      >
        <p>Jawaban yang sudah dikirim tidak bisa diubah.</p>
        <p>Kalau waktu habis duluan, jawaban tetap terkirim apa adanya.</p>
      </DialogKonfirmasi>
    </div>
  )
}

// --------------------------------------------------------------- sub-layar
function LayarUnggah({
  file,
  onPilih,
  onDialogBerkas,
  onKirim,
}: {
  file: File | null
  onPilih: (file: File) => void
  onDialogBerkas: (aktif: boolean) => void
  onKirim: () => void
}) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-[2rem] leading-tight font-bold tracking-tight">Unggah karyamu</h1>
      <p className="mt-2.5 text-pretty text-adw-dim">
        Berkas PDF atau PPT, maksimal 2 MB. Sekali diunggah, berkas tidak bisa
        diganti.
      </p>

      <div className="mt-6">
        <ZonaUnggah
          tipeDiizinkan={['application/pdf', 'application/vnd.ms-powerpoint', 'ppt', 'pptx']}
          maksBytes={2_000_000}
          onPilih={onPilih}
          onAktifDialog={onDialogBerkas}
        />
      </div>

      <div className="mt-7">
        <Tombol
          gaya="saran"
          label="Unggah & lanjut"
          onClick={onKirim}
          nonaktif={!file}
          lebar
          className="!min-h-12 !text-[1.05rem]"
        />
      </div>
    </main>
  )
}

function LayarSesiBerhenti() {
  return (
    <main className="grid min-h-dvh place-items-center bg-window px-6">
      <div className="max-w-md text-center">
        <Ikon nama="peringatan" ukuran={52} className="mx-auto text-error-text" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-balance">
          Sesi diakhiri sistem
        </h1>
        <p className="mt-3 text-pretty text-adw-dim">
          Pelanggaran tercatat berkali-kali sehingga Sesi dikunci sebelum jawaban
          lengkap. Kalau menurutmu ini keliru, hubungi Guru dan minta Izin Unggah
          Ulang.
        </p>
      </div>
    </main>
  )
}

// ------------------------------------------------------------------ utilitas
function urut(list: PertanyaanMurid[]): PertanyaanMurid[] {
  return [...list].sort(
    (a, b) => URUTAN_TIPE.indexOf(a.type) - URUTAN_TIPE.indexOf(b.type) || a.seq - b.seq,
  )
}

function pesan(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.'
}

function jeda(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}
