import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { getUserFromRequest, getAuthenticatedClient } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rateLimit'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000

function getToken(req: NextRequest) {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
}

const MAX_IMAGES_PER_MESSAGE = 2
const MAX_IMAGES_TOTAL = 6
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024

type StashBead = {
  name: string
  colour: string
  size?: string
  size_mm?: number
  quantity: number
  shape?: string
}

type StashFinding = {
  name: string
  type: string
  metal: string
  quantity: number
}

type ChatMessage = Anthropic.MessageParam

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const limit = rateLimit(`codesign:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) return tooManyRequests(limit.retryAfter)

  let messages: ChatMessage[]
  try {
    ;({ messages } = await req.json())
  } catch {
    return new Response('Invalid request body', { status: 400 })
  }

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
    return new Response('Invalid messages', { status: 400 })
  }
  let totalImages = 0
  for (const m of messages) {
    if (!['user', 'assistant'].includes(m.role as string)) {
      return new Response('Invalid message role', { status: 400 })
    }
    let textOnly = ''
    if (typeof m.content === 'string') {
      textOnly = m.content
    } else {
      const blocks = m.content as Array<{ type: string; text?: string; source?: { type?: string; data?: string } }>
      let imagesInMessage = 0
      for (const b of blocks) {
        if (b.type !== 'text' && b.type !== 'image') {
          return new Response('Invalid content block', { status: 400 })
        }
        if (b.type === 'text') {
          textOnly += b.text ?? ''
        } else {
          imagesInMessage++
          if (imagesInMessage > MAX_IMAGES_PER_MESSAGE) {
            return new Response('Too many images in message', { status: 400 })
          }
          const data = b.source?.type === 'base64' ? b.source.data ?? '' : ''
          if (data.length > MAX_IMAGE_BYTES) {
            return new Response('Image too large', { status: 400 })
          }
        }
      }
      totalImages += imagesInMessage
      if (totalImages > MAX_IMAGES_TOTAL) {
        return new Response('Too many images', { status: 400 })
      }
    }
    if (textOnly.length > 10000) return new Response('Message too long', { status: 400 })
  }
  // Read the stash server-side rather than trusting a client-supplied copy.
  const supabase = getAuthenticatedClient(getToken(req))
  const [beadsRes, findingsRes] = await Promise.all([
    supabase.from('beads').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('findings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])
  if (beadsRes.error || findingsRes.error) {
    console.error('codesign stash load error:', beadsRes.error || findingsRes.error)
    return new Response('Could not load your stash', { status: 500 })
  }
  const beads = (beadsRes.data || []).slice(0, 200) as StashBead[]
  const findings = (findingsRes.data || []).slice(0, 200) as StashFinding[]
  const trunc = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0, max) : ''
  const safeBeads = beads.map(b => ({ ...b, name: trunc(b.name, 200), colour: trunc(b.colour, 100), size: trunc(b.size, 50), shape: trunc(b.shape, 50) }))
  const safeFindings = findings.map(f => ({ ...f, name: trunc(f.name, 200), type: trunc(f.type, 50), metal: trunc(f.metal, 50) }))

  const stashLines: string[] = []
  if (safeBeads?.length) {
    stashLines.push(`BEADS:\n${safeBeads.map((b) => `- ${b.name} (${b.colour}, ${b.size ?? (typeof b.size_mm === 'number' ? `${b.size_mm}mm` : 'size unknown')}, qty: ${b.quantity}${b.shape ? ', ' + b.shape : ''})`).join('\n')}`)
  }
  if (safeFindings?.length) {
    stashLines.push(`FINDINGS:\n${safeFindings.map((f) => `- ${f.name} (${f.type}, ${f.metal}, qty: ${f.quantity})`).join('\n')}`)
  }
  const stashContext = stashLines.length
    ? `\n\nThe user's stash:\n${stashLines.join('\n\n')}`
    : ''

  const system = `You are an expert beaded jewellery co-designer. Work collaboratively with the maker through natural conversation — ask focused questions (one or two at a time), suggest specific ideas, reference their actual materials when relevant, and refine the design until they're happy. Be warm, creative, and direct. Don't overwhelm with questions.

Assume basic findings are available even if not listed (jump rings, ear wires, head pins, clasps, standard wire, crimps). If the stash includes findings of type "statement_component", treat those as primary focal structures (like earring frames or chandelier bases) and design around them first.${stashContext}

When you have enough detail to create a design (usually after 3–4 exchanges), embed a blueprint using this exact JSON format with no markdown fences:

<blueprint>
{"title":"short evocative name","description":"one sentence — what it is and the feeling it has","colourStory":"why these specific materials work together visually — be specific about the beads","difficulty":"Beginner|Intermediate|Advanced","estimatedTime":"e.g. 35 mins","pieceType":"earrings|necklace|bracelet|pendant|ring|anklet","materialsCheck":{"allAvailable":true,"notes":"any quantity concerns or substitution suggestions"},"components":[{"item":"exact material name","quantity":1,"note":"how it's used"}],"steps":[{"id":1,"instruction":"clear, specific instruction — one action per step","material":"exact material name used in this step, or null","technique":"one of the allowed technique tags, or null","tip":"a practical tip for this step, or null"}]}
</blueprint>

Each step's "technique" must be null or from this exact list only: "Wrapped Loop", "Simple Loop", "Crimping", "Wire Coiling", "Wire Wrapping", "Jump Ring", "Briolette Wrap", "Stringing", "Knotting".

Keep your conversational text concise and engaging. After generating a blueprint keep chatting — update it whenever the design changes by emitting a new <blueprint> block. The blueprint should get more detailed as the conversation progresses.`

  let stream: Awaited<ReturnType<typeof client.messages.stream>>
  try {
    stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      system,
      messages,
    })
  } catch (e) {
    console.error('Codesign stream init error:', e)
    return new Response('AI service error. Please try again.', { status: 500 })
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } catch (e) {
        console.error('Codesign stream chunk error:', e)
      }
      controller.close()
    },
  })

  return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
