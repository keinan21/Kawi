import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Scroll reveal, sekali saja.
 *
 * Bagian naik 32px dan memudar dari 0 ke 1 selama 700ms pada kurva dasar
 * (cubic-bezier(0.22,1,0.36,1)), persis aturan gerak skill. Pemicunya
 * IntersectionObserver dengan ambang kecil — bukan listener scroll yang
 * berjalan tiap frame. Difungsikan sekali: turun lagi tidak memutar ulang.
 *
 * Di bawah `prefers-reduced-motion` CSS menampilkan keadaan akhir seketika,
 * jadi bagian tidak pernah tersembunyi.
 */
export function Reveal({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const rujuk = useRef<HTMLDivElement>(null)
  const [masuk, setMasuk] = useState(false)

  useEffect(() => {
    const el = rujuk.current
    if (!el) return
    const io = new IntersectionObserver(
      (daftar) => {
        for (const e of daftar) {
          if (e.isIntersecting) {
            setMasuk(true)
            io.disconnect()
          }
        }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={rujuk}
      className={`lp-reveal${masuk ? ' lp-reveal--masuk' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  )
}