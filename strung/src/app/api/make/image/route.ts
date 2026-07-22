import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rateLimit'
import { buildFallbackImagePrompt } from '@/lib/imagePrompt'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// DALL-E 3 hd is the priciest upstream call in the app, so cap it tighter.
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000

async function buildPrompt(design: Record<string, unknown>): Promise<string> {
  const summary = {
    title: design.title,
    description: design.description,
    pieceType: design.pieceType,
    colourStory: design.colourStory,
    components: design.components,
    steps: (design.steps as Array<{ instruction: string }>).map(s => s.instruction),
  }

  const res = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [
      {
        role: 'user',
        content: `You are writing a prompt for DALL-E 3 to generate a photorealistic image of a specific finished handmade beaded jewellery piece.

Here is the complete design:
${JSON.stringify(summary, null, 2)}

Write a single dense paragraph (under 850 characters) that describes EXACTLY what this finished piece looks like as if seen in a photo. Be specific about:
- The exact arrangement and structure (how beads are laid out, strung, or connected)
- Each component: precise colours, sizes, shapes, quantities, and their positions
- How elements connect (wrapped loops, jump rings, crimp beads, stringing pattern, etc.)
- The overall silhouette and feel of the finished piece

Then append exactly this sentence: "Macro product photography, flat lay on deep warm mocha-brown velvet, soft warm lamplight, shallow depth of field, colour-accurate, photorealistic, no hands, no text, no watermarks."

Output ONLY the prompt text, nothing else.`,
      },
    ],
  })

  const text = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
  // The prompt-writer is non-critical: if it truncates at max_tokens or comes
  // back empty, fall back to a deterministic prompt so the preview still renders
  // rather than failing the whole request.
  if (res.stop_reason === 'max_tokens' || !text) {
    console.error('make/image: prompt-writer truncated or empty, using fallback prompt')
    return buildFallbackImagePrompt(design)
  }
  return text
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = rateLimit(`make-image:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) return tooManyRequests(limit.retryAfter)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Image generation not configured' }, { status: 501 })
  }

  try {
    const raw = await req.json()
    if (!raw || typeof raw !== 'object') return NextResponse.json({ error: 'Invalid design' }, { status: 400 })
    const design: Record<string, unknown> = {
      title: typeof raw.title === 'string' ? raw.title.slice(0, 200) : '',
      description: typeof raw.description === 'string' ? raw.description.slice(0, 500) : '',
      pieceType: typeof raw.pieceType === 'string' ? raw.pieceType.slice(0, 50) : '',
      colourStory: typeof raw.colourStory === 'string' ? raw.colourStory.slice(0, 500) : '',
      components: Array.isArray(raw.components) ? raw.components.slice(0, 50) : [],
      steps: Array.isArray(raw.steps) ? raw.steps.slice(0, 50) : [],
    }
    if (!design.title) return NextResponse.json({ error: 'Invalid design' }, { status: 400 })
    const prompt = await buildPrompt(design)

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'hd',
      }),
    })

    if (!res.ok) {
      console.error('DALL-E error:', await res.json().catch(() => ({})))
      return NextResponse.json({ error: 'Image generation failed' }, { status: res.status })
    }

    const data = await res.json() as { data?: { url?: string }[] }
    const imageUrl = data.data?.[0]?.url
    if (!imageUrl) {
      console.error('DALL-E returned no image url:', JSON.stringify(data).slice(0, 300))
      return NextResponse.json({ error: 'Image generation failed' }, { status: 502 })
    }
    return NextResponse.json({ imageUrl })
  } catch (e: unknown) {
    console.error('image route error:', e)
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
  }
}
