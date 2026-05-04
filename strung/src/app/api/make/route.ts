import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

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

export async function POST(req: NextRequest) {
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

  const stashSummary = [
    beads.length > 0
      ? `BEADS:\n${beads.map((b) => `- ${b.name} (${b.colour}, ${b.size ?? (typeof b.size_mm === 'number' ? `${b.size_mm}mm` : 'size unknown')}, qty: ${b.quantity}${b.shape ? ', ' + b.shape : ''})`).join('\n')}`
      : 'No beads in stash.',
    findings.length > 0
      ? `FINDINGS:\n${findings.map((f) => `- ${f.name} (${f.type}, ${f.metal}, qty: ${f.quantity}${f.size ? ', ' + f.size : ''})`).join('\n')}`
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

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return NextResponse.json(JSON.parse(clean))
  } catch {
    return NextResponse.json({ error: 'Failed to parse design' }, { status: 500 })
  }
}
