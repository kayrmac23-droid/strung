import { describe, it, expect, beforeEach } from 'vitest'
import { rateLimit, clientIp, tooManyRequests, __resetRateLimits } from '@/lib/rateLimit'

describe('rateLimit', () => {
  beforeEach(() => __resetRateLimits())

  it('allows hits up to the limit within a window', () => {
    const now = 1_000_000
    for (let i = 0; i < 3; i++) {
      expect(rateLimit('k', 3, 60_000, now).allowed).toBe(true)
    }
  })

  it('blocks the hit that exceeds the limit and reports retryAfter', () => {
    const now = 1_000_000
    for (let i = 0; i < 3; i++) rateLimit('k', 3, 60_000, now)
    const blocked = rateLimit('k', 3, 60_000, now + 10_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.remaining).toBe(0)
    // 60s window opened at `now`, checked 10s in → ~50s left.
    expect(blocked.retryAfter).toBe(50)
  })

  it('reports decreasing remaining allowance', () => {
    const now = 1_000_000
    expect(rateLimit('k', 3, 60_000, now).remaining).toBe(2)
    expect(rateLimit('k', 3, 60_000, now).remaining).toBe(1)
    expect(rateLimit('k', 3, 60_000, now).remaining).toBe(0)
  })

  it('resets after the window elapses', () => {
    const now = 1_000_000
    for (let i = 0; i < 3; i++) rateLimit('k', 3, 60_000, now)
    expect(rateLimit('k', 3, 60_000, now).allowed).toBe(false)
    // Past the reset boundary the window starts fresh.
    expect(rateLimit('k', 3, 60_000, now + 60_001).allowed).toBe(true)
  })

  it('tracks keys independently', () => {
    const now = 1_000_000
    for (let i = 0; i < 3; i++) rateLimit('a', 3, 60_000, now)
    expect(rateLimit('a', 3, 60_000, now).allowed).toBe(false)
    expect(rateLimit('b', 3, 60_000, now).allowed).toBe(true)
  })

  it('never returns a retryAfter below 1 second when blocked', () => {
    const now = 1_000_000
    rateLimit('k', 1, 60_000, now)
    // Check right at the reset boundary — ceil could round to 0 without the floor.
    const blocked = rateLimit('k', 1, 60_000, now + 59_999)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThanOrEqual(1)
  })
})

describe('clientIp', () => {
  it('uses the left-most x-forwarded-for hop', () => {
    const req = new Request('https://x/', { headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })
    expect(clientIp(req)).toBe('1.2.3.4')
  })

  it('falls back to x-real-ip', () => {
    const req = new Request('https://x/', { headers: { 'x-real-ip': '9.9.9.9' } })
    expect(clientIp(req)).toBe('9.9.9.9')
  })

  it('falls back to a shared bucket when no ip header is present', () => {
    expect(clientIp(new Request('https://x/'))).toBe('unknown')
  })
})

describe('tooManyRequests', () => {
  it('returns a 429 with a Retry-After header', async () => {
    const res = tooManyRequests(42)
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    const body = await res.json()
    expect(body.error).toMatch(/too many requests/i)
  })
})
