import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getAuthenticatedClient } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rateLimit'

// Set well above the AI-route limits: the UI legitimately bursts this route —
// decrementStash() is per-row and the journal loads/saves in quick succession —
// so this is only a guard against runaway loops, not a tight throttle.
const RATE_LIMIT = 120
const RATE_WINDOW_MS = 60_000

function rateLimited(userId: string): Response | null {
  const limit = rateLimit(`builds:${userId}`, RATE_LIMIT, RATE_WINDOW_MS)
  return limit.allowed ? null : tooManyRequests(limit.retryAfter)
}

function getToken(req: NextRequest) {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
}

async function parseBody(req: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' ? body as Record<string, unknown> : {}
  } catch {
    return null
  }
}

const BUILD_FIELDS = ['title', 'design', 'status', 'current_step', 'started_at', 'completed_at', 'time_taken_minutes', 'notes', 'rating'] as const

function pickBuildFields(data: Record<string, unknown>) {
  return Object.fromEntries(BUILD_FIELDS.filter(f => f in data).map(f => [f, data[f]]))
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json([])
  const limited = rateLimited(user.id)
  if (limited) return limited
  const supabase = getAuthenticatedClient(getToken(req))
  const id = new URL(req.url).searchParams.get('id')

  // ?id= returns a single build (or 404) instead of the full list.
  if (id) {
    const { data, error } = await supabase
      .from('builds')
      .select('*')
      .eq('user_id', user.id)
      .eq('id', id)
      .maybeSingle()
    if (error) {
      console.error('builds GET error:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from('builds')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('builds GET error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = rateLimited(user.id)
  if (limited) return limited
  const supabase = getAuthenticatedClient(getToken(req))
  const body = await parseBody(req)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  const sanitized = pickBuildFields(body)
  const { data, error } = await supabase
    .from('builds')
    .insert({ ...sanitized, user_id: user.id })
    .select()
    .single()
  if (error) {
    console.error('builds POST error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = rateLimited(user.id)
  if (limited) return limited
  const supabase = getAuthenticatedClient(getToken(req))
  const body = await parseBody(req)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  const { id, ...raw } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const updates = pickBuildFields(raw as Record<string, unknown>)
  const { data, error } = await supabase
    .from('builds')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) {
    console.error('builds PATCH error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const limited = rateLimited(user.id)
  if (limited) return limited
  const supabase = getAuthenticatedClient(getToken(req))
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await supabase.from('builds').delete().eq('id', id).eq('user_id', user.id)
  if (error) {
    console.error('builds DELETE error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
