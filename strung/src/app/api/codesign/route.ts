import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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
  const {
    messages,
    beads = [],
    findings = [],
  }: {
    messages: ChatMessage[]
    beads: StashBead[]
    findings: StashFinding[]
  } = await req.json()

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
    return new Response('Invalid messages', { status: 400 })
  }
  for (const m of messages) {
    if (!['user', 'assistant'].includes(m.role as string)) {
      return new Response('Invalid message role', { status: 400 })
    }
    const textOnly = typeof m.content === 'string'
      ? m.content
      : (m.content as Array<{ type: string; text?: string }>)
          .filter(b => b.type === 'text')
          .map(b => b.text ?? '')
          .join('')
    if (textOnly.length > 10000) return new Response('Message too long', { status: 400 })
  }
  if (!Array.isArray(beads) || !Array.isArray(findings)) {
    return new Response('Invalid stash data', { status: 400 })
  }
  if (beads.length > 200 || findings.length > 200) {
    return new Response('Stash too large', { status: 400 })
  }
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

When you have enough detail to create a design (usually after 3–4 exchanges), embed a blueprint using this exact format with no markdown fences:

<blueprint>
{"title":"name","tagline":"one evocative sentence","type":"earrings/necklace/bracelet/etc","difficulty":"Beginner/Intermediate/Advanced","time":"e.g. 2–3 hours","overview":"2–3 sentence concept","components":[{"part":"component name","material":"specific material","dimensions":"approx size","note":"construction note"}],"steps":["step 1","step 2","step 3","step 4","step 5"],"techniques":["technique1","technique2"],"tools":["tool1","tool2"],"variations":["variation1","variation2"],"tips":["tip1","tip2"]}
</blueprint>

Keep your conversational text concise and engaging. After generating a blueprint keep chatting — update it whenever the design changes by emitting a new <blueprint> block. The blueprint should get more detailed as the conversation progresses.`

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system,
    messages,
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
