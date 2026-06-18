import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic()

const VALID_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type ValidMime = typeof VALID_MIMES[number]
const MAX_BASE64_BYTES = 5 * 1024 * 1024 * 4 / 3 // ~6.7M chars for 5MB image

export async function POST(req: NextRequest) {
  try {
    const { imageData, mediaType, kind = 'bead' } = await req.json()

    if (!imageData || typeof imageData !== 'string') {
      return Response.json({ error: 'Missing image data' }, { status: 400 })
    }
    if (imageData.length > MAX_BASE64_BYTES) {
      return Response.json({ error: 'Image too large (max 5MB)' }, { status: 400 })
    }
    const resolvedMime: ValidMime = VALID_MIMES.includes(mediaType) ? mediaType : 'image/jpeg'

    const prompt = kind === 'finding'
      ? `You are an expert jewellery findings identifier. Analyse this image and identify the finding shown.
Return ONLY valid JSON with exactly these fields:
{
  "name": "descriptive name e.g. 20mm sterling silver hoop ear wire",
  "type": "one of: ear_wire, head_pin, eye_pin, jump_ring, clasp, chain, wire, crimp, connector, other",
  "metal": "one of: silver, gold_filled, gold, copper, brass, oxidised, other",
  "size": "size or gauge e.g. 21g, 6mm, 0.8mm, or empty string if unclear",
  "notes": "any helpful notes, or empty string"
}
No markdown, no backticks, ONLY the JSON object.`
      : `You are an expert jewellery bead identifier. Analyse this image and identify the bead shown.
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

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: resolvedMime, data: imageData },
          },
          { type: 'text', text: prompt },
        ],
      }],
    })

    const text = (response.content[0] as Anthropic.TextBlock).text
    const result = JSON.parse(text.replace(/```json|```/g, '').trim())
    return Response.json(result)
  } catch (e: unknown) {
    console.error('identify error:', e)
    return Response.json({ error: 'Identification failed' }, { status: 500 })
  }
}
