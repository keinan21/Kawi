import { Link } from '@tanstack/react-router'
import { Ikon } from '@/components/adw/ikon'
import { TombolDashboard } from './TombolDashboard'

/**
 * The landing page's header bar.
 *
 * A header bar, not a marketing nav: the app identity on the start side, the
 * page's one primary action on the end side, and nothing else competing with
 * the hero below it (Figure–Ground: the header must not out-shout the offer).
 * At most two in-page anchors survive — everything a visitor needs is one
 * scroll away, so a fuller nav would be choice without purpose (Hick's law).
 * No collapsed menu: the anchors hide on narrow screens, the action never
 * does (Fitts's law: the primary target stays large and in place).
 */

const TAUTAN = [
  { href: '#alur', label: 'Cara kerja' },
  { href: '#batas', label: 'Batas' },
]

export function NavLanding() {
  return (
    <header className="adw-headerbar sticky top-0 z-30">
      <div className="lp-shell flex h-15 items-center gap-3">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 rounded-md py-1 text-[0.9375rem] font-bold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="grid size-6 flex-none place-items-center rounded-[7px] bg-accent text-accent-fg"
          >
            <Ikon nama="tDicek" ukuran={14} />
          </span>
          <span className="truncate">Assignment Integrity Form</span>
        </Link>

        <nav aria-label="Bagian halaman" className="ml-4 hidden md:block">
          <ul className="m-0 flex list-none items-center gap-1 p-0">
            {TAUTAN.map((t) => (
              <li key={t.href}>
                <a
                  href={t.href}
                  className="rounded-control px-2.5 py-1.5 text-[0.875rem] font-medium transition-colors hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)]"
                >
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <span className="flex-1" />

        <TombolDashboard kelas="adw-btn adw-btn--suggested" denganIkon={false} />
      </div>
    </header>
  )
}
