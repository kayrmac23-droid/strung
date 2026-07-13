import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

const client = new Anthropic()

const VALID_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type ValidMime = typeof VALID_MIMES[number]

// The client downscales photos to 1568px JPEG before upload (see
// src/lib/imagePrep.ts), so real payloads are ~200–500KB of base64. Vercel
// rejects request bodies over 4.5MB at the platform layer regardless, so this
// cap exists to fail with a clear message rather than an opaque 413.
const MAX_BASE64_CHARS = 4 * 1024 * 1024

const BEAD_PROMPT = `You are an expert jewellery bead identifier. Analyse this image and identify the bead shown.
Return ONLY valid JSON with exactly these fields:
{
  "name": "descriptive name e.g. Labradorite teardrop briolette",
  "type": "one of: gemstone, crystal, glass, seed, metal, pearl, resin, other",
  "colour": "colour description e.g. Steel blue with iridescent flash",
  "hex": "best matching hex code e.g. #7a9ab8",
  "size": "one of: seed, small, medium, large, statement",
  "shape": "one of: round, rondelle, briolette, teardrop, faceted, chip, tube, oval, square, other",
  "notes": "any helpful notes, or empty string"
}
No markdown, no backticks, ONLY the JSON object.`

const FINDING_PROMPT = `You are an expert jewellery findings identifier. Analyse this image and identify the finding shown.
Return ONLY valid JSON with exactly these fields:
{
  "name": "descriptive name e.g. 20mm sterling silver hoop ear wire",
  "type": "one of: ear_wire, head_pin, eye_pin, jump_ring, clasp, chain, wire, crimp, connector, other",
  "metal": "one of: silver, gold_filled, gold, copper, brass, oxidised, other",
  "size": "size or gauge e.g. 21g, 6mm, 0.8mm, or empty string if unclear",
  "notes": "any helpful notes, or empty string"
}
No markdown, no backticks, ONLY the JSON object.`

function extractJson(raw: string): unknown {
  const clean = raw.replace(/```json|```/g, '').trim()
  try {
    return JSON.parse(clean)
  } catch {
    const first = clean.indexOf('{')
    const last = clean.lastIndexOf('}')
    if (first === -1 || last <= first) throw new Error('No JSON object found in response')
    return JSON.parse(clean.slice(first, last + 1))
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return Response.json({ error: 'Sign in to use AI identification' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const imageData = body.imageData
  const mediaType = body.mediaType
  const kind = body.kind === 'finding' ? 'finding' : 'bead'

  if (!imageData || typeof imageData !== 'string') {
    return Response.json({ error: 'Missing image data' }, { status: 400 })
  }
  if (imageData.length > MAX_BASE64_CHARS) {
    return Response.json({ error: 'Photo too large — retake or choose a smaller image' }, { status: 400 })
  }
  if (typeof mediaType !== 'string' || !(VALID_MIMES as readonly string[]).includes(mediaType)) {
    return Response.json({ error: 'Unsupported image format — use JPEG, PNG, WebP, or GIF' }, { status: 415 })
  }
  const resolvedMime = mediaType as ValidMime

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: resolvedMime, data: imageData },
          },
          { type: 'text', text: kind === 'finding' ? FINDING_PROMPT : BEAD_PROMPT },
        ],
      }],
    })

    if (response.stop_reason === 'max_tokens') {
      console.error('identify error: response truncated at max_tokens')
      return Response.json({ error: 'The AI response was cut off — try again' }, { status: 502 })
    }
    const block = response.content.find(b => b.type === 'text')
    const text = block?.type === 'text' ? block.text : ''
    if (!text) {
      console.error('identify error: no text block in response, stop_reason:', response.stop_reason)
      return Response.json({ error: 'The AI returned no result — try again' }, { status: 502 })
    }

    let result: unknown
    try {
      result = extractJson(text)
    } catch {
      console.error('identify error: unparseable model output:', text.slice(0, 500))
      return Response.json({ error: 'Could not read the AI response — try again' }, { status: 502 })
    }
    return Response.json(result)
  } catch (e: unknown) {
    console.error('identify error:', e)
    const status = e instanceof Anthropic.APIError ? 502 : 500
    return Response.json({ error: 'Identification failed — try again shortly' }, { status })
  }
}
