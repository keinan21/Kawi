import { DialogPeringatan } from '@/components/adw/adw'

export interface DialogKonfirmasiProps {
  terbuka: boolean
  judul: string
  children: React.ReactNode
  labelKonfirmasi: string
  labelBatal?: string
  sibuk?: boolean
  /** Destructive for actions that cannot be undone. */
  merusak?: boolean
  onKonfirmasi: () => void
  onBatal: () => void
}

/**
 * Dialog konfirmasi — pola alert dialog Adwaita: modal terhadap induknya,
 * Esc membatalkan, tombol batal mendahului tombol affirmatif, dan fokus
 * diarahkan ke kotak dialog saat dibuka.
 */
export function DialogKonfirmasi({
  terbuka,
  judul,
  children,
  labelKonfirmasi,
  labelBatal,
  sibuk,
  merusak,
  onKonfirmasi,
  onBatal,
}: DialogKonfirmasiProps) {
  return (
    <DialogPeringatan
      terbuka={terbuka}
      judul={judul}
      labelKonfirmasi={labelKonfirmasi}
      {...(labelBatal === undefined ? {} : { labelBatal })}
      {...(sibuk === undefined ? {} : { sibuk })}
      nada={merusak ? 'merusak' : 'saran'}
      onBatal={onBatal}
      onKonfirmasi={onKonfirmasi}
    >
      {children}
    </DialogPeringatan>
  )
}

export default DialogKonfirmasi
