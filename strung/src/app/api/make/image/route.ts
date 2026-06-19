import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

Then append exactly this sentence: "Macro product photography, flat lay on dark weathered slate, soft studio rim lighting, shallow depth of field, colour-accurate, photorealistic, no hands, no text, no watermarks."

Output ONLY the prompt text, nothing else.`,
      },
    ],
  })

  return res.content[0].type === 'text' ? res.content[0].text.trim() : ''
}

export async function POST(req: NextRequest) {
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

    const data = await res.json() as { data: { url: string }[] }
    return NextResponse.json({ imageUrl: data.data[0].url })
  } catch (e: unknown) {
    console.error('image route error:', e)
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
  }
}
