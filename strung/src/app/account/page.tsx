'use client'
import { useEffect, useState } from 'react'
import Nav from '@/components/Nav'
import { supabase } from '@/lib/supabase'

type Mode = 'signin' | 'signup'

export default function AccountPage() {
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
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

  function reset() {
    setMsg('')
    setIsError(false)
  }

  async function submit() {
    if (!email.trim() || !password) return
    setSubmitting(true); reset()
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setMsg(error.message); setIsError(true) }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setMsg(error.message); setIsError(true) }
      else setMsg('Account created — you\'re signed in.')
    }
    setSubmitting(false)
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSessionEmail(null)
    setEmail(''); setPassword(''); setMsg('')
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
              {loading ? '' : sessionEmail ? 'You\'re in.' : mode === 'signin' ? 'Sign in.' : 'Sign up.'}
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
              <p style={{ color: 'var(--text2)', fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
                {mode === 'signin'
                  ? 'Sign in to save and sync your stash, designs, and builds across devices.'
                  : 'Create an account to save your stash, designs, and builds.'}
              </p>

              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
                {(['signin', 'signup'] as Mode[]).map(m => (
                  <button key={m} onClick={() => { setMode(m); reset() }} style={{
                    flex: 1, padding: '9px 0',
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                    background: mode === m ? 'var(--surface2)' : 'var(--surface)',
                    border: `1px solid ${mode === m ? 'var(--silver)' : 'var(--border)'}`,
                    color: mode === m ? 'var(--silver2)' : 'var(--muted)',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}>{m === 'signin' ? 'Sign in' : 'Create account'}</button>
                ))}
              </div>

              <label className="label" style={{ marginBottom: 6 }}>Email</label>
              <input
                className="input-base"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ marginBottom: 14 }}
              />
              <label className="label" style={{ marginBottom: 6 }}>Password</label>
              <input
                className="input-base"
                type="password"
                placeholder={mode === 'signup' ? 'Choose a password (min 6 chars)' : 'Your password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
                style={{ marginBottom: 14 }}
              />
              <button
                className="btn-silver"
                onClick={submit}
                disabled={submitting || !email.trim() || !password}
                style={{ width: '100%', justifyContent: 'center', padding: '13px' }}
              >
                {submitting
                  ? <><span className="spinner" />{mode === 'signin' ? 'Signing in…' : 'Creating account…'}</>
                  : mode === 'signin' ? 'Sign in' : 'Create account'}
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
