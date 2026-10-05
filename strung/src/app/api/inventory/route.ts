import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getAuthenticatedClient } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rateLimit'
import { getToken, parseBody, isUuid } from '@/lib/apiRequest'
import { isAllowedTable } from '@/lib/colour'
import { cleanStashInput } from '@/lib/stashItems'

// Set well above the AI-route limits: decrementStash() fires a parallel PATCH
// per matched row and "Save all" batches inserts, so the UI legitimately bursts
// this route. This only guards against runaway loops, not normal use.
const RATE_LIMIT = 120
const RATE_WINDOW_MS = 60_000

function rateLimited(userId: string): Response | null {
  const limit = rateLimit(`inventory:${userId}`, RATE_LIMIT, RATE_WINDOW_MS)
  return limit.allowed ? null : tooManyRequests(limit.retryAfter)
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = rateLimited(user.id)
  if (limited) return limited
  const supabase = getAuthenticatedClient(getToken(req))
  const [beads, findings] = await Promise.all([
    supabase.from('beads').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('findings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])
  // A failed read must not look like an empty stash. It used to answer 200
  // with [] here, so a missing table (PGRST205) or an RLS failure showed the
  // maker an empty stash — inviting them to re-add everything and duplicate it
  // once the outage cleared. Report it, and let the page say so.
  if (beads.error || findings.error) {
    console.error('inventory GET error:', beads.error || findings.error)
    return NextResponse.json({ error: 'Could not load your stash' }, { status: 500 })
  }
  return NextResponse.json({ beads: beads.data || [], findings: findings.data || [] })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = rateLimited(user.id)
  if (limited) return limited
  const supabase = getAuthenticatedClient(getToken(req))
  const body = await parseBody(req)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  const { table, data } = body
  // Route the table check through the single allowlist in @/lib/colour rather
  // than an inline literal — an inline copy is how a new table reachable by
  // ?table= gets added in one place and silently missed in the other three.
  if (!isAllowedTable(table)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 })

  // Bulk insert: a single request with an array of rows (used by "Save all").
  if (Array.isArray(data)) {
    if (data.length === 0) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    if (data.length > 100) return NextResponse.json({ error: 'Too many rows (max 100)' }, { status: 400 })
    const rows: Record<string, unknown>[] = []
    for (const [i, row] of data.entries()) {
      const cleaned = cleanStashInput(table, row, false)
      if (!cleaned.ok) return NextResponse.json({ error: `Row ${i + 1}: ${cleaned.error}` }, { status: 400 })
      rows.push({ ...cleaned.fields, user_id: user.id })
    }
    const { data: result, error } = await supabase.from(table).insert(rows).select()
    if (error) {
      console.error('inventory POST error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    return NextResponse.json(result)
  }

  const cleaned = cleanStashInput(table, data, false)
  if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 })
  const { data: result, error } = await supabase.from(table).insert({ ...cleaned.fields, user_id: user.id }).select().single()
  if (error) {
    console.error('inventory POST error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = rateLimited(user.id)
  if (limited) return limited
  const supabase = getAuthenticatedClient(getToken(req))
  const { searchParams } = new URL(req.url)
  const table = searchParams.get('table')
  const id = searchParams.get('id')
  if (!id || !isAllowedTable(table)) return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', user.id)
  if (error) {
    console.error('inventory DELETE error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = rateLimited(user.id)
  if (limited) return limited
  const supabase = getAuthenticatedClient(getToken(req))
  const body = await parseBody(req)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  const { table, id, data } = body
  if (!isAllowedTable(table)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  if (typeof id !== 'string' || !id) return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const cleaned = cleanStashInput(table, data, true)
  if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 })
  if (Object.keys(cleaned.fields).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  const { data: result, error } = await supabase.from(table).update(cleaned.fields).eq('id', id).eq('user_id', user.id).select().maybeSingle()
  if (error) {
    console.error('inventory PATCH error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  // maybeSingle: an id that is not this user's (or no longer exists) is a 404,
  // not the PGRST116 "Database error" .single() turned it into.
  if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(result)
}
