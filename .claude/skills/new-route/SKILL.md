---
name: new-route
description: Scaffold a new Next.js API route for the strung project. Use when the user wants to add a new API endpoint. Args: /new-route <name> <type> where type is "json" or "streaming".
---

# New API Route — strung

Scaffold a new API route following the exact conventions of this project.

## Step 1 — Gather requirements

Parse the skill args. If the user wrote `/new-route advice streaming`, name=`advice` and type=`streaming`. If args are missing or ambiguous, ask:
- Route name (becomes `src/app/api/<name>/route.ts`)
- Response type: **json** (structured data) or **streaming** (SSE-style text for chat/advisor UI)
- What it does in one sentence (used to write the Claude prompt)

## Step 2 — Check for conflicts

Check whether `strung/src/app/api/<name>/route.ts` already exists. If it does, stop and tell the user.

## Step 3 — Write the file

Every template below follows the rules in `CLAUDE.md` (Auth, AI Response Patterns, Shared Route Helpers). Do not drop any of these: the auth check, the rate limit, `parseBody`, `MODEL`, `withEffort`, `logUsage` / `streamTextResponse`, and `firstTextBlock` + `parseJsonLoose` (never `content[0]`, never a hand-inlined fence strip or stream loop).

Pick `RATE_LIMIT` per minute to match the route's cost: 10 for the image route, 15–30 for Claude routes, 120 for plain database CRUD. Pick effort `low` for extraction / short answers, `medium` for design generation or vision.

### JSON route template

```ts
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { parseJsonLoose } from '@/lib/colour'
import { rateLimit, tooManyRequests } from '@/lib/rateLimit'
import { MODEL, firstTextBlock, parseBody, truncStr, withEffort, logUsage } from '@/lib/apiRequest'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = rateLimit(`<name>:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) return tooManyRequests(limit.retryAfter)

  const body = await parseBody(req)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  // TODO: validate each field by type and length; answer 400 naming the field.
  // Clamp anything interpolated into the prompt with truncStr().

  const prompt = `TODO: prompt. Return ONLY valid JSON, no markdown, no backticks:
{"TODO":"shape"}`

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      ...withEffort('low'),
      messages: [{ role: 'user', content: prompt }],
    })
    logUsage('<name>', response)
    if (response.stop_reason === 'max_tokens') {
      return NextResponse.json({ error: 'The response was cut short — try again' }, { status: 502 })
    }
    let parsed: unknown
    try {
      parsed = parseJsonLoose(firstTextBlock(response))
    } catch {
      return NextResponse.json({ error: 'Could not read the AI response — try again' }, { status: 502 })
    }
    // TODO: shape-check `parsed` before returning it; 502 if it is the wrong shape.
    return NextResponse.json(parsed)
  } catch (e: unknown) {
    console.error('<name> error:', e)
    return NextResponse.json({ error: 'Request failed' }, { status: 500 })
  }
}
```

### Streaming route template

```ts
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rateLimit'
import { MODEL, parseBody, streamTextResponse, withEffort } from '@/lib/apiRequest'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const limit = rateLimit(`<name>:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) return tooManyRequests(limit.retryAfter)

  const body = await parseBody(req)
  if (!body) return new Response('Invalid request body', { status: 400 })
  // TODO: validate each field by type and length; answer 400 naming the field.

  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2000,
    ...withEffort('low'),
    system: 'TODO: system prompt',
    messages: [{ role: 'user', content: 'TODO' }],
  })
  // Awaits the first event (upstream failure → 502), pipes text deltas, appends
  // STREAM_ERROR_MARKER on max_tokens, and logs usage.
  return streamTextResponse(stream, '<name>')
}
```

If the route reads or writes user data, add `getAuthenticatedClient(token)` from `@/lib/auth` and filter every query by `user_id` (see CLAUDE.md → Supabase Access). Never use the singleton client from `@/lib/supabase` in a route.

## Step 4 — Fill in the TODO comments

Replace both TODO comments with real logic based on what the user said the route does. Don't leave placeholder comments in the final file.

## Step 5 — Report

Tell the user:
- The file path created
- The response type, effort level and rate limit chosen
- What they need to wire up on the client side: send `getAuthHeaders()` from `@/lib/authClient`; read JSON with `res.json()`, or a stream with `readTextStream()` from `@/lib/streamText` (never a hand-rolled `decoder.decode(value)` without `{ stream: true }`)
- That the route must be added to the API Routes tables in `CLAUDE.md` and `README.md`
