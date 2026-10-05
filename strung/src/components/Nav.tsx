'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Two navs (2026-10 redesign):
//  - studio (default): Bench · Stash · Make · Journal, with Learn and the
//    account avatar on the right. On phones the four destinations move to a
//    bottom tab bar (.tabbar) so they stay one thumb away.
//  - public: the landing and How it works pages — How it works, Sign in and
//    Start free. A signed-in visitor gets a single "Open studio" instead.
// Make covers its three tools (Generate /make, Co-design /codesign, Palette
// /sequence); MakeTabs switches between them.

const studioLinks = [
  { href: '/bench', label: 'Bench' },
  { href: '/inventory', label: 'Stash' },
  { href: '/make', label: 'Make' },
  { href: '/journal', label: 'Journal' },
]

const MAKE_PATHS = ['/make', '/codesign', '/sequence']
const LEARN_PATHS = ['/guides', '/glossary', '/calculator']

export function isActive(href: string, path: string): boolean {
  if (href === '/make') return MAKE_PATHS.some(p => path === p || path.startsWith(p + '/'))
  if (href === '/guides') return LEARN_PATHS.includes(path)
  return path === href
}

// The signed-in email, or null. `undefined` while the first check is pending,
// so the nav doesn't flash "Sign in" at a signed-in maker.
function useSessionEmail(): string | null | undefined {
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    supabase.auth.getSession()
      .then(({ data }) => { if (live) setEmail(data.session?.user?.email ?? null) })
      .catch(() => { if (live) setEmail(null) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setEmail(session?.user?.email ?? null)
    })
    return () => { live = false; subscription.unsubscribe() }
  }, [])
  return email
}

export function Wordmark({ size = 21 }: { size?: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: size, letterSpacing: '-.03em', color: 'var(--cream)', lineHeight: 1 }}>strung</span>
      <svg width="46" height="10" viewBox="0 0 84 10" aria-hidden="true" style={{ display: 'block' }}>
        <line x1="0" y1="5" x2="84" y2="5" stroke="var(--saddle)" strokeWidth="1" />
        <circle cx="14" cy="5" r="3.2" fill="var(--button-accent-hover)" />
        <circle cx="30" cy="5" r="2.4" fill="none" stroke="var(--tan)" strokeWidth="1" />
        <circle cx="44" cy="5" r="2.4" fill="none" stroke="var(--tan)" strokeWidth="1" />
      </svg>
    </span>
  )
}

const barStyle = (height: string): React.CSSProperties => ({
  position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height,
  background: 'color-mix(in srgb, var(--bean) 90%, transparent)', backdropFilter: 'blur(16px)',
  borderBottom: '1px solid var(--seam)',
})

export default function Nav({ variant = 'studio' }: { variant?: 'studio' | 'public' }) {
  const path = usePathname() ?? ''
  const email = useSessionEmail()

  if (variant === 'public') {
    return (
      <>
        <a href="#main" className="skip-link">Skip to content</a>
        <nav aria-label="Main" style={barStyle('var(--nav-h-public)')}>
          <div className="wrap wrap--wide" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <Link href="/" aria-label="strung — home"><Wordmark size={22} /></Link>
            <div className="public-nav-links">
              <Link href="/how-it-works" className="quiet hide-xs" aria-current={path === '/how-it-works' ? 'page' : undefined}>How it works</Link>
              {email ? (
                <Link href="/bench" className="btn-primary" style={{ padding: '11px 18px 10px' }}>Open studio</Link>
              ) : (
                <>
                  <Link href="/account" className="quiet">Sign in</Link>
                  <Link href="/account?mode=signup" className="btn-primary" style={{ padding: '11px 18px 10px' }}>Start free</Link>
                </>
              )}
            </div>
          </div>
        </nav>
      </>
    )
  }

  const learnOn = isActive('/guides', path)
  return (
    <>
      {/* First focusable element on every page — see .skip-link in globals.css. */}
      <a href="#main" className="skip-link">Skip to content</a>
      <nav aria-label="Studio" style={barStyle('var(--nav-h)')}>
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '0 clamp(16px, 4vw, 44px)' }}>
          <Link href="/bench" aria-label="strung — your bench"><Wordmark /></Link>
          <ul className="studio-nav-links">
            {studioLinks.map(l => (
              <li key={l.href}>
                <Link href={l.href} className="studio-nav-link" aria-current={isActive(l.href, path) ? 'page' : undefined}>{l.label}</Link>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <Link href="/guides" className="studio-nav-link studio-nav-learn" aria-current={learnOn ? 'page' : undefined} style={{ padding: 0 }}>Learn</Link>
            {email ? (
              <Link href="/account" className="avatar" aria-label={`Account — ${email}`} title={email}>{email.trim().charAt(0) || '·'}</Link>
            ) : email === null ? (
              <Link href="/account" className="studio-nav-link" style={{ padding: 0, color: path === '/account' ? 'var(--cream)' : undefined }}>Sign in</Link>
            ) : (
              <span className="avatar" aria-hidden="true" style={{ opacity: .4 }} />
            )}
          </div>
        </div>
      </nav>
      <nav className="tabbar" aria-label="Studio — tabs">
        {studioLinks.map(l => (
          <Link key={l.href} href={l.href} aria-current={isActive(l.href, path) ? 'page' : undefined}>
            <span className="dot" aria-hidden="true" />{l.label}
          </Link>
        ))}
      </nav>
    </>
  )
}

// Generate · Co-design · Palette — the three Make tools, one row of tabs.
export function MakeTabs() {
  const path = usePathname() ?? ''
  const tabs = [['/make', 'Generate'], ['/codesign', 'Co-design'], ['/sequence', 'Palette']] as const
  return (
    <div className="wrap" style={{ paddingTop: 'clamp(24px, 4vw, 44px)' }}>
      <nav aria-label="Make tools" className="chip-row">
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className={`chip${path === href ? ' is-on' : ''}`} aria-current={path === href ? 'page' : undefined} style={{ padding: '11px 18px' }}>{label}</Link>
        ))}
      </nav>
    </div>
  )
}
