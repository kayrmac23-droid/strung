import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getAuthenticatedClient } from '@/lib/auth'

function getToken(req: NextRequest) {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getAuthenticatedClient(getToken(req))
  const { data, error } = await supabase
    .from('designs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('designs GET error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  return NextResponse.json(data || [])
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getAuthenticatedClient(getToken(req))
  const body = await req.json()
  const { data, error } = await supabase
    .from('designs')
    .insert({ ...body, user_id: user.id })
    .select()
    .single()
  if (error) {
    console.error('designs POST error:', error)
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
  const { error } = await supabase.from('designs').delete().eq('id', id).eq('user_id', user.id)
  if (error) {
    console.error('designs DELETE error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getAuthenticatedClient(getToken(req))
  const { id, ...data } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { data: result, error } = await supabase
    .from('designs')
    .update(data)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()
  if (error) {
    console.error('designs PATCH error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
  return NextResponse.json(result)
}
