'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const primaryLinks = [
  { href: '/', label: 'Home' },
  { href: '/inventory', label: 'My Stash' },
  { href: '/inspire', label: 'Inspire' },
  { href: '/codesign', label: 'Design Studio' },
  { href: '/palette', label: 'Palette' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/guides', label: 'Guides' },
]

const secondaryLinks = [
  { href: '/journal', label: 'Journal' },
  { href: '/advisor', label: 'Advisor' },
  { href: '/glossary', label: 'Glossary' },
]

export default function Nav() {
  const path = usePathname()
  return (
    <nav style={{
      position:'fixed',top:0,left:0,right:0,zIndex:100,
      display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:'0 clamp(16px,4vw,40px)',minHeight:'60px',
      background:'rgba(9,10,13,0.95)',backdropFilter:'blur(16px)',
      borderBottom:'1px solid var(--border)',flexWrap:'wrap',gap:'8px'
    }}>
      <Link href="/" style={{display:'flex',alignItems:'center',gap:10}}>
        <span style={{
          width:8,height:8,borderRadius:'50%',
          background:'var(--silver)',
          boxShadow:'0 0 10px rgba(168,180,200,0.6)',
          animation:'glow 3s ease-in-out infinite',
          display:'inline-block'
        }}/>
        <span style={{fontFamily:'var(--font-display)',fontSize:26,fontWeight:600,letterSpacing:'0.08em',color:'var(--cream)'}}>Strung</span>
      </Link>
      <div style={{display:'flex',alignItems:'center',gap:0,flexWrap:'wrap'}}>
        <ul className="nav-links">
          {primaryLinks.map(l => (
            <li key={l.href}>
              <Link href={l.href} style={{
                fontFamily:'var(--font-mono)',fontSize:10,letterSpacing:'0.14em',
                textTransform:'uppercase',
                color:path===l.href?'var(--silver2)':'var(--muted)',
                borderBottom:path===l.href?'1px solid var(--silver)':'none',
                paddingBottom:path===l.href?'2px':'0',
                transition:'color 0.2s'
              }}>{l.label}</Link>
            </li>
          ))}
        </ul>
        <span style={{width:1,height:16,background:'var(--border2)',alignSelf:'center',margin:'0 4px'}}/>
        <ul className="nav-links">
          {secondaryLinks.map(l => (
            <li key={l.href}>
              <Link href={l.href} style={{
                fontFamily:'var(--font-mono)',fontSize:10,letterSpacing:'0.14em',
                textTransform:'uppercase',
                color:path===l.href?'var(--silver2)':'var(--muted2)',
                borderBottom:path===l.href?'1px solid var(--silver)':'none',
                paddingBottom:path===l.href?'2px':'0',
                transition:'color 0.2s'
              }}>{l.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}
