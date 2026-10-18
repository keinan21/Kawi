import { Link, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@clerk/clerk-react'
import { Ikon } from '@/components/adw/ikon'

const kunciClerk = import.meta.env['VITE_CLERK_PUBLISHABLE_KEY']
const ADA_CLERK = typeof kunciClerk === 'string' && kunciClerk.length > 0

/**
 * The page's one primary action, shared by the header bar, the hero, and the
 * closing band — identical label, identical destination (Law of Similarity:
 * identical elements get identical treatment, so three sightings still read
 * as one decision).
 *
 * A signed-in visitor goes straight to `/guru`. Anyone else goes through the
 * dedicated `/masuk` route with `redirect=/guru`; no Clerk modal is ever
 * opened from this page, so there is exactly one door, never two.
 */
export function TombolDashboard({
  kelas = 'lp-cta lp-cta--riuh',
  denganIkon = true,
}: {
  kelas?: string
  denganIkon?: boolean
}) {
  const navigate = useNavigate()
  const auth = useAuth()

  const sudahMasuk = ADA_CLERK && auth.isLoaded && auth.isSignedIn

  const isi = (
    <>
      {denganIkon ? <Ikon nama="tDicek" ukuran={16} /> : null}
      Buka Dashboard
    </>
  )

  if (!ADA_CLERK || sudahMasuk) {
    return (
      <Link to="/guru" className={kelas}>
        {isi}
      </Link>
    )
  }

  return (
    <button
      type="button"
      className={kelas}
      onClick={() => void navigate({ to: '/masuk', search: { redirect: '/guru' } })}
    >
      {isi}
    </button>
  )
}
