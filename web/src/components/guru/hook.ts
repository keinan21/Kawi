import { useState } from 'react'

// Hook toast konsol Guru (bukan komponen) — modul sendiri supaya `ui.tsx`
// hanya mengekspor komponen (react-refresh).

export interface PesanToast {
  id: number
  teks: string
}

export function usePesanToast() {
  const [pesan, setPesan] = useState<PesanToast | null>(null)
  const tampilkan = (teks: string) =>
    setPesan((sblm) => ({ id: (sblm?.id ?? 0) + 1, teks }))
  return { pesan, tampilkan }
}