import { createClient } from '@supabase/supabase-js'

export async function getAuthHeaders(base: HeadersInit = {}): Promise<HeadersInit> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return base
  const supabase = createClient(url, key)
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { ...base, Authorization: `Bearer ${token}` } : base
}
