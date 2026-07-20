// Lightweight in-memory sliding-window rate limiter.
//
// Every AI route calls a paid upstream (Anthropic / OpenAI), and /api/sequence
// is fully public, so without a cap one client can run up unbounded cost. This
// keeps a per-key timestamp window in module memory and rejects once the window
// is full.
//
// Caveat: serverless deployments (Vercel) run several isolated instances, so
// the effective ceiling is roughly `limit * instanceCount` rather than a hard
// global limit. That is intentional — this is a cheap first line of defence
// against runaway loops and casual abuse, not a billing guarantee. A shared
// store (e.g. Upstash/Redis) would be the next step if a strict global cap is
// needed.

type Window = { count: number; resetAt: number }

const buckets = new Map<string, Window>()

// Guard against unbounded growth: sweep expired windows once the map gets large.
const MAX_TRACKED_KEYS = 10_000

export type RateLimitResult = {
  allowed: boolean
  // Seconds until the window resets. Suitable for a Retry-After header.
  retryAfter: number
  remaining: number
}

function sweep(now: number) {
  for (const [key, win] of buckets) {
    if (win.resetAt <= now) buckets.delete(key)
  }
}

/**
 * Record a hit for `key` and report whether it is within `limit` hits per
 * `windowMs`. Fixed-window semantics: the first hit starts the window and every
 * hit within it counts toward the limit.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  if (buckets.size > MAX_TRACKED_KEYS) sweep(now)

  const existing = buckets.get(key)
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0, remaining: limit - 1 }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
    }
  }

  existing.count += 1
  return { allowed: true, retryAfter: 0, remaining: limit - existing.count }
}

// Test-only: clear all tracked windows so cases don't leak into each other.
export function __resetRateLimits() {
  buckets.clear()
}

// Standard 429 response. Plain `Response` so it works for both JSON routes and
// the streaming routes (the client checks response status before reading).
export function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests — please slow down and try again in a moment.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    },
  )
}

/**
 * Best-effort client identifier for the public routes that have no user id.
 * Prefers the left-most x-forwarded-for hop (the real client on Vercel), then
 * x-real-ip, and falls back to a shared bucket so a missing header still counts
 * against *something* rather than bypassing the limit entirely.
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}
