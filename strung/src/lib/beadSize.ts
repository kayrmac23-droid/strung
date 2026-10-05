// Bead size → schematic glyph scale.
//
// The stash records bead size as a category (the Stash form's seed/small/medium/
// large/statement select), not a measurement — there is no millimetre column. So
// each category maps to a representative diameter: the midpoint of the range the
// Calculator's bead size guide gives it. Parse-stash keeps free text as written,
// so an explicit "8mm" is read too. Anything else is unknown, and an unknown size
// draws at the default glyph size.

export const BEAD_SIZE_MM: Readonly<Record<string, number>> = {
  seed: 1.5, // 1–2 mm
  small: 3.5, // 3–4 mm
  medium: 6, // 5–7 mm
  large: 9.5, // 8–11 mm
  statement: 13, // 12 mm+
}

// The size the default glyph radius stands for. Medium is the most common stash
// size and sits at scale 1, so medium beads draw exactly as before.
export const REFERENCE_MM = 6

const MIN_SCALE = 0.5
const MAX_SCALE = 1.5

// Representative diameter in mm, or null when the size is empty or unreadable.
export function beadSizeMm(size: unknown): number | null {
  if (typeof size !== 'string') return null
  const s = size.trim().toLowerCase()
  if (!s) return null
  if (Object.prototype.hasOwnProperty.call(BEAD_SIZE_MM, s)) return BEAD_SIZE_MM[s]
  const m = s.match(/(\d+(?:\.\d+)?)\s*mm\b/)
  if (!m) return null
  const mm = Number(m[1])
  return mm > 0 && mm <= 50 ? mm : null
}

// Radius multiplier for a bead of this diameter. Square root rather than linear:
// statement beads are ~9× seed beads across, which at a linear scale would make
// seed beads specks and statement beads overrun their row. Null, 0 and anything
// non-finite give 1 — the default glyph.
export function glyphScale(mm: number | null | undefined): number {
  if (typeof mm !== 'number' || !Number.isFinite(mm) || mm <= 0) return 1
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.sqrt(mm / REFERENCE_MM)))
}
