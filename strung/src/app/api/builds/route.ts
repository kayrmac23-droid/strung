import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase, getUserIdFromRequest } from '@/lib/serverAuth'

async function requireUser(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return userId
}

export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json([])
  const supabase = getServerSupabase()
  const { data, error } = await supabase
    .from('builds')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const userId = await requireUser(req)
  if (userId instanceof NextResponse) return userId
  const supabase = getServerSupabase()
  const body = await req.json()
  const { data, error } = await supabase
    .from('builds')
    .insert({ ...body, user_id: userId })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest) {
  const userId = await requireUser(req)
  if (userId instanceof NextResponse) return userId
  const supabase = getServerSupabase()
  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { data, error } = await supabase
    .from('builds')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUser(req)
  if (userId instanceof NextResponse) return userId
  const supabase = getServerSupabase()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await supabase.from('builds').delete().eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
