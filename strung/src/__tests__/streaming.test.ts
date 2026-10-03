import { describe, it, expect, vi } from 'vitest'
import { streamTextResponse, STREAM_ERROR_MARKER } from '@/lib/apiRequest'
import { readTextStream } from '@/lib/streamText'
import { beadWeightGrams } from '@/lib/beadMath'

const delta = (text: string) => ({ type: 'content_block_delta', delta: { type: 'text_delta', text } })

async function* events(items: unknown[], failAfter?: number) {
  let i = 0
  for (const item of items) {
    if (failAfter !== undefined && i === failAfter) throw new Error('upstream died')
    yield item as { type: string; delta?: unknown }
    i++
  }
  if (failAfter !== undefined && i === failAfter) throw new Error('upstream died')
}

describe('streamTextResponse', () => {
  it('streams text deltas and ignores other events', async () => {
    const res = await streamTextResponse(events([{ type: 'message_start' }, delta('Hel'), delta('lo')]), 'test')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('Hello')
  })

  it('answers 502 when the upstream fails before the first event', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await streamTextResponse(events([], 0), 'test')
    expect(res.status).toBe(502)
    spy.mockRestore()
  })

  it('appends the cut-short marker when the stream dies partway', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await streamTextResponse(events([delta('partial')], 1), 'test')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('partial' + STREAM_ERROR_MARKER)
    spy.mockRestore()
  })

  it('stops the upstream when the reader cancels', async () => {
    const returned = vi.fn()
    const iterable = {
      [Symbol.asyncIterator]() {
        return {
          next: async () => ({ done: false as const, value: delta('x') }),
          return: async () => { returned(); return { done: true as const, value: undefined } },
        }
      },
    }
    const res = await streamTextResponse(iterable, 'test')
    await res.body!.cancel()
    expect(returned).toHaveBeenCalled()
  })
})

describe('readTextStream', () => {
  const streamOf = (chunks: Uint8Array[]) =>
    new ReadableStream<Uint8Array>({
      start(c) { chunks.forEach(ch => c.enqueue(ch)); c.close() },
    })

  it('reassembles a multi-byte character split across chunks', async () => {
    const bytes = new TextEncoder().encode('a — b')
    // The em dash is three bytes (indices 2-4); split it down the middle.
    const seen: string[] = []
    const full = await readTextStream(streamOf([bytes.slice(0, 3), bytes.slice(3)]), t => seen.push(t))
    expect(full).toBe('a — b')
    expect(seen.join('')).not.toContain('�')
  })

  it('returns an empty string for a missing body', async () => {
    expect(await readTextStream(null, () => {})).toBe('')
  })
})

describe('beadWeightGrams', () => {
  it('scales with volume, not diameter', () => {
    expect(beadWeightGrams(8, 'gemstone') / beadWeightGrams(4, 'gemstone')).toBeCloseTo(8, 5)
  })

  it('lands in the real range for common beads', () => {
    // An 8mm quartz round weighs roughly 0.7g; a 4mm one under 0.1g.
    expect(beadWeightGrams(8, 'gemstone')).toBeGreaterThan(0.6)
    expect(beadWeightGrams(8, 'gemstone')).toBeLessThan(0.8)
    expect(beadWeightGrams(4, 'gemstone')).toBeLessThan(0.1)
    expect(beadWeightGrams(6, 'glass')).toBeLessThan(beadWeightGrams(6, 'gemstone'))
  })

  it('returns 0 for nonsense sizes', () => {
    expect(beadWeightGrams(0, 'glass')).toBe(0)
    expect(beadWeightGrams(NaN, 'glass')).toBe(0)
  })
})
