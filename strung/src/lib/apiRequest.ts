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
  return req.headers.get('Authorization')?.replace('Bearer ', '').trim() ?? ''
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
 * Request fragment that pins how hard the model thinks: spread it into a
 * `messages.create()` call.
 *
 * Leaving `output_config` out is not "no thinking" on this model — omitting it
 * runs adaptive thinking at the default effort, and those thinking tokens bill
 * as output *and* count against `max_tokens`. On the JSON routes that meant
 * paying for reasoning nobody sees and, with a tight cap, a reply cut off
 * before the JSON finished. Say the level out loud per route instead.
 */
export function withEffort(effort: 'low' | 'medium' | 'high') {
  return { output_config: { effort } } as const
}

/**
 * Log what one model call consumed, as a single greppable line.
 *
 * Nothing recorded token usage, so cost was a guess and a truncated reply
 * could not be told apart from a thinking budget that ate the cap. One JSON
 * line per call is enough to answer both from the runtime logs.
 */
export function logUsage(
  label: string,
  msg: { usage?: unknown; stop_reason?: unknown } | null | undefined,
): void {
  const u = (msg?.usage && typeof msg.usage === 'object' ? msg.usage : {}) as Record<string, unknown>
  const n = (v: unknown) => (typeof v === 'number' ? v : 0)
  console.log(
    'ai-usage',
    JSON.stringify({
      route: label,
      input: n(u.input_tokens),
      output: n(u.output_tokens),
      cacheRead: n(u.cache_read_input_tokens),
      stop: typeof msg?.stop_reason === 'string' ? msg.stop_reason : null,
    }),
  )
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

// Structural, so the SDK's MessageStream (and a test double) both satisfy it.
type StreamEvent = { type: string; delta?: unknown }

/**
 * Turn an Anthropic message stream into a `text/plain` streaming Response.
 *
 * `client.messages.stream()` does not throw when the request fails — a bad API
 * key, an overloaded model or a rejected message list only surfaces on the
 * first read. Both streaming routes used to build the Response straight away,
 * so every upstream failure went out as a 200 whose entire body was the
 * cut-short marker. Pulling the first event before answering moves those
 * failures back onto the status line, where the client already handles them.
 *
 * Cancelling the response (the reader navigated away) is passed upstream so
 * the model stops generating tokens nobody will read.
 */
export async function streamTextResponse(
  events: AsyncIterable<StreamEvent>,
  label: string,
): Promise<Response> {
  const iterator = events[Symbol.asyncIterator]()
  let first: IteratorResult<StreamEvent>
  try {
    first = await iterator.next()
  } catch (e) {
    console.error(`${label} stream init error:`, e)
    return new Response('AI service error. Please try again.', { status: 502 })
  }

  const encoder = new TextEncoder()
  const textOf = (event: StreamEvent): string => {
    if (event.type !== 'content_block_delta' || !event.delta || typeof event.delta !== 'object') return ''
    const delta = event.delta as { type?: unknown; text?: unknown }
    return delta.type === 'text_delta' && typeof delta.text === 'string' ? delta.text : ''
  }

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        let result = first
        while (!result.done) {
          const text = textOf(result.value)
          if (text) controller.enqueue(encoder.encode(text))
          result = await iterator.next()
        }
      } catch (e) {
        // Past the first chunk the status line is already sent, so the only
        // way to tell the reader the answer is incomplete is in-band.
        console.error(`${label} stream chunk error:`, e)
        try {
          controller.enqueue(encoder.encode(STREAM_ERROR_MARKER))
        } catch {
          // Controller already closed or cancelled — nothing useful left to do.
        }
      }
      try {
        controller.close()
      } catch {
        // Already closed by a cancel.
      }
    },
    async cancel() {
      await iterator.return?.()
    },
  })

  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
