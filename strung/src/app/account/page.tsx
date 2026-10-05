'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
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
    // "Start free" links here with ?mode=signup. Read once the auth check
    // settles rather than via useSearchParams, which would force a Suspense
    // boundary on the page; the form is hidden until then anyway.
    const wantsSignup = new URLSearchParams(window.location.search).get('mode') === 'signup'
    supabase.auth.getUser()
      .then(({ data }) => {
        setSessionEmail(data.user?.email ?? null)
        if (wantsSignup) setMode('signup')
      })
      .catch(() => setSessionEmail(null))
      .finally(() => setLoading(false))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setSessionEmail(session?.user?.email ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  function reset() {
    setMsg('')
    setIsError(false)
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault()
    if (!email.trim() || !password || submitting) return
    setSubmitting(true); reset()
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) { setMsg(error.message); setIsError(true) }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          // The confirmation link lands on the callback page, which picks up
          // the session; without this it went to the project's bare Site URL.
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        })
        if (error) { setMsg(error.message); setIsError(true) }
        // With email confirmation on (Supabase's default) signUp returns no
        // session — telling the maker they were signed in was simply wrong.
        else if (data.session) setMsg('Account created — you\'re signed in.')
        else setMsg('Account created — check your email for a confirmation link to finish signing up.')
      }
    } catch {
      setMsg('Could not reach the sign-in service. Check your connection and try again.')
      setIsError(true)
    } finally {
      setSubmitting(false)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setSessionEmail(null)
    setEmail(''); setPassword(''); setMsg('')
  }

  return (
    <>
      <Nav />
      <main id="main" className="page-main">
        <div className="page-pad" style={{ maxWidth: 520, margin: '0 auto', paddingTop: 80, paddingBottom: 80 }}>

          <header style={{ marginBottom: 40, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p className="eyebrow eyebrow--lit fade-up">Account</p>
            <h1 className="display d-1 fade-up-1">
              {loading ? '' : sessionEmail ? 'You\'re in.' : mode === 'signin' ? 'Sign in.' : 'Sign up.'}
            </h1>
          </header>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <span className="strand-loader" role="status" aria-label="Loading"><i/><i/><i/></span>
            </div>
          ) : sessionEmail ? (
            <div className="card fade-up" style={{ padding: 32 }}>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 6 }}>SIGNED IN AS</p>
              <p style={{ color: 'var(--cream)', fontSize: 17, marginBottom: 28 }}>{sessionEmail}</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Link href="/bench" className="btn-primary btn-md">Go to your bench →</Link>
                <button className="btn-outline" onClick={signOut}>Sign out</button>
              </div>
            </div>
          ) : (
            <form className="card fade-up" style={{ padding: 32 }} onSubmit={submit} noValidate>
              <p style={{ color: 'var(--text2)', fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
                {mode === 'signin'
                  ? 'Sign in to save and sync your stash, designs, and builds across devices.'
                  : 'Create an account to save your stash, designs, and builds.'}
              </p>

              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
                {(['signin', 'signup'] as Mode[]).map(m => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => { setMode(m); reset() }} style={{
                    flex: 1, padding: '9px 0',
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                    background: mode === m ? 'var(--umber)' : 'var(--roast)',
                    border: `1px solid ${mode === m ? 'var(--cream)' : 'var(--seam)'}`,
                    color: mode === m ? 'var(--cream)' : 'var(--meta)',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}>{m === 'signin' ? 'Sign in' : 'Create account'}</button>
                ))}
              </div>

              <label className="label" htmlFor="account-email" style={{ marginBottom: 6 }}>Email</label>
              <input
                id="account-email"
                className="input-base"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={{ marginBottom: 14 }}
              />
              <label className="label" htmlFor="account-password" style={{ marginBottom: 6 }}>Password</label>
              <input
                id="account-password"
                className="input-base"
                type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                placeholder={mode === 'signup' ? 'Choose a password (min 6 chars)' : 'Your password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ marginBottom: 14 }}
              />
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting || !email.trim() || !password}
                style={{ width: '100%', justifyContent: 'center', padding: '13px' }}
              >
                {submitting
                  ? <><span className="spinner" />{mode === 'signin' ? 'Signing in…' : 'Creating account…'}</>
                  : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>

              {msg && (
                <p role={isError ? 'alert' : 'status'} style={{
                  marginTop: 16, fontSize: 14, lineHeight: 1.5,
                  fontFamily: isError ? 'var(--font-mono)' : 'var(--font-body)',
                  color: isError ? 'var(--rose)' : 'var(--sage)',
                }}>
                  {msg}
                </p>
              )}
            </form>
          )}
        </div>
      </main>
    </>
  )
}
