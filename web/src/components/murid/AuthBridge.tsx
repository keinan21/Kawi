import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { SignedIn, SignedOut, UserButton, useAuth, useUser } from '@clerk/clerk-react'
import { Ikon } from '@/components/adw/ikon'
import { setMuridAuthTokenProvider } from '@/lib/murid-api.ts'
import { setGuruAuthTokenProvider } from '@/lib/guru-api.ts'

/**
 * Jembatan auth: menyambungkan token Clerk ke kedua client API.
 * Akun bersifat universal — tidak ada penguncian peran tunggal.
 *
 * Tidak merender apa pun. Letaknya di shell root, bukan di dalam bar, supaya
 * satu pasang token untuk dua client API tetap utuh dan tidak ikut berubah-ubah
 * ketika sebuah tampilan mengisi slot bar-nya.
 */
export function AuthBridge() {
  const { getToken } = useAuth()

  useEffect(() => {
    // Satu sumber token untuk kedua client API (Bearer, bukan cookie).
    const provider = () => getToken()
    setMuridAuthTokenProvider(provider)
    setGuruAuthTokenProvider(provider)
    return () => {
      setMuridAuthTokenProvider(null)
      setGuruAuthTokenProvider(null)
    }
  }, [getToken])

  return null
}

/**
 * Kontrol akun di ujung bar.
 *
 * Satu account control untuk seluruh aplikasi, dan status login selalu terlihat
 * di sana. Sebelumnya bar root memakai tombol ini sementara bar konsol memakai
 * `TombolAkun` — dua kontrol untuk satu tujuan, dan yang di konsol tidak
 * melakukan apa-apa.
 *
 * Belum masuk: tombol "Masuk" yang jelas, menuju `/masuk` dan kembali ke halaman
 * ini setelah berhasil. Sedang masuk: nama akun di samping avatarnya, jadi
 * tidak ada tebakan apakah sudah masuk atau belum.
 */
export function KontrolAkun() {
  return (
    <>
      <SignedIn>
        <AkunMasuk />
      </SignedIn>
      <SignedOut>
        <Link
          to="/masuk"
          search={{ redirect: typeof window === 'undefined' ? undefined : window.location.pathname }}
          className="adw-btn adw-btn--header adw-btn--header-saran"
        >
          <Ikon nama="orang" ukuran={16} />
          Masuk
        </Link>
      </SignedOut>
    </>
  )
}

function AkunMasuk() {
  const { user } = useUser()
  const nama = user?.primaryEmailAddress?.emailAddress ?? user?.username ?? null

  return (
    <span className="flex items-center gap-2">
      <span
        className="hidden max-w-40 truncate text-[0.8125rem] text-adw-dim lg:inline"
        title={nama ?? undefined}
      >
        {nama ?? 'Akun'}
      </span>
      <UserButton afterSignOutUrl="/" />
    </span>
  )
}

export default AuthBridge