// Drawn bead-shape micro-icons (DESIGN §Iconography) — the tool's icons are its
// own diagrams at small size. Replaces the retired Unicode glyph set (◈ ◉ ◎ ◇ ⊡).
// 1.25px cream stroke, sized 16/20px. Shape grammar mirrors components/Schematic.

export type BeadShape = 'round' | 'rondelle' | 'bicone' | 'chip' | 'tube' | 'ring' | 'disc'

export default function BeadIcon({
  shape,
  size = 18,
  stroke = 'var(--cream)',
  fill = 'none',
}: {
  shape: BeadShape
  size?: number
  stroke?: string
  fill?: string
}) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 20 20',
    fill: 'none',
    stroke,
    strokeWidth: 1.25,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
    style: { display: 'inline-block', flexShrink: 0, verticalAlign: 'middle' },
  }
  switch (shape) {
    case 'round':
      return <svg {...common}><circle cx="10" cy="10" r="6.5" fill={fill} /></svg>
    case 'disc':
      return <svg {...common}><circle cx="10" cy="10" r="6.5" fill={stroke} stroke="none" /></svg>
    case 'ring':
      return <svg {...common}><circle cx="10" cy="10" r="6.5" /><circle cx="10" cy="10" r="2.6" /></svg>
    case 'rondelle':
      return <svg {...common}><ellipse cx="10" cy="10" rx="7.5" ry="4.5" fill={fill} /></svg>
    case 'bicone':
      return <svg {...common}><path d="M10 2.5 L16 10 L10 17.5 L4 10 Z" fill={fill} /></svg>
    case 'tube':
      return <svg {...common}><rect x="6.5" y="3" width="7" height="14" rx="3.2" fill={fill} /></svg>
    case 'chip':
      return <svg {...common}><path d="M6 4 L15 6 L16 13 L9 16.5 L3.5 11 Z" fill={fill} /></svg>
    default:
      return <svg {...common}><circle cx="10" cy="10" r="6.5" fill={fill} /></svg>
  }
}
