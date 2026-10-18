import type { PelanggaranType } from '@lms/shared'
import type { TimerApi } from './types.ts'
import { timerApiDefault } from './types.ts'

/** Bentuk payload yang dikirim ke `POST /api/sessions/:id/violations`. */
export interface PelanggaranPayload {
  type: PelanggaranType
  detail: string
  /** ISO timestamp dari klien; `server_ts` tetap ditulis server. */
  client_ts: string
}

export type PelanggaranSender = (
  sessionId: string,
  batch: PelanggaranPayload[],
) => Promise<void>

export interface IngestClientOptions {
  sessionId: string
  send: PelanggaranSender
  /** Batas jumlah event per batch — saat penuh langsung flush. */
  maxBatch?: number
  /** Interval flush berkala selama batch belum penuh. */
  flushIntervalMs?: number
  /** Jeda dasar retry, dikalikan jumlah percobaan. */
  retryDelayMs?: number
  timers?: TimerApi
  clientTs?: () => string
  onError?: (error: unknown) => void
}

/**
 * Fire-and-forget violation ingest (DESIGN.md §7): event dikumpulkan, dikirim
 * per batch, tidak pernah menahan UI dan tidak pernah melempar error ke
 * pemanggil. Batch yang gagal dikembalikan ke antrean lalu dicoba lagi.
 */
export class IngestClient {
  private readonly send: PelanggaranSender
  private readonly sessionId: string
  private readonly maxBatch: number
  private readonly retryDelayMs: number
  private readonly timers: TimerApi
  private readonly clientTs: () => string
  private readonly onError: (error: unknown) => void
  private readonly antrean: PelanggaranPayload[] = []
  private readonly gagal: PelanggaranPayload[] = []
  private interval: number | null = null
  private retryTimer: number | null = null
  private percobaanRetry = 0

  constructor(options: IngestClientOptions) {
    this.sessionId = options.sessionId
    this.send = options.send
    this.maxBatch = options.maxBatch ?? 20
    this.retryDelayMs = options.retryDelayMs ?? 4_000
    this.timers = options.timers ?? timerApiDefault
    this.clientTs = options.clientTs ?? (() => new Date().toISOString())
    this.onError = options.onError ?? (() => undefined)
    this.interval = this.timers.setInterval(
      () => void this.flush(),
      options.flushIntervalMs ?? 5_000,
    )
  }

  /** Jumlah event yang belum terkirim (antrean + gagal). */
  get size(): number {
    return this.antrean.length + this.gagal.length
  }

  private scheduleRetry(): void {
    if (this.retryTimer !== null || this.gagal.length === 0) return
    const delay = this.retryDelayMs * (this.percobaanRetry + 1)
    this.percobaanRetry += 1
    this.retryTimer = this.timers.setTimeout(() => {
      this.retryTimer = null
      void this.kirim(this.gagal.splice(0, this.gagal.length))
    }, delay)
  }

  private async kirim(batch: PelanggaranPayload[]): Promise<void> {
    if (batch.length === 0) return
    try {
      await this.send(this.sessionId, batch)
      this.percobaanRetry = 0
    } catch (error) {
      this.onError(error)
      this.gagal.push(...batch)
      this.scheduleRetry()
    }
  }

  /** Catat satu Pelanggaran; flush otomatis saat batch penuh. */
  enqueue(type: PelanggaranType, detail: string): void {
    this.antrean.push({ type, detail, client_ts: this.clientTs() })
    if (this.antrean.length >= this.maxBatch) void this.flush()
  }

  /** Kirim antrean yang ada. Tidak melempar error, tidak di-await pemanggil UI. */
  flush(): Promise<void> {
    const batch = [...this.gagal.splice(0, this.gagal.length), ...this.antrean.splice(0)]
    if (batch.length === 0) return Promise.resolve()
    return this.kirim(batch)
  }

  /** Hentikan timer lalu kirim sisa antrean satu kali. */
  stop(): void {
    if (this.interval !== null) {
      this.timers.clearInterval(this.interval)
      this.interval = null
    }
    if (this.retryTimer !== null) {
      this.timers.clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
    void this.flush()
  }
}