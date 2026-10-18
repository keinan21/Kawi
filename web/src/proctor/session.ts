import type { PelanggaranType } from '@lms/shared'
import {
  BlockedInputDetector,
  FullscreenExitDetector,
  MultiTabDetector,
  TabSwitchDetector,
  WindowBlurDetector,
} from './detectors.ts'
import type { IngestClient } from './ingest.ts'
import type {
  ChannelFactory,
  Detector,
  DocumentLike,
  EventSourceLike,
  PelanggaranEvent,
} from './types.ts'

export interface ProctorSessionOptions {
  /** Dipanggil untuk setiap Pelanggaran yang lolos guard — dipakai UI. */
  onViolation: (type: PelanggaranType, detail: string) => void
  /** Target injeksi untuk tes; default `document`/`window` browser. */
  document?: DocumentLike
  window?: EventSourceLike
  createChannel?: ChannelFactory
  /** Jendela dedup per tipe (ms). Default 1000. */
  dedupWindowMs?: number
  now?: () => number
}

/**
 * Registry detector (DESIGN.md §7) + guard anti-storm:
 * - dedup tipe yang sama dalam jendela waktu tertentu,
 * - event live dibuang selama overlay countdown aktif (suppression guard),
 * - event langsung (input terblokir, multi tab) tetap dicatat.
 */
export class ProctorSession {
  private readonly detectors: Detector[] = []
  private readonly dedupTerakhir = new Map<PelanggaranType, number>()
  private readonly onViolation: ProctorSessionOptions['onViolation']
  private readonly dedupWindowMs: number
  private readonly now: () => number
  private readonly doc: DocumentLike
  private readonly win: EventSourceLike
  private readonly createChannel: ChannelFactory | undefined
  private readonly ingest: IngestClient[] = []
  private suppressed = false
  private berjalan = false

  private readonly handle = (event: PelanggaranEvent): void => {
    // Guard anti-storm: countdown aktif → event live tidak memicu countdown lagi.
    if (this.suppressed && event.kategori === 'live') return

    const terakhir = this.dedupTerakhir.get(event.type)
    const now = event.clientTs
    if (terakhir !== undefined && now - terakhir < this.dedupWindowMs) return
    this.dedupTerakhir.set(event.type, now)

    for (const client of this.ingest) client.enqueue(event.type, event.detail)
    this.onViolation(event.type, event.detail)
  }

  constructor(options: ProctorSessionOptions) {
    this.onViolation = options.onViolation
    this.dedupWindowMs = options.dedupWindowMs ?? 1_000
    this.now = options.now ?? Date.now
    this.doc = options.document ?? document
    this.win = options.window ?? window
    this.createChannel = options.createChannel

    this.detectors.push(
      new TabSwitchDetector(this.handle, this.doc, this.now),
      new WindowBlurDetector(this.handle, this.win, this.now),
      new FullscreenExitDetector(this.handle, this.doc, this.now),
      new BlockedInputDetector(this.handle, this.doc, this.now),
      new MultiTabDetector(this.handle, {
        ...(this.createChannel ? { createChannel: this.createChannel } : {}),
        now: this.now,
      }),
    )
  }

  /** Tambahkan detector custom (mis. deteksi tambahan di masa depan). */
  register(detector: Detector): this {
    this.detectors.push(detector)
    return this
  }

  /** Sambungkan batcher ingest; setiap event yang lolos guard ikut dicatat. */
  attachIngest(client: IngestClient): void {
    this.ingest.push(client)
  }

  /** Aktifkan/nonaktifkan suppression saat overlay countdown tampil. */
  setSuppressed(value: boolean): void {
    this.suppressed = value
  }

  isSuppressed(): boolean {
    return this.suppressed
  }

  /** Bersihkan dedup (dipakai saat Sesi berganti). */
  reset(): void {
    this.dedupTerakhir.clear()
  }

  start(): void {
    if (this.berjalan) return
    this.berjalan = true
    for (const detector of this.detectors) detector.start()
  }

  stop(): void {
    if (!this.berjalan) return
    this.berjalan = false
    for (const detector of this.detectors) detector.stop()
    for (const client of this.ingest) client.stop()
  }

  get aktif(): boolean {
    return this.berjalan
  }
}

/** Fungsi callback UI: dipanggil hanya untuk event live (pemicu countdown). */
export function adalahLive(type: PelanggaranType): boolean {
  return type === 'tab_switch' || type === 'window_blur' || type === 'fullscreen_exit'
}