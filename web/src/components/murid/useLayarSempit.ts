import { useEffect, useState } from 'react'

/** Deteksi viewport sempit / perangkat sentuh — Sesi butuh layar lebar. */
export function useLayarSempit(): boolean {
  const [sempit, setSempit] = useState(hitung)

  useEffect(() => {
    const mqSempit = window.matchMedia('(max-width: 767px)')
    const mqSentuh = window.matchMedia('(hover: none) and (max-width: 1024px)')
    const perbarui = () => setSempit(mqSempit.matches || mqSentuh.matches)

    perbarui()
    mqSempit.addEventListener('change', perbarui)
    mqSentuh.addEventListener('change', perbarui)
    return () => {
      mqSempit.removeEventListener('change', perbarui)
      mqSentuh.removeEventListener('change', perbarui)
    }
  }, [])

  return sempit
}

function hitung(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(max-width: 767px)').matches ||
    window.matchMedia('(hover: none) and (max-width: 1024px)').matches
  )
}