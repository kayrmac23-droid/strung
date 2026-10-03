// Validation for the client-supplied chat history on /api/codesign.
//
// The route used to pass the request's message objects straight to Anthropic
// after spot-checking a few fields. Anything it did not check rode along: extra
// keys on a block, a `url` image source (which makes Anthropic fetch an
// arbitrary URL), or a null entry that threw a TypeError and surfaced as a 500.
// This rebuilds every message from scratch, keeping only the shapes the page
// actually sends, so what reaches the paid upstream is exactly what was checked.

import type Anthropic from '@anthropic-ai/sdk'

export const MAX_MESSAGES = 50
export const MAX_TEXT_CHARS_PER_MESSAGE = 10_000
export const MAX_IMAGES_PER_MESSAGE = 2
export const MAX_IMAGES_TOTAL = 6
// Compared against the base64 *string* length, not decoded bytes — base64 is
// ~4/3 the size of what it encodes, so this is roughly 1.1MB of image.
export const MAX_IMAGE_BASE64_CHARS = 1.5 * 1024 * 1024

const IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number]

type Block = Anthropic.TextBlockParam | Anthropic.ImageBlockParam

export type ChatValidation =
  | { ok: true; messages: Anthropic.MessageParam[] }
  | { ok: false; error: string }

const fail = (error: string): ChatValidation => ({ ok: false, error })

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

export function sanitiseChatMessages(raw: unknown): ChatValidation {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) {
    return fail('Invalid messages')
  }

  const out: Anthropic.MessageParam[] = []
  let totalImages = 0

  for (const m of raw) {
    if (!isRecord(m)) return fail('Invalid message')
    const role = m.role
    if (role !== 'user' && role !== 'assistant') return fail('Invalid message role')

    if (typeof m.content === 'string') {
      if (m.content.length > MAX_TEXT_CHARS_PER_MESSAGE) return fail('Message too long')
      // An empty turn is rejected by the API outright, and one failed reply
      // left in the page's history would then fail every later request.
      if (!m.content.trim()) continue
      out.push({ role, content: m.content })
      continue
    }

    if (!Array.isArray(m.content)) return fail('Invalid message content')

    const blocks: Block[] = []
    let textChars = 0
    let imagesInMessage = 0
    for (const b of m.content) {
      if (!isRecord(b)) return fail('Invalid content block')
      if (b.type === 'text') {
        if (typeof b.text !== 'string') return fail('Invalid content block')
        textChars += b.text.length
        if (b.text.trim()) blocks.push({ type: 'text', text: b.text })
      } else if (b.type === 'image') {
        // Only the user attaches photos, and only as inline base64.
        if (role !== 'user') return fail('Invalid content block')
        const source = b.source
        if (!isRecord(source) || source.type !== 'base64') return fail('Invalid image')
        const mediaType = source.media_type
        const data = source.data
        if (typeof mediaType !== 'string' || !(IMAGE_MEDIA_TYPES as readonly string[]).includes(mediaType)) {
          return fail('Unsupported image format')
        }
        if (typeof data !== 'string' || !data) return fail('Invalid image')
        if (data.length > MAX_IMAGE_BASE64_CHARS) return fail('Image too large')
        imagesInMessage++
        if (imagesInMessage > MAX_IMAGES_PER_MESSAGE) return fail('Too many images in message')
        blocks.push({ type: 'image', source: { type: 'base64', media_type: mediaType as ImageMediaType, data } })
      } else {
        return fail('Invalid content block')
      }
    }
    if (textChars > MAX_TEXT_CHARS_PER_MESSAGE) return fail('Message too long')
    totalImages += imagesInMessage
    if (totalImages > MAX_IMAGES_TOTAL) return fail('Too many images')
    if (blocks.length > 0) out.push({ role, content: blocks })
  }

  // The model answers the last turn, so it has to be the maker's.
  if (out.length === 0 || out[out.length - 1].role !== 'user') return fail('Invalid messages')
  // The conversation has to open with the maker too — dropping an empty turn
  // above can leave an assistant turn first.
  while (out.length > 0 && out[0].role !== 'user') out.shift()
  return { ok: true, messages: out }
}
