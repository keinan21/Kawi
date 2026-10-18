import { useEffect, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { SessionStatus } from '@lms/shared'
import { Ikon } from '@/components/adw/ikon'
import {
  Banner,
  HeaderBar,
  Kotak,
  LabelBagian,
  Lencana,
  PemilihGaya,
  Properti,
  Tombol,
  TombolAkun,
  TombolKembali,
} from '@/components/adw/adw'
import { NadaStatus } from '@/components/adw/rel'
import { STATUS_SESI_LABEL } from '@/lib/guru-api'
import { STATUS_JENDELA_LABEL, statusJendela } from './format'

/**
 * Konsol Guru shell.
 *
 * One header bar, not two: the root shell owns the app identity and the console
 * owns the view heading. The previous layout stacked a page header and a
 * console header, so the same words appeared twice within 100 px.
 *
 * Reload is a first-class control because the console has no realtime channel
 * (DESIGN.md §10) — the Guru's loop is explicitly read → refresh → read.
 */

export function KerangkaGuru({
  demo,
  judul,
  deskripsi,
  aksi,
  kembali,
  onMuatUlang,
  dimuatAt,
  children,
}: {
  demo: boolean
  judul: string
  deskripsi?: string
  aksi?: ReactNode
  /** Rendered at the header bar's start point, where a back button belongs. */
  kembali?: ReactNode
  onMuatUlang?: () => void
  /** Rendered as "Terakhir dimuat 14.03.22" beside the reload control. */
  dimuatAt?: Date | null
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-window text-window-fg">
      <HeaderBar
        awal={kembali}
        judul={
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="hidden shrink-0 text-adw-dim sm:inline">Konsol Guru</span>
            <span className="hidden shrink-0 text-adw-dim sm:inline" aria-hidden="true">
              ·
            </span>
            <span className="min-w-0 truncate">{judul}</span>
          </span>
        }
        aksen={
          <>
            {onMuatUlang ? (
              <span className="flex items-center gap-1">
                {dimuatAt ? (
                  <span className="adw-caption adw-dim angka hidden md:inline">
                    {formatMuat(dimuatAt)}
                  </span>
                ) : null}
                <Tombol
                  aria-label="Muat ulang data"
                  title="Muat ulang data (Ctrl+R)"
                  ikon="muatUlang"
                  onClick={onMuatUlang}
                />
              </span>
            ) : null}
            <PemilihGaya />
            <TombolAkun />
          </>
        }
      />
      {demo ? (
        <div className="mx-auto max-w-[1600px] px-3 pt-3 sm:px-5">
          <Banner nada="info" ikon="info">
            Mode demo — angka dan nama bersifat contoh untuk keperluan lomba.
          </Banner>
        </div>
      ) : null}
      <main className="mx-auto max-w-[1600px] px-3 py-6 sm:px-5 sm:py-8">
        <KepalaHalaman judul={judul} deskripsi={deskripsi} aksi={aksi} />
        {children}
      </main>
    </div>
  )
}

function formatMuat(d: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d)
}

export function KepalaHalaman({
  judul,
  deskripsi,
  aksi,
}: {
  judul: string
  deskripsi?: string
  aksi?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-2xl">
        <h1 className="text-[1.7rem] leading-tight font-bold tracking-tight text-balance">
          {judul}
        </h1>
        {deskripsi ? <p className="mt-1.5 text-pretty text-adw-dim">{deskripsi}</p> : null}
      </div>
      {aksi ? <div className="flex flex-wrap items-center gap-2">{aksi}</div> : null}
    </div>
  )
}

/** The back affordance a child view carries in its header bar. */
export function KembaliKeDaftar() {
  return <TombolKembali ke="/guru">Daftar Tugas</TombolKembali>
}

export function KeTugas({ tugasId }: { tugasId: string }) {
  return (
    <TombolKembali ke="/guru/tugas/$tugasId" params={{ tugasId }} label="Kembali ke Tugas">
      Tugas
    </TombolKembali>
  )
}

/* --- Status ---------------------------------------------------------------- */

