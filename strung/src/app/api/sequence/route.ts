import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { parseJsonLoose } from '@/lib/colour'
import { rateLimit, tooManyRequests, clientIp } from '@/lib/rateLimit'
import { MODEL, firstTextBlock, truncStr } from '@/lib/apiRequest'

// Without an explicit key the SDK falls back to its own env lookup, which is
// easy to break by renaming the variable and gives a confusing runtime error
// rather than a clear one. Every other route passes it explicitly; this is the
// last one that did not.
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// This is the only public AI route (Palette works signed out), so it is the
// most exposed to abuse. Limit by client IP since there is no user id.
const RATE_LIMIT = 15
const RATE_WINDOW_MS = 60_000

const VALID_HARMONY_TYPES = [
  'Complementary', 'Analogous', 'Triadic', 'Monochromatic',
  'Split-Complementary', 'Earth & Neutrals', 'Jewel Tones', 'Pastel Dream',
]

const VALID_PIECE_TYPES = ['Necklace', 'Bracelet', 'Earrings', 'Anklet', 'Any']

// Per-field caps for the client-supplied stash. Generous against real bead
// names, restrictive against anything pathological.
const MAX_BEADS = 100
const MAX_NAME_CHARS = 100
const MAX_COLOUR_CHARS = 60
const MAX_ATTR_CHARS = 30
const MAX_QUANTITY = 9999
const MAX_STASH_BLOCK_CHARS = 8000
const HEX_RE = /^#[0-9a-fA-F]{6}$/

export async function POST(request: Request) {
  const limit = rateLimit(`sequence:${clientIp(request)}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) return tooManyRequests(limit.retryAfter)

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

  // This route is public, and every one of these fields is interpolated into a
  // prompt that Anthropic bills us for. The 100-bead cap alone bounded the row
  // count but not the row size, so a single request carrying 100 beads with
  // megabyte-long names was an unauthenticated lever on our own bill. Clamp
  // every field, then clamp the assembled block as a backstop.
  const rawBeads = Array.isArray(raw.beads) ? raw.beads.slice(0, MAX_BEADS) : []
  const beadLines = rawBeads
    .map((entry) => {
      const b = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>
      const name = truncStr(b.name, MAX_NAME_CHARS).trim()
      if (!name) return ''
      const colour = truncStr(b.colour, MAX_COLOUR_CHARS).trim()
      // Only a well-formed 6-digit hex is passed through; anything else is
      // dropped rather than truncated, so a partial hex never reaches the model.
      const hex = HEX_RE.test(truncStr(b.hex, 7).trim()) ? truncStr(b.hex, 7).trim() : ''
      const size = truncStr(b.size, MAX_ATTR_CHARS).trim()
      const shape = truncStr(b.shape, MAX_ATTR_CHARS).trim()
      const qty = Number.isFinite(Number(b.quantity))
        ? Math.min(MAX_QUANTITY, Math.max(0, Math.floor(Number(b.quantity))))
        : 0
      return `- ${name}: ${colour}${hex ? ` (${hex})` : ''}, ${size}, ${shape}, qty: ${qty}`
    })
    .filter(Boolean)

  const stashSummary = beadLines.length > 0
    ? `USER'S BEAD STASH:\n${beadLines.join('\n').slice(0, MAX_STASH_BLOCK_CHARS)}\nIf any stash beads closely match the palette colours, include them in stashMatches.`
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
      model: MODEL,
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    })
    if (msg.stop_reason === 'max_tokens') {
      console.error('sequence error: response truncated at max_tokens')
      return NextResponse.json({ error: 'Palette too long — try again' }, { status: 502 })
    }
    const text = firstTextBlock(msg)
    const json = parseJsonLoose(text)
    return NextResponse.json(json)
  } catch (e: unknown) {
    console.error('Sequence API error:', e)
    return NextResponse.json({ error: 'Generation failed. Please try again.' }, { status: 500 })
  }
}
