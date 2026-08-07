// The optional "assembly" field on a design: how the components hang together.
// Three jobs live here, all pure so both the API routes and the schematic can
// share them — validation (used by /api/make's repair retry), normalisation of
// whatever shape actually came back from the model, and the branched layout
// maths the schematic draws from.
//
// Everything is defensive: builds.design is jsonb and older rows have no
// assembly field at all, so absent/garbled input must degrade to "no assembly"
// rather than throw.

import { ASSEMBLY_FORMS, ASSEMBLY_FORM_LIST_TEXT, type AssemblyForm } from './designVocab'

export type AssemblyElement = { item: string; quantity: number }

export type AssemblyStrand = {
  id: number
  attachAt: AttachPoint
  repeat: number
  elements: AssemblyElement[]
}

export type Assembly = {
  form: AssemblyForm
  anchor: string | null
  strands: AssemblyStrand[]
}

export type AttachPoint = 'left' | 'centre' | 'right'

// Minimal shapes for the physical-sense pass — a component is classified by
// looking it up in the maker's stash. Kept structural so BeadItem/FindingItem
// (and any looser caller) satisfy them without importing the supabase types.
export type StashBeadLite = { name?: string | null; shape?: string | null }
export type StashFindingLite = { name?: string | null; type?: string | null }

// Finding types that can physically bear a piece from the top — the anchor is a
// mount point, so only these (and equivalent by-name findings below) belong in
// the anchor field. Exported so the make prompt can flag anchor-eligible stash.
export const ANCHOR_STRUCTURAL_FINDING_TYPES = new Set([
  'ear_wire',
  'connector',
  'statement_component',
  'chain',
  'clasp',
])

export function isStructuralFindingType(type: unknown): boolean {
  return typeof type === 'string' && ANCHOR_STRUCTURAL_FINDING_TYPES.has(type)
}

// Bead shapes that are drops — a briolette or teardrop hangs FROM an anchor, it
// is never the anchor itself.
const DROP_BEAD_SHAPES = new Set(['briolette', 'teardrop'])

// Name signals, used when a component is not in the stash (e.g. basic findings
// the maker is assumed to own, like an ear wire, are legitimately absent).
// Structural wins over drop so a clearly-mounting component is never flagged.
const STRUCTURAL_ANCHOR_KEYWORDS = ['ear wire', 'earwire', 'ear hook', 'hoop', 'filigree', 'connector', 'chandelier', 'frame', 'hook', 'post', 'stud', 'clasp', 'bail']
const DROP_KEYWORDS = ['cabochon', 'briolette', 'teardrop', 'tear drop', 'droplet', 'dangle', 'drop']

// Loose both-ways name match, mirroring how the schematic resolves a component
// name to a stash entry.
function nameMatches(itemLc: string, nameLc: string): boolean {
  return !!itemLc && !!nameLc && (itemLc.includes(nameLc) || nameLc.includes(itemLc))
}

/**
 * Physical-sense check on the anchor only (strand contents are deliberately not
 * policed — a strand may legitimately hold a spacer finding or a jump ring).
 * Returns a human-readable violation, or null when the anchor is plausibly a
 * top mount. Conservative: structural evidence always clears it, and an unknown
 * component (not in stash, no keyword) is left alone rather than guessed at.
 */
function anchorPhysicalViolation(anchor: string, beads: StashBeadLite[], findings: StashFindingLite[]): string | null {
  const lc = anchor.toLowerCase()

  // 1. Clearly structural → always a valid anchor.
  const structuralFinding = findings.some(
    (f) => isStructuralFindingType(f.type) && nameMatches(lc, String(f.name ?? '').toLowerCase().trim()),
  )
  if (structuralFinding) return null
  if (STRUCTURAL_ANCHOR_KEYWORDS.some((k) => lc.includes(k))) return null

  // 2. Drop-shaped → hangs from the anchor, cannot be one.
  const dropBead = beads.some(
    (b) => DROP_BEAD_SHAPES.has(String(b.shape ?? '').toLowerCase().trim()) && nameMatches(lc, String(b.name ?? '').toLowerCase().trim()),
  )
  if (dropBead || DROP_KEYWORDS.some((k) => lc.includes(k))) {
    return `assembly.anchor "${anchor}" is a drop/dangle-shaped component, which hangs FROM the anchor rather than serving as one. The anchor is the TOP mount point — use a structural finding (ear wire, hoop, filigree connector, or statement_component) as the anchor and list "${anchor}" as a strand element hanging below it.`
  }

  // 3. A plain bead → not a mount point.
  const isBead = beads.some((b) => nameMatches(lc, String(b.name ?? '').toLowerCase().trim()))
  if (isBead) {
    return `assembly.anchor "${anchor}" is a bead, but the anchor is the TOP mount point the strands hang from and must be a structural finding (ear wire, hoop, filigree connector, or statement_component). Anchor from a finding and list "${anchor}" as a strand element instead.`
  }

  // Unknown component — no evidence either way; leave it (a basic assumed-owned
  // finding such as "ear wire" already cleared step 1 via its keyword).
  return null
}

