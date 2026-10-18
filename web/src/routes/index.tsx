import { createFileRoute } from '@tanstack/react-router'
import { NavLanding } from '@/components/landing/NavLanding'
import { HeroLanding } from '@/components/landing/HeroLanding'
import { AlurNegak } from '@/components/landing/AlurNegak'
import { PenutupLanding } from '@/components/landing/PenutupLanding'

export const Route = createFileRoute('/')({
  component: Landing,
})

/**
 * Halaman awal.
 *
 * Persuade, with a single decision point: the whole page offers ONE primary
 * action (`TombolDashboard`, identical in the header bar, the hero, and the
 * closing band) plus ONE quiet link field in the hero. Three blocks, one
 * visual anchor (the locked-session panel in the hero), one left text edge,
 * one rhythm of vertical spacing.
 *
 * Rute ini mengambil shell-nya sendiri, bukan header bar `__root`, karena
 * header bar konsol Guru mengubah isinya mengikuti tampilan yang sedang dibuka
 * (HIG, Header Bars) — dan halaman ini punya navigasinya sendiri. Baris yang
 * sama tidak boleh ada dua kali di satu layar.
 */
function Landing() {
  return (
    <>
      <NavLanding />
      <main id="isi">
        <HeroLanding />
        <AlurNegak />
        <PenutupLanding />
      </main>
    </>
  )
}
