// Typed access to the design reference pool in `src/data/referencePool.json`.
//
// The pool is a tagged record of 157 real pieces from a Pinterest inspiration
// board. It exists to WIDEN the range Strung can draw on, not to narrow it:
// nothing here is a style constraint, and it must not be fed to a design prompt
// as one. The four shipped styles live in `designVocab.ts` and stay the only
// firm aesthetic constraint. Use this pool to sample variety, to look up what a
// construction or motif actually looks like in the wild, or to check that a
// generated design is not collapsing onto one formula.
//
// Every value is read off the image. Material and metal names are visual
// guesses carrying their own `confidence`; surface them as guesses or not at
// all. See `caveats` in the JSON before you put any of this in front of a user.

import raw from '@/data/referencePool.json'

export type Confidence = 'certain' | 'likely' | 'uncertain'

/** A material guess. `name` is the best guess only — read `confidence` first. */
export type ReferenceMaterial = {
  name: string
  confidence: Confidence
  /** Equally plausible species. Non-empty is the normal case, not an edge case. */
  alternatives: string[]
  /** The fuller phrase the tag was written as, kept where the species name lost detail. */
  observed_as?: string
}

/**
 * No measurement was taken from any image. `range_mm` is null unless something
 * in the frame (a hand, a finger) gave a scale reference, and even then it is a
 * rough bracket — `estimated` is true whenever a value is present.
 */
export type ReferenceDimensions = {
  measure: 'drop' | 'length' | 'width'
  range_mm: [number, number] | null
  estimated: boolean
  basis: string | null
}

type ReferenceBase = {
  ref_id: string
  image_number: number
  pin_id: string
  pin_url: string
  image_url: string
  source_title: string | null
  source_site: string | null
}

/** A tutorial or instructional graphic — no piece to tag. */
export type ExcludedReference = ReferenceBase & {
  status: 'excluded'
  excluded_reason: string
}

/** The same image as another pin; tagged once, under `duplicate_of`. */
export type DuplicateReference = ReferenceBase & {
  status: 'duplicate'
  duplicate_of: string
}

export type TaggedReference = ReferenceBase & {
  status: 'tagged'
  piece_type: string
  shot_type: string
  form: string
  scale: string
  symmetry: string
  density: string
  construction: string[]
  components: string[]
  materials: ReferenceMaterial[]
  metal_tone: string[]
  metal_confidence: Confidence
  metal_alternatives: string[]
  palette: string[]
  finish: string[]
  motifs: string[]
  style_tags: string[]
  /** Nearest of the four shipped styles. A lookup convenience, not a claim of belonging. */
  strung_style_affinity: string[]
  /** Techniques from ALLOWED_TECHNIQUES this piece looks like it used. */
  technique_hints: string[]
  dimensions: ReferenceDimensions
  notes: string
  tag_confidence: 'high' | 'medium' | 'low'
}

export type Reference = TaggedReference | ExcludedReference | DuplicateReference

export type ReferencePool = {
  schema_version: number
  name: string
  purpose: string
  source: { kind: string; board: string; board_url: string; captured: string; pins_captured: number }
  tagged_from: string
  counts: { total: number; tagged: number; excluded_tutorial: number; duplicate: number }
  caveats: string[]
  vocabulary: Record<string, string[]>
  references: Reference[]
}

export const referencePool = raw as unknown as ReferencePool

/** Every reference, including the excluded and duplicate stubs. */
export const ALL_REFERENCES = referencePool.references

/** The 149 that actually carry tags — the list almost every caller wants. */
export const TAGGED_REFERENCES = ALL_REFERENCES.filter(
  (r): r is TaggedReference => r.status === 'tagged',
)

/** Controlled values, keyed by field. Join against these, not against free text. */
export const REFERENCE_VOCABULARY = referencePool.vocabulary

export function isTagged(ref: Reference): ref is TaggedReference {
  return ref.status === 'tagged'
}

export function getReference(refId: string): Reference | undefined {
  return ALL_REFERENCES.find((r) => r.ref_id === refId)
}

/**
 * Filter the tagged references. Every field is optional and every supplied
 * field must match; array fields match when the reference carries ANY of the
 * given values. Unknown vocabulary values simply match nothing.
 */
export type ReferenceQuery = {
  pieceType?: string | string[]
  form?: string | string[]
  scale?: string | string[]
  styleTags?: string[]
  strungStyle?: string[]
  palette?: string[]
  motifs?: string[]
  construction?: string[]
  components?: string[]
  techniques?: string[]
  /** Drop references tagged below this confidence. Default: keep everything. */
  minTagConfidence?: 'high' | 'medium' | 'low'
}

const CONFIDENCE_RANK = { low: 0, medium: 1, high: 2 } as const

function matchesScalar(value: string, want: string | string[] | undefined): boolean {
  if (want === undefined) return true
  return Array.isArray(want) ? want.includes(value) : want === value
}

function matchesAny(values: string[], want: string[] | undefined): boolean {
  if (want === undefined) return true
  return want.some((w) => values.includes(w))
}

export function findReferences(query: ReferenceQuery = {}): TaggedReference[] {
  const floor = query.minTagConfidence ? CONFIDENCE_RANK[query.minTagConfidence] : -1
  return TAGGED_REFERENCES.filter(
    (r) =>
      CONFIDENCE_RANK[r.tag_confidence] >= floor &&
      matchesScalar(r.piece_type, query.pieceType) &&
      matchesScalar(r.form, query.form) &&
      matchesScalar(r.scale, query.scale) &&
      matchesAny(r.style_tags, query.styleTags) &&
      matchesAny(r.strung_style_affinity, query.strungStyle) &&
      matchesAny(r.palette, query.palette) &&
      matchesAny(r.motifs, query.motifs) &&
      matchesAny(r.construction, query.construction) &&
      matchesAny(r.components, query.components) &&
      matchesAny(r.technique_hints, query.techniques),
  )
}

/**
 * Deterministically pick `count` references spread across distinct forms, so a
 * sample reads as a range rather than five versions of one silhouette. `seed`
 * picks the rotation; the same seed always returns the same set.
 */
export function sampleVariedReferences(
  count: number,
  seed = 0,
  query: ReferenceQuery = {},
): TaggedReference[] {
  const pool = findReferences(query)
  if (count <= 0 || pool.length === 0) return []

  const byForm = new Map<string, TaggedReference[]>()
  for (const ref of pool) {
    const bucket = byForm.get(ref.form)
    if (bucket) bucket.push(ref)
    else byForm.set(ref.form, [ref])
  }
  const forms = [...byForm.keys()].sort()

  const picked: TaggedReference[] = []
  for (let round = 0; picked.length < count && round < pool.length; round += 1) {
    let addedThisRound = false
    for (let f = 0; f < forms.length && picked.length < count; f += 1) {
      const bucket = byForm.get(forms[(f + seed) % forms.length])!
      const ref = bucket[(round + seed) % bucket.length]
      if (round < bucket.length && !picked.includes(ref)) {
        picked.push(ref)
        addedThisRound = true
      }
    }
    if (!addedThisRound) break
  }
  return picked
}
