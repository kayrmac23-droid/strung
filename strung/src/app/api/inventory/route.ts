import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getAuthenticatedClient } from '@/lib/auth'

function getToken(req: NextRequest) {
  return req.headers.get('Authorization')!.replace('Bearer ', '')
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ beads: [], findings: [] })
  const supabase = getAuthenticatedClient(getToken(req))
  const [beads, findings] = await Promise.all([
    supabase.from('beads').select('*').order('created_at', { ascending: false }),
    supabase.from('findings').select('*').order('created_at', { ascending: false }),
  ])
  return NextResponse.json({ beads: beads.data || [], findings: findings.data || [] })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getAuthenticatedClient(getToken(req))
  const body = await req.json()
  const { table, data } = body
  if (!['beads', 'findings'].includes(table)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  const { data: result, error } = await supabase.from(table).insert({ ...data, user_id: user.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getAuthenticatedClient(getToken(req))
  const { searchParams } = new URL(req.url)
  const table = searchParams.get('table')
  const id = searchParams.get('id')
  if (!table || !id || !['beads', 'findings'].includes(table)) return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getAuthenticatedClient(getToken(req))
  const body = await req.json()
  const { table, id, data } = body
  if (!['beads', 'findings'].includes(table)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  const { data: result, error } = await supabase.from(table).update(data).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(result)
}
