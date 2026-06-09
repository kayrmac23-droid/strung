'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()
  const [status, setStatus] = useState('Signing you in…')

  useEffect(() => {
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
    })

    return () => subscription.unsubscribe()
  }, [router])

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16
    }}>
      <span className="spinner-dark" />
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.12em' }}>
        {status.toUpperCase()}
      </p>
    </div>
  )
}
