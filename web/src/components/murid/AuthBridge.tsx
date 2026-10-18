import { useEffect } from 'react'
import { SignedIn, UserButton, useAuth, useUser } from '@clerk/clerk-react'
import { setMuridAuthTokenProvider } from '@/lib/murid-api.ts'
import { setGuruAuthTokenProvider } from '@/lib/guru-api.ts'

/**
 * Jembatan auth: menyambungkan token Clerk ke kedua client API.
 * Akun bersifat universal — tidak ada penguncian peran tunggal.
 */
export function AuthBridge() {
  const { getToken } = useAuth()
  const { user } = useUser()

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

  return (
    <SignedIn>
      <div className="flex items-center gap-3">
        <span className="hidden text-xs text-neutral-500 sm:inline">
          {user?.primaryEmailAddress?.emailAddress ?? 'Murid'}
        </span>
        <UserButton afterSignOutUrl="/" />
      </div>
    </SignedIn>
  )
}

export default AuthBridge