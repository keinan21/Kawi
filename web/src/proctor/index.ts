/**
 * Modul lockdown / proctor (DESIGN.md §7) — logika murni, tanpa React.
 * Dipakai oleh halaman Sesi Murid lewat `ProctorSession` + `IngestClient`.
 */
export type {
  ChannelFactory,
  ChannelLike,
  Detector,
  DocumentLike,
  EventSourceLike,
  PelanggaranEvent,
  PelanggaranKategori,
  PelanggaranSink,
  TimerApi,
} from './types.ts'
export { LANGSUNG_PELANGGARAN, LIVE_PELANGGARAN, timerApiDefault } from './types.ts'
export {
  BlockedInputDetector,
  FullscreenExitDetector,
  MultiTabDetector,
  TabSwitchDetector,
  WindowBlurDetector,
} from './detectors.ts'
export { matchShortcut } from './shortcuts.ts'
export type { ShortcutInput } from './shortcuts.ts'
export type { IngestClientOptions, PelanggaranPayload, PelanggaranSender } from './ingest.ts'
export { IngestClient } from './ingest.ts'
export type { ProctorSessionOptions } from './session.ts'
export { adalahLive, ProctorSession } from './session.ts'