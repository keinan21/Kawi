import { SignIn } from '@clerk/clerk-react'
import { Ikon } from '@/components/adw/ikon'

/**
 * Halaman masuk (Google OAuth). Dipasang inline di halaman pra-tangan Tugas —
 * tidak memakai route terpisah supaya alur link Guru tetap satu jalur.
 */
export function PanelMasuk({ peran }: { peran: 'murid' | 'guru' }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Ikon nama="orang" ukuran={36} className="adw-dim" />
      <div>
        <p className="text-[1.05rem] font-bold">
          Masuk untuk mulai {peran === 'guru' ? 'Konsol' : 'Sesi'}
        </p>
        <p className="mt-1.5 text-pretty text-adw-dim">
          Gunakan akun yang sama seperti saat masuk ke kelas.
        </p>
      </div>
      <SignIn
        routing="hash"
        fallbackRedirectUrl={window.location.pathname + window.location.search}
        signUpForceRedirectUrl={window.location.pathname + window.location.search}
      />
    </div>
  )
}

export default PanelMasuk
