// Shape-checks the palette JSON /api/sequence gets back from the model.
//
// The route used to forward whatever parsed. The Palette page then called
// .map() on `palette`, `sequence` and `stashMatches`, .split() on
// `sequencePattern`, and read `metalRecommendation.hex` — so one missing or
// mistyped field in an otherwise good reply threw during render and blanked
// the whole page. Normalising here gives the page a shape it can rely on, and
// clamps every string so unbounded model output never reaches the UI.

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const FALLBACK_HEX = '#888888'

export type PaletteEntry = { role: string; name: string; hex: string; beadSuggestion: string; note: string }
export type SequenceEntry = { label: string; colourName: string; hex: string; count: number; beadType: string }
export type StashMatch = { beadName: string; colour: string; hex: string; role: string; note: string }

export type SequenceResult = {
  title: string
  colourStory: string
  harmonyType: string
  palette: PaletteEntry[]
  sequence: SequenceEntry[]
  sequencePattern: string
  repeats: number
  totalBeadsPerRepeat: number
  stashMatches: StashMatch[]
  tip: string
  metalRecommendation: { name: string; hex: string; reason: string } | null
}

type Rec = Record<string, unknown>

const rec = (v: unknown): Rec => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Rec) : {})
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const hex = (v: unknown, fallback = FALLBACK_HEX) => (typeof v === 'string' && HEX_RE.test(v.trim()) ? v.trim() : fallback)
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : [])

function int(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

/** Returns null when nothing usable came back (no palette at all). */
export function normaliseSequenceResult(raw: unknown): SequenceResult | null {
  const r = rec(raw)

  const palette = arr(r.palette, 6)
    .map(rec)
    .map((p) => ({
      role: str(p.role, 40),
      name: str(p.name, 80),
      hex: hex(p.hex),
      beadSuggestion: str(p.beadSuggestion, 160),
      note: str(p.note, 300),
    }))
    .filter((p) => p.name)
  if (palette.length === 0) return null

  const sequence = arr(r.sequence, 10)
    .map(rec)
    .map((s) => ({
      label: str(s.label, 3).toUpperCase(),
      colourName: str(s.colourName, 80),
      hex: hex(s.hex),
      count: int(s.count, 1, 99, 1),
      beadType: str(s.beadType, 80),
    }))
    .filter((s) => s.label)

  // Only labels the sequence actually defines — the strip skips the rest, and
  // a pattern referencing nothing renders nothing rather than throwing.
  const labels = new Set(sequence.map((s) => s.label))
  const sequencePattern = str(r.sequencePattern, 200)
    .split('-')
    .map((l) => l.trim().toUpperCase())
    .filter((l) => labels.has(l))
    .join('-')

  const patternLength = sequencePattern ? sequencePattern.split('-').length : 0
  const totalBeadsPerRepeat = int(r.totalBeadsPerRepeat, 0, 999, patternLength)

  const metal = rec(r.metalRecommendation)
  const metalName = str(metal.name, 60)

  return {
    title: str(r.title, 120) || 'Untitled palette',
    colourStory: str(r.colourStory, 800),
    harmonyType: str(r.harmonyType, 60),
    palette,
    sequence,
    sequencePattern,
    repeats: int(r.repeats, 0, 999, 0),
    totalBeadsPerRepeat,
    stashMatches: arr(r.stashMatches, 20)
      .map(rec)
      .map((m) => ({
        beadName: str(m.beadName, 120),
        colour: str(m.colour, 80),
        hex: hex(m.hex, ''),
        role: str(m.role, 40),
        note: str(m.note, 300),
      }))
      .filter((m) => m.beadName),
    tip: str(r.tip, 600),
    metalRecommendation: metalName
      ? { name: metalName, hex: hex(metal.hex), reason: str(metal.reason, 300) }
      : null,
  }
}
