'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/inventory', label: 'Stash' },
  { href: '/make', label: 'Make' },
  { href: '/guides', label: 'Learn' },
  { href: '/journal', label: 'Journal' },
  { href: '/account', label: 'Account' },
]

export default function Nav() {
  const path = usePathname()

  const isActive = (href: string) => {
    if (href === '/make') return path === '/make' || path.startsWith('/make/')
    if (href === '/guides') return path === '/guides' || path === '/glossary'
    return path === href
  }

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 40px', height: '60px',
      background: 'rgba(9,10,13,0.95)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)'
    }}>
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'var(--silver)',
          boxShadow: '0 0 10px rgba(168,180,200,0.6)',
          animation: 'glow 3s ease-in-out infinite',
          display: 'inline-block'
        }} />
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600,
          letterSpacing: '0.1em', color: 'var(--cream)'
        }}>Strung</span>
      </Link>
      <ul style={{ display: 'flex', listStyle: 'none', gap: 32, alignItems: 'center' }}>
        {links.map(l => (
          <li key={l.href}>
            <Link href={l.href} style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: isActive(l.href) ? 'var(--silver2)' : 'var(--muted)',
              borderBottom: isActive(l.href) ? '1px solid var(--silver)' : 'none',
              paddingBottom: isActive(l.href) ? '2px' : '0',
              transition: 'color 0.2s'
            }}>{l.label}</Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
