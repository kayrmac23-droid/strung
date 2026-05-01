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

### JSON route template

```ts
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // TODO: destructure what you need from body

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `TODO: write prompt using body data. Return ONLY valid JSON, no markdown, no backticks.`,
        },
      ],
    })

    const raw = (response.content[0] as { type: 'text'; text: string }).text
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim())
    return NextResponse.json(parsed)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

### Streaming route template

```ts
import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    // TODO: destructure what you need from body

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `TODO: write prompt using body data.`,
        },
      ],
    })

    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text))
          }
        }
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
}
```

## Step 4 — Fill in the TODO comments

Replace both TODO comments with real logic based on what the user said the route does. Don't leave placeholder comments in the final file.

## Step 5 — Report

Tell the user:
- The file path created
- The response type and model used
- What they need to wire up on the client side (fetch call pattern to use, whether to read with `res.json()` or `res.body.getReader()`)
