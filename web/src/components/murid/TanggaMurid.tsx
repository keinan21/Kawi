import { Ikon } from '@/components/adw/ikon'

export interface TanggaMuridProps {
  /** 1 = layar penuh, 2 = unggah, 3 = menjawab, 4 = selesai. */
  tahap: 1 | 2 | 3 | 4
}

/**
 * Peta tahap Sesi, seperti view switcher: tahap berjalan disorot, yang sudah
 * lewat tampil dengan centang, yang belum datang tetap terlihat supaya Murid
 * tahu masih ada langkah lagi. Lebih baik daripada label "Langkah 2 dari 3"
 * yang tersedia hanya sebagai teks di pojok.
 */
const TAHAP = [
  { no: 1, label: 'Layar penuh' },
  { no: 2, label: 'Unggahan' },
  { no: 3, label: 'Menjawab' },
] as const

export function TanggaMurid({ tahap }: TanggaMuridProps) {
  if (tahap >= 4) return null
  return (
    <div className="flex items-center gap-1" aria-label={`Tahap Sesi ${tahap} dari 3`}>
      {TAHAP.map((t) => {
        const aktif = t.no === tahap
        const lewat = t.no < tahap
        return (
          <span
            key={t.no}
            aria-current={aktif ? 'step' : undefined}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] transition-colors ${
              aktif
                ? 'bg-accent font-medium text-accent-fg'
                : lewat
                  ? 'adw-dim'
                  : 'adw-dim opacity-55'
            }`}
          >
            {lewat ? <Ikon nama="cek" ukuran={12} /> : null}
            <span className="angka">{t.no}</span>
            <span className="hidden md:inline">{t.label}</span>
          </span>
        )
      })}
    </div>
  )
}

export default TanggaMurid
