import { supabase } from '@/lib/supabase'

export async function getAuthHeaders(base: HeadersInit = {}): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { ...base, Authorization: `Bearer ${token}` } : base
}