// Caps on a single rendered diagram. A pathological saved design (or a model
// that writes repeat: 9999) must not produce a million-node SVG.
const MAX_STRANDS = 24
const MAX_ELEMENTS_PER_STRAND = 24
const MAX_REPEAT = 12
const MAX_QUANTITY = 12

// Both spellings, plus the middle synonym, map to the same attach point.
const ATTACH_ORDER: Record<string, number> = { left: 0, centre: 1, center: 1, middle: 1, right: 2 }

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isForm(value: unknown): value is AssemblyForm {
  return typeof value === 'string' && (ASSEMBLY_FORMS as readonly string[]).includes(value)
}

// Lowercased component names from a design, for case-insensitive matching.
function componentNames(design: unknown): Set<string> {
  const names = new Set<string>()
  const components = asObject(design).components
  for (const raw of Array.isArray(components) ? components : []) {
    const item = asString(asObject(raw).item)
    if (item) names.add(item.toLowerCase())
  }
  return names
}

/**
 * Check a design's assembly against its own components. Returns human-readable
 * violations (empty === valid, and an absent assembly is always valid since the
 * field is optional). The strings are fed straight back to the model by the
 * one-shot repair retry, so they name the offending value.
 */
export function validateAssembly(
  design: unknown,
  beads: StashBeadLite[] = [],
  findings: StashFindingLite[] = [],
): string[] {
  const violations: string[] = []
  const d = asObject(design)
  if (d.assembly === undefined || d.assembly === null) return violations
  if (typeof d.assembly !== 'object' || Array.isArray(d.assembly)) {
    violations.push('assembly must be an object with "form", "anchor" and "strands", or be omitted entirely')
    return violations
  }

  const a = asObject(d.assembly)
  const names = componentNames(design)

  if (!isForm(a.form)) {
    violations.push(`assembly.form is "${String(a.form)}" but must be one of ${ASSEMBLY_FORM_LIST_TEXT}`)
  }

  const anchor = asString(a.anchor)
  if (anchor && !names.has(anchor.toLowerCase())) {
    violations.push(`assembly.anchor "${anchor}" does not appear in components[] — assembly may only arrange components you already listed`)
  }
  // Physical sense: the anchor is the top mount, so it must be a structural
  // finding — not a bead or a drop-shaped element hanging beneath it.
  if (anchor) {
    const anchorIssue = anchorPhysicalViolation(anchor, beads, findings)
    if (anchorIssue) violations.push(anchorIssue)
  }

  const strands = Array.isArray(a.strands) ? a.strands : []
  if ((a.form === 'drop' || a.form === 'branched') && strands.length === 0) {
    violations.push(`assembly.form is "${String(a.form)}" but assembly.strands is empty — list the elements of each drop, top to bottom`)
  }

  strands.forEach((rawStrand, i) => {
    const s = asObject(rawStrand)
    const label = typeof s.id === 'number' ? `${s.id}` : `${i + 1}`
    const elements = Array.isArray(s.elements) ? s.elements : []
    if (elements.length === 0) {
      violations.push(`assembly strand ${label} has no elements`)
      return
    }
    for (const rawEl of elements) {
      const item = asString(asObject(rawEl).item)
      if (!item) {
        violations.push(`assembly strand ${label} has an element with no "item" name`)
      } else if (!names.has(item.toLowerCase())) {
        violations.push(`assembly strand ${label} uses "${item}" which does not appear in components[] — assembly may only arrange components you already listed`)
      }
    }
  })

  return violations
}

