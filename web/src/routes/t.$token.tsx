import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'

import {
  ApiError,
  BATAS_UNGGAHAN_DEFAULT,
  ambilTugas,
  formatBytes,
  mulaiSesi,
  type TugasPratinjau,
} from '@/lib/murid-api.ts'
import { DialogKonfirmasi } from '@/components/murid/DialogKonfirmasi.tsx'
import { GerbangLaptop } from '@/components/murid/MobileGate.tsx'
import { useLayarSempit } from '@/components/murid/useLayarSempit.ts'

import { formatTanggalJam, labelTipeFile } from '@/components/murid/format.ts'
import { Banner, Kotak, Pemuat, Properti, Tombol } from '@/components/adw/adw'
import { Ikon } from '@/components/adw/ikon'

export const Route = createFileRoute('/t/$token')({
  component: PratinjauTugas,
})

type StatusMuat = 'memuat' | 'siap' | 'galat'

function PratinjauTugas() {
  const { token } = Route.useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const sempit = useLayarSempit()
  const ADA_CLERK = Boolean(import.meta.env['VITE_CLERK_PUBLISHABLE_KEY'])

  const [status, setStatus] = useState<StatusMuat>('memuat')
  const [galat, setGalat] = useState<string | null>(null)
  const [tugas, setTugas] = useState<TugasPratinjau | null>(null)
  const [konfirmasi, setKonfirmasi] = useState(false)
  const [sibuk, setSibuk] = useState(false)
  const [sesiAktif, setSesiAktif] = useState<string | null>(null)

  useEffect(() => {
    let batal = false
    setStatus('memuat')
    ambilTugas(token)
      .then((data) => {
        if (batal) return
        setTugas(data)
        setStatus('siap')
      })
      .catch((error: unknown) => {
        if (batal) return
        setGalat(error instanceof Error ? error.message : 'Gagal memuat Tugas.')
        setStatus('galat')
      })
    return () => {
      batal = true
    }
  }, [token])

  const mulai = async () => {
    if (!tugas) return
    setSibuk(true)
    try {
      const sesi = await mulaiSesi(tugas.id)
      setKonfirmasi(false)
      await navigate({ to: '/sesi/$sessionId', params: { sessionId: sesi.id } })
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setSesiAktif(sessionIdDariError(error))
        setKonfirmasi(false)
        return
      }
      setGalat(error instanceof Error ? error.message : 'Gagal memulai Sesi.')
    } finally {
      setSibuk(false)
    }
  }

  if (sempit) return <GerbangLaptop judul="Sesi terkunci hanya berjalan di laptop." />

  if (status === 'memuat') return <Pemuat teks="Memuat Tugas" />

  if (status === 'galat' || !tugas) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
        <Ikon nama="peringatan" ukuran={44} className="text-error-text" />
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Tugas tidak bisa dibuka</h1>
        <p className="mt-2 text-pretty text-adw-dim">{galat}</p>
        <p className="mt-2 text-pretty text-adw-dim">
          Periksa lagi tautan yang kamu terima dari Guru — kode Tasks setelah /t/
          juga bisa ditempel langsung.
        </p>
      </main>
    )
  }

  const lewatDeadline =
    tugas.deadline_at !== null && new Date(tugas.deadline_at).getTime() < Date.now()
  const maksBytes = tugas.max_bytes || BATAS_UNGGAHAN_DEFAULT
  const tipeFile = tugas.file_types.length > 0 ? tugas.file_types : ['application/pdf']
  const durasiMenit = tugas.sesi_minutes

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="text-[2rem] leading-tight font-bold tracking-tight text-balance">
        Tugas dari Guru
      </h1>
      <p className="mt-4 text-[1.05rem] leading-relaxed text-pretty whitespace-pre-line">
        {tugas.brief}
      </p>

      <Kotak className="mt-7 px-5 py-1">
        <dl className="divide-y divide-shade-strong">
          <Properti
            ikon="berkas"
            nama="Format berkas"
            nilai={tipeFile.map(labelTipeFile).join(' / ')}
          />
          <Properti ikon="berkas" nama="Ukuran maksimum" nilai={formatBytes(maksBytes)} />
          <Properti
            ikon="jam"
            nama="Batas akhir"
            nilai={formatTanggalJam(tugas.deadline_at)}
          />
          <Properti
            ikon="jam"
            nama="Waktu menjawab"
            nilai={`${durasiMenit} menit, dihitung setelah Unggahan diterima`}
          />
          <Properti
            ikon="daftar"
            nama="Jumlah Pertanyaan"
            nilai={`${tugas.questions_per_type * 3} butir`}
          />
        </dl>
      </Kotak>

      {/* Persistent state about this specific Tugas, so it belongs in a banner
          rather than a paragraph: it does not go away and the Guru needs the
          Murid to have read it. */}
      <div className="mt-5">
        <Banner>
          <strong>Unggahan hanya bisa dikirim satu kali.</strong> Tidak ada tombol
          hapus atau ganti — kalau berkasnya salah, Sesi tetap tercatat sebagai
          percobaan yang gagal.
        </Banner>
      </div>
      <div className="mt-2.5">
        <Banner nada="info" ikon="gembok">
          Selama Sesi kamu wajib berada di mode layar penuh. Berpindah tab,
          kehilangan fokus, atau keluar layar penuh memberi hitung mundur 5 detik
          sebelum Sesi dikunci dan jawaban dikirim otomatis.
        </Banner>
      </div>

      {galat ? (
        <p role="alert" className="mt-5 text-[0.9375rem] text-pretty text-error-text">
          {galat}
        </p>
      ) : null}

      {sesiAktif ? (
        <div className="mt-5">
          <Banner nada="info" ikon="jam" aksi={
            <Tombol
              label="Lanjutkan Sesi"
              onClick={() =>
                void navigate({ to: '/sesi/$sessionId', params: { sessionId: sesiAktif } })
              }
            />
          }>
            Kamu sudah punya Sesi yang belum selesai untuk Tugas ini.
          </Banner>
        </div>
      ) : null}

      {lewatDeadline ? (
        <div className="mt-6">
          <Banner nada="galat">
            Batas waktu Tugas ini sudah lewat. Hubungi Guru.
          </Banner>
        </div>
      ) : (
        <div className="mt-8">
          {!ADA_CLERK ? (
            <Tombol
              gaya="pill"
              label="Mulai Sesi"
              onClick={() => setKonfirmasi(true)}
              lebar
              className="!min-h-12 !text-[1.05rem]"
            />
          ) : !auth.isLoaded ? (
            <Pemuat teks="Memuat" />
          ) : !auth.isSignedIn ? (
            <Tombol
              gaya="pill"
              label="Masuk untuk mulai Sesi"
              onClick={() => void navigate({ to: '/masuk', search: { redirect: `/t/${token}` } })}
              lebar
              className="!min-h-12 !text-[1.05rem]"
            />
          ) : (
            <Tombol
              gaya="pill"
              label="Mulai Sesi"
              onClick={() => setKonfirmasi(true)}
              lebar
              className="!min-h-12 !text-[1.05rem]"
            />
          )}
        </div>
      )}

      <DialogKonfirmasi
        terbuka={konfirmasi}
        judul="Mulai Sesi terkunci?"
        labelKonfirmasi="Ya, mulai Sesi"
        sibuk={sibuk}
        onBatal={() => setKonfirmasi(false)}
        onKonfirmasi={() => void mulai()}
      >
        <p>
          Kamu akan masuk mode layar penuh dan diminta mengunggah Unggahan sekali
          saja. Timer {durasiMenit} menit baru berjalan setelah berkas diterima.
        </p>
        <p>Pastikan tidak ada aplikasi lain yang perlu kamu buka saat itu.</p>
      </DialogKonfirmasi>
    </main>
  )
}

/** Server bisa menyertakan id Sesi aktif pada 409; dipakai bila ada. */
function sessionIdDariError(error: ApiError): string | null {
  const data = error.data
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    const kandidat = record['session_id'] ?? record['sessionId'] ?? record['id']
    if (typeof kandidat === 'string' && kandidat.length > 0) return kandidat
  }
  return null
}
