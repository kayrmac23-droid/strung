import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { getUserFromRequest, getAuthenticatedClient } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rateLimit'
import { MODEL, getToken, parseBody, truncStr, streamTextResponse, withEffort } from '@/lib/apiRequest'
import { sanitiseChatMessages } from '@/lib/chatMessages'
import {
  TECHNIQUE_LIST_TEXT,
  TECHNIQUE_GLOSSARY,
  METAL_COHESION_RULE,
  DIFFICULTY_RUBRIC,
  REPEAT_STEP_RULE,
  ASSEMBLY_RULES,
  ASSEMBLY_SCHEMA_COMPACT,
  STYLE_MENU,
  STYLE_OVERRIDE_RULE,
} from '@/lib/designVocab'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 60_000

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

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return new Response('Unauthorized', { status: 401 })

  const limit = rateLimit(`codesign:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) return tooManyRequests(limit.retryAfter)

  const body = await parseBody(req)
  if (!body) return new Response('Invalid request body', { status: 400 })
  const checked = sanitiseChatMessages(body.messages)
  if (!checked.ok) return new Response(checked.error, { status: 400 })
  const messages = checked.messages

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
  const safeBeads = beads.map(b => ({ ...b, name: truncStr(b.name, 200), colour: truncStr(b.colour, 100), size: truncStr(b.size, 50), shape: truncStr(b.shape, 50) }))
  const safeFindings = findings.map(f => ({ ...f, name: truncStr(f.name, 200), type: truncStr(f.type, 50), metal: truncStr(f.metal, 50) }))

  const stashLines: string[] = []
  if (safeBeads?.length) {
    stashLines.push(`BEADS:\n${safeBeads.map((b) => `- ${b.name} (${b.colour}, ${b.size || (typeof b.size_mm === 'number' ? `${b.size_mm}mm` : 'size unknown')}, qty: ${b.quantity}${b.shape ? ', ' + b.shape : ''})`).join('\n')}`)
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
{"title":"short evocative name","description":"one sentence — what it is and the feeling it has","colourStory":"why these specific materials work together visually — be specific about the beads","difficulty":"Beginner|Intermediate|Advanced","estimatedTime":"e.g. 35 mins","pieceType":"earrings|necklace|bracelet|pendant|ring|anklet","materialsCheck":{"allAvailable":true,"notes":"any quantity concerns or substitution suggestions"},"components":[{"item":"exact material name","quantity":1,"note":"how it's used"}],${ASSEMBLY_SCHEMA_COMPACT},"steps":[{"id":1,"instruction":"clear, specific instruction — one action per step, or one repeating unit with an explicit repeat count","material":"exact material name used in this step, or null","technique":"one of the allowed technique tags, or null","tip":"a practical tip for this step, or null"}]}
</blueprint>

Each step's "technique" must be null or from this exact list only: ${TECHNIQUE_LIST_TEXT}.

${TECHNIQUE_GLOSSARY}

${METAL_COHESION_RULE}

${DIFFICULTY_RUBRIC}

${REPEAT_STEP_RULE}

${ASSEMBLY_RULES}

Settle on ONE style early and hold it for the whole design rather than blending aesthetics — a piece should read as one of these:
${STYLE_MENU}
${STYLE_OVERRIDE_RULE}

Keep your conversational text concise and engaging. After generating a blueprint keep chatting — update it whenever the design changes by emitting a new <blueprint> block. The blueprint should get more detailed as the conversation progresses.`

  // A blueprint is the same design JSON /api/make asks for (which allows 4500
  // tokens at medium effort) plus the conversational reply around it. At 3000
  // with no explicit effort — so the model's default thinking also drew on the
  // cap — a full blueprint could be cut off mid-JSON and silently dropped.
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: 6000,
    ...withEffort('medium'),
    system,
    messages,
  })
  return streamTextResponse(stream, 'Codesign')
}
