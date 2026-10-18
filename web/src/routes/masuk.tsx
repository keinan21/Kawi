import { useEffect } from 'react'
import { createFileRoute, useLocation, useNavigate } from '@tanstack/react-router'
import { SignIn, useAuth } from '@clerk/clerk-react'

import { Banner, Kotak, Pemuat } from '@/components/adw/adw'

export const Route = createFileRoute('/masuk')({
  component: HalamanMasuk,
})

const ADA_CLERK = Boolean(import.meta.env['VITE_CLERK_PUBLISHABLE_KEY'])

function HalamanMasuk() {
  const auth = useAuth()
  const navigate = useNavigate()
  const lokasi = useLocation()
  const redirect = typeof lokasi.search === 'object' && lokasi.search !== null && 'redirect' in lokasi.search && typeof (lokasi.search as Record<string, unknown>).redirect === 'string'
    ? (lokasi.search as Record<string, string>).redirect
    : '/guru'

  useEffect(() => {
    if (!ADA_CLERK) return
    if (auth.isLoaded && auth.isSignedIn) void navigate({ to: redirect })
  }, [auth.isLoaded, auth.isSignedIn, redirect, navigate])

  if (!ADA_CLERK) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
        <Kotak className="px-6 py-8">
          <Banner>
            Mode pengembangan: kunci Clerk belum diatur, sehingga halaman masuk
            tidak aktif. Gunakan tombol langsung ke Dashboard.
          </Banner>
          <div className="mt-4">
            <a href="/guru" className="adw-btn adw-btn--suggested w-full !min-h-10">
              Buka Dashboard
            </a>
          </div>
        </Kotak>
      </main>
    )
  }

  if (!auth.isLoaded) return <Pemuat teks="Memuat" />

  return (
    <main className="mx-auto max-w-md px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Masuk</h1>
      <p className="mt-1 text-pretty text-adw-dim">
        Masuk dengan akunmu untuk membuka Konsol atau memulai Sesi. Satu akun bisa
        dipakai sebagai Guru maupun Murid.
      </p>
      <div className="mt-6">
        <SignIn
          path="/masuk"
          routing="path"
          forceRedirectUrl={redirect}
        />
      </div>
    </main>
  )
}
