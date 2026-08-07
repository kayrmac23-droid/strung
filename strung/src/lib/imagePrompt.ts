// Deterministic image prompt built directly from a design. Used as a fallback
// when the Claude prompt-writer call is truncated (stop_reason === 'max_tokens')
// or returns nothing: the AI-written prompt is a nicety, but the preview image
// should still generate, so we assemble a serviceable prompt from the design
// fields rather than hard-failing the whole request.

// Appended verbatim so every generated image shares the same photographic look.
// This must always survive length-trimming, so trim the body, never the suffix.
export const DALLE_PHOTO_SUFFIX =
  'Macro product photography, flat lay on dark weathered slate, soft studio rim lighting, shallow depth of field, colour-accurate, photorealistic, no hands, no text, no watermarks.'

import { normaliseAssembly, expandStrands, type AssemblyStrand } from './assembly'

// Practical prompt ceiling used elsewhere in this route.
const MAX_PROMPT_CHARS = 850

type ImageDesign = {
  title?: unknown
  description?: unknown
  pieceType?: unknown
  colourStory?: unknown
  components?: unknown
  assembly?: unknown
}

// One strand, top to bottom, as the image model should read it.
function strandText(strand: AssemblyStrand): string {
  return strand.elements
    .map((el) => (el.quantity > 1 ? `${el.quantity}× ${el.item}` : el.item))
    .join(', then ')
}

/**
 * Turn a branched/drop assembly into a plain-English orientation sentence: what
 * mounts at the top and what hangs below it, in authored order. This is the fix
 * for the inverted-render bug — without it the image model sees only a flat
 * component list and guesses the structure (e.g. a cabochon as the top post).
 * Returns '' when there is no branched assembly to describe (plain strands, or
 * a design saved before the field existed), so callers can append unconditionally.
 * The wording matches what the deterministic Schematic draws from the same data.
 */
export function describeAssembly(design: unknown): string {
  const a = normaliseAssembly(design)
  if (!a) return ''
  const strands = expandStrands(a.strands)
  if (strands.length === 0) return ''

  const anchorPart = a.anchor
    ? `The ${a.anchor} is mounted at the very top and everything else hangs below it`
    : `A finding at the very top holds the piece and everything hangs below it`

  const single = strands.length === 1
  const strandParts = strands.map((s, i) => {
    const label = single ? 'The drop hangs downward' : `Strand ${i + 1} hangs downward`
    return `${label}: ${strandText(s)} (ordered top to bottom)`
  })
  const layout = single ? '' : ` ${strands.length} strands hang side by side, left to right.`

  return `Physical structure (render this exact orientation, never inverted): ${anchorPart}.${layout} ${strandParts.join('; ')}. Nothing sits above the top anchor.`
}

export function buildFallbackImagePrompt(design: ImageDesign): string {
  const title = typeof design.title === 'string' ? design.title.trim() : ''
  const pieceType = typeof design.pieceType === 'string' && design.pieceType.trim()
    ? design.pieceType.trim()
    : 'beaded jewellery piece'
  const description = typeof design.description === 'string' ? design.description.trim() : ''
  const colourStory = typeof design.colourStory === 'string' ? design.colourStory.trim() : ''
  const components = Array.isArray(design.components) ? design.components : []

  const compText = components
    .map(c => {
      const cc = (c && typeof c === 'object' ? c : {}) as { item?: unknown; quantity?: unknown }
      const item = typeof cc.item === 'string' ? cc.item.trim() : ''
      const qty = Number(cc.quantity) || 0
      return item ? (qty ? `${qty}× ${item}` : item) : ''
    })
    .filter(Boolean)
    .join(', ')

  const structure = describeAssembly(design)

  // Structure sits ahead of the free-text prose so that if the body is trimmed
  // to fit the ceiling, the orientation (which fixes the inverted render) is
  // kept and the more expendable description/colourStory is what gets cut.
  const body = [
    `A finished handmade ${pieceType}${title ? ` titled "${title}"` : ''}.`,
    structure,
    description,
    colourStory,
    compText ? `Made from: ${compText}.` : '',
  ].filter(Boolean).join(' ')

  const maxBody = MAX_PROMPT_CHARS - DALLE_PHOTO_SUFFIX.length - 1
  const trimmed = body.length > maxBody ? body.slice(0, maxBody).trimEnd() : body
  return `${trimmed} ${DALLE_PHOTO_SUFFIX}`
}
