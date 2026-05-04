import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase, getUserIdFromRequest } from '@/lib/serverAuth'

async function requireUser(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return userId
}

export async function GET(req: NextRequest) {
  const userId = await requireUser(req)
  if (userId instanceof NextResponse) return userId
  const supabase = getServerSupabase()
  const [beads, findings] = await Promise.all([
    supabase.from('beads').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('findings').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ])
  return NextResponse.json({ beads: beads.data || [], findings: findings.data || [] })
}

export async function POST(req: NextRequest) {
  const userId = await requireUser(req)
  if (userId instanceof NextResponse) return userId
  const supabase = getServerSupabase()
  const body = await req.json()
  const { table, data } = body
  if (!['beads','findings'].includes(table)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  const { data: result, error } = await supabase.from(table).insert({ ...data, user_id: userId }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const userId = await requireUser(req)
  if (userId instanceof NextResponse) return userId
  const supabase = getServerSupabase()
  const { searchParams } = new URL(req.url)
  const table = searchParams.get('table')
  const id = searchParams.get('id')
  if (!table || !id || !['beads','findings'].includes(table)) return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  const { error } = await supabase.from(table).delete().eq('id', id).eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const userId = await requireUser(req)
  if (userId instanceof NextResponse) return userId
  const supabase = getServerSupabase()
  const body = await req.json()
  const { table, id, data } = body
  if (!['beads','findings'].includes(table)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  const { data: result, error } = await supabase.from(table).update(data).eq('id', id).eq('user_id', userId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(result)
}
