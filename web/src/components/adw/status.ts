import type { SessionStatus } from '@lms/shared'

/**
 * Peta status Sesi, dipisah dari komponen rail supaya berkas komponen itu
 * hanya mengekspor komponen (react-refresh/only-export-components).
 */

export const LENCANA_RAIL: Record<SessionStatus, string> = {
  created: 'Menunggu Unggahan',
  generating: 'Menyusun Pertanyaan',
  answering: 'Menjawab Pertanyaan',
  submitted: 'Terkirim',
  auto_submitted: 'Dihentikan sistem',
}

export function NadaStatus(status: SessionStatus): 'netral' | 'aksen' | 'sukses' | 'galat' {
  switch (status) {
    case 'generating':
    case 'answering':
      return 'aksen'
    case 'submitted':
      return 'sukses'
    case 'auto_submitted':
      return 'galat'
    default:
      return 'netral'
  }
}
