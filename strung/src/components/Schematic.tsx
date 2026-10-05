'use client'
import type { BeadItem, FindingItem } from '@/lib/supabase'
import { metalColours } from '@/lib/stash-colours'
import { beadSizeMm, glyphScale } from '@/lib/beadSize'
import {
  normaliseAssembly,
  expandStrands,
  layoutBranched,
  GLYPH_R,
  ROW_GAP,
  WRAP_ROW_GAP,
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
const ROW_H = 58 // vertical space per element (straight joins — the default)
// Wider row spacing used only when a column draws wrapped-loop joins, which need
// clearance for a loop at the top and bottom of each gap plus wrap ticks. A
// column with no wrapping join keeps ROW_H, so old designs are byte-identical.
const WRAP_ROW_H = 72
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

// Both-ways substring match on a stash item's name.
function nameMatches(matchStr: string, rawName: string | undefined): boolean {
  const name = (rawName || '').toLowerCase().trim()
  return !!name && (matchStr.includes(name) || name.includes(matchStr))
}

// The colour as a whole word, so "red" does not match "threaded", nor "tan"
// "titanium".
function colourMatches(matchStr: string, rawColour: string | undefined): boolean {
  const colour = (rawColour || '').toLowerCase().trim()
  if (!colour) return false
  const escaped = colour.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(matchStr)
}

// Name match across every bead first: a colour hit on an earlier stash row must
// not shadow a later bead the element actually names.
function matchBeadByName(matchStr: string, beads: BeadItem[]): BeadItem | undefined {
  if (!matchStr) return undefined
  return beads.find((b) => nameMatches(matchStr, b.name))
}

function matchBeadByColour(matchStr: string, beads: BeadItem[]): BeadItem | undefined {
  if (!matchStr) return undefined
  return beads.find((b) => colourMatches(matchStr, b.colour))
}

// Same name matching as beads — findings have no colour field to fall back on.
function matchFinding(matchStr: string, findings: FindingItem[]): FindingItem | undefined {
  if (!matchStr) return undefined
  return findings.find((f) => nameMatches(matchStr, f.name))
}

type ResolvedGlyph = { shape: string; fill: string; r: number }

// Precedence: a bead named by the element, then a finding named by it (beads
// before findings, as in the stash decrement), and only then a bead whose colour
// the element mentions. A name is evidence of identity; a colour is a guess, so
// "silver jump rings" resolves to the jump-ring finding, not a silver bead.
// Only a matched bead's size scales the glyph; a finding's size means something
// else per type (gauge, length, ring diameter), so findings and unmatched
// elements keep the default radius.
function resolveGlyph(matchStr: string, beads: BeadItem[], findings: FindingItem[]): ResolvedGlyph {
  const named = matchBeadByName(matchStr, beads)
  const finding = named ? undefined : matchFinding(matchStr, findings)
  const bead = named || (finding ? undefined : matchBeadByColour(matchStr, beads))
  const fill =
    bead?.hex ||
    (finding ? metalColours[finding.metal] || metalColours.other : '') ||
    'var(--muted)'
  const r = bead ? R * glyphScale(beadSizeMm(bead.size)) : R
  return { shape: bead?.shape || 'round', fill, r }
}

// Extra row spacing so the largest glyph cannot reach its neighbour. 2.2 is the
// tallest glyph's height in radii (tube; briolette is 1.2 above + 1 below). Zero
// when nothing is drawn above the default radius, so those columns keep their
// original spacing.
function rowGrowth(glyphs: ResolvedGlyph[]): number {
  return Math.ceil(2.2 * (maxGlyphR(glyphs) - R))
}

function maxGlyphR(glyphs: ResolvedGlyph[]): number {
  return Math.max(R, ...glyphs.map((g) => g.r))
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

// Bead shape enum → SVG glyph of radius r, centred on (cx, cy). The prop is
// bound to R so the shape maths below reads the same as the module constant.
function Glyph({ shape, cx, cy, fill, r: R }: { shape: string; cx: number; cy: number; fill: string; r: number }) {
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

// --- Joins between beads -----------------------------------------------------
//
// The design schema does NOT yet carry a per-connection "join" field, so the
// glyph-to-glyph connection is derived from technique data already on the design:
// steps[].technique. Each step names the material it works and the technique it
// uses; a glyph is matched to the step that works its material (same both-ways
// name match the stash resolver uses) and that step's technique picks the join
// drawn beneath the glyph. No matching step — or a plain Stringing/Crimping step
// — leaves the join straight, so a design with no technique signal (every build
// saved before this change) renders exactly as it did before.

type JoinTech = 'wrapped' | 'jumpring' | 'briolette' | 'straight'

// Technique tag (from ALLOWED_TECHNIQUES) → the join glyph it should draw.
// Only the wire techniques that visibly change a connection map to a glyph;
// everything else (Stringing, Crimping, Simple Loop, Knotting, …) is a plain
// straight line, unchanged from before.
function joinFromTechnique(technique: string): JoinTech {
  switch (technique.trim().toLowerCase()) {
    case 'wrapped loop':
    case 'linked chain':
      return 'wrapped'
    case 'jump ring':
      return 'jumpring'
    case 'briolette wrap':
      return 'briolette'
    default:
      return 'straight'
  }
}

// Build a resolver: element matchStr (already lowercased) → the join to draw
// beneath that glyph. Returns a constant "straight" resolver when the design
// carries no wire-technique steps, which is the byte-identical old-design path.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildJoinResolver(blueprint: any): (matchStr: string) => JoinTech {
  const steps = Array.isArray(blueprint?.steps) ? blueprint.steps : []
  const entries: { material: string; join: JoinTech }[] = []
  for (const raw of steps) {
    const s = raw && typeof raw === 'object' ? raw : {}
    // Read every plausible field name so a missing one never throws.
    const material = String(s.material ?? s.item ?? s.component ?? s.part ?? '').toLowerCase().trim()
    const join = joinFromTechnique(String(s.technique ?? ''))
    if (material && join !== 'straight') entries.push({ material, join })
  }
  if (entries.length === 0) return () => 'straight'
  return (matchStr: string) => {
    if (!matchStr) return 'straight'
    const hit = entries.find((e) => matchStr.includes(e.material) || e.material.includes(matchStr))
    return hit ? hit.join : 'straight'
  }
}

const JOIN_STROKE = 'var(--border2)'

// A ~330° arc leaving a small opening on the right — an open jump ring.
function openRingPath(cx: number, cy: number, r: number): string {
  const gap = 0.5 // radians of opening
  const start = gap / 2
  const end = Math.PI * 2 - gap / 2
  const x1 = cx + r * Math.cos(start)
  const y1 = cy + r * Math.sin(start)
  const x2 = cx + r * Math.cos(end)
  const y2 = cy + r * Math.sin(end)
  // large-arc-flag=1, sweep-flag=1 → the long way round, leaving the gap at 0°.
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 1 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
}

// The connection drawn in the gap between an upper glyph (cy1, radius r1) and
// the lower glyph (cy2, radius r2) in column x. "straight" reproduces the original
// 2px centre-to-centre line exactly, so a run of straight JoinGlyphs is visually
// identical to the single spanning line it replaces. Loops and rings stay at the
// base size — they are wire, not bead, and do not grow with the bead.
function JoinGlyph({ x, cy1, cy2, join, r1, r2 }: { x: number; cy1: number; cy2: number; join: JoinTech; r1: number; r2: number }) {
  if (join === 'straight') {
    return <line className="join join-straight" x1={x} y1={cy1} x2={x} y2={cy2} stroke={JOIN_STROKE} strokeWidth={2} />
  }

  const r = R
  const top = cy1 + r1 // bottom edge of the upper glyph
  const bot = cy2 - r2 // top edge of the lower glyph
  const lr = r * 0.3 // small loop radius

  if (join === 'jumpring') {
    return (
      <g className="join join-jumpring">
        <line x1={x} y1={cy1} x2={x} y2={cy2} stroke={JOIN_STROKE} strokeWidth={1.5} />
        <path d={openRingPath(x, (cy1 + cy2) / 2, r * 0.42)} fill="none" stroke={JOIN_STROKE} strokeWidth={1.5} />
      </g>
    )
  }

  if (join === 'briolette') {
    // Wire down from the upper glyph, then a single wrap loop sitting at the TOP
    // of the lower (drop) glyph.
    const loopCy = bot - lr
    return (
      <g className="join join-briolette">
        <line x1={x} y1={cy1} x2={x} y2={loopCy - lr} stroke={JOIN_STROKE} strokeWidth={1.5} />
        <circle cx={x} cy={loopCy} r={lr} fill="none" stroke={JOIN_STROKE} strokeWidth={1.5} />
      </g>
    )
  }

  // wrapped (Wrapped Loop / Linked Chain): a loop at the top and bottom of the
  // gap with a few wrap ticks on the wire between them — each bead reads as an
  // individually wrapped link.
  const topLoopCy = top + lr
  const botLoopCy = bot - lr
  const wireTop = topLoopCy + lr
  const wireBot = botLoopCy - lr
  const span = wireBot - wireTop
  const tw = r * 0.45 // wrap-tick half width
  const ticks = span > 0 ? [1, 2, 3].map((k) => wireTop + (span * k) / 4) : []
  return (
    <g className="join join-wrapped">
      <circle cx={x} cy={topLoopCy} r={lr} fill="none" stroke={JOIN_STROKE} strokeWidth={1.5} />
      <line x1={x} y1={wireTop} x2={x} y2={wireBot} stroke={JOIN_STROKE} strokeWidth={1.5} />
      {ticks.map((ty, k) => (
        <line key={k} x1={x - tw} y1={ty} x2={x + tw} y2={ty} stroke={JOIN_STROKE} strokeWidth={1.2} />
      ))}
      <circle cx={x} cy={botLoopCy} r={lr} fill="none" stroke={JOIN_STROKE} strokeWidth={1.5} />
    </g>
  )
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
function StrandSchematic({ elements, beads, findings, joinFor }: { elements: NormElement[]; beads: BeadItem[]; findings: FindingItem[]; joinFor: (matchStr: string) => JoinTech }) {
  // One join per gap, governed by the upper glyph of the pair (its bottom loop
  // connects down to the next bead).
  const joins = elements.slice(0, -1).map((el) => joinFor(el.matchStr))
  const anyWrap = joins.some((j) => j !== 'straight')
  const glyphs = elements.map((el) => resolveGlyph(el.matchStr, beads, findings))
  const rowH = (anyWrap ? WRAP_ROW_H : ROW_H) + rowGrowth(glyphs)
  // Keep an oversized first or last glyph off the frame edge (1.2 radii: the
  // briolette's point). Zero at the default radius, so TOP is unchanged then.
  const top = TOP + Math.ceil(1.2 * (maxGlyphR(glyphs) - R))
  const height = top * 2 + (elements.length - 1) * rowH
  const wireBottom = top + (elements.length - 1) * rowH

  return (
    <svg viewBox={`0 0 ${VB_W} ${height}`} width="100%" role="img" aria-label="Build schematic" style={svgStyle}>
      {/* No wrapping join anywhere → keep the original single spanning line, so a
          design with no technique signal renders byte-identically. */}
      {elements.length > 1 && !anyWrap && (
        <line x1={COL_X} y1={top} x2={COL_X} y2={wireBottom} stroke="var(--border2)" strokeWidth={2} />
      )}
      {anyWrap &&
        joins.map((join, i) => (
          <JoinGlyph key={`join-${i}`} x={COL_X} cy1={top + i * rowH} cy2={top + (i + 1) * rowH} join={join} r1={glyphs[i].r} r2={glyphs[i + 1].r} />
        ))}
      {elements.map((el, i) => {
        const cy = top + i * rowH
        const { shape, fill, r } = glyphs[i]
        return (
          <g key={i}>
            <text x={COL_X - 34} y={cy + 4} fill="var(--muted)" fontSize={11} fontFamily="var(--font-mono)" textAnchor="middle">{i + 1}</text>
            <Glyph shape={shape} cx={COL_X} cy={cy} fill={fill} r={r} />
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
function BranchedSchematic({ assembly, beads, findings, joinFor }: { assembly: Assembly; beads: BeadItem[]; findings: FindingItem[]; joinFor: (matchStr: string) => JoinTech }) {
  // A strand element with quantity 3 is three beads stacked down the strand, so
  // expand quantities into glyphs — that is what makes a taper visible. Because
  // the expanded copies keep the element's matchStr, a quantity-3 linked element
  // resolves to a wrapped join on every gap between its copies, so it reads as
  // three individual wrapped links rather than three flush beads under one line.
  const strands = expandStrands(assembly.strands).map((strand) =>
    strand.elements.flatMap((el) => Array.from({ length: el.quantity }, () => normaliseElement(el))),
  )
  // Per glyph, the join to draw beneath it. Derived per expanded copy, so the
  // quantity expansion inserts a join between every copy.
  const strandJoins = strands.map((els) => els.map((el) => joinFor(el.matchStr)))
  const strandGlyphs = strands.map((els) => els.map((el) => resolveGlyph(el.matchStr, beads, findings)))
  const anyWrap = strandJoins.some((js) => js.some((j) => j !== 'straight'))
  const rowGapValue = (anyWrap ? WRAP_ROW_GAP : ROW_GAP) + rowGrowth(strandGlyphs.flat())
  const { width, height, anchorX, anchorY, strandTop, rowGap, columns } = layoutBranched(strands.map((s) => s.length), rowGapValue)
  const anchor = assembly.anchor ? normaliseElement({ item: assembly.anchor }) : null
  const anchorGlyph = anchor ? resolveGlyph(anchor.matchStr, beads, findings) : null
  const anchorR = anchorGlyph ? anchorGlyph.r : R

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="Build schematic" style={svgStyle}>
      {anchor && (
        <text x={anchorX} y={anchorY - anchorR - 12} fill="var(--text2)" fontSize={12} fontFamily="var(--font-mono)" textAnchor="middle">
          {truncate(anchor.label, 40)}
        </text>
      )}
      {/* Anchor down to the top of each strand. */}
      {columns.map((x, i) => (
        <line key={`link-${i}`} x1={anchorX} y1={anchorY + anchorR} x2={x} y2={strandTop - (strandGlyphs[i]?.[0]?.r ?? R)} stroke="var(--border2)" strokeWidth={1.5} />
      ))}
      {anchor && anchorGlyph && (
        <g>
          <Glyph shape={anchorGlyph.shape} cx={anchorX} cy={anchorY} fill={anchorGlyph.fill} r={anchorGlyph.r} />
          <title>{anchor.label}</title>
        </g>
      )}
      {strands.map((elements, s) => {
        const x = columns[s]
        const joins = strandJoins[s]
        const glyphs = strandGlyphs[s]
        const firstR = glyphs[0]?.r ?? R
        const lastR = glyphs[glyphs.length - 1]?.r ?? R
        const strandHasWrap = joins.some((j) => j !== 'straight')
        const bottom = strandTop + (elements.length - 1) * rowGap
        return (
          <g key={s}>
            {/* Straight strand → original single spanning line (byte-identical). */}
            {elements.length > 1 && !strandHasWrap && (
              <line x1={x} y1={strandTop} x2={x} y2={bottom} stroke="var(--border2)" strokeWidth={2} />
            )}
            {/* Cap: the topmost link's own loop attaching up to the anchor, so a
                loop-jointed strand shows one join per link (a quantity-3 linked
                element → cap + 2 gap joins = 3 links, 3 joins). */}
            {strandHasWrap && (joins[0] === 'wrapped' || joins[0] === 'briolette') && (
              <circle className="join join-cap" cx={x} cy={strandTop - firstR - R * 0.3} r={R * 0.3} fill="none" stroke="var(--border2)" strokeWidth={1.5} />
            )}
            {strandHasWrap &&
              joins.slice(0, -1).map((join, i) => (
                <JoinGlyph key={`j-${i}`} x={x} cy1={strandTop + i * rowGap} cy2={strandTop + (i + 1) * rowGap} join={join} r1={glyphs[i].r} r2={glyphs[i + 1].r} />
              ))}
            {elements.map((el, i) => {
              const { shape, fill, r } = glyphs[i]
              return (
                <g key={i}>
                  <Glyph shape={shape} cx={x} cy={strandTop + i * rowGap} fill={fill} r={r} />
                  <title>{el.dimensions ? `${el.label} (${el.dimensions})` : el.label}</title>
                </g>
              )
            })}
            <text x={x} y={bottom + lastR + 20} fill="var(--muted)" fontSize={11} fontFamily="var(--font-mono)" textAnchor="middle">{s + 1}</text>
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
  const joinFor = buildJoinResolver(blueprint)
  if (assembly) return <BranchedSchematic assembly={assembly} beads={beads} findings={findings} joinFor={joinFor} />

  const elements = normalise(blueprint)
  if (elements.length === 0) return <Empty />
  return <StrandSchematic elements={elements} beads={beads} findings={findings} joinFor={joinFor} />
}
