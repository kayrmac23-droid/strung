import Link from 'next/link'
import Nav from '@/components/Nav'

export default function NotFound() {
  return (
    <>
      <Nav />
      <main style={{
        paddingTop: 60, minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden'
      }}>
        <div className="fade-up" style={{ textAlign: 'center', position: 'relative', zIndex: 1, padding: '40px 24px' }}>
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32
          }}>
            {['#7a9ab8', '#8a70aa', '#6a9080'].map((c, i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: '50%', background: c,
                boxShadow: `0 0 8px ${c}60`,
                animation: `shimmer ${2 + i * 0.4}s ease-in-out infinite`
              }} />
            ))}
          </div>

          <p className="section-eyebrow" style={{ marginBottom: 16 }}>404</p>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(40px,7vw,72px)',
            fontWeight: 400, color: 'var(--cream)', lineHeight: 1.1, marginBottom: 16
          }}>
            Lost in the stash.
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 17, color: 'var(--text2)',
            lineHeight: 1.7, maxWidth: 380, margin: '0 auto 36px'
          }}>
            That page doesn&apos;t exist — it may have been moved or you followed a broken link.
          </p>
          <Link href="/" className="btn-silver">Back to studio</Link>
        </div>
      </main>
    </>
  )
}
