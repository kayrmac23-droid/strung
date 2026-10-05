import type { CSSProperties, ReactNode } from 'react'
import { beadStyle, type BeadForm } from '@/lib/bead'

// One drawn bead — see beadStyle() in src/lib/bead.ts. Decorative by default;
// pass `title` when the bead is the only thing naming a stash item.
export default function Bead({
  hex, shape = 'round', size = 10, title, style,
}: {
  hex: string
  shape?: BeadForm
  size?: number
  title?: string
  style?: CSSProperties
}) {
  return <span title={title} aria-hidden={title ? undefined : true} style={{ display: 'block', ...beadStyle(hex, shape, size, style) }} />
}

// A strand: the 1px saddle thread with beads threaded along it.
// `spread` justifies the beads across the full width (progress strands);
// otherwise they sit centred with `gap` between them.
export function Strand({
  children, height = 28, gap = 6, spread = false, inset = 0, align = 'center', style,
}: {
  children: ReactNode
  height?: number
  gap?: number
  spread?: boolean
  inset?: number
  align?: 'center' | 'flex-start'
  style?: CSSProperties
}) {
  return (
    <div style={{
      position: 'relative', display: 'flex', alignItems: 'center', height, gap,
      justifyContent: spread ? 'space-between' : align, padding: inset ? `0 ${inset}px` : undefined,
      ...style,
    }}>
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'var(--saddle)' }} />
      {children}
    </div>
  )
}

// The open ring used for findings and for steps not yet reached.
export function OpenBead({ size = 12, colour = 'var(--saddle)', fill = 'var(--roast)' }: { size?: number; colour?: string; fill?: string }) {
  return <span aria-hidden="true" style={{ display: 'block', flex: 'none', position: 'relative', width: size, height: size, borderRadius: '50%', border: `1px solid ${colour}`, background: fill }} />
}

// The current-step marker: an empty oxblood ring with a soft halo.
export function CurrentBead({ size = 20 }: { size?: number }) {
  return <span aria-hidden="true" style={{ display: 'block', flex: 'none', position: 'relative', width: size, height: size, borderRadius: '50%', border: '2px solid var(--button-accent-hover)', background: 'var(--bean)', boxShadow: '0 0 0 4px rgba(143,53,64,.15)' }} />
}

// Progress strand for a build: finished steps are filled beads (in the step's
// bead colour when known, else tan), the current step is the oxblood ring,
// the rest are open rings. Spread across the full width.
export function StepStrand({
  colours, current, total, beadSize = 16, height = 28, label,
}: {
  colours: (string | null | undefined)[]
  current: number
  total: number
  beadSize?: number
  height?: number
  label?: string
}) {
  const n = Math.max(total, 1)
  return (
    <div role="img" aria-label={label ?? `Step ${Math.min(current + 1, n)} of ${n}`}>
      <Strand spread height={height}>
        {Array.from({ length: n }, (_, i) =>
          i < current
            ? <Bead key={i} hex={colours[i] || '#9C8070'} size={beadSize} />
            : i === current
              ? <CurrentBead key={i} size={Math.round(beadSize * 1.25)} />
              : <OpenBead key={i} size={Math.round(beadSize * 0.75)} fill="var(--mocha)" />
        )}
      </Strand>
    </div>
  )
}
