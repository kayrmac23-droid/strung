import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  try {
    const { imageData, mediaType } = await req.json()

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageData },
          },
          {
            type: 'text',
            text: `You are an expert jewellery bead identifier. Analyse this image and identify the bead shown.
Return ONLY valid JSON with exactly these fields:
{
  "name": "descriptive name e.g. Labradorite teardrop briolette",
  "type": "one of: gemstone, crystal, glass, seed, metal, pearl, other",
  "colour": "colour description e.g. Steel blue with iridescent flash",
  "hex": "best matching hex code e.g. #7a9ab8",
  "size": "one of: seed, small, medium, large, statement",
  "shape": "one of: round, rondelle, briolette, teardrop, faceted, chip, tube, oval, square, other",
  "notes": "any helpful notes, or empty string"
}
No markdown, no backticks, ONLY the JSON object.`,
          },
        ],
      }],
    })

    const text = (response.content[0] as Anthropic.TextBlock).text
    const result = JSON.parse(text.replace(/```json|```/g, '').trim())
    return Response.json(result)
  } catch (e: any) {
    return Response.json({ error: e.message || 'Identification failed' }, { status: 500 })
  }
}