export function LencanaStatus({ status }: { status: SessionStatus }) {
  const nada = NadaStatus(status)
  return (
    <Lencana nada={nada === 'aksen' ? 'aksen' : nada} ikon={ikonStatus(status)}>
      {STATUS_SESI_LABEL[status]}
    </Lencana>
  )
}

function ikonStatus(status: SessionStatus) {
  switch (status) {
    case 'submitted':
      return 'cek' as const
    case 'auto_submitted':
      return 'peringatan' as const
    case 'answering':
      return 'jam' as const
    default:
      return 'berkas' as const
  }
}

export function LencanaJendela({ deadlineAt }: { deadlineAt: string | null }) {
  const s = statusJendela(deadlineAt)
  const nada =
    s === 'lewat' ? 'galat' : s === 'mendekati' ? 'peringatan' : 'netral'
  return (
    <Lencana nada={nada} ikon={s === 'lewat' ? 'peringatan' : 'jam'}>
      {STATUS_JENDELA_LABEL[s]}
    </Lencana>
  )
}

/** Pelanggaran count. Never colour alone: the warning icon and the word carry it. */
export function HitungPelanggaran({ n }: { n: number }) {
  return (
    <Lencana
      nada={n > 0 ? 'galat' : 'netral'}
      ikon={n > 0 ? 'peringatan' : 'cek'}
      className="angka"
    >
      {n} Pelanggaran
    </Lencana>
  )
}

/* --- Text fields ----------------------------------------------------------- */

export function Medan({
  label,
  petunjuk,
  children,
  htmlFor,
}: {
  label: string
  /** Caption under the control; the field keeps its label above. */
  petunjuk?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[0.875rem] font-medium"
      >
        {label}
      </label>
      {children}
      {petunjuk ? <p className="adw-caption adw-dim mt-1.5">{petunjuk}</p> : null}
    </div>
  )
}

/* --- Field rows ------------------------------------------------------------ */

export function BarisSwitch({
  label,
  keterangan,
  checked,
  onChange,
}: {
  label: string
  keterangan?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="adw-row">
      <span className="min-w-0 flex-1">
        <span className="block text-[0.9375rem] font-medium">{label}</span>
        {keterangan ? (
          <span className="adw-caption adw-dim mt-0.5 block">{keterangan}</span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="adw-switch"
        onClick={() => onChange(!checked)}
      />
    </div>
  )
}

export function BarisProperti({
  label,
  nilai,
  ikon,
}: {
  label: string
  nilai: string
  ikon?: Parameters<typeof Ikon>[0]['nama']
}) {
  return (
    <div className="adw-row adw-row--tight">
      {ikon ? <Ikon nama={ikon} className="adw-dim" /> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="angka adw-dim">{nilai}</span>
    </div>
  )
}

/* --- Share link ------------------------------------------------------------ */

export function SalinTautan({ teks }: { teks: string }) {
  return (
    <div className="adw-boxed adw-boxed--framed flex items-center gap-2 p-2 pl-3">
      <Ikon nama="salin" className="adw-dim flex-none" />
      <code className="angka min-w-0 flex-1 truncate text-[0.8125rem] text-adw-dim">
        {teks}
      </code>
      <Tombol ikon="salin" label="Salin link" onClick={() => void salin(teks)} />
    </div>
  )
}

async function salin(teks: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(teks)
  } catch {
    const el = document.createElement('textarea')
    el.value = teks
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
  }
}

/* --- Ctrl+R reload ---------------------------------------------------------
   The GNOME standard shortcut for reloading a view. Deliberately not bound in
   the locked Murid Sesi, where the proctor owns the keyboard. */

export function PematahReload({ onMuat }: { onMuat: () => void }) {
  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r') {
        e.preventDefault()
        onMuat()
      }
    }
    document.addEventListener('keydown', tekan)
    return () => document.removeEventListener('keydown', tekan)
  }, [onMuat])
  return null
}

/* --- Section wrapper ------------------------------------------------------- */

export function Bagian({
  judul,
  aksi,
  children,
  className,
}: {
  judul: string
  aksi?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={className}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <LabelBagian>{judul}</LabelBagian>
        {aksi}
      </div>
      <Kotak>{children}</Kotak>
    </section>
  )
}

export { Link, Properti }
