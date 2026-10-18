import { useCallback, useEffect, useRef, useState } from 'react'
import { formatBytes } from '@/lib/murid-api.ts'
import { labelTipeFile } from './format.ts'
import { Ikon } from '@/components/adw/ikon'

export interface ZonaUnggahProps {
  /** MIME/ekstensi yang diizinkan, mis. `['application/pdf']`. */
  tipeDiizinkan: string[]
  maksBytes: number
  onPilih: (file: File) => void
  /**
   * Dipanggil saat dialog berkas OS dibuka/ditutup. Browser kehilangan fokus
   * saat dialog itu muncul, jadi parent sempatkan deteksi `window_blur`.
   */
  onAktifDialog?: (aktif: boolean) => void
}

/** Cocokkan file terhadap allow-list MIME maupun ekstensi (mis. `ppt` ↔ `.pptx`). */
function cocokTipe(file: File, diizinkan: string[]): boolean {
  if (diizinkan.length === 0) return true
  const mime = file.type.toLowerCase()
  const ekstensi = (file.name.split('.').pop() ?? '').toLowerCase()
  return diizinkan.some((tipe) => {
    const v = tipe.toLowerCase().trim()
    if (v.startsWith('.')) return ekstensi === v.slice(1)
    if (v.includes('/')) return mime === v
    return ekstensi === v || mime === v
  })
}

/**
 * Area unggah Unggahan (PDF/PPT, ≤2MB). Validasi tipe + ukuran dilakukan di
 * klien sebelum file dikirim, supaya Murid tahu masalahnya sebelum Unggahan
 * tercatat (server melakukan validasi ulang sebelum persist).
 *
 * Drop target memakai `.view` sebagai warna latar — permukaan konten Adwaita —
 * dengan garis putus-putus 2px, sehingga jelas merupakan target tanpa menjadi
 * kotak peringatan.
 */
export function ZonaUnggah({
  tipeDiizinkan,
  maksBytes,
  onPilih,
  onAktifDialog,
}: ZonaUnggahProps) {
  const [galat, setGalat] = useState<string | null>(null)
  const [namaFile, setNamaFile] = useState<string | null>(null)
  const [diAtas, setDiAtas] = useState(false)
  const [dialogBuka, setDialogBuka] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const tutupDialog = useCallback(() => {
    setDialogBuka(false)
    onAktifDialog?.(false)
  }, [onAktifDialog])

  // Dialog berkas OS yang dibatalkan tidak memicu event `change`; saat jendela
  // kembali fokus, anggap dialog sudah selesai agar deteksi proctor hidup lagi.
  useEffect(() => {
    if (!dialogBuka) return
    window.addEventListener('focus', tutupDialog)
    return () => window.removeEventListener('focus', tutupDialog)
  }, [dialogBuka, tutupDialog])

  const cek = (file: File): boolean => {
    if (!cocokTipe(file, tipeDiizinkan)) {
      setGalat(
        `Tipe berkas tidak diizinkan. Gunakan ${tipeDiizinkan.map(labelTipeFile).join(' atau ')}.`,
      )
      return false
    }
    if (file.size > maksBytes) {
      setGalat(
        `Ukuran berkas ${formatBytes(file.size)} melebihi batas ${formatBytes(maksBytes)}.`,
      )
      return false
    }
    setGalat(null)
    setNamaFile(`${file.name} · ${formatBytes(file.size)}`)
    return true
  }

  const terima = (file: File | undefined) => {
    tutupDialog()
    setDiAtas(false)
    if (!file) return
    if (cek(file)) onPilih(file)
  }

  const bukaDialog = () => {
    setDialogBuka(true)
    onAktifDialog?.(true)
    inputRef.current?.click()
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={bukaDialog}
        onDragOver={(e) => {
          e.preventDefault()
          setDiAtas(true)
          // Cegah listener dragstart global proctor memblokir drag Unggahan.
          e.stopPropagation()
        }}
        onDragLeave={() => setDiAtas(false)}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          terima(e.dataTransfer.files[0])
        }}
        className={`flex w-full flex-col items-center justify-center gap-3 rounded-card bg-view px-6 py-12 text-center transition-colors ${
          diAtas
            ? 'outline-2 outline-offset-2 outline-accent'
            : 'border-2 border-dashed border-shade-strong'
        }`}
      >
        <Ikon
          nama="unggah"
          ukuran={34}
          className={diAtas ? 'text-accent-text' : 'adw-dim'}
        />
        <span className="text-[0.9375rem] font-medium">
          {diAtas ? 'Lepaskan berkas di sini' : 'Seret berkas ke sini'}
        </span>
        <span className="adw-caption adw-dim">atau klik untuk memilih dari komputer</span>
        <span className="adw-caption adw-dim">
          {tipeDiizinkan.length > 0 ? tipeDiizinkan.map(labelTipeFile).join(', ') : 'PDF / PPT'}
          {' · '}maks. {formatBytes(maksBytes)}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={tipeDiizinkan.join(',') || '.pdf,.ppt,.pptx'}
        onChange={(e) => {
          terima(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {namaFile ? (
        <p className="flex items-center gap-2 text-[0.875rem]">
          <Ikon nama="cek" ukuran={15} className="text-success-text" />
          <span className="min-w-0 truncate">{namaFile}</span>
        </p>
      ) : null}
      {galat ? (
        <p role="alert" className="flex items-start gap-2 text-[0.875rem] text-error-text">
          <Ikon nama="peringatan" ukuran={15} className="mt-px flex-none" />
          <span className="text-pretty">{galat}</span>
        </p>
      ) : null}
    </div>
  )
}

export default ZonaUnggah
