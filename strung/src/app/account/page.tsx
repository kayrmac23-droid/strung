'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import Nav from '@/components/Nav'

export default function AccountPage() {
  const [email, setEmail] = useState('')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getUser().then(({ data }) => setSessionEmail(data.user?.email ?? null))
  }, [supabase])

  async function signIn() {
    if (!supabase) return setMsg('Supabase auth is not configured.')
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    setMsg(error ? error.message : 'Check your email for a sign-in link.')
  }

  async function signOut() {
    if (!supabase) return
    await supabase.auth.signOut()
    setSessionEmail(null)
    setMsg('Signed out.')
  }

  return <><Nav /><main style={{ paddingTop: 80, maxWidth: 720, margin: '0 auto' }}>
    <h1>Account</h1>
    {sessionEmail ? <>
      <p>Signed in as {sessionEmail}</p>
      <button className="btn-outline" onClick={signOut}>Sign out</button>
    </> : <>
      <p>Sign in to save and sync your stash, designs, and builds.</p>
      <input className="input-base" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      <button className="btn-silver" onClick={signIn} style={{ marginTop: 12 }}>Email me a magic link</button>
    </>}
    {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
  </main></>
}
