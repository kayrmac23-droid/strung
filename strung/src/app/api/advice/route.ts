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

  const limit = rateLimit(`advice:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) return tooManyRequests(limit.retryAfter)

  const body = await parseBody(req)
  if (!body) return new Response('Invalid request body', { status: 400 })
  const { question, context } = body
  if (typeof question !== 'string' || !question.trim()) return new Response('No question', { status: 400 })
  if (question.length > 2000) return new Response('Question too long', { status: 400 })
  if (context !== undefined && context !== null && typeof context !== 'string') {
    return new Response('Invalid context', { status: 400 })
  }
  if (typeof context === 'string' && context.length > 2000) return new Response('Context too long', { status: 400 })
  const safeContext = typeof context === 'string' && context.trim()
    ? context.replace(/[\r\n]/g, ' ').slice(0, 300)
    : null

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
${safeContext ? `\nContext: ${safeContext}` : ''}
Be specific, practical, and honest. Warn about common beginner mistakes. Explain why, not just what.`

  // Effort is explicit for the same reason as on the JSON routes (see
  // withEffort): left out, this model thinks at its default effort, and that
  // thinking is billed as output and spent from max_tokens before any answer
  // text streams — at the old 1000-token cap a hard question could come back
  // cut short or empty. A how-to answer does not need deep reasoning.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 2000,
    ...withEffort('low'),
    system,
    messages: [{ role: 'user', content: question }],
  })
  return streamTextResponse(stream, 'Advice')
}
