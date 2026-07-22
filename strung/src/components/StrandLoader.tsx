// The loading strand — beads slide along a thread (DESIGN §Loading strand).
// Replaces the old ring spinners. Loading copy stays in DM Mono caps beside it.
export default function StrandLoader({ label }: { label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div className="strand-loader" aria-label={label || 'Loading'} role="status">
        <i></i><i></i><i></i>
      </div>
      {label && (
        <span className="mono" style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--meta)' }}>
          {label}
        </span>
      )}
    </div>
  )
}
