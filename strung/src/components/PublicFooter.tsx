import Link from 'next/link'

// Footer for the public pages. Links only to pages that exist — the handoff's
// "Privacy" entry is omitted until there is a privacy page to point at.
export default function PublicFooter() {
  const links = [['/guides', 'Guides'], ['/glossary', 'Glossary'], ['/calculator', 'Bead math']]
  return (
    <footer style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, flexWrap: 'wrap',
      padding: '24px 0 36px', borderTop: '1px solid var(--seam)',
      fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-3xs)', letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--meta)',
    }}>
      <Link href="/" style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'var(--fs-lead)', letterSpacing: '-.03em', textTransform: 'none', color: 'var(--cream)' }}>strung</Link>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        {links.map(([href, label]) => <Link key={href} href={href} style={{ color: 'var(--meta)' }}>{label}</Link>)}
      </div>
    </footer>
  )
}
