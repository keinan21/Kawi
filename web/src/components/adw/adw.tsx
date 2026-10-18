import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react'
import { Link } from '@tanstack/react-router'
import { cx, bacaGayaUI, terapkanGayaUI, type GayaUI } from './gaya'
import { Ikon } from './ikon'

/* =============================================================================
   Adwaita primitives.

   Each one is the browser's standard control wearing the platform's shape, not
   a picture of a GTK widget. Where the HIG names a pattern (header bar, boxed
   list, alert dialog, banner, placeholder page, progress bar), this file is
   that pattern's web implementation.
   ========================================================================== */

/* --- Header bar ------------------------------------------------------------ */

export function HeaderBar({
  awal,
  judul,
  children,
  aksen,
}: {
  /** Start alignment point: back / primary buttons. */
  awal?: ReactNode
  /** Center alignment point: the window heading. */
  judul?: ReactNode
  /** Below the bar — used by the thin progress bar pattern. */
  children?: ReactNode
  /** End alignment point: menus and the account. */
  aksen?: ReactNode
}) {
  return (
    <div className="adw-headerbar sticky top-0 z-30">
      <div className="mx-auto flex h-15 max-w-[1600px] items-center gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 flex-none items-center gap-1">{awal}</div>
        <div className="adw-heading min-w-0 flex-1 truncate text-center">{judul}</div>
        <div className="flex min-w-0 flex-none items-center justify-end gap-1">{aksen}</div>
      </div>
      {children}
    </div>
  )
}

/** Tombol navigasi ke belakang — top-left in left-to-right locales. */
export function TombolKembali({
  ke,
  params,
  label = 'Kembali',
  children,
}: {
  ke?: string
  params?: Record<string, string>
  label?: string
  children?: ReactNode
}) {
  const isi = (
    <>
      <Ikon nama="kembali" />
      <span className="hidden sm:inline">{children ?? label}</span>
    </>
  )
  const cls =
    'adw-btn adw-btn--header adw-btn--quiet text-[0.875rem] font-medium'
  if (ke) {
    return (
      <Link to={ke} params={params} className={cls} aria-label={label}>
        {isi}
      </Link>
    )
  }
  return (
    <button type="button" className={cls}>
      {isi}
    </button>
  )
}

/** Account entry point at the end of the header bar. */
export function TombolAkun({ nama }: { nama?: string }) {
  return (
    <button
      type="button"
      className="adw-btn adw-btn--header"
      aria-label={nama ? `Akun: ${nama}` : 'Akun'}
    >
      <Ikon nama="orang" />
      <span className="hidden max-w-28 truncate text-[0.875rem] md:inline">
        {nama ?? 'Akun'}
      </span>
    </button>
  )
}

/* --- Buttons --------------------------------------------------------------- */

type GayaTombol = 'biasa' | 'usang' | 'saran' | 'merusak' | 'pill' | 'sirkular'

export function Tombol({
  gaya = 'biasa',
  ikon,
  label,
  tipe = 'button',
  formId,
  ref,
  onClick,
  nonaktif,
  lebar,
  ...sisa
}: {
  gaya?: GayaTombol
  ikon?: Parameters<typeof Ikon>[0]['nama']
  /** Supply either visible text or an accessible name — never neither. */
  label?: ReactNode
  tipe?: 'button' | 'submit'
  formId?: string
  ref?: Ref<HTMLButtonElement>
  onClick?: () => void
  nonaktif?: boolean
  lebar?: boolean
  title?: string
  'aria-label'?: string
  className?: string
}) {
  const kelas = cx(
    'adw-btn',
    gaya === 'saran' && 'adw-btn--suggested',
    gaya === 'merusak' && 'adw-btn--destructive',
    gaya === 'pill' && 'adw-btn--pill adw-btn--suggested',
    gaya === 'usang' && 'adw-btn--quiet',
    gaya === 'sirkular' && 'adw-btn--circular',
    !label && !sisa['aria-label'] && 'adw-btn--circular',
    lebar && 'w-full',
    sisa.className,
  )
  return (
    <button
      ref={ref}
      type={tipe}
      form={formId}
      onClick={onClick}
      disabled={nonaktif}
      className={kelas}
      title={sisa.title}
      aria-label={sisa['aria-label']}
    >
      {ikon ? <Ikon nama={ikon} /> : null}
      {label}
    </button>
  )
}

