import { useCallback, useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
import {
  beriIzinUnggahUlang,
  detailSesi,
  detailTugas,
  sedangModeDemo,
  unduhBlobUnggahan,
  TIPE_PELANGGARAN_LABEL,
  TIPE_PERTANYAAN_LABEL,
  type QAItem,
  type SessionDetail,
} from '@/lib/guru-api'
import { formatBytes, formatTanggalWaktu } from '@/components/guru/format'
import {
  HitungPelanggaran,
  KerangkaGuru,
  KeTugas,
  LencanaStatus,
  PematahReload,
  Properti,
} from '@/components/guru/ui'
import {
  Banner,
  Baris,
  DialogPeringatan,
  Galat,
  HalamanKosong,
  Kotak,
  Lencana,
  Pemuat,
  Tombol,
  Toast,
} from '@/components/adw/adw'
import { CapRel, RelSesi } from '@/components/adw/rel'
import { Ikon } from '@/components/adw/ikon'
import { usePesanToast } from '@/components/guru/hook'

export const Route = createFileRoute('/guru/sesi/$sessionId')({
  component: DetailSesi,
})

function DetailSesi() {
  const { sessionId } = Route.useParams()
  const [sesi, setSesi] = useState<SessionDetail | null>(null)
  const [namaTugas, setNamaTugas] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [demo, setDemo] = useState(sedangModeDemo)
  const [dimuatAt, setDimuatAt] = useState<Date | null>(null)
  const [dialogIzin, setDialogIzin] = useState(false)
  const [memprosesIzin, setMemprosesIzin] = useState(false)
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
      const d = await detailSesi(sessionId)
      setSesi(d)
      setDemo(sedangModeDemo())
      setDimuatAt(new Date())
      try {
        const t = await detailTugas(d.tugasId)
        setNamaTugas(t.token)
      } catch {
        setNamaTugas(null)
      }
    } catch (err) {
      setGalat(err instanceof Error ? err.message : 'Tidak diketahui')
    }
  }, [sessionId])

  useEffect(() => {
    void muat()
  }, [muat])

  const kirimIzin = async () => {
    setMemprosesIzin(true)
    try {
      const hasil = await beriIzinUnggahUlang(sessionId)
      setDialogIzin(false)
      tampilkan(`Izin diberikan — Percobaan ke-${hasil.attemptNo} dibuat untuk Murid.`)
      await muat()
    } catch (err) {
      tampilkan(err instanceof Error ? err.message : 'Gagal memberi izin')
    } finally {
      setMemprosesIzin(false)
    }
  }

  if (ADA_CLERK && !auth.isLoaded) {
    return <Pemuat teks="Memuat Sesi" />
  }
  if (ADA_CLERK && !auth.isSignedIn) return null

  if (galat) {
    return (
      <KerangkaGuru demo={demo} judul="Detail Sesi">
        <Galat pesan={galat} onUlang={() => void muat()} />
      </KerangkaGuru>
    )
  }

  if (sesi == null) {
    return (
      <KerangkaGuru demo={demo} judul="Detail Sesi" onMuatUlang={() => void muat()}>
        <Pemuat teks="Memuat detail Sesi" />
      </KerangkaGuru>
    )
  }

  const ditutup = sesi.status === 'submitted' || sesi.status === 'auto_submitted'
  const terjawab = sesi.tanyaJawab.filter((q) => q.answer).length

  return (
    <KerangkaGuru
      demo={demo}
      judul={`${sesi.murid.nama} · Percobaan ke-${sesi.attemptNo}`}
      deskripsi={namaTugas ? `${sesi.murid.email} · Tugas /t/${namaTugas}` : sesi.murid.email}
      kembali={<KeTugas tugasId={sesi.tugasId} />}
      onMuatUlang={() => void muat()}
      dimuatAt={dimuatAt}
    >
      <PematahReload onMuat={() => void muat()} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <LencanaStatus status={sesi.status} />
        <HitungPelanggaran n={sesi.pelanggaran.length} />
        {sesi.tanyaJawab.length > 0 ? (
          <Lencana nada="netral" ikon="daftar" className="angka">
            {terjawab}/{sesi.tanyaJawab.length} dijawab
          </Lencana>
        ) : null}
        <span className="flex-1" />
        <Tombol
          ikon="muatUlang"
          label="Izin Unggah Ulang"
          onClick={() => setDialogIzin(true)}
          nonaktif={!ditutup}
          title={
            ditutup
              ? 'Buat Percobaan berikutnya untuk Murid ini'
              : 'Hanya tersedia setelah Sesi ditutup'
          }
        />
      </div>

      {sesi.status === 'auto_submitted' ? (
        <div className="mb-6">
          <Banner nada="galat">
            Sesi diakhiri sistem — jawaban terkirim apa adanya, dan Penilaian AI
            sengaja tidak dijalankan karena jawaban parsial bukan sinyal pemahaman.
          </Banner>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] lg:items-start">
        {/* Left: the attempt's evidence. Rail first — it is the spine of the
            whole page and the answer to "what happened, in order". */}
        <div className="min-w-0 space-y-6">
          <div>
            <h2 className="adw-label mb-2 px-1">Perjalanan Sesi</h2>
            <Kotak className="px-5 py-4">
              <RelSesi status={sesi.status}>
                {sesi.pelanggaran.map((p) => (
                  <CapRel key={p.id}>
                    <div className="pb-3">
                      <p className="flex items-center gap-1.5 text-[0.875rem] leading-snug font-medium">
                        <Ikon nama="peringatan" ukuran={14} className="text-error-text" />
                        {TIPE_PELANGGARAN_LABEL[p.type]}
                      </p>
                      <p className="angka adw-caption adw-dim mt-0.5">
                        {formatTanggalWaktu(p.serverTs)}
                      </p>
                      {p.detail ? (
                        <p className="mt-1 text-pretty text-[0.8125rem] adw-dim">{p.detail}</p>
                      ) : null}
                    </div>
                  </CapRel>
                ))}
              </RelSesi>
            </Kotak>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3 px-1">
              <h2 className="adw-label">Pertanyaan &amp; Jawaban</h2>
              {sesi.tanyaJawab.length > 0 ? (
                <span className="angka adw-caption adw-dim">
                  {terjawab} dari {sesi.tanyaJawab.length} terjawab
                </span>
              ) : null}
            </div>
            <Kotak>
              {sesi.tanyaJawab.length === 0 ? (
                <HalamanKosong
                  judul="Pertanyaan belum dibuat"
                  deskripsi="AI menyusun Pertanyaan setelah Unggahan diterima dan diproses."
                  ikon="daftar"
                  simbolik
                />
              ) : (
                sesi.tanyaJawab.map((qa) => <ItemTanyaJawab key={qa.id} qa={qa} />)
              )}
            </Kotak>
          </div>

          {sesi.riwayat.length > 1 ? (
            <div>
              <h2 className="adw-label mb-2 px-1">Riwayat Percobaan</h2>
              <Kotak>
                {[...sesi.riwayat]
                  .sort((a, b) => b.attemptNo - a.attemptNo)
                  .map((r) => (
                    <Baris key={r.sessionId} padat className="gap-3">
                      <span className="angka shrink-0 text-[0.875rem] font-medium">
                        Percobaan ke-{r.attemptNo}
                      </span>
                      {r.sessionId === sesi.id ? (
                        <Lencana nada="aksen">Sesi ini</Lencana>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate text-[0.875rem] adw-dim">
                        {formatTanggalWaktu(r.dimulaiAt)}
                      </span>
                      <LencanaStatus status={r.status} />
                      <HitungPelanggaran n={r.pelanggaranCount} />
                    </Baris>
                  ))}
              </Kotak>
            </div>
          ) : null}
        </div>

        {/* Right: the facts about the attempt. */}
        <aside className="min-w-0 space-y-6">
          <div>
            <h2 className="adw-label mb-2 px-1">Murid &amp; Sesi</h2>
            <Kotak className="px-5 py-1">
              <dl className="divide-y divide-shade-strong">
                <Properti nama="Nama" nilai={sesi.murid.nama} />
                <Properti nama="Email" nilai={sesi.murid.email} />
                <Properti nama="Percobaan" nilai={`ke-${sesi.attemptNo}`} angka />
                <Properti nama="Sesi dimulai" nilai={formatTanggalWaktu(sesi.dimulaiAt)} angka />
                <Properti
                  nama="Batas jawab"
                  nilai={
                    sesi.batasJawabAt
                      ? formatTanggalWaktu(sesi.batasJawabAt)
                      : 'Belum ada — timer mulai setelah Unggahan'
                  }
                  angka={sesi.batasJawabAt != null}
                />
                <Properti
                  nama="Dikumpulkan"
                  nilai={sesi.dikumpulAt ? formatTanggalWaktu(sesi.dikumpulAt) : 'Belum dikumpulkan'}
                  angka={sesi.dikumpulAt != null}
                />
              </dl>
            </Kotak>
          </div>

          <div>
            <h2 className="adw-label mb-2 px-1">Unggahan</h2>
            <Kotak className="px-5 py-4">
              {sesi.unggahan == null ? (
                <p className="text-pretty text-[0.9375rem] adw-dim">
                  Belum ada Unggahan. Timer menjawab baru berjalan setelah Murid
                  mengunggah berkas.
                </p>
              ) : (
                <div>
                  <p className="flex items-start gap-2.5">
                    <Ikon nama="berkas" className="mt-0.5 adw-dim" />
                    <span className="min-w-0 flex-1 text-pretty font-medium break-all">
                      {sesi.unggahan.namaFile}
                    </span>
                  </p>
                  <p className="angka adw-caption adw-dim mt-1.5 ml-6.5">
                    {formatBytes(sesi.unggahan.ukuranBytes)} · diunggah{' '}
                    {formatTanggalWaktu(sesi.unggahan.diunggahAt)}
                  </p>
                  {demo ? (
                    <p className="adw-caption adw-dim mt-3">
                      Pratinjau berkas tidak tersedia di mode demo — berkas asli hanya
                      ada di server.
                    </p>
                  ) : (
                    <div className="mt-3">
                      <BukaUnggahan sessionId={sesi.id} />
                    </div>
                  )}
                </div>
              )}
            </Kotak>
          </div>

          <div>
            <h2 className="mb-2 flex items-center gap-2 px-1">
              <span className="adw-label">Penilaian AI</span>
              <Lencana nada="netral" ikon="gembok">
                Confidential
              </Lencana>
            </h2>
            <Kotak className="px-5 py-4">
              {sesi.penilaian == null ? (
                <p className="text-pretty text-[0.9375rem] adw-dim">
                  Belum dinilai. Penilaian muncul setelah Murid mengumpulkan jawaban
                  lengkap.
                </p>
              ) : (
                <div>
                  <div className="flex items-baseline justify-between gap-4 pb-3">
                    <span className="text-[0.875rem] font-medium">Skor total</span>
                    <span className="angka text-2xl font-bold">
                      {sesi.penilaian.skorTotal}
                    </span>
                  </div>
                  <div className="space-y-3 pb-3">
                    <BilahSkor label="Ideasi" nilai={sesi.penilaian.skorIdeasi} />
                    <BilahSkor label="Isi" nilai={sesi.penilaian.skorIsi} />
                    <BilahSkor label="Harapan" nilai={sesi.penilaian.skorHarapan} />
                  </div>
                  <p className="border-t border-shade-strong pt-3 text-pretty leading-relaxed">
                    {sesi.penilaian.ringkasan}
                  </p>
                  <p className="adw-caption adw-dim mt-3">
                    Sinyal bantu, bukan vonis. Nilai akhir tetap keputusan Guru.
                  </p>
                </div>
              )}
            </Kotak>
          </div>
        </aside>
      </div>

      <DialogPeringatan
        terbuka={dialogIzin}
        judul="Beri Izin Unggah Ulang?"
        labelKonfirmasi="Ya, beri izin"
        nada="merusak"
        sibuk={memprosesIzin}
        onBatal={() => setDialogIzin(false)}
        onKonfirmasi={() => void kirimIzin()}
      >
        <p>
          Percobaan ke-{sesi.attemptNo + 1} dibuat untuk{' '}
          <strong>{sesi.murid.nama}</strong>. Pertanyaan dan jawaban lama tetap
          tersimpan sebagai bukti — Murid hanya bisa mengunggah berkas baru dan
          menerima Pertanyaan baru.
        </p>
        <p>Percobaan tambahan untuk Sesi ini akan tercatat sebagai percobaan tersendiri.</p>
      </DialogPeringatan>

      <Toast pesan={pesan?.teks ?? null} />
    </KerangkaGuru>
  )
}

/**
 * Endpoint Unggahan hanya menerima `Authorization: Bearer`, sedangkan navigasi
 * `<a href>` tidak bisa mengirim header — jadi berkas diambil lewat fetch
 * ber-token lalu dibuka dari object URL.
 */
function BukaUnggahan({ sessionId }: { sessionId: string }) {
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  const buka = async () => {
    setSibuk(true)
    setGalat(null)
    let objectUrl: string | null = null
    try {
      objectUrl = await unduhBlobUnggahan(sessionId)
      const tab = window.open(objectUrl, '_blank', 'noopener')
      if (!tab) window.location.assign(objectUrl)
    } catch (error) {
      setGalat(error instanceof Error ? error.message : 'Gagal membuka berkas.')
    } finally {
      const url = objectUrl
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setSibuk(false)
    }
  }

  return (
    <div>
      <Tombol ikon="buka" label={sibuk ? 'Mengunduh…' : 'Buka berkas'} onClick={() => void buka()} nonaktif={sibuk} />
      {galat ? <p role="alert" className="mt-2 text-[0.8125rem] text-error-text">{galat}</p> : null}
    </div>
  )
}

function BilahSkor({ label, nilai }: { label: string; nilai: number }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="text-[0.875rem]">{label}</span>
        <span className="angka text-[0.875rem] font-bold">{nilai}</span>
      </div>
      <div
        className="adw-progress"
        role="img"
        aria-label={`Skor ${label}: ${nilai} dari 100`}
      >
        <span
          className={nilai >= 70 ? 'bg-success' : nilai >= 40 ? 'bg-warning' : 'bg-error'}
          style={{ width: `${nilai}%`, transitionDuration: '400ms' }}
        />
      </div>
    </div>
  )
}

function ItemTanyaJawab({ qa }: { qa: QAItem }) {
  const [buka, setBuka] = useState(qa.answer != null)
  return (
    <div className="border-b border-shade-strong last:border-b-0">
      <Baris
        padat
        onClick={() => setBuka((b) => !b)}
        aria-expanded={buka}
        className="items-start py-3"
      >
        <span className="min-w-0 flex-1">
          <span className="mb-1 flex items-center gap-2">
            <Lencana nada="aksen">{TIPE_PERTANYAAN_LABEL[qa.type]}</Lencana>
            {qa.answer == null ? (
              <Lencana nada="peringatan" ikon="peringatan">
                Belum dijawab
              </Lencana>
            ) : null}
          </span>
          <span className="block text-pretty leading-snug">{qa.question}</span>
        </span>
        <Ikon
          nama="bawah"
          className="adw-dim mt-1 transition-transform"
          style={buka ? { rotate: '180deg' } : undefined}
        />
      </Baris>
      {buka ? (
        <div className="px-4 pb-4">
          {qa.answer == null ? (
            <p className="text-pretty text-[0.875rem] adw-dim">
              Murid belum mengumpulkan jawaban untuk pertanyaan ini — kemungkinan Sesi
              berakhir otomatis sebelum selesai menjawab.
            </p>
          ) : (
            <blockquote className="border-l-2 border-shade-strong pl-4 text-pretty leading-relaxed">
              {qa.answer}
            </blockquote>
          )}
        </div>
      ) : null}
    </div>
  )
}
