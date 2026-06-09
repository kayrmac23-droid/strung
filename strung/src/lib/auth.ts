import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export function getAuthenticatedClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
}

export async function getUserFromRequest(request: Request): Promise<User | null> {
  const header = request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.replace('Bearer ', '').trim()
  if (!token) return null
  const supabase = getAuthenticatedClient(token)
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}
