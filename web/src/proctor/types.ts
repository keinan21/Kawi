import type { PelanggaranType } from '@lms/shared'

/**
 * Kategori event Pelanggaran (DESIGN.md §7):
 * - `live`     → memunculkan countdown 5 detik, diabaikan = auto-submit
 * - `langsung` → langsung dicatat, tanpa countdown (input terblokir, multi tab)
 */
export type PelanggaranKategori = 'live' | 'langsung'

/** Event tunggal yang dikumpulkan ProctorSession sebelum diteruskan ke UI + ingest. */
export interface PelanggaranEvent {
  type: PelanggaranType
  kategori: PelanggaranKategori
  /** Alasan spesifik dalam Bahasa Indonesia — disimpan sebagai `detail` di DB. */
  detail: string
  /** `Date.now()` saat event terjadi (server tetap menulis `server_ts`). */
  clientTs: number
}

/** Callback internal detector → session. */
export type PelanggaranSink = (event: PelanggaranEvent) => void

/**
 * Kontrak detector (DESIGN.md §7): satu class per kekhawatiran.
 * Sengaja tanpa React — murni logika, bisa diuji di node.
 */
export interface Detector {
  start(): void
  stop(): void
}

/** Event live: memicu countdown. */
export const LIVE_PELANGGARAN: readonly PelanggaranType[] = [
  'tab_switch',
  'window_blur',
  'fullscreen_exit',
]

/** Event yang langsung dicatat, tanpa countdown. */
export const LANGSUNG_PELANGGARAN: readonly PelanggaranType[] = [
  'copy_blocked',
  'paste_blocked',
  'context_menu_blocked',
  'shortcut_blocked',
  'multi_tab',
]

/** Sumber event DOM yang di-inject — membuat detector bisa diuji tanpa browser. */
export interface EventSourceLike {
  addEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: AddEventListenerOptions | boolean,
  ): void
  removeEventListener(
    type: string,
    listener: (event: Event) => void,
    options?: AddEventListenerOptions | boolean,
  ): void
}

/** `document` yang dibutuhkan detector fullscreen/visibility. */
export interface DocumentLike extends EventSourceLike {
  readonly visibilityState?: DocumentVisibilityState
  readonly fullscreenElement?: Element | null
}

/** BroadcastChannel minimal untuk deteksi multi tab. */
export interface ChannelLike {
  postMessage(message: unknown): void
  close(): void
  onmessage: ((event: { data: unknown }) => void) | null
}

export type ChannelFactory = (name: string) => ChannelLike | null

/** Timer yang bisa di-inject agar tes deterministik. */
export interface TimerApi {
  setInterval: (fn: () => void, ms: number) => number
  clearInterval: (handle: number) => void
  setTimeout: (fn: () => void, ms: number) => number
  clearTimeout: (handle: number) => void
}

export const timerApiDefault: TimerApi = {
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms) as unknown as number,
  clearInterval: (h) => globalThis.clearInterval(h),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number,
  clearTimeout: (h) => globalThis.clearTimeout(h),
}