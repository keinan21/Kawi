/**
 * Banner pengganti aplikasi saat `VITE_CLERK_PUBLISHABLE_KEY` belum diisi.
 * Tanpa kunci, Clerk tidak bisa menginisialisasi sesi — lebih baik memberi
 * instruksi devsional daripada membuat aplikasi crash.
 */
export function BannerTanpaClerkKey() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-medium tracking-wide text-amber-700 uppercase">
        Mode pengembangan
      </p>
      <h1 className="text-2xl font-semibold">set VITE_CLERK_PUBLISHABLE_KEY di .env.local</h1>
      <p className="max-w-lg text-sm text-neutral-600">
        Kunci Clerk belum ada, jadi login, onboard role, dan pemanggilan API
        terproteksi belum bisa berjalan. Salin <code>web/.env.example</code>{' '}
        menjadi <code>web/.env.local</code>, isi kuncinya, lalu jalankan ulang dev
        server.
      </p>
    </main>
  )
}

export default BannerTanpaClerkKey