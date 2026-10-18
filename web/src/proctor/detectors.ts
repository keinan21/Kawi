import type {
  ChannelFactory,
  ChannelLike,
  DocumentLike,
  EventSourceLike,
  PelanggaranEvent,
  PelanggaranSink,
  TimerApi,
} from './types.ts'
import { timerApiDefault } from './types.ts'
import { matchShortcut } from './shortcuts.ts'

/**
 * Detector-modul lockdown (DESIGN.md §7). Satu class per kekhawatiran,
 * semua murni logika: target DOM, channel, dan timer bisa di-inject agar
 * unit test berjalan tanpa browser.
 */

function makeEvent(
  type: PelanggaranEvent['type'],
  kategori: PelanggaranEvent['kategori'],
  detail: string,
  now: () => number,
): PelanggaranEvent {
  return { type, kategori, detail, clientTs: now() }
}

export class TabSwitchDetector {
  private readonly doc: DocumentLike
  private readonly now: () => number
  private readonly sink: PelanggaranSink
  private aktif = false

  private readonly onVisibilityChange = (): void => {
    if (!this.aktif) return
    if (this.doc.visibilityState !== 'hidden') return
    this.sink(
      makeEvent(
        'tab_switch',
        'live',
        'Tab Sesi tidak lagi terlihat (berpindah tab atau minimized).',
        this.now,
      ),
    )
  }

  constructor(sink: PelanggaranSink, doc: DocumentLike = document, now: () => number = Date.now) {
    this.sink = sink
    this.doc = doc
    this.now = now
  }

  start(): void {
    if (this.aktif) return
    this.aktif = true
    this.doc.addEventListener('visibilitychange', this.onVisibilityChange)
  }

  stop(): void {
    if (!this.aktif) return
    this.aktif = false
    this.doc.removeEventListener('visibilitychange', this.onVisibilityChange)
  }
}

export class WindowBlurDetector {
  private readonly win: EventSourceLike
  private readonly now: () => number
  private readonly sink: PelanggaranSink
  private aktif = false

  private readonly onBlur = (): void => {
    if (!this.aktif) return
    this.sink(
      makeEvent(
        'window_blur',
        'live',
        'Fokus jendela Sesi berpindah ke aplikasi lain.',
        this.now,
      ),
    )
  }

  constructor(sink: PelanggaranSink, win: EventSourceLike = window, now: () => number = Date.now) {
    this.sink = sink
    this.win = win
    this.now = now
  }

  start(): void {
    if (this.aktif) return
    this.aktif = true
    this.win.addEventListener('blur', this.onBlur)
  }

  stop(): void {
    if (!this.aktif) return
    this.aktif = false
    this.win.removeEventListener('blur', this.onBlur)
  }
}

/**
 * Menangkap keluar-fullscreen. Hanya dianggap pelanggaran bila memang pernah
 * masuk fullscreen lalu keluar — event masuk (fullscreenElement != null) diabaikan.
 */
export class FullscreenExitDetector {
  private readonly doc: DocumentLike
  private readonly now: () => number
  private readonly sink: PelanggaranSink
  private aktif = false
  private pernahFullscreen = false

  private readonly onFullscreenChange = (): void => {
    if (!this.aktif) return
    if (this.doc.fullscreenElement) {
      this.pernahFullscreen = true
      return
    }
    if (!this.pernahFullscreen) return
    this.sink(
      makeEvent(
        'fullscreen_exit',
        'live',
        'Sesi keluar dari mode layar penuh.',
        this.now,
      ),
    )
  }

  constructor(sink: PelanggaranSink, doc: DocumentLike = document, now: () => number = Date.now) {
    this.sink = sink
    this.doc = doc
    this.now = now
  }

  start(): void {
    if (this.aktif) return
    this.aktif = true
    this.pernahFullscreen = Boolean(this.doc.fullscreenElement)
    this.doc.addEventListener('fullscreenchange', this.onFullscreenChange)
  }

  stop(): void {
    if (!this.aktif) return
    this.aktif = false
    this.doc.removeEventListener('fullscreenchange', this.onFullscreenChange)
  }
}

/**
 * Listener input terblokir: copy, paste, contextmenu, selectstart, dragstart,
 * dan pintasan terlarang. Semua `preventDefault()` lalu dicatat langsung
 * (tanpa countdown).
 */
export class BlockedInputDetector {
  private readonly doc: DocumentLike
  private readonly now: () => number
  private readonly sink: PelanggaranSink
  private aktif = false

  private readonly onCopy = (event: Event): void => {
    if (!this.aktif) return
    event.preventDefault()
    this.sink(
      makeEvent('copy_blocked', 'langsung', 'Menyalin konten diblokir selama Sesi.', this.now),
    )
  }

  private readonly onPaste = (event: Event): void => {
    if (!this.aktif) return
    event.preventDefault()
    this.sink(
      makeEvent('paste_blocked', 'langsung', 'Menempel konten diblokir selama Sesi.', this.now),
    )
  }

  private readonly onContextMenu = (event: Event): void => {
    if (!this.aktif) return
    event.preventDefault()
    this.sink(
      makeEvent(
        'context_menu_blocked',
        'langsung',
        'Menu klik kanan diblokir selama Sesi.',
        this.now,
      ),
    )
  }

  private readonly onKeyDown = (event: Event): void => {
    if (!this.aktif) return
    const label = matchShortcut(event as KeyboardEvent)
    if (!label) return
    event.preventDefault()
    this.sink(
      makeEvent(
        'shortcut_blocked',
        'langsung',
        `Pintasan terlarang ditekan: ${label}.`,
        this.now,
      ),
    )
  }

