import { useEffect } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { AuthBridge } from '@/components/murid/AuthBridge.tsx'
import { BarApp } from '@/components/app/BarApp'
import { bacaGayaUI, terapkanGayaUI } from '@/components/adw/gaya'

export const Route = createRootRoute({
  component: Kerangka,
})

/**
 * Root shell: the token bridge, the display-style preference, and the one app
 * bar.
 *
 * The bar used to have two lives — this shell rendered an identity bar, and the
 * console and the Sesi page each rendered a second one on top of it — so the
 * same words could appear twice within 100px and the controls meant different
 * things in different routes. There is now exactly one, mounted here, and a view
 * fills its slots through `<IsiBar />` rather than bringing its own (HIG, Header
 * Bars). The landing page uses the same bar: it is the same product, and a
 * visitor who navigates from the hero to a console view must not meet a
 * different-looking app.
 */
function Kerangka() {
  useEffect(() => {
    terapkanGayaUI(bacaGayaUI())
  }, [])

  return (
    <div className="min-h-dvh bg-window text-window-fg">
      <a
        href="#isi"
        className="lp-sr focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-accent focus:px-3 focus:py-2 focus:text-sm focus:font-bold focus:text-accent-fg"
      >
        Lompat ke isi
      </a>

      <AuthBridge />

      {/* The bar owns its provider, so the whole app renders inside it and any
          view can fill the bar's slots through `<IsiBar />`. */}
      <BarApp>
        {/* One skip-link target for the whole app: every view's own `<main>`
            renders inside it, so the link works the same on every route. */}
        <div id="isi" tabIndex={-1} className="focus:outline-none">
          <Outlet />
        </div>
      </BarApp>
    </div>
  )
}