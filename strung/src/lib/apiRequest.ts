// Shared plumbing for the API routes.
//
// Every route was re-implementing the same handful of things — naming the
// model, pulling the bearer token, parsing a JSON body defensively, reading
// text out of an Anthropic response, and clamping a free-text field before it
// goes into a paid prompt. Duplicate copies meant several places to fix a bug,
// so they live here instead.

/**
 * The Claude model every AI route calls.
 *
 * This id was inlined at eight call sites across seven routes, so a model
 * change meant eight edits and any one of them could be missed — leaving some
 * routes on the old model with nothing to flag the mismatch. The routes have no
 * reason to disagree about which model they use, so the id lives here and they
 * import it.
 */
export const MODEL = 'claude-sonnet-5-5'

/**
 * Bearer token from the Authorization header, or '' when absent.
 *
 * Returning '' rather than throwing is deliberate: callers pair this with
 * `getUserFromRequest`, which has already rejected the unauthenticated case by
 * the time this runs, so an empty string here means "no header" and the
 * resulting Supabase client simply has no rights.
 */
export function getToken(req: Request): string {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
}

/**
 * Parse a JSON request body.
 *
 * Returns `null` when the body is not valid JSON (the caller should answer
 * 400), and `{}` when it parses to something that is not a plain object — a
 * bare `5`, `"text"`, `null`, or an array. Collapsing those to `{}` lets every
 * caller treat the result as a record and fall through to its own per-field
 * validation rather than special-casing each non-object shape.
 */
export async function parseBody(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json()
    return body && typeof body === 'object' && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {}
  } catch {
    return null
  }
}

/**
 * First text block of an Anthropic response, or '' when there is none.
 *
 * Every route used to read `content[0]` and assume it was text. That holds
 * today, but it is an assumption about response shape rather than a guarantee:
 * a leading non-text block (thinking, tool_use) silently yields '' and the
 * route reports a parse failure for a response that actually contained the
 * JSON. Scanning for the first text block removes the assumption.
 */
export function firstTextBlock(msg: { content?: unknown } | null | undefined): string {
  const blocks = msg?.content
  if (!Array.isArray(blocks)) return ''
  for (const block of blocks) {
    if (block && typeof block === 'object' && (block as { type?: unknown }).type === 'text') {
      const text = (block as { text?: unknown }).text
      if (typeof text === 'string') return text
    }
  }
  return ''
}

/**
 * Clamp a value destined for a prompt to `max` characters.
 *
 * Non-strings become '' rather than being coerced, so a client sending
 * `{ name: { toString: ... } }` or a nested object cannot smuggle arbitrary
 * text past the length cap via stringification.
 */
export function truncStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

/**
 * Appended to a stream that dies partway through.
 *
 * The streaming routes used to swallow a mid-stream error and close the
 * controller, so a truncated answer was indistinguishable from a complete one —
 * the reader just saw the stream end. The status line is already sent by then,
 * so an error status is no longer available; this marker is the only way to
 * tell the reader the text is incomplete.
 */
export const STREAM_ERROR_MARKER = '\n\n[The response was cut short — please try again.]'