  // selectstart/dragstart diblokir agar konten tidak bisa diseleksi atau
  // diseret keluar. Keduanya tidak punya anggota enum PelanggaranType, jadi
  // hanya diblokir tanpa dilaporkan (lihat laporan: celah kontrak §7).
  private readonly onBlockOnly = (event: Event): void => {
    if (!this.aktif) return
    event.preventDefault()
  }

  constructor(sink: PelanggaranSink, doc: DocumentLike = document, now: () => number = Date.now) {
    this.sink = sink
    this.doc = doc
    this.now = now
  }

  start(): void {
    if (this.aktif) return
    this.aktif = true
    this.doc.addEventListener('copy', this.onCopy)
    this.doc.addEventListener('paste', this.onPaste)
    this.doc.addEventListener('contextmenu', this.onContextMenu)
    this.doc.addEventListener('keydown', this.onKeyDown)
    this.doc.addEventListener('selectstart', this.onBlockOnly)
    this.doc.addEventListener('dragstart', this.onBlockOnly)
  }

  stop(): void {
    if (!this.aktif) return
    this.aktif = false
    this.doc.removeEventListener('copy', this.onCopy)
    this.doc.removeEventListener('paste', this.onPaste)
    this.doc.removeEventListener('contextmenu', this.onContextMenu)
    this.doc.removeEventListener('keydown', this.onKeyDown)
    this.doc.removeEventListener('selectstart', this.onBlockOnly)
    this.doc.removeEventListener('dragstart', this.onBlockOnly)
  }
}

/** Menyetel handler ke channel apa pun (native atau fake test). */
function bindChannel(
  channel: ChannelLike,
  handler: (data: unknown) => void,
): void {
  channel.onmessage = (event) => handler(event.data)
}

interface MultiTabOptions {
  channelName?: string
  createChannel?: ChannelFactory
  intervalMs?: number
  peerTimeoutMs?: number
  timers?: TimerApi
  now?: () => number
  id?: string
}

/**
 * Deteksi silang-tab lewat BroadcastChannel heartbeat: tiap page load punya id
 * sendiri, ping tiap 2 detik. Selama ada peer lain (presence > 1) satu event
 * `multi_tab` dilaporkan — tidak diulang sampai Sesi berakhir.
 */
export class MultiTabDetector {
  private readonly sink: PelanggaranSink
  private readonly opts: Required<Omit<MultiTabOptions, 'createChannel'>> &
    Pick<MultiTabOptions, 'createChannel'>
  private readonly peer: Map<string, number>
  private channel: ChannelLike | null = null
  private timer: number | null = null
  private aktif = false
  private sudahDilaporkan = false

  private readonly onData = (payload: unknown): void => {
    if (!this.aktif) return
    const data = payload as { kind?: unknown; id?: unknown } | null
    if (!data || typeof data !== 'object') return
    if (typeof data.id !== 'string' || data.id === this.opts.id) return

    if (data.kind === 'bye') {
      this.peer.delete(data.id)
      return
    }
    if (data.kind !== 'ping') return

    this.peer.set(data.id, this.opts.now())
    if (this.sudahDilaporkan || this.peer.size === 0) return
    this.sudahDilaporkan = true
    this.sink({
      type: 'multi_tab',
      kategori: 'langsung',
      detail: `Tab lain untuk Sesi ini terdeteksi (${this.peer.size + 1} tab terbuka).`,
      clientTs: this.opts.now(),
    })
  }

  constructor(sink: PelanggaranSink, options: MultiTabOptions = {}) {
    this.sink = sink
    this.opts = {
      channelName: options.channelName ?? 'lms.proctor.sesi',
      intervalMs: options.intervalMs ?? 2_000,
      peerTimeoutMs: options.peerTimeoutMs ?? 7_000,
      timers: options.timers ?? timerApiDefault,
      now: options.now ?? Date.now,
      id: options.id ?? `tab-${Math.random().toString(36).slice(2, 10)}`,
      createChannel: options.createChannel,
    }
    this.peer = new Map()
  }

  private prunePeers(): void {
    const batas = this.opts.now() - this.opts.peerTimeoutMs
    for (const [id, lastSeen] of this.peer) {
      if (lastSeen < batas) this.peer.delete(id)
    }
  }

  private ping(): void {
    this.prunePeers()
    this.channel?.postMessage({ kind: 'ping', id: this.opts.id })
  }

  start(): void {
    if (this.aktif) return
    this.aktif = true
    const factory =
      this.opts.createChannel ??
      ((name: string): ChannelLike | null =>
        typeof BroadcastChannel === 'undefined'
          ? null
          : (new BroadcastChannel(name) as unknown as ChannelLike))
    this.channel = factory(this.opts.channelName)
    if (!this.channel) return
    bindChannel(this.channel, this.onData)
    this.ping()
    this.timer = this.opts.timers.setInterval(() => this.ping(), this.opts.intervalMs)
  }

  stop(): void {
    if (!this.aktif) return
    this.aktif = false
    if (this.timer !== null) {
      this.opts.timers.clearInterval(this.timer)
      this.timer = null
    }
    this.channel?.postMessage({ kind: 'bye', id: this.opts.id })
    if (this.channel) {
      this.channel.onmessage = null
      this.channel.close()
      this.channel = null
    }
    this.peer.clear()
  }
}