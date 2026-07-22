'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const links = [
  { href: '/inventory', label: 'Stash' },
  { href: '/make', label: 'Make' },
  { href: '/codesign', label: 'Co-Design' },
  { href: '/sequence', label: 'Palette' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/guides', label: 'Learn' },
  { href: '/journal', label: 'Journal' },
  { href: '/account', label: 'Account' },
]

export default function Nav() {
  const path = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/make') return path === '/make' || path.startsWith('/make/')
    if (href === '/guides') return path === '/guides' || path === '/glossary'
    return path === href
  }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 clamp(16px, 4vw, 40px)', height: '60px',
      background: 'color-mix(in srgb, var(--bean) 92%, transparent)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--seam)'
    }}>
      {/* Wordmark — "strung" on its thread (DESIGN §Wordmark). The strand
          replaces the retired glowing orb. */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600,
          letterSpacing: '-0.01em', color: 'var(--cream)'
        }}>strung</span>
        <svg width="42" height="10" viewBox="0 0 84 10" aria-hidden="true" style={{ display: 'block' }}>
          <line x1="0" y1="5" x2="84" y2="5" stroke="var(--saddle)" strokeWidth="1" />
          <circle cx="14" cy="5" r="3.2" fill="var(--madder)" />
          <circle cx="30" cy="5" r="2.4" fill="none" stroke="var(--tan)" strokeWidth="1" />
          <circle cx="44" cy="5" r="2.4" fill="none" stroke="var(--tan)" strokeWidth="1" />
        </svg>
      </Link>

      <button
        className="nav-hamburger"
        onClick={() => setMenuOpen(o => !o)}
        aria-label="Toggle menu"
      >
        {menuOpen ? '×' : '≡'}
      </button>

      <ul className={`nav-links${menuOpen ? ' nav-links--open' : ''}`}>
        {links.map(l => (
          <li key={l.href}>
            <Link href={l.href} onClick={() => setMenuOpen(false)} style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: isActive(l.href) ? 'var(--cream)' : 'var(--meta)',
              borderBottom: isActive(l.href) ? '1px solid var(--madder)' : 'none',
              paddingBottom: isActive(l.href) ? '2px' : '0',
              transition: 'color 0.2s'
            }}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
