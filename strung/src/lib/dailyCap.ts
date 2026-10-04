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
 * Check the user's allowance for `kind` over the last 24h and, if there is
 * room, record this use.
 *
 * Fails OPEN on a database error. The preview is non-critical, and refusing it
 * because a bookkeeping table is unreachable would break a feature to guard a
 * bill; the error is logged so a missing table is visible, not silent.
 *
 * Check-then-insert is not atomic, so concurrent requests can overshoot the cap
 * by a few. That is acceptable for a spend guard.
 */
export async function takeDailyAllowance(
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
  if (count >= cap) return { allowed: false, checked: true }

  const { error: insertError } = await supabase.from('usage_events').insert({ user_id: userId, kind })
  if (insertError) console.error('daily cap record failed:', insertError.message)
  return { allowed: true, checked: true }
}

export function dailyCapReached(): Response {
  return new Response(
    JSON.stringify({ error: 'Daily preview limit reached — your designs are unaffected. Try again tomorrow.' }),
    { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '3600' } },
  )
}
