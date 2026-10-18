import type { ReactNode } from 'react'
import type { SessionStatus } from '@lms/shared'
import { cx } from './gaya'

/**
 * The Integrity Rail — this product's signature move.
 *
 * The Sesi state machine, drawn as one continuous line. Every Sesi is a rail of
 * the same four stages; how far the rail is filled is the session's status, and
 * Pelanggaran are stamped onto the rail at the position they happened. Reading
 * "when did this go wrong relative to the work" becomes a position on a line
 * instead of a re-computation from a list.
 *
 * Colour does real jobs here — grey reached, blue in progress, green sent,
 * red ended by the system — and never carries the meaning alone: each node
 * ships its own label.
 */

const TAHAP: Array<{ status: SessionStatus; label: string }> = [
  { status: 'created', label: 'Sesi dimulai' },
  { status: 'generating', label: 'Unggahan diterima' },
  { status: 'answering', label: 'Menjawab Pertanyaan' },
  { status: 'submitted', label: 'Terkirim' },
]

const URUTAN: SessionStatus[] = ['created', 'generating', 'answering', 'submitted']

function nada(status: SessionStatus, tercapai: boolean): string {
  if (!tercapai) return 'netral'
  switch (status) {
    case 'submitted':
      return 'sukses'
    case 'auto_submitted':
      return 'galat'
    case 'generating':
    case 'answering':
      return 'aksen'
    default:
      return 'netral'
  }
}

/** Index in the rail a session has actually reached. */
function tahapTercapai(status: SessionStatus): number {
  if (status === 'auto_submitted') return 3
  const i = URUTAN.indexOf(status)
  return i === -1 ? 0 : i
}

export function RelSesi({
  status,
  children,
  className,
}: {
  status: SessionStatus
  /** Pelanggaran and other events, stamped between the nodes. */
  children?: ReactNode
  className?: string
}) {
  const tercapai = tahapTercapai(status)

  return (
    <ol className={cx('adw-rail', className)} aria-label="Riwayat status Sesi">
      {TAHAP.map((t, i) => {
        const tercapaiTahap = i <= tercapai
        const adalahTerakhir = i === tercapai
        return (
          <li
            key={t.status}
            data-reached={tercapaiTahap}
            data-tone={nada(t.status, tercapaiTahap)}
            aria-current={adalahTerakhir ? 'step' : undefined}
          >
            <div className="min-h-7 pb-3">
              <p
                className={cx(
                  'text-[0.875rem] leading-snug',
                  tercapaiTahap ? 'font-medium' : 'adw-dim',
                )}
              >
                {t.label}
              </p>
              {adalahTerakhir ? (
                <p className="adw-caption adw-dim">{keteranganTahap(t.status, status)}</p>
              ) : null}
            </div>
          </li>
        )
      })}
      {status === 'auto_submitted' ? (
        <li data-reached="true" data-tone="galat">
          <div className="min-h-7">
            <p className="text-[0.875rem] leading-snug font-medium">
              Dihentikan sistem
            </p>
            <p className="adw-caption adw-dim">Jawaban terkirim apa adanya</p>
          </div>
        </li>
      ) : null}
      {children}
    </ol>
  )
}

function keteranganTahap(tahap: SessionStatus, status: SessionStatus): string {
  if (status === 'submitted' && tahap === 'submitted') return 'Dalam penilaian'
  switch (tahap) {
    case 'created':
      return 'Menunggu Unggahan'
    case 'generating':
      return 'AI menyusun Pertanyaan'
    case 'answering':
      return 'Timer berjalan'
    default:
      return ''
  }
}

/** Compact rail for list rows: four nodes, no labels, status in the tooltip. */
export function RelMini({ status }: { status: SessionStatus }) {
  const tercapai = tahapTercapai(status)
  return (
    <span
      className="flex shrink-0 items-center gap-1"
      role="img"
      aria-label={`Status Sesi: ${LENCANA_RAIL[status]}`}
      title={LENCANA_RAIL[status]}
    >
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cx('h-1.5 rounded-full transition-colors', i <= tercapai ? 'w-4' : 'w-2')}
          style={{
            backgroundColor: i <= tercapai ? WARNA_RAIL[status] : 'var(--adw-shade)',
          }}
        />
      ))}
    </span>
  )
}

const WARNA_RAIL: Record<SessionStatus, string> = {
  created: 'var(--adw-light-5)',
  generating: 'var(--adw-accent-bg)',
  answering: 'var(--adw-accent-bg)',
  submitted: 'var(--adw-success-bg)',
  auto_submitted: 'var(--adw-error-bg)',
}

export const LENCANA_RAIL: Record<SessionStatus, string> = {
  created: 'Menunggu Unggahan',
  generating: 'Menyusun Pertanyaan',
  answering: 'Menjawab Pertanyaan',
  submitted: 'Terkirim',
  auto_submitted: 'Dihentikan sistem',
}

/** Tone for a badge that repeats the same status language. */
export function NadaStatus(status: SessionStatus): 'netral' | 'aksen' | 'sukses' | 'galat' {
  switch (status) {
    case 'generating':
    case 'answering':
      return 'aksen'
    case 'submitted':
      return 'sukses'
    case 'auto_submitted':
      return 'galat'
    default:
      return 'netral'
  }
}

/** A Pelanggaran stamped onto the rail at its recorded moment. */
export function CapRel({ children }: { children: ReactNode }) {
  return <li className="adw-rail-mark">{children}</li>
}
