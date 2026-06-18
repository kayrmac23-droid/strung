import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getAuthenticatedClient } from '@/lib/auth'

function getToken(req: NextRequest) {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
}

const BEAD_FIELDS = ['name', 'type', 'colour', 'hex', 'size', 'quantity', 'shape', 'notes'] as const
const FINDING_FIELDS = ['name', 'type', 'metal', 'size', 'quantity', 'notes'] as const

function pickFields(data: Record<string, unknown>, fields: readonly string[]) {
  return Object.fromEntries(fields.filter(f => f in data).map(f => [f, data[f]]))
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ beads: [], findings: [] })
  const supabase = getAuthenticatedClient(getToken(req))
  const [beads, findings] = await Promise.all([
    supabase.from('beads').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('findings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
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
  if (!data || typeof data !== 'object') return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  const allowed = table === 'beads' ? BEAD_FIELDS : FINDING_FIELDS
  const sanitized = pickFields(data as Record<string, unknown>, allowed)
  const { data: result, error } = await supabase.from(table).insert({ ...sanitized, user_id: user.id }).select().single()
  if (error) {
    console.error('inventory POST error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
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
  const supabase = getAuthenticatedClient(getToken(req))
  const body = await req.json()
  const { table, id, data } = body
  if (!['beads', 'findings'].includes(table)) return NextResponse.json({ error: 'Invalid table' }, { status: 400 })
  if (!id || !data || typeof data !== 'object') return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  const allowed = table === 'beads' ? BEAD_FIELDS : FINDING_FIELDS
  const sanitized = pickFields(data as Record<string, unknown>, allowed)
  const { data: result, error } = await supabase.from(table).update(sanitized).eq('id', id).eq('user_id', user.id).select().single()
  if (error) {
    console.error('inventory PATCH error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  return NextResponse.json(result)
}
