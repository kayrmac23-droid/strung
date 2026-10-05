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

// ── Client side: what the Co-Design page sends ─────────────────────────────
//
// The page resent its whole history on every turn and had no way to start
// over short of a reload. Once a chat passed MAX_MESSAGES turns or
// MAX_IMAGES_TOTAL photos, the route answered 400 — and since the history only
// grows, so did every message after it: the conversation was dead. A handful
// of photos could also push the body past Vercel's 4.5MB request cap, which
// fails before the route runs. The model only needs the recent turns and the
// recent photos, so trim to that before sending.

// Leaves headroom under Vercel's 4.5MB body limit for the text of the chat.
export const MAX_HISTORY_IMAGE_CHARS = 3 * 1024 * 1024

export const PHOTO_PLACEHOLDER = '[A photo was shared here earlier in the chat.]'

type OutgoingBlock = { type: string; text?: string; source?: { data?: unknown } }
export type OutgoingMessage = { role: 'user' | 'assistant'; content: string | OutgoingBlock[] }

export function trimChatHistory<M extends OutgoingMessage>(messages: M[]): OutgoingMessage[] {
  let recent: OutgoingMessage[] = messages.slice(-MAX_MESSAGES)
  // The route drops leading assistant turns anyway; trimming here keeps the
  // count honest.
  while (recent.length > 0 && recent[0].role !== 'user') recent = recent.slice(1)

  // Walk newest to oldest, keeping photos while they fit every limit.
  let images = 0
  let imageChars = 0
  const out: OutgoingMessage[] = []
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i]
    if (typeof m.content === 'string') {
      out.push({ role: m.role, content: m.content })
      continue
    }
    const blocks = m.content.map((b) => {
      if (b.type !== 'image') return b
      const size = typeof b.source?.data === 'string' ? b.source.data.length : 0
      if (images + 1 <= MAX_IMAGES_TOTAL && imageChars + size <= MAX_HISTORY_IMAGE_CHARS) {
        images++
        imageChars += size
        return b
      }
      return { type: 'text', text: PHOTO_PLACEHOLDER }
    })
    out.push({ role: m.role, content: blocks })
  }
  return out.reverse()
}
