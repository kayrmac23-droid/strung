import { describe, it, expect, vi, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { takeDailyAllowance, dailyCapReached } from '@/lib/dailyCap'
import { withEffort, logUsage } from '@/lib/apiRequest'

// Minimal stand-in for the query builder: select().eq().eq().gte() resolves to
// the count result; insert() resolves to the insert result.
function fakeSupabase(count: number | null, readError: string | null = null, insertError: string | null = null) {
  const insert = vi.fn().mockResolvedValue({ error: insertError ? { message: insertError } : null })
  const gte = vi.fn().mockResolvedValue({ count, error: readError ? { message: readError } : null })
  const chain = { eq: vi.fn(() => chain), gte }
  const from = vi.fn(() => ({ select: vi.fn(() => chain), insert }))
  return { client: { from } as unknown as SupabaseClient, insert, from, gte }
}

afterEach(() => vi.restoreAllMocks())

describe('takeDailyAllowance', () => {
  it('allows and records a use while under the cap', async () => {
    const { client, insert } = fakeSupabase(3)
    const r = await takeDailyAllowance(client, 'u1', 'image', 25)
    expect(r).toEqual({ allowed: true, checked: true })
    expect(insert).toHaveBeenCalledWith({ user_id: 'u1', kind: 'image' })
  })

  it('refuses at the cap and records nothing', async () => {
    const { client, insert } = fakeSupabase(25)
    const r = await takeDailyAllowance(client, 'u1', 'image', 25)
    expect(r).toEqual({ allowed: false, checked: true })
    expect(insert).not.toHaveBeenCalled()
  })

  it('looks back exactly 24 hours', async () => {
    const { client, gte } = fakeSupabase(0)
    const now = Date.UTC(2026, 9, 4, 12, 0, 0)
    await takeDailyAllowance(client, 'u1', 'image', 25, now)
    expect(gte).toHaveBeenCalledWith('created_at', new Date(now - 24 * 3600 * 1000).toISOString())
  })

  it('fails open, and says so, when the count cannot be read', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client, insert } = fakeSupabase(null, 'relation "usage_events" does not exist')
    const r = await takeDailyAllowance(client, 'u1', 'image', 25)
    expect(r).toEqual({ allowed: true, checked: false })
    expect(insert).not.toHaveBeenCalled()
    expect(err).toHaveBeenCalled()
  })

  it('still allows the call when recording the use fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = fakeSupabase(1, null, 'boom')
    expect((await takeDailyAllowance(client, 'u1', 'image', 25)).allowed).toBe(true)
  })
})

describe('dailyCapReached', () => {
  it('is a 429 with a JSON error and a Retry-After', async () => {
    const res = dailyCapReached()
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('3600')
    expect(typeof (await res.json()).error).toBe('string')
  })
})

describe('withEffort', () => {
  it('nests the level under output_config', () => {
    expect(withEffort('low')).toEqual({ output_config: { effort: 'low' } })
  })
})

describe('logUsage', () => {
  it('logs one ai-usage line with token counts and the stop reason', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    logUsage('make', { usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 5 }, stop_reason: 'max_tokens' })
    expect(log).toHaveBeenCalledWith('ai-usage', JSON.stringify({ route: 'make', input: 10, output: 20, cacheRead: 5, stop: 'max_tokens' }))
  })

  it('tolerates a response with no usage', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(() => logUsage('x', undefined)).not.toThrow()
    expect(log).toHaveBeenCalledWith('ai-usage', JSON.stringify({ route: 'x', input: 0, output: 0, cacheRead: 0, stop: null }))
  })
})
