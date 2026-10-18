import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
import {
  daftarPeserta,
  detailTugas,
  sedangModeDemo,
  type Participant,
  type TugasItem,
} from '@/lib/guru-api'
import { formatBytes, formatTanggalWaktu, tautanTugas } from '@/components/guru/format'
import {
  BarisProperti,
  HitungPelanggaran,
  KerangkaGuru,
  KeTugas,
  LencanaJendela,
  LencanaStatus,
  PematahReload,
  SalinTautan,
} from '@/components/guru/ui'
import {
  Galat,
  HalamanKosong,
  Kotak,
  PemisahTampilan,
  Pemuat,
  Tombol,
} from '@/components/adw/adw'
import { LENCANA_RAIL, RelMini } from '@/components/adw/rel'
import { Ikon } from '@/components/adw/ikon'

export const Route = createFileRoute('/guru/tugas/$tugasId')({
  component: DetailTugas,
})

type Tampilan = 'murid' | 'percobaan'

function DetailTugas() {
  const { tugasId } = Route.useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const ADA_CLERK = Boolean(import.meta.env['VITE_CLERK_PUBLISHABLE_KEY'])

  useEffect(() => {
    if (!ADA_CLERK) return
    if (auth.isLoaded && !auth.isSignedIn) {
      void navigate({ to: '/masuk', search: { redirect: window.location.pathname } })
    }
  }, [ADA_CLERK, auth.isLoaded, auth.isSignedIn, navigate])

  const [tugas, setTugas] = useState<TugasItem | null>(null)
  const [peserta, setPeserta] = useState<Participant[] | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [demo, setDemo] = useState(sedangModeDemo)
  const [dimuatAt, setDimuatAt] = useState<Date | null>(null)
  const [tampilan, setTampilan] = useState<Tampilan>('murid')
  const [bukaRiwayat, setBukaRiwayat] = useState<Record<string, boolean>>({})

  const muat = useCallback(async () => {
    setGalat(null)
    try {
      const [t, p] = await Promise.all([detailTugas(tugasId), daftarPeserta(tugasId)])
      setTugas(t)
      setPeserta(p)
      setDemo(sedangModeDemo())
      setDimuatAt(new Date())
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Tidak diketahui')
    }
  }, [tugasId])

  useEffect(() => {
    void muat()
  }, [muat])

  const keSesi = (sessionId: string) =>
    void navigate({ to: '/guru/sesi/$sessionId', params: { sessionId } })

  if (ADA_CLERK && !auth.isLoaded) {
    return <Pemuat teks="Memuat detail Tugas" />
  }
  if (ADA_CLERK && !auth.isSignedIn) return null

  if (galat) {
    return (
      <KerangkaGuru demo={demo} judul="Detail Tugas">
        <Galat pesan={galat} onUlang={() => void muat()} />
      </KerangkaGuru>
    )
  }

  if (tugas == null || peserta == null) {
    return (
      <KerangkaGuru demo={demo} judul="Detail Tugas" onMuatUlang={() => void muat()}>
        <Pemuat teks="Memuat detail Tugas" />
      </KerangkaGuru>
    )
  }

  const kosong = peserta.length === 0

  return (
    <KerangkaGuru
      demo={demo}
      judul={cuplikan(tugas.brief, 48)}
      deskripsi="Perintah yang dilihat Murid, link bagikan, dan semua Percobaan yang tercatat untuk Tugas ini."
      aksi={<Tombol ikon="maju" label="Detail Sesi pertama" onClick={() => {
        const pertama = peserta[0]
        if (pertama) keSesi(pertama.sessionId)
      }} />}
      kembali={<KeTugas tugasId={tugas.id} />}
      onMuatUlang={() => void muat()}
      dimuatAt={dimuatAt}
    >
      <PematahReload onMuat={() => void muat()} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="min-w-0">
          <Kotak className="mb-6">
            <p className="px-5 py-4 text-pretty leading-relaxed whitespace-pre-line">
              {tugas.brief}
            </p>
          </Kotak>

          <div className="mb-4">
            <PemisahTampilan
              tampilan={tampilan}
              onGanti={setTampilan}
              opsi={[
                { nilai: 'murid', label: 'Murid', ikon: 'orang', jumlah: peserta.length },
                { nilai: 'percobaan', label: 'Percobaan', ikon: 'daftar' },
              ]}
            />
          </div>

          {kosong ? (
            <Kotak dibingkai>
              <HalamanKosong
                judul="Belum ada Murid yang memulai Sesi"
                deskripsi="Bagikan link Tugas di panel kanan. Setiap Murid yang masuk akan tercatat di sini lengkap dengan status Sesi dan Pelgarannya."
                ikon="orang"
              />
            </Kotak>
          ) : tampilan === 'murid' ? (
            <MuridView peserta={peserta} keSesi={keSesi} />
          ) : (
            <PercobaanView
              peserta={peserta}
              bukaRiwayat={bukaRiwayat}
              setBukaRiwayat={setBukaRiwayat}
              keSesi={keSesi}
            />
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <div>
            <h2 className="adw-label mb-2 px-1">Aturan Tugas</h2>
            <Kotak>
              <div className="divide-y divide-shade-strong">
                <BarisProperti
                  ikon="jam"
                  label="Batas waktu"
                  nilai={tugas.deadlineAt ? formatTanggalWaktu(tugas.deadlineAt) : '—'}
                />
                <BarisProperti ikon="jam" label="Durasi Sesi" nilai={`${tugas.sesiMinutes} menit`} />
                <BarisProperti
                  ikon="berkas"
                  label="Tipe berkas"
                  nilai={tugas.fileTypes.join(', ').toUpperCase()}
                />
                <BarisProperti
                  ikon="berkas"
                  label="Ukuran maksimum"
                  nilai={formatBytes(tugas.maxBytes)}
                />
                <BarisProperti
                  ikon="daftar"
                  label="Soal per tipe"
                  nilai={tugas.questionsPerType.toString()}
                />
              </div>
            </Kotak>
            <div className="mt-2 px-1">
              <LencanaJendela deadlineAt={tugas.deadlineAt} />
            </div>
          </div>

          <div>
            <h2 className="adw-label mb-2 px-1">Link untuk Murid</h2>
            <SalinTautan teks={tautanTugas(tugas.token)} />
            <p className="adw-caption adw-dim mt-2 px-1">
              Siapa pun yang punya link ini dan masuk bisa memulai satu Sesi, seperti
              mengisi Google Forms.
            </p>
          </div>
        </aside>
      </div>
    </KerangkaGuru>
  )
}

function cuplikan(brief: string, panjang: number): string {
  const satuBaris = brief.replace(/\s+/g, ' ').trim()
  return satuBaris.length <= panjang ? satuBaris : `${satuBaris.slice(0, panjang).trimEnd()}…`
}

function MuridView({
  peserta,
  keSesi,
}: {
  peserta: Participant[]
  keSesi: (id: string) => void
}) {
  return (
    <Kotak>
      {peserta.map((p) => (
        <button
          key={p.muridId}
          type="button"
          onClick={() => keSesi(p.sessionId)}
          className="adw-row adw-row--activatable gap-4 py-3.5"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.9375rem] font-medium">{p.nama}</span>
            <span className="adw-caption adw-dim mt-0.5 block truncate">{p.email}</span>
          </span>

          <span className="hidden shrink-0 items-center gap-3 sm:flex">
            <RelMini status={p.status} />
            <span className="angka adw-caption adw-dim w-28 whitespace-nowrap text-right">
              Percobaan ke-{p.attemptNo}
            </span>
          </span>

          <span className="flex shrink-0 items-center gap-2">
            <LencanaStatus status={p.status} />
            <HitungPelanggaran n={p.pelanggaranCount} />
            <Ikon nama="maju" className="adw-dim" />
          </span>
        </button>
      ))}
    </Kotak>
  )
}

function PercobaanView({
  peserta,
  bukaRiwayat,
  setBukaRiwayat,
  keSesi,
}: {
  peserta: Participant[]
  bukaRiwayat: Record<string, boolean>
  setBukaRiwayat: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  keSesi: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <p className="text-pretty text-adw-dim">
        Riwayat semua Percobaan per Murid — bukti integritas yang tidak pernah
        dihapus. Percobaan terbaru tampil duluan.
      </p>
      {peserta.map((p) => {
        const terbuka = bukaRiwayat[p.muridId] ?? false
        const [terbaru, ...lama] = [...p.riwayat].sort((a, b) => b.attemptNo - a.attemptNo)
        return (
          <Kotak key={p.muridId}>
            <button
              type="button"
              onClick={() =>
                setBukaRiwayat((s) => ({ ...s, [p.muridId]: !terbuka }))
              }
              className="adw-row adw-row--activatable"
              aria-expanded={terbuka}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-medium">{p.nama}</span>
                <span className="adw-caption adw-dim angka mt-0.5 block">
                  {p.riwayat.length} percobaan
                </span>
              </span>
              <HitungPelanggaran n={p.pelanggaranCount} />
              <Ikon
                nama="bawah"
                className="adw-dim transition-transform"
                style={terbuka ? { rotate: '180deg' } : undefined}
              />
            </button>

            <div className="divide-y divide-shade-strong border-t border-shade-strong">
              <BarisPercobaan
                {...terbaru}
                terbaru
                onBuka={() => keSesi(terbaru.sessionId)}
              />
              {terbuka ? (
                lama.map((r) => (
                  <BarisPercobaan key={r.sessionId} {...r} onBuka={() => keSesi(r.sessionId)} />
                ))
              ) : lama.length > 0 ? (
                <p className="adw-caption adw-dim px-4 py-3">
                  {lama.length} percobaan lama — buka untuk melihatnya.
                </p>
              ) : null}
            </div>
          </Kotak>
        )
      })}
    </div>
  )
}

function BarisPercobaan({
  attemptNo,
  status,
  dimulaiAt,
  pelanggaranCount,
  terbaru,
  onBuka,
}: {
  sessionId: string
  attemptNo: number
  status: Participant['status']
  dimulaiAt: string
  pelanggaranCount: number
  terbaru?: boolean
  onBuka: () => void
}) {
  return (
    <button
      type="button"
      onClick={onBuka}
      className="adw-row adw-row--activatable adw-row--tight gap-3"
      title={`${LENCANA_RAIL[status]} — buka detail Sesi`}
    >
      <RelMini status={status} />
      <span className="angka shrink-0 text-[0.875rem] font-medium">
        Percobaan ke-{attemptNo}
      </span>
      {terbaru ? (
        <span className="adw-badge adw-badge--accent shrink-0">Terbaru</span>
      ) : null}
      <span className="min-w-0 flex-1 truncate text-[0.875rem] adw-dim">
        {formatTanggalWaktu(dimulaiAt)}
      </span>
      <LencanaStatus status={status} />
      <HitungPelanggaran n={pelanggaranCount} />
    </button>
  )
}
