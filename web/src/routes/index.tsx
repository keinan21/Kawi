import { createFileRoute } from '@tanstack/react-router'
import { HeroLanding } from '@/components/landing/HeroLanding'
import { TaglineLanding } from '@/components/landing/TaglineLanding'
import { ManfaatLanding } from '@/components/landing/ManfaatLanding'
import { AlurNegak } from '@/components/landing/AlurNegak'
import { FaqLanding } from '@/components/landing/FaqLanding'
import { PenutupLanding } from '@/components/landing/PenutupLanding'
import { Reveal } from '@/components/landing/Reveal'

export const Route = createFileRoute('/')({
  component: Landing,
})

/**
 * Halaman awal.
 *
 * Satu tawaran, satu audiens, satu aksi utama. Urutannya mengikuti argumen:
 * tawarkan (hero + Sesi terkunci sebagai jangkar visual), ucapkan manfaatnya
 * dalam satu momen besar (tagline reveal), buktikan (manfaat), jelaskan
 * alurnya (tiga langkah + tiga tipe pertanyaan), jawab keberatannya (tanya
 * jawab), baru minta tindakan lagi (band penutup, aksi identik).
 *
 * Tidak ada header bar sendiri — bar aplikasi milik shell root, sama untuk
 * seluruh rute. Bukti sosial sengaja tidak ada: tidak ada testimoni atau
 * angka pelanggan nyata, dan mengarangnya dilarang. Yang ada adalah produknya
 * sendiri, digambar hidup.
 */
function Landing() {
  return (
    <main>
      <HeroLanding />
      <Reveal>
        <TaglineLanding />
      </Reveal>
      <Reveal>
        <ManfaatLanding />
      </Reveal>
      <Reveal>
        <AlurNegak />
      </Reveal>
      <Reveal>
        <FaqLanding />
      </Reveal>
      <Reveal>
        <PenutupLanding />
      </Reveal>
    </main>
  )
}