function normaliseElements(raw: unknown): AssemblyElement[] {
  const out: AssemblyElement[] = []
  for (const rawEl of Array.isArray(raw) ? raw : []) {
    const el = asObject(rawEl)
    const item = asString(el.item)
    if (!item) continue
    const quantity = Math.min(MAX_QUANTITY, Math.max(1, Math.floor(Number(el.quantity)) || 1))
    out.push({ item, quantity })
    if (out.length >= MAX_ELEMENTS_PER_STRAND) break
  }
  return out
}

function normaliseAttachAt(raw: unknown): AttachPoint {
  const key = asString(raw).toLowerCase()
  if (key === 'left') return 'left'
  if (key === 'right') return 'right'
  return 'centre'
}

/**
 * Read the assembly off a design, or return null when there is nothing branched
 * to draw — no assembly field, an unusable shape, form "strand", or no strands
 * with any elements. Callers treat null as "render the plain single column".
 */
export function normaliseAssembly(design: unknown): Assembly | null {
  const a = asObject(asObject(design).assembly)
  if (!isForm(a.form) || a.form === 'strand') return null

  const strands: AssemblyStrand[] = []
  for (const rawStrand of Array.isArray(a.strands) ? a.strands : []) {
    const s = asObject(rawStrand)
    const elements = normaliseElements(s.elements)
    if (elements.length === 0) continue
    strands.push({
      id: Number.isFinite(Number(s.id)) ? Number(s.id) : strands.length + 1,
      attachAt: normaliseAttachAt(s.attachAt),
      repeat: Math.min(MAX_REPEAT, Math.max(1, Math.floor(Number(s.repeat)) || 1)),
      elements,
    })
    if (strands.length >= MAX_STRANDS) break
  }
  if (strands.length === 0) return null

  const anchor = asString(a.anchor)
  return { form: a.form, anchor: anchor || null, strands }
}

/**
 * Left to right, one entry per rendered strand: sorted by attach point (sort is
 * stable, so strands sharing an attach point keep their authored order), then
 * repeat counts expanded into that many identical strands.
 */
export function expandStrands(strands: AssemblyStrand[]): AssemblyStrand[] {
  const ordered = [...strands].sort((a, b) => ATTACH_ORDER[a.attachAt] - ATTACH_ORDER[b.attachAt])
  const out: AssemblyStrand[] = []
  for (const strand of ordered) {
    for (let i = 0; i < strand.repeat && out.length < MAX_STRANDS; i++) {
      out.push(strand)
    }
  }
  return out
}

// Diagram geometry, in viewBox units. GLYPH_R matches the schematic's own glyph
// radius — columns and rows are spaced off it so glyphs never touch.
export const GLYPH_R = 15
const COL_GAP = 64
const ROW_GAP = 42
const ANCHOR_Y = 46
const STRAND_TOP = 118
const PAD_X = 48
const PAD_BOTTOM = 46
// Floor on the width so a single drop is not blown up by the SVG scaling to
// 100% — it keeps glyphs close to the size they are in the single-column view.
const MIN_WIDTH = 440

export type BranchedLayout = {
  width: number
  height: number
  anchorX: number
  anchorY: number
  strandTop: number
  rowGap: number
  /** Centre x of each rendered strand, left to right. */
  columns: number[]
}

/**
 * Size the diagram from what is actually in it — one column per rendered strand,
 * one row per glyph in the longest strand — so a wide chandelier and a long
 * single drop both fit without fixed dimensions.
 */
export function layoutBranched(strandLengths: number[]): BranchedLayout {
  const count = Math.max(1, strandLengths.length)
  const longest = Math.max(1, ...strandLengths, 1)
  const width = Math.max(MIN_WIDTH, (count - 1) * COL_GAP + PAD_X * 2)
  const anchorX = width / 2
  const columns = Array.from({ length: count }, (_, i) => anchorX + (i - (count - 1) / 2) * COL_GAP)
  return {
    width,
    height: STRAND_TOP + (longest - 1) * ROW_GAP + PAD_BOTTOM,
    anchorX,
    anchorY: ANCHOR_Y,
    strandTop: STRAND_TOP,
    rowGap: ROW_GAP,
    columns,
  }
}
