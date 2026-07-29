'use client'
import type { BeadItem, FindingItem } from '@/lib/supabase'
import { metalColours } from '@/lib/stash-colours'

// A deterministic, buildable SVG diagram of a design — the counterpart to the
// decorative AI render. Reads the design's element list, matches each element to
// the maker's stash for real colour + shape, and lays them out as a strand.

const COL_X = 70 // x of the centre "wire"
const LABEL_X = 104 // x where labels begin
const ROW_H = 58 // vertical space per element
const TOP = 30
const R = 15 // base glyph radius
const VB_W = 520

type NormElement = { label: string; dimensions: string; matchStr: string }

// Prefer the inspire-style layout[]; fall back to components[]. Read every
// plausible field name so a missing one never throws.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalise(blueprint: any): NormElement[] {
  const raw =
    Array.isArray(blueprint?.layout) && blueprint.layout.length
      ? blueprint.layout
      : Array.isArray(blueprint?.components)
        ? blueprint.components
        : []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return raw.map((el: any): NormElement => {
    const e = el && typeof el === 'object' ? el : {}
    const label = String(e.material || e.component || e.item || e.part || 'Component').trim()
    const dimensions = String(e.dimensions || e.size || '').trim()
    const matchStr = [e.material, e.component, e.item, e.part]
      .filter((v) => typeof v === 'string' && v.trim())
      .join(' ')
      .toLowerCase()
    return { label, dimensions, matchStr }
  })
}

function matchBead(matchStr: string, beads: BeadItem[]): BeadItem | undefined {
  if (!matchStr) return undefined
  return beads.find((b) => {
    const name = (b.name || '').toLowerCase().trim()
    const colour = (b.colour || '').toLowerCase().trim()
    return (
      (name && (matchStr.includes(name) || name.includes(matchStr))) ||
      (colour && matchStr.includes(colour))
    )
  })
}

// Same name matching as beads — findings have no colour field to fall back on.
function matchFinding(matchStr: string, findings: FindingItem[]): FindingItem | undefined {
  if (!matchStr) return undefined
  return findings.find((f) => {
    const name = (f.name || '').toLowerCase().trim()
    return !!name && (matchStr.includes(name) || name.includes(matchStr))
  })
}

function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`
  }).join(' ')
}

// Bead shape enum → SVG glyph, centred on (cx, cy).
function Glyph({ shape, cx, cy, fill }: { shape: string; cx: number; cy: number; fill: string }) {
  const common = { fill, stroke: 'var(--border2)', strokeWidth: 1.5 }
  switch ((shape || '').toLowerCase()) {
    case 'rondelle':
      return <ellipse cx={cx} cy={cy} rx={R} ry={R * 0.55} {...common} />
    case 'oval':
      return <ellipse cx={cx} cy={cy} rx={R * 0.7} ry={R} {...common} />
    case 'square':
      return <rect x={cx - R * 0.85} y={cy - R * 0.85} width={R * 1.7} height={R * 1.7} {...common} />
    case 'tube':
      return <rect x={cx - R * 0.5} y={cy - R * 1.1} width={R} height={R * 2.2} rx={R * 0.5} {...common} />
    case 'faceted':
      return <polygon points={hexPoints(cx, cy, R)} {...common} />
    case 'chip':
      return (
        <polygon
          points={`${cx - R},${cy - R * 0.3} ${cx - R * 0.2},${cy - R} ${cx + R * 0.9},${cy - R * 0.5} ${cx + R * 0.6},${cy + R * 0.7} ${cx - R * 0.5},${cy + R}`}
          {...common}
        />
      )
    case 'briolette':
    case 'teardrop':
      return (
        <path
          d={`M ${cx} ${cy - R * 1.2} C ${cx + R} ${cy - R * 0.2}, ${cx + R} ${cy + R * 0.8}, ${cx} ${cy + R} C ${cx - R} ${cy + R * 0.8}, ${cx - R} ${cy - R * 0.2}, ${cx} ${cy - R * 1.2} Z`}
          {...common}
        />
      )
    case 'round':
    default:
      return <circle cx={cx} cy={cy} r={R} {...common} />
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function Schematic({ blueprint, beads = [], findings = [] }: { blueprint: any; beads?: BeadItem[]; findings?: FindingItem[] }) {
  const elements = normalise(blueprint)
  if (elements.length === 0) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', border: '1px dashed var(--border)', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em' }}>
        No components to diagram yet.
      </div>
    )
  }
  const height = TOP * 2 + (elements.length - 1) * ROW_H
  const wireBottom = TOP + (elements.length - 1) * ROW_H

  return (
    <svg viewBox={`0 0 ${VB_W} ${height}`} width="100%" role="img" aria-label="Build schematic"
      style={{ display: 'block', background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {elements.length > 1 && (
        <line x1={COL_X} y1={TOP} x2={COL_X} y2={wireBottom} stroke="var(--border2)" strokeWidth={2} />
      )}
      {elements.map((el, i) => {
        const cy = TOP + i * ROW_H
        // Beads first, then findings — same precedence as the stash decrement.
        const bead = matchBead(el.matchStr, beads)
        const finding = bead ? undefined : matchFinding(el.matchStr, findings)
        const fill =
          bead?.hex ||
          (finding ? metalColours[finding.metal] || metalColours.other : '') ||
          'var(--muted)'
        return (
          <g key={i}>
            <text x={COL_X - 34} y={cy + 4} fill="var(--muted)" fontSize={11} fontFamily="var(--font-mono)" textAnchor="middle">{i + 1}</text>
            <Glyph shape={bead?.shape || 'round'} cx={COL_X} cy={cy} fill={fill} />
            <text x={LABEL_X} y={el.dimensions ? cy - 2 : cy + 4} fill="var(--text2)" fontSize={13} fontFamily="var(--font-mono)">
              {el.label.length > 42 ? el.label.slice(0, 41) + '…' : el.label}
            </text>
            {el.dimensions && (
              <text x={LABEL_X} y={cy + 15} fill="var(--muted)" fontSize={11} fontFamily="var(--font-mono)">{el.dimensions}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
