import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { beads, findings, mood, pieceType, notes } = await req.json()

  const stashSummary = [
    beads.length > 0 ? `BEADS:\n${beads.map((b: any) => `- ${b.name} (${b.colour}, ${b.size || b.size_mm+'mm'}, qty: ${b.quantity}${b.shape ? ', '+b.shape : ''})`).join('\n')}` : 'No beads logged.',
    findings.length > 0 ? `FINDINGS:\n${findings.map((f: any) => `- ${f.name} (${f.type}, ${f.metal}, qty: ${f.quantity})`).join('\n')}` : 'No findings logged.',
  ].join('\n\n')

  const prompt = `You are an expert beaded jewellery designer helping a hobbyist maker. Based ONLY on the materials they have in their stash, generate 3 distinct design blueprints.

THEIR STASH:
${stashSummary}

THEIR REQUEST:
- Mood/vibe: ${mood || 'open'}
- Piece type preference: ${pieceType || 'any'}
- Additional notes: ${notes || 'none'}

IMPORTANT: Only use materials they actually have. If they have no findings for a certain technique, don't suggest it. If quantity is 1, only use it once.

Return ONLY valid JSON, no markdown, no backticks:
{
  "blueprints": [
    {
      "title": "Blueprint name",
      "type": "earrings/necklace/bracelet/etc",
      "difficulty": "Beginner/Intermediate/Advanced",
      "time": "estimated time e.g. 45 mins",
      "vibe": "2-3 word mood descriptor",
      "description": "2 sentence concept description",
      "colourStory": "Describe the colour palette and why it works",
      "layout": [
        {"step": 1, "component": "component name", "material": "specific bead/finding from stash", "technique": "what to do", "note": "optional tip"}
      ],
      "findingsNeeded": ["specific finding from their stash"],
      "techniques": ["technique1", "technique2"],
      "warnings": "One key thing to watch out for or null"
    }
  ]
}

Make each blueprint genuinely distinct — different piece types, different colour approaches, different complexity levels. Be specific about bead names from their stash.`

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
    return NextResponse.json({ error: 'Failed to parse blueprints' }, { status: 500 })
  }
}
