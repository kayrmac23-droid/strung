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

// ── Write validation for /api/inventory ─────────────────────────────────────
//
// normaliseBead/normaliseFinding above repair model output — they fill in
// defaults because the review UI lets the maker correct them. A direct write
// from the stash form is different: a bad value there is a client bug or a
// hand-crafted request, and silently "fixing" it would store something the
// maker never chose. So this rejects instead, naming the field.
//
// It used to be missing entirely: the route only whitelisted field NAMES, so a
// hex of "banana", a quantity of -40 or a 1MB notes string went straight in.
// The hex is rendered as a CSS colour and the quantity drives stash maths.

const HEX_RE = /^#[0-9a-fA-F]{6}$/
export const MAX_STASH_QUANTITY = 99_999

type FieldRule =
  | { kind: 'text'; max: number; required?: boolean; nullable?: boolean }
  | { kind: 'enum'; values: readonly string[]; required?: boolean }
  | { kind: 'hex'; required?: boolean }
  | { kind: 'quantity'; required?: boolean }

const BEAD_RULES: Record<string, FieldRule> = {
  name: { kind: 'text', max: 200, required: true },
  type: { kind: 'enum', values: BEAD_TYPES, required: true },
  colour: { kind: 'text', max: 100 },
  hex: { kind: 'hex' },
  size: { kind: 'text', max: 50 },
  quantity: { kind: 'quantity' },
  shape: { kind: 'text', max: 50, nullable: true },
  notes: { kind: 'text', max: 1000, nullable: true },
}

const FINDING_RULES: Record<string, FieldRule> = {
  name: { kind: 'text', max: 200, required: true },
  type: { kind: 'enum', values: FINDING_TYPES, required: true },
  metal: { kind: 'enum', values: FINDING_METALS, required: true },
  size: { kind: 'text', max: 50, nullable: true },
  quantity: { kind: 'quantity' },
  notes: { kind: 'text', max: 1000, nullable: true },
}

export type StashInputResult =
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; error: string }

/**
 * Validate a stash row for insert (`partial: false`) or update (`partial:
 * true`). Unknown keys are dropped — that is the field whitelist. Required
 * fields must be present on insert; on update they may be omitted but, when
 * sent, must still be valid (a name cannot be blanked).
 */
export function cleanStashInput(
  table: 'beads' | 'findings',
  data: unknown,
  partial: boolean,
): StashInputResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'Invalid data' }
  const input = data as RawItem
  const rules = table === 'beads' ? BEAD_RULES : FINDING_RULES
  const fields: Record<string, unknown> = {}

  for (const [key, rule] of Object.entries(rules)) {
    const present = key in input && input[key] !== undefined
    if (!present) {
      if (rule.required && !partial) return { ok: false, error: `Missing ${key}` }
      continue
    }
    const v = input[key]
    switch (rule.kind) {
      case 'text': {
        if (v === null && rule.nullable) { fields[key] = null; break }
        if (typeof v !== 'string') return { ok: false, error: `Invalid ${key}` }
        const t = v.trim()
        if (rule.required && !t) return { ok: false, error: `${key[0].toUpperCase()}${key.slice(1)} is required` }
        if (t.length > rule.max) return { ok: false, error: `${key[0].toUpperCase()}${key.slice(1)} is too long` }
        fields[key] = rule.nullable && !t ? null : t
        break
      }
      case 'enum':
        if (typeof v !== 'string' || !rule.values.includes(v)) return { ok: false, error: `Invalid ${key}` }
        fields[key] = v
        break
      case 'hex':
        if (typeof v !== 'string' || !HEX_RE.test(v.trim())) {
          return { ok: false, error: 'Colour hex must look like #7a9ab8' }
        }
        fields[key] = v.trim().toLowerCase()
        break
      case 'quantity':
        if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX_STASH_QUANTITY) {
          return { ok: false, error: `Quantity must be a whole number from 0 to ${MAX_STASH_QUANTITY}` }
        }
        fields[key] = v
        break
    }
  }
  return { ok: true, fields }
}

export type NormalisedBead = NonNullable<ReturnType<typeof normaliseBead>>
export type NormalisedFinding = NonNullable<ReturnType<typeof normaliseFinding>>

export function itemConfidence(raw: unknown): Confidence {
  if (!raw || typeof raw !== 'object') return 'likely'
  return pickEnum((raw as RawItem).confidence, CONFIDENCE_LEVELS, 'likely')
}
