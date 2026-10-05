import type { SupabaseClient } from '@supabase/supabase-js'

// Per-user daily ceiling on the one genuinely expensive call (image renders).
//
// `rateLimit()` is per serverless instance and resets whenever a fresh instance
// spins up, so it stops a runaway loop but not a patient script on an open
// signup. This counts rows in `usage_events` instead, so the ceiling survives
// across instances and deploys. Setup SQL lives in README.md → "Set up the
// database".

export const IMAGE_DAILY_CAP = 25

const DAY_MS = 24 * 60 * 60 * 1000

export type DailyAllowance = {
  allowed: boolean
  // false when the count could not be read (table missing, DB down): the call
  // went ahead unmetered.
  checked: boolean
}

/**
 * Check the user's allowance for `kind` over the last 24h, without recording
 * anything. Pair with `recordDailyUse()` once the call has actually succeeded.
 *
 * Fails OPEN on a database error. The preview is non-critical, and refusing it
 * because a bookkeeping table is unreachable would break a feature to guard a
 * bill; the error is logged so a missing table is visible, not silent.
 */
export async function checkDailyAllowance(
  supabase: SupabaseClient,
  userId: string,
  kind: string,
  cap: number,
  now: number = Date.now(),
): Promise<DailyAllowance> {
  const since = new Date(now - DAY_MS).toISOString()
  const { count, error } = await supabase
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', kind)
    .gte('created_at', since)
  if (error || count === null) {
    console.error('daily cap read failed (allowing):', error?.message ?? 'no count returned')
    return { allowed: true, checked: false }
  }
  return { allowed: count < cap, checked: true }
}

/**
 * Count one use of `kind` against the user's daily allowance.
 *
 * Recorded after the paid call succeeds, not before it. Recording up front
 * charged a use for every render that then failed upstream — an OpenAI outage
 * spent the whole day's allowance on errors, and users cannot delete their own
 * rows (deliberately: see the README policies) to get it back. The cost is that
 * concurrent requests can overshoot the cap by a few; the per-minute burst
 * limit bounds that, and it is acceptable for a spend guard.
 */
export async function recordDailyUse(supabase: SupabaseClient, userId: string, kind: string): Promise<void> {
  const { error } = await supabase.from('usage_events').insert({ user_id: userId, kind })
  if (error) console.error('daily cap record failed:', error.message)
}

export function dailyCapReached(): Response {
  return new Response(
    JSON.stringify({ error: 'Daily preview limit reached — your designs are unaffected. Try again tomorrow.' }),
    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' } },
  )
}
