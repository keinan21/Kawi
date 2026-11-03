import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from '@tanstack/react-router'

import { HeaderBar, PemilihGaya } from '@/components/adw/adw'
import { Ikon } from '@/components/adw/ikon'
import { KontrolAkun } from '@/components/murid/AuthBridge'

/**
 * The one app bar.
 *
 * Every route in the product sits under this bar, including the landing page —
 * there is no second header bar anywhere, and none may be added. The bar has
 * three alignment points and their meaning never changes:
 *
 * - **start** — the app identity, linking home. Always present, always the same.
 * - **centre** — what view you are in ("Konsol Guru · Daftar Tugas",
 *   "Sesi terkunci"). Filled by the view through `<IsiBar judul=… />`.
 * - **end** — the view's own action, then the display-style picker, then your
 *   account. The view's action goes first in the group because it is the most
 *   likely thing to be pressed (Fitts's law), and it is always the same shape
 *   whatever it does: a header button.
 *
 * Views fill their slots with `<IsiBar />`, which portals into the bar instead
 * of rendering a second one. That is the whole mechanism: a view can put a back
 * control, a title, a reload, or a timer in the bar without owning the bar, so
 * no two bars can ever stack.
 *
 * Signed out there is no account control at all — an account slot with nothing
 * in it is just a mystery. The page's own primary action is the way in.
 */
export function BarApp({ children }: { children?: ReactNode }) {
  const [awal, setAwal] = useState<HTMLElement | null>(null)
  const [judul, setJudul] = useState<HTMLElement | null>(null)
  const [aksi, setAksi] = useState<HTMLElement | null>(null)
  const [bawah, setBawah] = useState<HTMLElement | null>(null)

  const slot = useMemo(
    () => ({ awal, judul, aksi, bawah }),
    [awal, judul, aksi, bawah],
  )

  return (
    <KonteksBar.Provider value={slot}>
      <HeaderBar
        awal={
          <>
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
              <span className="hidden truncate sm:inline">Assignment Integrity Form</span>
            </Link>
            <Slot noda={awal} setNoda={setAwal} />
          </>
        }
        judul={<Slot noda={judul} setNoda={setJudul} />}
        aksen={
          <>
            <Slot noda={aksi} setNoda={setAksi} />
            <PemilihGaya />
            <KontrolAkun />
          </>
        }
      >
        <Slot noda={bawah} setNoda={setBawah} />
      </HeaderBar>

      {children}
    </KonteksBar.Provider>
  )
}

type SlotBar = {
  awal: HTMLElement | null
  judul: HTMLElement | null
  aksi: HTMLElement | null
  bawah: HTMLElement | null
}

const KonteksBar = createContext<SlotBar>({
  awal: null,
  judul: null,
  aksi: null,
  bawah: null,
})

/**
 * The bar's own half of a slot: an empty, layout-transparent anchor that a
 * view's `<IsiBar />` portals into. `display: contents` means the anchor never
 * affects spacing or alignment — the portalled nodes sit exactly as if the view
 * had rendered them there directly.
 */
function Slot({
  noda,
  setNoda,
  children,
}: {
  noda: HTMLElement | null
  setNoda: (n: HTMLElement | null) => void
  children?: ReactNode
}) {
  return (
    <span ref={setNoda} className="contents">
      {noda && children ? createPortal(children, noda) : null}
    </span>
  )
}

/**
 * A view's content for the app bar.
 *
 * Renders nothing where it sits; portals its parts into the bar. `awal` is for
 * a back or step control, `judul` names the view, `aksi` is the view's single
 * action, and `bawah` is for anything that hangs under the bar (the Sesi
 * session's thin progress bar is the only user today).
 */
export function IsiBar({
  awal,
  judul,
  aksi,
  bawah,
}: {
  awal?: ReactNode
  judul?: ReactNode
  aksi?: ReactNode
  bawah?: ReactNode
}) {
  const slot = useContext(KonteksBar)

  return (
    <>
      {slot.awal && awal ? createPortal(awal, slot.awal) : null}
      {slot.judul && judul ? createPortal(judul, slot.judul) : null}
      {slot.aksi && aksi ? createPortal(aksi, slot.aksi) : null}
      {slot.bawah && bawah ? createPortal(bawah, slot.bawah) : null}
    </>
  )
}