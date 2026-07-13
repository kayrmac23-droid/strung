// Shared normalisation for AI-extracted stash items, used by /api/parse-stash
// (text → items) and /api/identify multi mode (photo → items). Clamps every
// field the model returns to the app's enums and length limits so downstream
// code never sees unbounded model output.

export const BEAD_TYPES = ['gemstone', 'crystal', 'glass', 'seed', 'metal', 'pearl', 'resin', 'other'] as const
export const FINDING_TYPES = ['ear_wire', 'head_pin', 'eye_pin', 'jump_ring', 'clasp', 'chain', 'wire', 'crimp', 'connector', 'statement_component', 'other'] as const
export const FINDING_METALS = ['silver', 'gold_filled', 'gold', 'copper', 'brass', 'oxidised', 'other'] as const

// How sure the vision model is about an identified item. Surfaced in the
// review UI so uncertain rows get a second look; stripped by the inventory
// route's field whitelist before saving.
export const CONFIDENCE_LEVELS = ['certain', 'likely', 'unsure'] as const
export type Confidence = (typeof CONFIDENCE_LEVELS)[number]

type RawItem = Record<string, unknown>

export function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

export function qty(v: unknown): number {
  const n = typeof v === 'number' ? Math.round(v) : parseInt(String(v), 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, 9999)
}

export function pickEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

export function normaliseBead(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as RawItem
  const name = str(item.name, 200)
  if (!name) return null
  const hex = typeof item.hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(item.hex) ? item.hex : '#888888'
  const shape = str(item.shape, 50)
  const notes = str(item.notes, 300)
  return {
    name,
    type: pickEnum(item.type, BEAD_TYPES, 'other'),
    colour: str(item.colour, 100),
    hex,
    size: str(item.size, 50),
    quantity: qty(item.quantity),
    ...(shape ? { shape } : {}),
    ...(notes ? { notes } : {}),
  }
}

export function normaliseFinding(raw: unknown) {
  if (!raw || typeof raw !== 'object') return null
  const item = raw as RawItem
  const name = str(item.name, 200)
  if (!name) return null
  const size = str(item.size, 50)
  const notes = str(item.notes, 300)
  return {
    name,
    type: pickEnum(item.type, FINDING_TYPES, 'other'),
    metal: pickEnum(item.metal, FINDING_METALS, 'other'),
    ...(size ? { size } : {}),
    quantity: qty(item.quantity),
    ...(notes ? { notes } : {}),
  }
}

export type NormalisedBead = NonNullable<ReturnType<typeof normaliseBead>>
export type NormalisedFinding = NonNullable<ReturnType<typeof normaliseFinding>>

export function itemConfidence(raw: unknown): Confidence {
  if (!raw || typeof raw !== 'object') return 'likely'
  return pickEnum((raw as RawItem).confidence, CONFIDENCE_LEVELS, 'likely')
}
