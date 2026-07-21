import type { BeadItem } from '@/lib/supabase'

// Shared image-prompt builder for the AI "Visual" render. Kept out of the pages
// so design/ and codesign/ produce identical, palette-aware prompts.

const QUALITY_SUFFIX =
  'professional jewellery photography, studio lighting, white background, elegant, detailed macro'

// A rough plain-English reading of a hex colour, to nudge the render toward the
// real palette even when the colour name alone is vague.
function hexTone(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return ''
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b)
  const light = max > 200 ? 'light' : max < 80 ? 'deep' : 'medium'
  if (max - min < 24) return `${light} ${max > 180 ? 'silver-grey' : max < 70 ? 'charcoal' : 'grey'}`
  let hue: string
  if (r >= g && r >= b) hue = g > b ? 'warm amber' : 'rich red'
  else if (g >= r && g >= b) hue = b > r ? 'sea green' : 'fresh green'
  else hue = r > g ? 'violet' : 'ocean blue'
  return `${light} ${hue}`
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of arr) {
    const k = s.toLowerCase()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(s)
  }
  return out
}

// Pull concrete material strings from either blueprint shape.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collectMaterials(blueprint: any): string[] {
  const src = Array.isArray(blueprint?.components)
    ? blueprint.components
    : Array.isArray(blueprint?.layout)
      ? blueprint.layout
      : []
  const out: string[] = []
  for (const el of src) {
    if (!el || typeof el !== 'object') continue
    const m = el.material || el.item || el.component || el.part
    if (typeof m === 'string' && m.trim()) out.push(m.trim())
  }
  return out
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildVisualPrompt(blueprint: any, beads: BeadItem[] = []): string {
  const bp = blueprint && typeof blueprint === 'object' ? blueprint : {}
  const parts: string[] = []

  const title = typeof bp.title === 'string' ? bp.title.trim() : ''
  const type =
    typeof bp.pieceType === 'string' ? bp.pieceType.trim() : typeof bp.type === 'string' ? bp.type.trim() : ''
  const vibe =
    typeof bp.tagline === 'string'
      ? bp.tagline.trim()
      : typeof bp.vibe === 'string'
        ? bp.vibe.trim()
        : typeof bp.description === 'string'
          ? bp.description.trim()
          : ''

  const descriptor = type ? `handmade beaded ${type}` : 'handmade beaded jewellery piece'
  parts.push(title ? `A ${descriptor} titled "${title}"` : `A ${descriptor}`)
  if (vibe && vibe.toLowerCase() !== title.toLowerCase()) parts.push(vibe)

  const materials = dedupe(collectMaterials(bp))
  if (materials.length) parts.push(`made with ${materials.slice(0, 8).join(', ')}`)

  // Colour story: for each stash bead referenced by a material, name its colour
  // (plus a plain-English hex reading) so the render reflects the true palette.
  const lowerMaterials = materials.map((m) => m.toLowerCase())
  const colours: string[] = []
  for (const b of beads) {
    const name = (b.name || '').toLowerCase().trim()
    const colour = (b.colour || '').toLowerCase().trim()
    const hit = lowerMaterials.some(
      (m) => (name && (m.includes(name) || name.includes(m))) || (colour && m.includes(colour)),
    )
    if (!hit) continue
    const tone = hexTone(b.hex)
    colours.push(b.colour ? (tone ? `${b.colour} (${tone})` : b.colour) : tone)
  }
  const colourStory = dedupe(colours.filter(Boolean))
  if (colourStory.length) parts.push(`colour palette of ${colourStory.slice(0, 6).join(', ')}`)

  parts.push(QUALITY_SUFFIX)

  let prompt = dedupe(parts.map((p) => p.trim()).filter(Boolean)).join('. ')
  const MAX = 850
  if (prompt.length > MAX) prompt = prompt.slice(0, MAX - 1).replace(/[,.\s]+\S*$/, '') + '.'
  return prompt
}

// SWAP POINT: this single function is the only place the image backend is chosen.
// Today it returns a keyless Pollinations URL (no dependency, renders in a plain
// <img>). To move to Nano Banana Pro (gemini-3-pro-image) later, replace the body
// here to call that model and return its image URL — nothing else needs to change.
export function visualUrl(prompt: string): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true`
}
