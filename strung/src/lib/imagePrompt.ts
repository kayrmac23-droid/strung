// Deterministic DALL-E prompt built directly from a design. Used as a fallback
// when the Claude prompt-writer call is truncated (stop_reason === 'max_tokens')
// or returns nothing: the AI-written prompt is a nicety, but the preview image
// should still generate, so we assemble a serviceable prompt from the design
// fields rather than hard-failing the whole request.

// Appended verbatim so every generated image shares the same photographic look.
// This must always survive length-trimming, so trim the body, never the suffix.
export const DALLE_PHOTO_SUFFIX =
  'Macro product photography, flat lay on dark weathered slate, soft studio rim lighting, shallow depth of field, colour-accurate, photorealistic, no hands, no text, no watermarks.'

// DALL-E 3 practical prompt ceiling used elsewhere in this route.
const MAX_PROMPT_CHARS = 850

type ImageDesign = {
  title?: unknown
  description?: unknown
  pieceType?: unknown
  colourStory?: unknown
  components?: unknown
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

  const body = [
    `A finished handmade ${pieceType}${title ? ` titled "${title}"` : ''}.`,
    description,
    colourStory,
    compText ? `Made from: ${compText}.` : '',
  ].filter(Boolean).join(' ')

  const maxBody = MAX_PROMPT_CHARS - DALLE_PHOTO_SUFFIX.length - 1
  const trimmed = body.length > maxBody ? body.slice(0, maxBody).trimEnd() : body
  return `${trimmed} ${DALLE_PHOTO_SUFFIX}`
}
