import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
import {
  buatTugas,
  daftarTugas,
  sedangModeDemo,
  type CreateTugasInput,
  type FileKind,
  type TugasItem,
} from '@/lib/guru-api'
import { cuplikanBrief, formatTanggal, untukInputTanggal } from '@/components/guru/format'
import {
  BarisSwitch,
  HitungPelanggaran,
  KerangkaGuru,
  LencanaJendela,
  Medan,
  PematahReload,
} from '@/components/guru/ui'
import { clsArea, clsInput } from '@/components/guru/gaya'
import {
  DialogPeringatan,
  Galat,
  HalamanKosong,
  Kotak,
  LabelBagian,
  Pemuat,
  Tombol,
  Toast,
} from '@/components/adw/adw'
import { Ikon } from '@/components/adw/ikon'
import { usePesanToast } from '@/components/guru/hook'

export const Route = createFileRoute('/guru/')({
  component: DaftarTugas,
})

function DaftarTugas() {
  const [tugas, setTugas] = useState<TugasItem[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [demo, setDemo] = useState(sedangModeDemo)
  const [dimuatAt, setDimuatAt] = useState<Date | null>(null)
  const [modalBuka, setModalBuka] = useState(false)
  const { pesan, tampilkan } = usePesanToast()
  const auth = useAuth()
  const navigate = useNavigate()
  const ADA_CLERK = Boolean(import.meta.env['VITE_CLERK_PUBLISHABLE_KEY'])

  useEffect(() => {
    if (!ADA_CLERK) return
    if (auth.isLoaded && !auth.isSignedIn) {
      void navigate({ to: '/masuk', search: { redirect: window.location.pathname } })
    }
  }, [ADA_CLERK, auth.isLoaded, auth.isSignedIn, navigate])

  const muat = useCallback(async () => {
    setGalat(null)
    try {
      setTugas(await daftarTugas())
      setDemo(sedangModeDemo())
      setDimuatAt(new Date())
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Tidak diketahui')
    }
  }, [])

  useEffect(() => {
    void muat()
  }, [muat])

  const sesudahBuat = (baru: TugasItem) => {
    setModalBuka(false)
    void muat()
    tampilkan(`Tugas dibuat — link siap dibagikan (${baru.token})`)
  }

  if (ADA_CLERK && !auth.isLoaded) {
    return <Pemuat teks="Memuat" />
  }
  if (ADA_CLERK && !auth.isSignedIn) return null

  return (
    <KerangkaGuru
      demo={demo}
      judul="Daftar Tugas"
      deskripsi="Buat Tugas, bagikan link ke Murid, lalu pantau siapa saja yang sudah masuk dan Pelanggaran apa yang tercatat."
      aksi={
        <Tombol gaya="saran" ikon="tambah" label="Buat Tugas" onClick={() => setModalBuka(true)} />
      }
      onMuatUlang={() => void muat()}
      dimuatAt={dimuatAt}
    >
      <PematahReload onMuat={() => void muat()} />

      {galat ? (
        <Galat pesan={galat} onUlang={() => void muat()} />
      ) : tugas == null ? (
        <Pemuat teks="Memuat daftar Tugas" />
      ) : tugas.length === 0 ? (
        <Kotak dibingkai>
          <HalamanKosong
            judul="Belum ada Tugas"
            deskripsi="Buat Tugas pertama, lalu bagikan linknya ke Murid seperti mengisi Google Forms."
            aksi={
              <Tombol
                gaya="saran"
                ikon="tambah"
                label="Buat Tugas"
                onClick={() => setModalBuka(true)}
              />
            }
          />
        </Kotak>
      ) : (
        <>
          <LabelBagian>
            {tugas.length} {tugas.length === 1 ? 'Tugas' : 'Tugas'}
          </LabelBagian>
          {/* Column view, not a scrolling table: each Tugas is one row that
              stacks its metadata instead of forcing a 720px minimum width. */}
          <Kotak>
            {tugas.map((t) => (
              <TugasBaris key={t.id} tugas={t} />
            ))}
          </Kotak>
        </>
      )}

      {modalBuka ? (
        <FormTugasBaru
          onTutup={() => setModalBuka(false)}
          onJadi={sesudahBuat}
          onGalat={(p) => tampilkan(p)}
        />
      ) : null}
      <Toast pesan={pesan?.teks ?? null} />
    </KerangkaGuru>
  )
}

function TugasBaris({ tugas }: { tugas: TugasItem }) {
  const navigate = useNavigate()
  return (
    <div className="adw-row gap-4 py-3.5">
      <button
        type="button"
        onClick={() => void navigate({ to: '/guru/tugas/$tugasId', params: { tugasId: tugas.id } })}
        className="min-w-0 flex-1 rounded-[9px] text-left"
        aria-label={`Buka detail ${cuplikanBrief(tugas.brief, 40)}`}
      >
        <p className="truncate text-[0.9375rem] font-medium">
          {cuplikanBrief(tugas.brief, 96)}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] adw-dim">
          <span className="angka inline-flex items-center gap-1">
            <Ikon nama="orang" ukuran={13} />
            {tugas.muridCount} Murid
          </span>
          <span className="angka inline-flex items-center gap-1">
            <Ikon nama="jam" ukuran={13} />
            {tugas.deadlineAt ? formatTanggal(tugas.deadlineAt) : 'Tanpa batas'}
          </span>
          <span className="hidden sm:inline">{tugas.sesiMinutes} menit per Sesi</span>
        </p>
      </button>

      <div className="flex shrink-0 items-center gap-2">
        <span className="hidden md:block">
          <LencanaJendela deadlineAt={tugas.deadlineAt} />
        </span>
        <HitungPelanggaran n={tugas.pelanggaranCount} />
        <Tombol
          aria-label={`Buka detail Tugas: ${cuplikanBrief(tugas.brief, 40)}`}
          title="Buka detail"
          ikon="maju"
          onClick={() => void navigate({ to: '/guru/tugas/$tugasId', params: { tugasId: tugas.id } })}
        />
      </div>
    </div>
  )
}