/* --- Boxed list ------------------------------------------------------------ */

export function Kotak({
  children,
  className,
  dibingkai,
}: {
  children: ReactNode
  className?: string
  /** Hairline frame for lists that sit directly on the window ground. */
  dibingkai?: boolean
}) {
  return (
    <div className={cx('adw-boxed', dibingkai && 'adw-boxed--framed', className)}>
      {children}
    </div>
  )
}

/** Section label above a boxed list, or between lists. */
export function LabelBagian({ children }: { children: ReactNode }) {
  return <h2 className="adw-label mb-2 px-1">{children}</h2>
}

export function Baris({
  children,
  padat,
  onClick,
  selected,
  className,
  ...sisa
}: {
  children: ReactNode
  padat?: boolean
  onClick?: () => void
  selected?: boolean
  className?: string
  'aria-label'?: string
  'aria-expanded'?: boolean
  'aria-current'?: boolean
}) {
  const kelas = cx(
    'adw-row',
    padat && 'adw-row--tight',
    onClick && 'adw-row--activatable',
    selected && 'bg-[color-mix(in_srgb,currentColor_9%,transparent)]',
    className,
  )
  if (!onClick) {
    return (
      <div className={kelas} {...sisa}>
        {children}
      </div>
    )
  }
  return (
    <button type="button" onClick={onClick} className={kelas} {...sisa}>
      {children}
    </button>
  )
}

/* --- Badges ---------------------------------------------------------------- */

type Nada = 'netral' | 'aksen' | 'sukses' | 'peringatan' | 'galat'

export function Lencana({
  nada = 'netral',
  ikon,
  children,
  className,
}: {
  nada?: Nada
  ikon?: Parameters<typeof Ikon>[0]['nama']
  children: ReactNode
  className?: string
}) {
  return (
    <span className={cx('adw-badge', `adw-badge--${nada}`, className)}>
      {ikon ? <Ikon nama={ikon} ukuran={13} /> : null}
      {children}
    </span>
  )
}

/* --- View switcher --------------------------------------------------------- */

