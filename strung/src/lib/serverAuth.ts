import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export function getServerSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null
  if (!token) return null
  const supabase = getServerSupabase()
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}
