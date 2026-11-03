import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Tagline reveal (wajib menurut skill, aturan B11).
 *
 * Satu momen besar di tengah halaman: pernyataan manfaat, bukan judul section.
 * Setiap kata mulai di 30% opasitas dan mencapai warna penuh sendiri-sendiri
 * ketika melintasi garis pemicu di tengah viewport — satu blok tidak pernah
 * menyala sekaligus. IntersectionObserver per kata dengan rootMargin yang
 * membentuk garis pemicu itu; kurva dasar 600ms.
 *
 * Di bawah `prefers-reduced-motion` CSS menampilkan teks penuh seketika.
 */

const KALIMAT = 'Tiga pertanyaan dari karya sendiri. Satu kutipan untuk setiap jawaban.'

export function TaglineLanding() {
  const kata = useMemo(() => KALIMAT.split(' '), [])
  const rujuk = useRef<Map<number, HTMLSpanElement>>(new Map())
  const [masuk, setMasuk] = useState<Set<number>>(new Set())

  useEffect(() => {
    const io = new IntersectionObserver(
      (daftar) => {
        for (const e of daftar) {
          if (!e.isIntersecting) continue
          const i = Number((e.target as HTMLElement).dataset.i)
          setMasuk((sebelum) => {
            if (sebelum.has(i)) return sebelum
            const berikut = new Set(sebelum)
            berikut.add(i)
            return berikut
          })
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    rujuk.current.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section aria-label="Tagline" className="lp-shell lp-sek">
      <p className="lp-h2 max-w-[680px] text-pretty">
        {kata.map((k, i) => (
          <span
            key={i}
            data-i={i}
            ref={(el) => {
              if (el) rujuk.current.set(i, el)
            }}
            className={`lp-tagline__kata${masuk.has(i) ? ' lp-tagline__kata--masuk' : ''}`}
          >
            {k}
            {i < kata.length - 1 ? ' ' : ''}
          </span>
        ))}
      </p>
    </section>
  )
}