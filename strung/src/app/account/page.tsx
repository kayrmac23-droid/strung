'use client'
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { supabase } from '@/lib/supabase'

export default function AccountPage() {
  const [email, setEmail] = useState('')
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSessionEmail(data.user?.email ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSessionEmail(session?.user?.email ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn() {
    if (!email.trim()) return
    setSending(true); setMsg(''); setIsError(false)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setMsg(error.message); setIsError(true) }
    else setMsg('Check your email — we sent you a sign-in link.')
    setSending(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSessionEmail(null)
    setMsg('')
  }

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 60, minHeight: '100vh' }}>
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '80px 40px' }}>

          <header style={{ marginBottom: 40 }}>
            <p className="section-eyebrow fade-up">Account</p>
            <h1 className="fade-up-1" style={{
              fontSize: 44, color: 'var(--cream)',
              fontFamily: 'var(--font-display)', fontWeight: 400, margin: '8px 0 10px'
            }}>
              {loading ? '' : sessionEmail ? 'You\'re in.' : 'Sign in.'}
            </h1>
          </header>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <span className="spinner-dark" />
            </div>
          ) : sessionEmail ? (
            <div className="card fade-up" style={{ padding: 32 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 6 }}>SIGNED IN AS</p>
              <p style={{ color: 'var(--cream)', fontSize: 18, marginBottom: 28 }}>{sessionEmail}</p>
              <button className="btn-outline" onClick={signOut}>Sign out</button>
            </div>
          ) : (
            <div className="card fade-up" style={{ padding: 32 }}>
              <p style={{ color: 'var(--text2)', fontSize: 16, marginBottom: 24, lineHeight: 1.6 }}>
                Sign in to save and sync your stash, designs, and builds across devices. No password needed — we&apos;ll email you a link.
              </p>
              <label className="label" style={{ marginBottom: 6 }}>Email address</label>
              <input
                className="input-base"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && signIn()}
                style={{ marginBottom: 14 }}
              />
              <button className="btn-silver" onClick={signIn} disabled={sending || !email.trim()}
                style={{ width: '100%', justifyContent: 'center', padding: '13px' }}>
                {sending ? <><span className="spinner" />Sending…</> : 'Email me a sign-in link'}
              </button>
              {msg && (
                <p style={{
                  marginTop: 16, fontSize: 14, lineHeight: 1.5,
                  fontFamily: isError ? 'var(--font-mono)' : 'var(--font-body)',
                  color: isError ? 'var(--rose)' : 'var(--sage)',
                }}>
                  {msg}
                </p>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
