'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// How long to wait for Supabase to turn the link into a session before telling
// the maker it did not work. An expired or already-used link never fires
// SIGNED_IN, so without this the spinner ran forever.
const TIMEOUT_MS = 10_000

// Supabase reports a bad link in the URL (query or fragment) as
// error_description; surface it rather than a generic message.
function linkError(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const desc = params.get('error_description') || hash.get('error_description')
  return desc ? desc.replace(/\+/g, ' ') : null
}

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Signing you in…')
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    const error = linkError()
    if (error) {
      // Deferred a tick so the effect never sets state synchronously.
      const t = setTimeout(() => setFailed(error), 0)
      return () => clearTimeout(t)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        setStatus('Signed in — redirecting…')
        router.replace('/account')
      }
      if (event === 'TOKEN_REFRESHED') {
        router.replace('/account')
      }
    })

    // Also check if session already exists (page reload case)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/account')
    }).catch(() => {})

    const timeout = setTimeout(() => {
      setFailed('This sign-in link did not work — it may have expired or already been used.')
    }, TIMEOUT_MS)

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [router])

  return (
    <div style={{
      minHeight: '100dvh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 20px', textAlign: 'center'
    }}>
      {failed ? (
        <>
          <p role="alert" style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--fs-base)', color: 'var(--text2)', maxWidth: 420 }}>
            {failed}
          </p>
          <Link href="/account" className="btn-outline">Go to sign in</Link>
        </>
      ) : (
        <>
          <span className="spinner-dark" />
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--muted)', letterSpacing: '0.12em' }}>
            {status.toUpperCase()}
          </p>
        </>
      )}
    </div>
  )
}
