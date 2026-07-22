// Progress strand (DESIGN §Progress strand) — replaces the journal SVG ring.
// A saddle thread with one bead per step, threaded left → right. Completed steps
// are filled beads (using the build's real bead colours when provided, else
// madder); the current step is madder; remaining steps are saddle-outlined.
export default function StrandProgress({
  total,
  done,
  colours = [],
}: {
  total: number
  done: number
  colours?: string[]
}) {
  const n = Math.max(total, 1)
  const gap = 18
  const pad = 8
  const w = pad * 2 + gap * (n - 1)
  const cy = 9
  const r = 4

  return (
    <svg width={w} height={18} viewBox={`0 0 ${w} 18`} role="img" aria-label={`${done} of ${total} steps done`}>
      <line x1={pad} y1={cy} x2={w - pad} y2={cy} stroke="var(--saddle)" strokeWidth="1" />
      {Array.from({ length: n }).map((_, i) => {
        const cx = pad + gap * i
        const isDone = i < done
        const isCurrent = i === done
        if (isDone) {
          return <circle key={i} cx={cx} cy={cy} r={r} fill={colours[i] || 'var(--madder)'} />
        }
        if (isCurrent) {
          return <circle key={i} cx={cx} cy={cy} r={r} fill="var(--madder)" />
        }
        return <circle key={i} cx={cx} cy={cy} r={r - 0.5} fill="none" stroke="var(--saddle)" strokeWidth="1" />
      })}
    </svg>
  )
}
