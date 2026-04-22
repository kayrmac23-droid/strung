import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { messages, beads, findings } = await req.json()

  const stashLines: string[] = []
  if (beads?.length) {
    stashLines.push(`BEADS:\n${beads.map((b: any) => `- ${b.name} (${b.colour}, ${b.size_mm}mm, qty: ${b.quantity}${b.shape ? ', ' + b.shape : ''})`).join('\n')}`)
  }
  if (findings?.length) {
    stashLines.push(`FINDINGS:\n${findings.map((f: any) => `- ${f.name} (${f.type}, ${f.metal}, qty: ${f.quantity})`).join('\n')}`)
  }
  const stashContext = stashLines.length
    ? `\n\nThe user's stash:\n${stashLines.join('\n\n')}`
    : ''

  const system = `You are an expert beaded jewellery co-designer. Work collaboratively with the maker through natural conversation — ask focused questions (one or two at a time), suggest specific ideas, reference their actual materials when relevant, and refine the design until they're happy. Be warm, creative, and direct. Don't overwhelm with questions.${stashContext}

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

  return new Response(readable, { headers: { 'Content-Type': 'text/plain' } })
}
