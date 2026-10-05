import type { CSSProperties } from 'react'

// Beads are drawn in CSS, not images: two radial-gradient highlights over the
// bead's hex plus a drop shadow (2026-10 redesign handoff, `beadSt()`). Very
// dark beads get a faint cream ring so they don't vanish into the bench.

export type BeadForm = 'round' | 'rondelle' | 'bicone' | 'chip' | 'tube' | 'seed'

const HEX = /^#[0-9a-f]{6}$/i

/** Perceived luminance 0–1 (the handoff's weighting). Bad input reads as mid-grey. */
export function luminance(hex: string): number {
  if (!HEX.test(hex)) return 0.5
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
}

/** Fallback for stash rows with a missing or malformed hex — the suede tan. */
export const UNKNOWN_BEAD_HEX = '#9C8070'

export function safeHex(hex: unknown): string {
  return typeof hex === 'string' && HEX.test(hex.trim()) ? hex.trim() : UNKNOWN_BEAD_HEX
}

/**
 * Map a stash row onto one of the six drawn forms. `shape` is free text in the
 * stash (up to 50 chars), so this matches keywords rather than exact values;
 * seed beads are recognised by type as well, since most are logged without a
 * shape. Anything unrecognised draws round.
 */
export function beadFormFor(item: { shape?: string | null; type?: string | null; name?: string | null }): BeadForm {
  const text = `${item.shape ?? ''} ${item.name ?? ''}`.toLowerCase()
  if (/rondel|abacus|saucer|disc|heishi/.test(text)) return 'rondelle'
  if (/bicone|cube|fire.?polish|faceted/.test(text)) return 'bicone'
  if (/chip|nugget|freeform|free-form/.test(text)) return 'chip'
  if (/tube|bugle|cylinder|barrel/.test(text)) return 'tube'
  if (item.type === 'seed' || /\bseed\b|\d+\/0/.test(text)) return 'seed'
  return 'round'
}

