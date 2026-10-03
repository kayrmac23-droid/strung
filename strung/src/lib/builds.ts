// Write validation for /api/builds.
//
// The route only whitelisted field NAMES, so any value went into the row: a
// status of "banana" (which the journal then filed under neither tab), a rating
// outside the three the UI knows, a negative current_step, or a design of any
// size. That last one mattered — the Make page saved its preview image into the
// design as a ~2MB base64 data URI, and every journal load then pulled every
// one of those back down.

export const BUILD_STATUSES = ['draft', 'in_progress', 'completed'] as const
export const BUILD_RATINGS = ['loved_it', 'good', 'could_be_better'] as const

// A real design is a few KB. This leaves plenty of headroom while refusing
// anything that has an image (or similar) embedded in it.
export const MAX_DESIGN_CHARS = 100_000
const MAX_TITLE_CHARS = 200
const MAX_NOTES_CHARS = 5_000
const MAX_STEP = 10_000
const MAX_MINUTES = 60 * 24 * 365

export type BuildInputResult =
  | { ok: true; fields: Record<string, unknown> }
  | { ok: false; error: string }

const fail = (error: string): BuildInputResult => ({ ok: false, error })

function isTimestamp(v: unknown): boolean {
  return typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v))
}

/**
 * Strip render-only fields a client may have attached to a design before it is
 * stored. `imageUrl` is the Make page's preview — a data URI, regenerated on
 * demand, and far too large to keep in a jsonb row.
 */
export function storableDesign(design: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...design }
  delete rest.imageUrl
  return rest
}

export function cleanBuildInput(data: Record<string, unknown>, partial: boolean): BuildInputResult {
  const fields: Record<string, unknown> = {}
  const has = (k: string) => k in data && data[k] !== undefined

  if (has('title')) {
    const t = data.title
    if (typeof t !== 'string' || !t.trim()) return fail('Invalid title')
    fields.title = t.trim().slice(0, MAX_TITLE_CHARS)
  } else if (!partial) {
    return fail('Missing title')
  }

  if (has('design')) {
    const d = data.design
    if (!d || typeof d !== 'object' || Array.isArray(d)) return fail('Invalid design')
    const design = storableDesign(d as Record<string, unknown>)
    if (JSON.stringify(design).length > MAX_DESIGN_CHARS) return fail('Design too large')
    fields.design = design
  } else if (!partial) {
    return fail('Missing design')
  }

  if (has('status')) {
    if (!(BUILD_STATUSES as readonly unknown[]).includes(data.status)) return fail('Invalid status')
    fields.status = data.status
  }

  if (has('current_step')) {
    const n = data.current_step
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > MAX_STEP) return fail('Invalid current_step')
    fields.current_step = n
  }

  for (const key of ['started_at', 'completed_at'] as const) {
    if (!has(key)) continue
    const v = data[key]
    if (v !== null && !isTimestamp(v)) return fail(`Invalid ${key}`)
    fields[key] = v
  }

  if (has('time_taken_minutes')) {
    const n = data.time_taken_minutes
    if (n !== null && (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > MAX_MINUTES)) {
      return fail('Invalid time_taken_minutes')
    }
    fields.time_taken_minutes = n
  }

  if (has('notes')) {
    const v = data.notes
    if (v !== null && typeof v !== 'string') return fail('Invalid notes')
    if (typeof v === 'string' && v.length > MAX_NOTES_CHARS) return fail('Notes are too long')
    fields.notes = v
  }

  if (has('rating')) {
    const v = data.rating
    if (v !== null && !(BUILD_RATINGS as readonly unknown[]).includes(v)) return fail('Invalid rating')
    fields.rating = v
  }

  return { ok: true, fields }
}
