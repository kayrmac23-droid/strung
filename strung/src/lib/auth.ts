import { createClient } from '@supabase/supabase-js'
import type { User } from '@supabase/supabase-js'

export function getAuthenticatedClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      // A fresh client is created per request and thrown away. Session
      // persistence and auto-refresh are browser concerns — on the server they
      // only leave a refresh timer behind on a client nothing holds a reference
      // to, so every request leaked one. detectSessionInUrl is meaningless here
      // for the same reason: there is no URL fragment to read.
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }
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
