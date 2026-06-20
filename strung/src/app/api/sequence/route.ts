import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { stripJsonFences } from '@/lib/colour'
import type { BeadItem } from '@/lib/supabase'

const client = new Anthropic()

const VALID_HARMONY_TYPES = [
  'Complementary', 'Analogous', 'Triadic', 'Monochromatic',
  'Split-Complementary', 'Earth & Neutrals', 'Jewel Tones', 'Pastel Dream',
]

const VALID_PIECE_TYPES = ['Necklace', 'Bracelet', 'Earrings', 'Anklet', 'Any']

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const raw = body as Record<string, unknown>

  const harmonyType = VALID_HARMONY_TYPES.includes(String(raw.harmonyType ?? ''))
    ? String(raw.harmonyType)
    : 'AI Picks'

  const anchorFamily = typeof raw.anchorFamily === 'string' && raw.anchorFamily.length < 60
    ? raw.anchorFamily.replace(/[^a-zA-Z &]/g, '').trim()
    : ''

  const pieceType = VALID_PIECE_TYPES.includes(String(raw.pieceType ?? ''))
    ? String(raw.pieceType)
    : 'Any'

  const beads = Array.isArray(raw.beads) ? (raw.beads as BeadItem[]).slice(0, 100) : []

  const stashSummary = beads.length > 0
    ? `USER'S BEAD STASH:\n${beads.map(b =>
        `- ${b.name}: ${b.colour}${b.hex ? ` (${b.hex})` : ''}, ${b.size ?? ''}, ${b.shape ?? ''}, qty: ${b.quantity}`
      ).join('\n')}\nIf any stash beads closely match the palette colours, include them in stashMatches.`
    : 'No stash provided — stashMatches should be an empty array [].'

  const prompt = `You are an expert beaded jewellery colour consultant with deep knowledge of colour theory and bead sequencing.

Generate a beautiful, harmonious colour palette and repeating bead sequence for jewellery making.

Inputs:
- Colour harmony type: ${harmonyType === 'AI Picks' ? 'Choose the most beautiful and inspiring harmony' : harmonyType}
- Anchor colour family: ${anchorFamily && anchorFamily !== 'Surprise Me' ? anchorFamily : 'Surprise the maker — choose something unexpected and beautiful'}
- Piece type: ${pieceType}

${stashSummary}

Create a 3–5 colour palette and a repeating bead sequence pattern the maker can follow rhythmically.

Return ONLY valid JSON, no markdown, no backticks:
{
  "title": "Evocative 3-4 word name e.g. 'Dusk Triadic Flow'",
  "colourStory": "2-3 sentences: the mood, feel, and where you would wear this piece",
  "harmonyType": "The harmony type name used",
  "palette": [
    {
      "role": "Anchor | Accent | Highlight | Transition | Neutral",
      "name": "Colour name (evocative, jewellery-appropriate)",
      "hex": "#rrggbb",
      "beadSuggestion": "Specific bead type and size e.g. Czech glass round 6mm",
      "note": "Brief note on this colour's role"
    }
  ],
  "sequence": [
    {
      "label": "A",
      "colourName": "Must exactly match a name in palette",
      "hex": "#rrggbb",
      "count": 3,
      "beadType": "e.g. Round 6mm"
    }
  ],
  "sequencePattern": "The one-repeat pattern unit e.g. 'A-A-B-C-B-A-A' showing full rhythm",
  "repeats": 10,
  "totalBeadsPerRepeat": 7,
  "stashMatches": [
    {
      "beadName": "Name from stash",
      "colour": "Colour from stash",
      "hex": "#rrggbb or empty string",
      "role": "Anchor | Accent | Highlight | Transition | Neutral",
      "note": "How to use this bead in the sequence"
    }
  ],
  "tip": "1-2 sentences of colour theory insight: WHY this combination works harmonically",
  "metalRecommendation": {
    "name": "One of: Sterling Silver | Gold Filled | Rose Gold Filled | Oxidised Silver | Antique Brass | Copper | Gunmetal",
    "hex": "#rrggbb",
    "reason": "Why this metal tone complements the palette"
  }
}

Rules:
- palette must have exactly 3–5 colours with distinct roles
- sequence labels must be single capital letters matching palette entries (A, B, C, D, E)
- sequencePattern must only use labels present in the sequence array
- all hex values must be valid 6-digit hex codes starting with #
- stashMatches is empty array [] if no stash or no close colour matches
- the pattern should feel rhythmic and balanced — think of it like a musical motif`

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const json = JSON.parse(stripJsonFences(text))
    return NextResponse.json(json)
  } catch (e: unknown) {
    console.error('Sequence API error:', e)
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}
