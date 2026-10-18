import type { ChannelLike } from './types.ts'
import { ProctorSession } from './session.ts'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Target DOM palsu:_methods addEventListener + pemicu manual. */
function targetPalsu() {
  const listener = new Map<string, Set<(event: Event) => void>>()
  return {
    addEventListener(type: string, fn: (event: Event) => void) {
      const set = listener.get(type) ?? new Set<(event: Event) => void>()
      set.add(fn)
      listener.set(type, set)
    },
    removeEventListener(type: string, fn: (event: Event) => void) {
      listener.get(type)?.delete(fn)
    },
    trigger(type: string, event: Partial<Event> = {}) {
      const preventDefault = vi.fn()
      const fake = { preventDefault, ...event } as unknown as Event
      for (const fn of [...(listener.get(type) ?? [])]) fn(fake)
      return preventDefault
    },
    jumlahListener(type: string) {
      return listener.get(type)?.size ?? 0
    },
  }
}

interface ChannelPalsu {
  onmessage: ((event: { data: unknown }) => void) | null
  postMessage: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

describe('ProctorSession', () => {
  type Target = ReturnType<typeof targetPalsu>
  let docTarget: Target
  let winTarget: Target
  let doc: Target & { visibilityState: DocumentVisibilityState; fullscreenElement: Element | null }
  let win: Target
  let now: number
  let onViolation: ReturnType<typeof vi.fn>
  let channels: ChannelPalsu[]
  let session: ProctorSession

  beforeEach(() => {
    docTarget = targetPalsu()
    doc = Object.assign(docTarget, {
      visibilityState: 'visible' as DocumentVisibilityState,
      fullscreenElement: null as Element | null,
    })
    winTarget = targetPalsu()
    win = winTarget
    now = 1_700_000_000_000
    onViolation = vi.fn()
    channels = []
    session = new ProctorSession({
      onViolation,
      document: doc,
      window: win,
      createChannel: (): ChannelLike => {
        const ch: ChannelPalsu = {
          onmessage: null,
          postMessage: vi.fn(),
          close: vi.fn(),
        }
        channels.push(ch)
        return ch
      },
      now: () => now,
      dedupWindowMs: 1_000,
    })
  })

  it(' memasang listener saat start dan melepas saat stop', () => {
    expect(doc.jumlahListener('visibilitychange')).toBe(0)
    session.start()
    expect(doc.jumlahListener('visibilitychange')).toBe(1)
    expect(win.jumlahListener('blur')).toBe(1)
    expect(doc.jumlahListener('copy')).toBe(1)
    expect(doc.jumlahListener('keydown')).toBe(1)

    session.stop()
    expect(doc.jumlahListener('visibilitychange')).toBe(0)
    expect(win.jumlahListener('blur')).toBe(0)
    expect(doc.jumlahListener('copy')).toBe(0)
  })

  it('tab_switch hanya saat dokumen hidden', () => {
    session.start()
    doc.trigger('visibilitychange')
    expect(onViolation).not.toHaveBeenCalled()

    doc.visibilityState = 'hidden'
    doc.trigger('visibilitychange')
    expect(onViolation).toHaveBeenCalledWith('tab_switch', expect.stringContaining('Tab'))
  })

  it('window_blur saat jendela kehilangan fokus', () => {
    session.start()
    win.trigger('blur')
    expect(onViolation).toHaveBeenCalledWith('window_blur', expect.any(String))
  })

  it('fullscreen_exit hanya setelah pernah masuk fullscreen', () => {
    session.start()
    doc.trigger('fullscreenchange')
    expect(onViolation).not.toHaveBeenCalled()

    doc.fullscreenElement = {} as Element
    doc.trigger('fullscreenchange')
    doc.fullscreenElement = null
    doc.trigger('fullscreenchange')

    expect(onViolation).toHaveBeenCalledWith('fullscreen_exit', expect.any(String))
  })

  it('input terblokir langsung dicatat dengan preventDefault', () => {
    session.start()

    expect(doc.trigger('copy')).toHaveBeenCalled()
    expect(doc.trigger('paste')).toHaveBeenCalled()
    expect(doc.trigger('contextmenu')).toHaveBeenCalled()
    expect(doc.trigger('selectstart')).toHaveBeenCalled()
    expect(doc.trigger('dragstart')).toHaveBeenCalled()

    expect(onViolation.mock.calls.map((c) => c[0])).toEqual([
      'copy_blocked',
      'paste_blocked',
      'context_menu_blocked',
    ])
  })

  it('shortcut terlarang dicatat sebagai shortcut_blocked', () => {
    session.start()
    doc.trigger('keydown', { key: 'u', ctrlKey: true } as Partial<Event>)
    expect(onViolation).toHaveBeenCalledWith(
      'shortcut_blocked',
      expect.stringContaining('Ctrl+U'),
    )
  })

  it('dedup tipe yang sama dalam jendela 1 detik', () => {
    session.start()
    doc.visibilityState = 'hidden'

    doc.trigger('visibilitychange')
    now += 999
    doc.trigger('visibilitychange')
    expect(onViolation).toHaveBeenCalledTimes(1)

    now += 2
    doc.trigger('visibilitychange')
    expect(onViolation).toHaveBeenCalledTimes(2)
  })

  it('suppression: event live dibuang saat countdown aktif, event langsung tetap dicatat', () => {
    session.start()
    session.setSuppressed(true)
    expect(session.isSuppressed()).toBe(true)

    doc.visibilityState = 'hidden'
    doc.trigger('visibilitychange')
    win.trigger('blur')
    expect(onViolation).not.toHaveBeenCalled()

    doc.trigger('copy')
    expect(onViolation).toHaveBeenCalledWith('copy_blocked', expect.any(String))

    session.setSuppressed(false)
    now += 2_000
    doc.trigger('visibilitychange')
    expect(onViolation).toHaveBeenLastCalledWith('tab_switch', expect.any(String))
  })

  it('multi_tab dilaporkan sekali meski ping berulang', () => {
    session.start()
    const ch = channels[0]
    const selfId = (ch.postMessage.mock.calls[0][0] as { id: string }).id

    ch.onmessage?.({ data: { kind: 'ping', id: 'tab-lain' } })
    expect(onViolation).toHaveBeenCalledTimes(1)
    expect(onViolation).toHaveBeenCalledWith('multi_tab', expect.stringContaining('tab'))

    ch.onmessage?.({ data: { kind: 'ping', id: 'tab-lain' } })
    now += 5_000
    ch.onmessage?.({ data: { kind: 'ping', id: 'tab-lain-2' } })
    expect(onViolation).toHaveBeenCalledTimes(1)

    // ping dari tab sendiri diabaikan
    ch.onmessage?.({ data: { kind: 'ping', id: selfId } })
    expect(onViolation).toHaveBeenCalledTimes(1)
  })

  it('event setelah stop tidak diteruskan', () => {
    session.start()
    session.stop()
    doc.visibilityState = 'hidden'
    doc.trigger('visibilitychange')
    win.trigger('blur')
    expect(onViolation).not.toHaveBeenCalled()
  })

  it('event diteruskan ke IngestClient yang terlampir', () => {
    const enqueue = vi.fn()
    session.attachIngest({ enqueue, stop: vi.fn(), flush: vi.fn(), size: 0 } as never)
    session.start()
    doc.visibilityState = 'hidden'
    doc.trigger('visibilitychange')
    expect(enqueue).toHaveBeenCalledWith('tab_switch', expect.stringContaining('Tab'))
  })
})