export function PemisahTampilan<T extends string>({
  tampilan,
  onGanti,
  opsi,
}: {
  tampilan: T
  onGanti: (nilai: T) => void
  opsi: Array<{ nilai: T; label: string; ikon?: Parameters<typeof Ikon>[0]['nama']; jumlah?: number }>
}) {
  return (
    <div className="adw-switcher" role="tablist">
      {opsi.map((o) => (
        <button
          key={o.nilai}
          type="button"
          role="tab"
          aria-selected={tampilan === o.nilai}
          onClick={() => onGanti(o.nilai)}
        >
          {o.ikon ? <Ikon nama={o.ikon} ukuran={14} /> : null}
          {o.label}
          {typeof o.jumlah === 'number' ? (
            <span className="angka adw-caption adw-dim">{o.jumlah}</span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

/* --- Banner ---------------------------------------------------------------- */

export function Banner({
  nada = 'peringatan',
  ikon = 'peringatan',
  children,
  aksi,
}: {
  nada?: 'peringatan' | 'galat' | 'info'
  ikon?: Parameters<typeof Ikon>[0]['nama']
  children: ReactNode
  aksi?: ReactNode
}) {
  return (
    <div
      className={cx('adw-banner', nada === 'galat' && 'adw-banner--error', nada === 'info' && 'adw-banner--info')}
      role={nada === 'galat' ? 'alert' : 'status'}
    >
      <Ikon nama={ikon} className="flex-none" />
      <p className="min-w-0 flex-1 text-pretty">{children}</p>
      {aksi}
    </div>
  )
}

/* --- Property row ----------------------------------------------------------
   A name and its value — the shape every details list should have. Values that
   change in place get tabular figures so the line never reflows. */

export function Properti({
  nama,
  nilai,
  ikon,
  angka,
}: {
  nama: string
  nilai: ReactNode
  ikon?: Parameters<typeof Ikon>[0]['nama']
  angka?: boolean
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-3">
      <dt className="flex items-center gap-2 text-[0.9375rem]">
        {ikon ? <Ikon nama={ikon} className="adw-dim" /> : null}
        {nama}
      </dt>
      <dd className={cx('text-right font-medium', angka && 'angka')}>{nilai}</dd>
    </div>
  )
}

/* --- Feedback -------------------------------------------------------------- */

export function Pemuat({ teks = 'Memuat' }: { teks?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-adw-dim">
      <Spinner />
      <span className="text-[0.9375rem]">{teks}</span>
    </div>
  )
}

export function Spinner({ ukuran = 18 }: { ukuran?: number }) {
  return (
    <svg
      width={ukuran}
      height={ukuran}
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="shrink-0 animate-spin"
      style={{ animationDuration: '900ms' }}
    >
      <circle
        cx="8"
        cy="8"
        r="6.25"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="1.75"
      />
      <path
        d="M8 1.75a6.25 6.25 0 0 1 6.25 6.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Progress bar. The bar shows the amount of task remaining, per the HIG, and
 * the caller supplies the label that says how much is left.
 */
export function BilahKemajuan({
  persen,
  tipis,
  nada = 'aksen',
  label,
  nilai,
  maks = 100,
}: {
  persen: number
  tipis?: boolean
  nada?: 'aksen' | 'sukses' | 'galat'
  label: string
  nilai: number
  maks?: number
}) {
  return (
    <div
      className={cx('adw-progress', tipis && 'adw-progress--thin')}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={maks}
      aria-valuenow={Math.round(nilai)}
    >
      <span
        className={cx(
          'transition-[width] duration-1000 ease-linear',
          nada === 'sukses' && 'bg-success',
          nada === 'galat' && 'bg-error',
        )}
        style={{ width: `${Math.max(0, Math.min(100, persen))}%` }}
      />
    </div>
  )
}

/* --- Placeholder pages -----------------------------------------------------
   Symbolic variant for spaces that are often populated but currently are not;
   the illustration variant is reserved for the first view of an app. */

export function HalamanKosong({
  judul,
  deskripsi,
  ikon = 'tumpukan',
  aksi,
  simbolik = true,
}: {
  judul: string
  deskripsi?: string
  ikon?: Parameters<typeof Ikon>[0]['nama']
  aksi?: ReactNode
  simbolik?: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Ikon nama={ikon} ukuran={simbolik ? 48 : 64} className="adw-dim" />
      <h2 className="mt-5 text-xl font-bold tracking-tight">{judul}</h2>
      {deskripsi ? (
        <p className="mt-2 max-w-sm text-pretty text-adw-dim">{deskripsi}</p>
      ) : null}
      {aksi ? <div className="mt-6">{aksi}</div> : null}
    </div>
  )
}

/** Inline error with its recovery — never a dead end. */
export function Galat({
  judul = 'Gagal memuat data',
  pesan,
  onUlang,
}: {
  judul?: string
  pesan: string
  onUlang?: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 px-6 py-12 text-center"
    >
      <Ikon nama="peringatan" ukuran={40} className="text-error-text" />
      <h2 className="text-lg font-bold">{judul}</h2>
      <p className="max-w-sm text-pretty text-adw-dim">{pesan}</p>
      {onUlang ? (
        <Tombol ikon="muatUlang" label="Coba lagi" onClick={onUlang} className="mt-2" />
      ) : null}
    </div>
  )
}

/* --- Alert dialog ----------------------------------------------------------
   Modal to its parent, Esc cancels, cancel sits before the affirmative button,
   and Return activates the affirmative one. */

export function DialogPeringatan({
  terbuka,
  judul,
  children,
  labelBatal = 'Batal',
  labelKonfirmasi,
  nada = 'saran',
  sibuk,
  formId,
  onBatal,
  onKonfirmasi,
}: {
  terbuka: boolean
  /** Heading in the informal heading style, no trailing period. */
  judul: string
  children?: ReactNode
  labelBatal?: string
  labelKonfirmasi: string
  nada?: 'saran' | 'merusak'
  sibuk?: boolean
  /** When set, the affirmative button submits this form instead of calling back. */
  formId?: string
  onBatal: () => void
  onKonfirmasi: () => void
}) {
  const kotak = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!terbuka) return
    const saatTombol = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sibuk) {
        e.preventDefault()
        onBatal()
      }
    }
    document.addEventListener('keydown', saatTombol)
    return () => document.removeEventListener('keydown', saatTombol)
  }, [terbuka, onBatal, sibuk])

  useEffect(() => {
    if (terbuka) kotak.current?.focus()
  }, [terbuka])

  if (!terbuka) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgb(0_0_0/45%)] p-4 sm:items-center"
      role="presentation"
      onClick={() => {
        if (!sibuk) onBatal()
      }}
    >
      <div
        ref={kotak}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-peringatan-judul"
        className="adw-entrance w-full max-w-md rounded-[15px] bg-dialog p-6 text-dialog-fg outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dialog-peringatan-judul" className="text-xl font-bold tracking-tight">
          {judul}
        </h2>
        {children ? (
          <div className="mt-3 space-y-3 text-[0.9375rem] text-pretty adw-dim">{children}</div>
        ) : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Tombol label={labelBatal} onClick={onBatal} nonaktif={sibuk} />
          <Tombol
            gaya={nada}
            label={sibuk ? 'Memproses…' : labelKonfirmasi}
            onClick={formId ? undefined : onKonfirmasi}
            nonaktif={sibuk}
            tipe={formId ? 'submit' : 'button'}
            formId={formId}
          />
        </div>
      </div>
    </div>
  )
}

/* --- Toast -----------------------------------------------------------------
   Transient, bottom-centred, horizontal. Never used for an ongoing state. */

export function Toast({ pesan }: { pesan: string | null }) {
  const [terlihat, setTerlihat] = useState<string | null>(null)
  useEffect(() => {
    if (!pesan) return
    setTerlihat(pesan)
    const t = window.setTimeout(() => setTerlihat(null), 3200)
    return () => window.clearTimeout(t)
  }, [pesan])
  if (!terlihat) return null
  return (
    <div
      role="status"
      className="adw-entrance adw-osd fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-[15px] px-4 py-2.5 text-[0.9375rem] font-medium"
    >
      <Ikon nama="cek" ukuran={15} />
      {terlihat}
    </div>
  )
}

/* --- Style preference ------------------------------------------------------
   Light, dark, follow system — the three options the HIG expects. */

const GAYA: Array<{ nilai: GayaUI; label: string }> = [
  { nilai: 'light', label: 'Terang' },
  { nilai: 'dark', label: 'Gelap' },
  { nilai: 'system', label: 'Ikuti sistem' },
]

export function PemilihGaya() {
  const [gaya, setGaya] = useState<GayaUI>('system')
  const [terbuka, setTerbuka] = useState(false)

  useEffect(() => {
    const awal = bacaGayaUI()
    setGaya(awal)
    terapkanGayaUI(awal)
  }, [])

  const pilih = useCallback((nilai: GayaUI) => {
    setGaya(nilai)
    terapkanGayaUI(nilai)
    setTerbuka(false)
  }, [])

  return (
    <>
      <button
        type="button"
        className="adw-btn adw-btn--header adw-tip"
        data-tip="Gaya tampilan"
        aria-label="Gaya tampilan"
        aria-haspopup="menu"
        aria-expanded={terbuka}
        onClick={() => setTerbuka((t) => !t)}
      >
        <Ikon nama="bawah" ukuran={13} />
        <span className="hidden text-[0.875rem] font-medium sm:inline">
          {gaya === 'dark' ? 'Gelap' : gaya === 'light' ? 'Terang' : 'Sistem'}
        </span>
      </button>
      {terbuka ? (
        <>
          <button
            type="button"
            aria-label="Tutup menu gaya"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setTerbuka(false)}
          />
          <div
            role="menu"
            aria-label="Gaya tampilan"
            className="adw-boxed adw-boxed--framed absolute top-13 right-3 z-50 w-44 py-1 shadow-[0_6px_24px_rgb(0_0_0/18%)]"
          >
            {GAYA.map((g) => (
              <button
                key={g.nilai}
                type="button"
                role="menuitemradio"
                aria-checked={gaya === g.nilai}
                onClick={() => pilih(g.nilai)}
                className="adw-row adw-row--tight adw-row--activatable w-full"
              >
                <span className="flex-1 text-left">{g.label}</span>
                {gaya === g.nilai ? <Ikon nama="cek" ukuran={15} /> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </>
  )
}
