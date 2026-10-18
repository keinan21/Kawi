import { Ikon } from '@/components/adw/ikon'

/**
 * Halaman penutup: Sesi terkunci hanya berjalan di laptop.
 *
 * Ini keputusan produk yang disengaja (DESIGN.md §7), bukan kegagalan tata
 * letak — jadi pesannya menjelaskan alasannya dan menawarkan jalan keluar, bukan
 * hanya menolak. Placeholder page simbolik, gaya Adwaita.
 */
export function GerbangLaptop({ judul }: { judul: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-window px-6">
      <div className="max-w-sm text-center">
        <Ikon nama="peta" ukuran={56} className="mx-auto adw-dim" />
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-balance">Buka di laptop</h1>
        <p className="mt-3 text-pretty text-adw-dim">
          {judul} Sesi terkunci berjalan di layar lebar dengan keyboard. Buka
          tautan ini di laptop atau komputer, lalu lanjutkan dari sana — tidak ada
          yang hilang.
        </p>
      </div>
    </main>
  )
}

export default GerbangLaptop
