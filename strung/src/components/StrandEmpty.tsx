// Empty state — the limp thread (DESIGN §Empty state). A slack curve with one
// unfilled bead and a single Newsreader-italic line. Existing empty-state copy
// is passed verbatim as `line`.
export default function StrandEmpty({ line, children }: { line: string; children?: React.ReactNode }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <svg viewBox="0 0 360 34" aria-hidden="true" style={{ width: 200, maxWidth: '60%', height: 'auto', marginBottom: 4 }}>
        <path d="M4,10 C 90,34 250,30 356,12" fill="none" stroke="var(--saddle)" strokeWidth="1" />
        <circle cx="180" cy="30.5" r="4" fill="none" stroke="var(--tan)" strokeWidth="1" />
      </svg>
      <p className="empty-line" style={{ marginBottom: children ? 18 : 0 }}>{line}</p>
      {children}
    </div>
  )
}
