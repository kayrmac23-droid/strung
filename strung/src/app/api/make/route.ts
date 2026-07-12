import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

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
  size?: string
}

type TimeAvailable = '15min' | '1hour' | 'afternoon'

const VALID_PIECE_TYPES = ['earrings', 'necklace', 'bracelet', 'pendant', 'ring', 'anklet', 'any']
const VALID_TIME: TimeAvailable[] = ['15min', '1hour', 'afternoon']

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    beads = [],
    findings = [],
    pieceType,
    mood,
    timeAvailable,
  }: {
    beads: StashBead[]
    findings: StashFinding[]
    pieceType?: string
    mood?: string
    timeAvailable?: TimeAvailable
  } = await req.json()

  if (!Array.isArray(beads) || !Array.isArray(findings)) {
    return NextResponse.json({ error: 'Invalid stash data' }, { status: 400 })
  }
  if (beads.length > 200 || findings.length > 200) {
    return NextResponse.json({ error: 'Stash too large' }, { status: 400 })
  }
  const truncStr = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0, max) : ''
  const safeBeads = beads.map(b => ({ ...b, name: truncStr(b.name, 200), colour: truncStr(b.colour, 100), size: truncStr(b.size, 50), shape: truncStr(b.shape, 50) }))
  const safeFindings = findings.map(f => ({ ...f, name: truncStr(f.name, 200), type: truncStr(f.type, 50), metal: truncStr(f.metal, 50), size: truncStr(f.size, 50) }))
  if (pieceType && (!VALID_PIECE_TYPES.includes(pieceType) || pieceType.length > 50)) {
    return NextResponse.json({ error: 'Invalid piece type' }, { status: 400 })
  }
  if (mood && mood.length > 200) {
    return NextResponse.json({ error: 'Mood too long' }, { status: 400 })
  }
  if (timeAvailable && !VALID_TIME.includes(timeAvailable)) {
    return NextResponse.json({ error: 'Invalid time' }, { status: 400 })
  }

  const stashSummary = [
    safeBeads.length > 0
      ? `BEADS:\n${safeBeads.map((b) => `- ${b.name} (${b.colour}, ${b.size ?? (typeof b.size_mm === 'number' ? `${b.size_mm}mm` : 'size unknown')}, qty: ${b.quantity}${b.shape ? ', ' + b.shape : ''})`).join('\n')}`
      : 'No beads in stash.',
    safeFindings.length > 0
      ? `FINDINGS:\n${safeFindings.map((f) => `- ${f.name} (${f.type}, ${f.metal}, qty: ${f.quantity}${f.size ? ', ' + f.size : ''})`).join('\n')}`
      : 'No findings in stash.',
  ].join('\n\n')

  const timeMap: Record<TimeAvailable, string> = {
    '15min': '15 minutes — extremely simple, 3-5 steps maximum',
    '1hour': 'about 1 hour — moderate complexity, up to 10 steps',
    'afternoon': 'a few hours — can be complex, multiple techniques fine',
  }
  const selectedTime = timeAvailable ? timeMap[timeAvailable] : '1 hour'

  const prompt = `You are an expert beaded jewellery designer. Generate ONE complete, specific design for a hobbyist maker to build right now using ONLY the materials in their stash.

THEIR STASH:
${stashSummary}

THEIR REQUEST:
- Piece type: ${pieceType || 'any — choose the best fit for the stash'}
- Mood/vibe: ${mood || 'open'}
- Time available: ${selectedTime}

CRITICAL RULES:
- Only use materials they actually have. Check quantities — if they have qty:2 of something, use at most 2.
- Assume basic findings are available by default (e.g. jump rings, ear wires, head pins, clasps, standard wire, and crimps) even if not listed.
- Treat stash findings marked as "statement_component" as the featured structural pieces (e.g. earring frames, chandeliers, focal connectors) and prioritise using them when present.
- If stash is empty or very sparse, design a simple piece and note what basic materials they'd need.
- The steps must be genuinely sequential and buildable — someone should be able to follow them with their hands.
- Technique tags must be from this exact list only: "Wrapped Loop", "Simple Loop", "Crimping", "Wire Coiling", "Wire Wrapping", "Jump Ring", "Briolette Wrap", "Stringing", "Knotting"

Return ONLY valid JSON, no markdown, no backticks:
{
  "title": "Short evocative name",
  "description": "One sentence — what it is and the feeling it has",
  "colourStory": "Why these specific materials work together visually — be specific about the beads",
  "difficulty": "Beginner|Intermediate|Advanced",
  "estimatedTime": "e.g. 35 mins",
  "pieceType": "earrings|necklace|bracelet|pendant|ring|anklet",
  "materialsCheck": {
    "allAvailable": true,
    "notes": "Any quantity concerns or substitution suggestions"
  },
  "components": [
    { "item": "exact name from stash", "quantity": 1, "note": "how it's used" }
  ],
  "steps": [
    {
      "id": 1,
      "instruction": "Clear, specific instruction — one action per step",
      "material": "Exact material name being used in this step, or null",
      "technique": "One of the allowed technique tags, or null",
      "tip": "A practical tip for this specific step, or null"
    }
  ]
}`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    try {
      return NextResponse.json(JSON.parse(clean))
    } catch {
      const first = clean.indexOf('{')
      const last = clean.lastIndexOf('}')
      if (first === -1 || last === -1 || last <= first) throw new Error('No JSON object found in response')
      return NextResponse.json(JSON.parse(clean.slice(first, last + 1)))
    }
  } catch (e: unknown) {
    console.error('make error:', e)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