/** Inline style for one bead `px` across. `extra` is merged last. */
export function beadStyle(hex: string, form: BeadForm, px: number, extra?: CSSProperties): CSSProperties {
  const colour = safeHex(hex)
  let w = px, h = px, r = '50%', rot = 0
  if (form === 'rondelle') h = px * 0.62
  else if (form === 'bicone') { w = h = px * 0.76; r = '2px'; rot = 45 }
  else if (form === 'chip') { h = px * 0.78; r = '42% 58% 46% 54% / 55% 45% 55% 45%'; rot = 12 }
  else if (form === 'tube') { w = px * 1.6; h = px * 0.7; r = `${px}px` }
  else if (form === 'seed') { h = px * 0.82; r = '45%' }
  const dark = luminance(colour) < 0.22
  return {
    width: w, height: h, borderRadius: r, flex: 'none', position: 'relative',
    transform: rot ? `rotate(${rot}deg)` : undefined,
    background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,.55) 0, rgba(255,255,255,0) 36%), radial-gradient(circle at 70% 78%, rgba(0,0,0,.4) 0, rgba(0,0,0,0) 62%), ${colour}`,
    boxShadow: dark ? '0 0 0 1px rgba(237,230,219,.2), 0 2px 5px rgba(0,0,0,.55)' : '0 2px 5px rgba(0,0,0,.55)',
    ...extra,
  }
}

/** Nominal drawn size per form, so seeds read smaller than focal rounds. */
export function nominalPx(form: BeadForm): number {
  return form === 'seed' ? 5 : form === 'tube' ? 7 : form === 'bicone' || form === 'chip' || form === 'rondelle' ? 8 : 10
}

export type StashBeadLike = { name: string; hex?: string; shape?: string; type?: string }

/**
 * Colour a design's components from the stash: each component whose item
 * names a stash bead (same trim + lowercase rule the build page uses for
 * decrement) becomes one bead. Unmatched components are skipped. Order follows
 * `components`, and each match repeats a little in proportion to quantity so a
 * strand reads as a sequence rather than a legend.
 */
export function strandFromComponents(
  components: { item?: unknown; quantity?: unknown }[] | undefined,
  beads: StashBeadLike[],
  max = 11,
): { hex: string; form: BeadForm; name: string }[] {
  if (!Array.isArray(components)) return []
  const byName = new Map(beads.map(b => [b.name.trim().toLowerCase(), b]))
  const picked: { hex: string; form: BeadForm; name: string; qty: number }[] = []
  for (const c of components) {
    if (!c || typeof c.item !== 'string') continue
    const b = byName.get(c.item.trim().toLowerCase())
    if (!b) continue
    picked.push({ hex: safeHex(b.hex), form: beadFormFor(b), name: b.name, qty: Number(c.quantity) || 1 })
  }
  if (picked.length === 0) return []
  // Lay the most-used bead as the field and thread the others through it.
  const sorted = [...picked].sort((a, b) => b.qty - a.qty)
  const [field, ...accents] = sorted
  const out: { hex: string; form: BeadForm; name: string }[] = []
  const strip = ({ hex, form, name }: typeof field) => ({ hex, form, name })
  let i = 0
  while (out.length < max) {
    out.push(strip(field))
    if (out.length >= max) break
    if (accents.length) out.push(strip(accents[i++ % accents.length]))
    else if (out.length >= Math.min(max, 5)) break
  }
  return out
}

/**
 * One colour per build step: the stash bead the step names (its `material`,
 * else its instruction), or null when it names none — a crimp or a wire cut.
 * Longest names are tried first so "garnet rondelle" beats "garnet".
 */
export function stepColours(
  steps: { material?: unknown; instruction?: unknown }[] | undefined,
  beads: StashBeadLike[],
): (string | null)[] {
  if (!Array.isArray(steps)) return []
  const named = beads
    .filter(b => typeof b.name === 'string' && b.name.trim().length >= 3)
    .map(b => ({ key: b.name.trim().toLowerCase(), hex: safeHex(b.hex) }))
    .sort((a, b) => b.key.length - a.key.length)
  return steps.map(s => {
    const text = `${typeof s?.material === 'string' ? s.material : ''} ${typeof s?.instruction === 'string' ? s.instruction : ''}`.toLowerCase()
    return named.find(b => text.includes(b.key))?.hex ?? null
  })
}

// ── Colour families for the Stash spectrum filter ─────────────────────────

export const COLOUR_FAMILIES = [
  { key: 'red', label: 'Red', swatch: '#7A1F2B' },
  { key: 'orange', label: 'Orange', swatch: '#B5482E' },
  { key: 'yellow', label: 'Yellow', swatch: '#D9A441' },
  { key: 'green', label: 'Green', swatch: '#2F4A3A' },
  { key: 'blue', label: 'Blue', swatch: '#4A4F8A' },
  { key: 'purple', label: 'Purple', swatch: '#7A5A8C' },
  { key: 'pink', label: 'Pink', swatch: '#D9A6A0' },
  { key: 'neutral', label: 'Neutral', swatch: '#5E6B6E' },
] as const

export type ColourFamily = (typeof COLOUR_FAMILIES)[number]['key']

/**
 * Bucket a bead hex into a hue family. Low-saturation, near-black and
 * near-white beads (pearl, moonstone, labradorite, black seeds) are neutral;
 * light, soft reds and magentas are pink. Bad hex reads as neutral.
 */
export function colourFamily(hex: string): ColourFamily {
  if (!HEX.test(hex)) return 'neutral'
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  // Pale creams (pearl, moonstone) read as neutral even with a warm cast.
  if (s < 0.15 || l < 0.1 || l > 0.92 || (l > 0.82 && s < 0.4)) return 'neutral'
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h = (h * 60 + 360) % 360
  if (h >= 290 && h < 340) return l > 0.55 ? 'pink' : 'purple'
  if (h >= 340 || h < 10) return l > 0.68 ? 'pink' : 'red'
  if (h < 36) return l > 0.75 ? 'pink' : 'orange'
  if (h < 68) return 'yellow'
  if (h < 165) return 'green'
  if (h < 255) return 'blue'
  return 'purple'
}
