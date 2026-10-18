import { describe, expect, it } from 'vitest'
import { matchShortcut } from './shortcuts.ts'

describe('matchShortcut', () => {
  it('memblokir F12', () => {
    expect(matchShortcut({ key: 'F12' })).toBe('F12 (Alat Pengembang)')
    expect(matchShortcut({ key: 'f12' })).toBe('F12 (Alat Pengembang)')
  })

  it('memblokir Ctrl+Shift+I/J/C untuk alat pengembang', () => {
    expect(matchShortcut({ key: 'I', ctrlKey: true, shiftKey: true })).toBe(
      'Ctrl+Shift+I (Alat Pengembang)',
    )
    expect(matchShortcut({ key: 'J', ctrlKey: true, shiftKey: true })).toBe(
      'Ctrl+Shift+J (Konsol)',
    )
    expect(matchShortcut({ key: 'C', ctrlKey: true, shiftKey: true })).toBe(
      'Ctrl+Shift+C (Inspector)',
    )
  })

  it('memblokir Ctrl+U/P/A/C/V dan Ctrl+S', () => {
    expect(matchShortcut({ key: 'u', ctrlKey: true })).toContain('Lihat Sumber')
    expect(matchShortcut({ key: 'p', ctrlKey: true })).toContain('Cetak')
    expect(matchShortcut({ key: 's', ctrlKey: true })).toContain('Simpan')
    expect(matchShortcut({ key: 'a', ctrlKey: true })).toContain('Pilih Semua')
    expect(matchShortcut({ key: 'c', ctrlKey: true })).toContain('Salin')
    expect(matchShortcut({ key: 'v', ctrlKey: true })).toContain('Tempel')
  })

  it('memperlakukan Cmd seperti Ctrl pada macOS', () => {
    expect(matchShortcut({ key: 'u', metaKey: true })).toBe('Cmd+U (Lihat Sumber Halaman)')
    expect(matchShortcut({ key: 'i', metaKey: true, shiftKey: true })).toBe(
      'Cmd+Shift+I (Alat Pengembang)',
    )
  })

  it('tidak memblokir kombinasi lain', () => {
    expect(matchShortcut({ key: 'i' })).toBeNull()
    expect(matchShortcut({ key: 'v' })).toBeNull()
    expect(matchShortcut({ key: 'w', ctrlKey: true })).toBeNull()
    expect(matchShortcut({ key: 'k', ctrlKey: true, shiftKey: true })).toBeNull()
    expect(matchShortcut({ key: 'r', metaKey: true })).toBeNull()
    expect(matchShortcut({ key: 'u', ctrlKey: true, shiftKey: true })).toBeNull()
    expect(matchShortcut({ key: 'u', ctrlKey: true, altKey: true })).toBeNull()
    expect(matchShortcut({ key: '' })).toBeNull()
  })
})