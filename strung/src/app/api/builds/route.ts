import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getAuthenticatedClient } from '@/lib/auth'

function getToken(req: NextRequest) {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
}

const BUILD_FIELDS = ['title', 'design', 'status', 'current_step', 'started_at', 'completed_at', 'time_taken_minutes', 'notes', 'rating'] as const

function pickBuildFields(data: Record<string, unknown>) {
  return Object.fromEntries(BUILD_FIELDS.filter(f => f in data).map(f => [f, data[f]]))
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json([])
  const supabase = getAuthenticatedClient(getToken(req))
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
  const supabase = getAuthenticatedClient(getToken(req))
  const body = await req.json()
  const sanitized = pickBuildFields(body as Record<string, unknown>)
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
  const supabase = getAuthenticatedClient(getToken(req))
  const body = await req.json()
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
