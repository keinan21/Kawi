import type { PelanggaranPayload, PelanggaranSender } from './ingest.ts'
import { IngestClient } from './ingest.ts'
import type { TimerApi } from './types.ts'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Timer palsu:Vp-trigger manual, tanpa waktu nyata. */
function timerPalsu(): TimerApi & { jalankanInterval: () => void; jalankanTimeout: (ms: number) => void } {
  const interval = new Map<number, () => void>()
  const timeout = new Map<number, { fn: () => void; ms: number }>()
  let nextId = 1
  return {
    setInterval: (fn) => {
      const id = nextId++
      interval.set(id, fn)
      return id
    },
    clearInterval: (id) => {
      interval.delete(id)
    },
    setTimeout: (fn, ms) => {
      const id = nextId++
      timeout.set(id, { fn, ms })
      return id
    },
    clearTimeout: (id) => {
      timeout.delete(id)
    },
    jalankanInterval: () => {
      for (const fn of [...interval.values()]) fn()
    },
    jalankanTimeout: (ms) => {
      for (const [id, t] of [...timeout.entries()]) {
        if (t.ms === ms) {
          timeout.delete(id)
          t.fn()
        }
      }
    },
  }
}

interface Catatan {
  sessionId: string
  batch: PelanggaranPayload[]
}

describe('IngestClient', () => {
  let terkirim: Catatan[]
  let kirim: PelanggaranSender
  let timers: ReturnType<typeof timerPalsu>
  let waktu: number

  beforeEach(() => {
    terkirim = []
    kirim = async (sessionId, batch) => {
      terkirim.push({ sessionId, batch: [...batch] })
    }
    timers = timerPalsu()
    waktu = 1_700_000_000_000
  })

  function buatClient(overrides: Partial<ConstructorParameters<typeof IngestClient>[0]> = {}) {
    return new IngestClient({
      sessionId: 'sesi-1',
      send: kirim,
      timers,
      maxBatch: 3,
      flushIntervalMs: 5_000,
      clientTs: () => new Date(waktu).toISOString(),
      ...overrides,
    })
  }

  it('menggabungkan event menjadi satu batch', async () => {
    const client = buatClient()
    client.enqueue('tab_switch', 'a')
    client.enqueue('copy_blocked', 'b')
    expect(client.size).toBe(2)
    expect(terkirim).toHaveLength(0)

    await client.flush()

    expect(terkirim).toHaveLength(1)
    expect(terkirim[0].sessionId).toBe('sesi-1')
    expect(terkirim[0].batch.map((e) => e.type)).toEqual(['tab_switch', 'copy_blocked'])
    expect(terkirim[0].batch[0].client_ts).toBe(new Date(waktu).toISOString())
    expect(client.size).toBe(0)
  })

  it('flush otomatis saat batch penuh', async () => {
    const client = buatClient()
    client.enqueue('window_blur', '1')
    client.enqueue('window_blur', '2')
    expect(terkirim).toHaveLength(0)
    client.enqueue('window_blur', '3')
    await vi.waitFor(() => expect(terkirim).toHaveLength(1))
    expect(terkirim[0].batch).toHaveLength(3)
  })

  it('flush berkala lewat interval', async () => {
    const client = buatClient({ maxBatch: 100 })
    client.enqueue('multi_tab', '1')
    timers.jalankanInterval()
    await vi.waitFor(() => expect(terkirim).toHaveLength(1))
  })

  it('stop() menghapus timer dan mengirim sisa antrean', async () => {
    const client = buatClient({ maxBatch: 100 })
    client.enqueue('shortcut_blocked', '1')
    client.stop()
    await vi.waitFor(() => expect(terkirim).toHaveLength(1))
    timers.jalankanInterval()
    expect(terkirim).toHaveLength(1)
  })

  it('gagal kirim tidak melempar dan batch dicoba lagi', async () => {
    const onError = vi.fn()
    let gagal = true
    const kirimGagal: PelanggaranSender = async (sessionId, batch) => {
      if (gagal) throw new Error('jaringan mati')
      terkirim.push({ sessionId, batch: [...batch] })
    }
    const client = buatClient({ send: kirimGagal, onError })

    client.enqueue('paste_blocked', '1')
    await client.flush()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(client.size).toBe(1)
    expect(terkirim).toHaveLength(0)

    gagal = false
    timers.jalankanTimeout(4_000)
    await vi.waitFor(() => expect(terkirim).toHaveLength(1))
    expect(terkirim[0].batch[0].type).toBe('paste_blocked')
    expect(client.size).toBe(0)
  })
})