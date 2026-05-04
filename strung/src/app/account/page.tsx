'use client'
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { supabase } from '@/lib/supabase'

export default function AccountPage() {
  const [email, setEmail] = useState('')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSessionEmail(data.user?.email ?? null))
  }, [])

  async function signIn() {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    setMsg(error ? error.message : 'Check your email for a sign-in link.')
  }

  async function signOut() {
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
