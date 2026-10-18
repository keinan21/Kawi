import { useEffect } from 'react'
import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'
import { AuthBridge } from '@/components/murid/AuthBridge.tsx'
import { PemilihGaya } from '@/components/adw/adw'
import { bacaGayaUI, terapkanGayaUI } from '@/components/adw/gaya'
import { Ikon } from '@/components/adw/ikon'

export const Route = createRootRoute({
  component: Kerangka,
})

/**
 * Root shell. Deliberately minimal: the app identity and the display-style
 * preference only. The Guru console builds its own header bar inside this one,
 * because a header bar's controls change with the view (HIG, Header Bars) —
 * what must not happen is two stacked bars saying the same thing at once, which
 * is what this replaces.
 *
 * The landing page is the one exception: it brings its own header bar, because a
 * marketing bar carries in-page anchors and two calls to action that the app
 * bar has no room for. So this shell steps aside on `/` rather than stacking a
 * second bar above it.
 */
function Kerangka() {
  useEffect(() => {
    terapkanGayaUI(bacaGayaUI())
  }, [])

  const diLanding = useRouterState({ select: (s) => s.location.pathname === '/' })

  return (
    <div className="min-h-dvh bg-window text-window-fg">
      <a
        href="#isi"
        className="lp-sr focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-accent-fg"
      >
        Lompat ke isi
      </a>

      {diLanding ? null : (
        <header className="border-b border-shade">
          <div className="mx-auto flex h-13 max-w-[1600px] items-center gap-3 px-3 sm:px-5">
            <a
              href="/"
              className="flex items-center gap-2 rounded-md py-1 text-[0.9375rem] font-bold tracking-tight"
            >
              <span
                aria-hidden="true"
                className="grid size-6 place-items-center rounded-[7px] bg-accent text-accent-fg"
              >
                <Ikon nama="tDicek" ukuran={14} />
              </span>
              Assignment Integrity Form
            </a>
            <span className="flex-1" />
            <AuthBridge />
            <PemilihGaya />
          </div>
        </header>
      )}

      <Outlet />
    </div>
  )
}