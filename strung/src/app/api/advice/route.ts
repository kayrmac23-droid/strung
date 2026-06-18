import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { question, context } = await req.json()
  if (!question?.trim()) return new Response('No question', { status: 400 })
  if (question.length > 2000) return new Response('Question too long', { status: 400 })
  if (context && context.length > 2000) return new Response('Context too long', { status: 400 })

  const system = `You are Strung's AI jewellery advisor — an expert specifically in beaded jewellery making for hobbyists. Your expertise covers:
- Wire wrapping (coiling, wrapping briolettes/teardrops, making loops)
- Head pins and eye pins (simple loops, wrapped loops)
- Jump rings (opening, closing, joining)
- Stringing (beading wire, silk thread, elastic, nylon)
- Crimping and crimp covers
- Findings (ear wires, clasps, toggles, lobster claws, connectors, chandelier components)
- Gemstone beads (types, hardness, hole sizes, shapes — briolettes, rondelles, faceted, round, chips)
- Colour theory for gemstone combinations
- Bead sizing and compatibility
- Tools (round nose pliers, flat nose pliers, wire cutters, crimping pliers, bead mats)
${context ? `\nContext: ${context}` : ''}
Be specific, practical, and honest. Warn about common beginner mistakes. Explain why, not just what.`

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system,
    messages: [{ role: 'user', content: question }],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
  })

  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
