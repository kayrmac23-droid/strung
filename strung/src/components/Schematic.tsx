'use client'
import type { BeadItem, FindingItem } from '@/lib/supabase'
import { metalColours } from '@/lib/stash-colours'
import {
  normaliseAssembly,
  expandStrands,
  layoutBranched,
  GLYPH_R,
  type Assembly,
} from '@/lib/assembly'

// A deterministic, buildable SVG diagram of a design — the counterpart to the
// decorative AI render. Reads the design's element list, matches each element to
// the maker's stash for real colour + shape, and lays them out.
//
// Two layouts: the single column (every design without an assembly field, and
// anything with form "strand"), and the branched layout for drops and
// chandeliers. Saved builds predate assembly entirely, so the single column
// stays the default and is never conditional on assembly existing.

const COL_X = 70 // x of the centre "wire"
const LABEL_X = 104 // x where labels begin
const ROW_H = 58 // vertical space per element
const TOP = 30
const R = GLYPH_R // base glyph radius
const VB_W = 520

type NormElement = { label: string; dimensions: string; matchStr: string }

// Read every plausible field name so a missing one never throws.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseElement(el: any): NormElement {
  const e = el && typeof el === 'object' ? el : {}
  const label = String(e.material || e.component || e.item || e.part || 'Component').trim()
  const dimensions = String(e.dimensions || e.size || '').trim()
  const matchStr = [e.material, e.component, e.item, e.part]
    .filter((v) => typeof v === 'string' && v.trim())
    .join(' ')
    .toLowerCase()
  return { label, dimensions, matchStr }
}

// Prefer the inspire-style layout[]; fall back to components[].
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalise(blueprint: any): NormElement[] {
  const raw =
    Array.isArray(blueprint?.layout) && blueprint.layout.length
      ? blueprint.layout
      : Array.isArray(blueprint?.components)
        ? blueprint.components
        : []
  return raw.map(normaliseElement)
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

// Beads first, then findings — same precedence as the stash decrement.
function resolveGlyph(matchStr: string, beads: BeadItem[], findings: FindingItem[]): { shape: string; fill: string } {
  const bead = matchBead(matchStr, beads)
  const finding = bead ? undefined : matchFinding(matchStr, findings)
  const fill =
    bead?.hex ||
    (finding ? metalColours[finding.metal] || metalColours.other : '') ||
    'var(--muted)'
  return { shape: bead?.shape || 'round', fill }
}

function truncate(label: string, max: number): string {
  return label.length > max ? label.slice(0, max - 1) + '…' : label
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

const svgStyle = { display: 'block', background: 'var(--surface)', border: '1px solid var(--border)' } as const

function Empty() {
  return (
    <div style={{ padding: '32px 16px', textAlign: 'center', border: '1px dashed var(--border)', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em' }}>
      No components to diagram yet.
    </div>
  )
}

// One vertical run: the original layout, and still the default.
function StrandSchematic({ elements, beads, findings }: { elements: NormElement[]; beads: BeadItem[]; findings: FindingItem[] }) {
  const height = TOP * 2 + (elements.length - 1) * ROW_H
  const wireBottom = TOP + (elements.length - 1) * ROW_H

  return (
    <svg viewBox={`0 0 ${VB_W} ${height}`} width="100%" role="img" aria-label="Build schematic" style={svgStyle}>
      {elements.length > 1 && (
        <line x1={COL_X} y1={TOP} x2={COL_X} y2={wireBottom} stroke="var(--border2)" strokeWidth={2} />
      )}
      {elements.map((el, i) => {
        const cy = TOP + i * ROW_H
        const { shape, fill } = resolveGlyph(el.matchStr, beads, findings)
        return (
          <g key={i}>
            <text x={COL_X - 34} y={cy + 4} fill="var(--muted)" fontSize={11} fontFamily="var(--font-mono)" textAnchor="middle">{i + 1}</text>
            <Glyph shape={shape} cx={COL_X} cy={cy} fill={fill} />
            <text x={LABEL_X} y={el.dimensions ? cy - 2 : cy + 4} fill="var(--text2)" fontSize={13} fontFamily="var(--font-mono)">
              {truncate(el.label, 42)}
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

// Drops and chandeliers: an anchor glyph at top centre, with each strand hanging
// from it in its own column. Columns are too narrow for inline labels, so every
// glyph carries a <title> — hovering names the material.
function BranchedSchematic({ assembly, beads, findings }: { assembly: Assembly; beads: BeadItem[]; findings: FindingItem[] }) {
  // A strand element with quantity 3 is three beads stacked down the strand, so
  // expand quantities into glyphs — that is what makes a taper visible.
  const strands = expandStrands(assembly.strands).map((strand) =>
    strand.elements.flatMap((el) => Array.from({ length: el.quantity }, () => normaliseElement(el))),
  )
  const { width, height, anchorX, anchorY, strandTop, rowGap, columns } = layoutBranched(strands.map((s) => s.length))
  const anchor = assembly.anchor ? normaliseElement({ item: assembly.anchor }) : null
  const anchorGlyph = anchor ? resolveGlyph(anchor.matchStr, beads, findings) : null

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Build schematic" style={svgStyle}>
      {anchor && (
        <text x={anchorX} y={anchorY - R - 12} fill="var(--text2)" fontSize={12} fontFamily="var(--font-mono)" textAnchor="middle">
          {truncate(anchor.label, 40)}
        </text>
      )}
      {/* Anchor down to the top of each strand. */}
      {columns.map((x, i) => (
        <line key={`link-${i}`} x1={anchorX} y1={anchorY + R} x2={x} y2={strandTop - R} stroke="var(--border2)" strokeWidth={1.5} />
      ))}
      {anchor && anchorGlyph && (
        <g>
          <Glyph shape={anchorGlyph.shape} cx={anchorX} cy={anchorY} fill={anchorGlyph.fill} />
          <title>{anchor.label}</title>
        </g>
      )}
      {strands.map((elements, s) => {
        const x = columns[s]
        const bottom = strandTop + (elements.length - 1) * rowGap
        return (
          <g key={s}>
            {elements.length > 1 && (
              <line x1={x} y1={strandTop} x2={x} y2={bottom} stroke="var(--border2)" strokeWidth={2} />
            )}
            {elements.map((el, i) => {
              const { shape, fill } = resolveGlyph(el.matchStr, beads, findings)
              return (
                <g key={i}>
                  <Glyph shape={shape} cx={x} cy={strandTop + i * rowGap} fill={fill} />
                  <title>{el.dimensions ? `${el.label} (${el.dimensions})` : el.label}</title>
                </g>
              )
            })}
            <text x={x} y={bottom + R + 20} fill="var(--muted)" fontSize={11} fontFamily="var(--font-mono)" textAnchor="middle">{s + 1}</text>
          </g>
        )
      })}
    </svg>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function Schematic({ blueprint, beads = [], findings = [] }: { blueprint: any; beads?: BeadItem[]; findings?: FindingItem[] }) {
  // Null for everything without a usable branched assembly — including every
  // design saved before the field existed.
  const assembly = normaliseAssembly(blueprint)
  if (assembly) return <BranchedSchematic assembly={assembly} beads={beads} findings={findings} />

  const elements = normalise(blueprint)
  if (elements.length === 0) return <Empty />
  return <StrandSchematic elements={elements} beads={beads} findings={findings} />
}