function FormTugasBaru({
  onTutup,
  onJadi,
  onGalat,
}: {
  onTutup: () => void
  onJadi: (t: TugasItem) => void
  onGalat: (pesan: string) => void
}) {
  const [brief, setBrief] = useState('')
  const [pdf, setPdf] = useState(true)
  const [ppt, setPpt] = useState(true)
  const [deadline, setDeadline] = useState(() =>
    untukInputTanggal(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()),
  )
  const [durasi, setDurasi] = useState('10')
  const [jumlahSoal, setJumlahSoal] = useState('1')
  const [menyimpan, setMenyimpan] = useState(false)

  // The affirmative button stays insensitive until the required options exist,
  // rather than becoming an error message after a click (HIG, Buttons).
  const valid = brief.trim().length >= 20 && (pdf || ppt)

  const simpan = async () => {
    if (!valid) return
    const fileTypes: FileKind[] = [
      ...(pdf ? (['pdf'] as const) : []),
      ...(ppt ? (['ppt'] as const) : []),
    ]
    const input: CreateTugasInput = {
      brief: brief.trim(),
      fileTypes,
      deadlineAt: deadline ? new Date(deadline).toISOString() : null,
      sesiMinutes: Math.max(1, Number(durasi) || 10),
      questionsPerType: Math.max(1, Number(jumlahSoal) || 1),
    }
    setMenyimpan(true)
    try {
      onJadi(await buatTugas(input))
    } catch (err) {
      onGalat(err instanceof Error ? err.message : 'Gagal membuat Tugas')
      setMenyimpan(false)
    }
  }

  return (
    <DialogPeringatan
      terbuka
      judul="Buat Tugas baru"
      labelKonfirmasi="Buat Tugas"
      sibuk={menyimpan}
      formId="form-tugas"
      onBatal={onTutup}
      onKonfirmasi={() => void simpan()}
    >
      <form
        id="form-tugas"
        onSubmit={(e) => {
          e.preventDefault()
          void simpan()
        }}
        className="space-y-5"
      >
        <Medan
          label="Brief / perintah Tugas"
          htmlFor="tugas-brief"
          petunjuk="Ditampilkan ke Murid sebelum masuk Sesi. Kalimat pertama menjadi judul di Daftar Tugas."
        >
          <textarea
            id="tugas-brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={4}
            placeholder="Contoh: Tulis esai 3–5 halaman tentang gagasan usaha kreatif di sekitar kampus…"
            className={clsArea}
            aria-invalid={brief.length > 0 && brief.trim().length < 20 ? 'true' : undefined}
          />
        </Medan>
        {brief.length > 0 && brief.trim().length < 20 ? (
          <p role="alert" className="-mt-3 text-[0.8125rem] text-error-text">
            Brief masih kurang dari 20 karakter — tulis perintah Tugas minimal satu kalimat.
          </p>
        ) : null}

        <div>
          <span className="mb-1.5 block text-[0.875rem] font-medium">
            Tipe berkas yang diterima
          </span>
          <Kotak dibingkai>
            <BarisSwitch
              label="PDF"
              keterangan="Dokumen cetak dan laporan"
              checked={pdf}
              onChange={setPdf}
            />
            <BarisSwitch
              label="PPT"
              keterangan="Presentasi dan slide"
              checked={ppt}
              onChange={setPpt}
            />
          </Kotak>
          <p className="adw-caption adw-dim mt-1.5">
            Batas ukuran berkas tetap 2 MB.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Medan label="Batas waktu" htmlFor="tugas-deadline">
            <input
              id="tugas-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className={clsInput}
            />
          </Medan>
          <Medan label="Durasi Sesi (menit)" htmlFor="tugas-durasi">
            <input
              id="tugas-durasi"
              type="number"
              min={1}
              max={120}
              value={durasi}
              onChange={(e) => setDurasi(e.target.value)}
              className={`${clsInput} angka`}
            />
          </Medan>
          <Medan label="Soal per tipe" htmlFor="tugas-soal">
            <input
              id="tugas-soal"
              type="number"
              min={1}
              max={5}
              value={jumlahSoal}
              onChange={(e) => setJumlahSoal(e.target.value)}
              className={`${clsInput} angka`}
            />
          </Medan>
        </div>
      </form>
    </DialogPeringatan>
  )
}
