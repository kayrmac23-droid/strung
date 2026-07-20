import Anthropic from '@anthropic-ai/sdk'
import { NextRequest } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { normaliseBead, normaliseFinding, itemConfidence } from '@/lib/stashItems'
import { parseJsonLoose } from '@/lib/colour'
import { rateLimit, tooManyRequests } from '@/lib/rateLimit'

const client = new Anthropic()

// Per-user cap on vision identifications (each sends a full image to Claude).
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

const VALID_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type ValidMime = typeof VALID_MIMES[number]

// Multi mode identifies distinct groups, not individual beads — a strand is
// one entry. More than this and the photo is better taken as two photos.
const MAX_ITEMS_PER_KIND = 12

// The client downscales photos to 1568px JPEG before upload (see
// src/lib/imagePrep.ts), so real payloads are ~200–500KB of base64. Vercel
// rejects request bodies over 4.5MB at the platform layer regardless, so this
// cap exists to fail with a clear message rather than an opaque 413.
const MAX_BASE64_CHARS = 4 * 1024 * 1024

const MULTI_PROMPT = `You are an expert jewellery bead and findings identifier. This photo may contain MULTIPLE distinct beads and findings — strands, groups, or a mixed lot.

Rules:
- Identify each visually DISTINCT bead or finding as ONE entry. Group identical items: a strand or pile of the same bead is one entry, never one entry per physical bead.
- quantity: estimate the count visible. A full strand of beads is about 40. If the count is unclear, use 1.
- confidence must be one of: certain (unmistakable), likely (probable, but the material or stone could differ), unsure (best guess — flag for a closer look).
- Beads are decorative components. Findings are hardware (ear wires, head pins, eye pins, jump rings, clasps, chain, wire, crimps, connectors, statement components).
- bead type must be one of: gemstone, crystal, glass, seed, metal, pearl, resin, other
- bead shape must be one of: round, rondelle, briolette, teardrop, faceted, chip, tube, oval, square, other
- bead size must be one of: seed, small, medium, large, statement
- finding type must be one of: ear_wire, head_pin, eye_pin, jump_ring, clasp, chain, wire, crimp, connector, statement_component, other
- finding metal must be one of: silver, gold_filled, gold, copper, brass, oxidised, other
- name: short and specific, e.g. "Labradorite teardrop briolettes", "Silver ball-end head pins".
- colour: the visible colour in plain words. hex: the best-matching CSS hex code.
- notes: only genuinely useful detail (finish, treatment, "possibly dyed"), or empty string.
- At most ${MAX_ITEMS_PER_KIND} beads and ${MAX_ITEMS_PER_KIND} findings — prioritise the most prominent. Never invent items that are not visible. If nothing is identifiable, return empty arrays.

Return ONLY valid JSON, no markdown, no backticks:
{"beads":[{"name":"...","type":"...","colour":"...","hex":"#RRGGBB","size":"...","shape":"...","quantity":1,"notes":"...","confidence":"likely"}],"findings":[{"name":"...","type":"...","metal":"...","size":"...","quantity":1,"notes":"...","confidence":"likely"}]}`

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) {
    return Response.json({ error: 'Sign in to use AI identification' }, { status: 401 })
  }

  const limit = rateLimit(`identify:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) return tooManyRequests(limit.retryAfter)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const imageData = body.imageData
  const mediaType = body.mediaType

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
      max_tokens: 3000,
      temperature: 0.2,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: resolvedMime, data: imageData },
          },
          { type: 'text', text: MULTI_PROMPT },
        ],
      }],
    })

    if (response.stop_reason === 'max_tokens') {
      console.error('identify error: response truncated at max_tokens')
      return Response.json({ error: 'The response was cut off — try photographing fewer groups at once' }, { status: 502 })
    }
    const block = response.content.find(b => b.type === 'text')
    const text = block?.type === 'text' ? block.text : ''
    if (!text) {
      console.error('identify error: no text block in response, stop_reason:', response.stop_reason)
      return Response.json({ error: 'The AI returned no result — try again' }, { status: 502 })
    }

    let result: unknown
    try {
      result = parseJsonLoose(text)
    } catch {
      console.error('identify error: unparseable model output:', text.slice(0, 500))
      return Response.json({ error: 'Could not read the AI response — try again' }, { status: 502 })
    }

    const parsed = (result ?? {}) as { beads?: unknown; findings?: unknown }
    const beads = (Array.isArray(parsed.beads) ? parsed.beads : [])
      .slice(0, MAX_ITEMS_PER_KIND)
      .flatMap(item => {
        const bead = normaliseBead(item)
        return bead ? [{ ...bead, confidence: itemConfidence(item) }] : []
      })
    const findings = (Array.isArray(parsed.findings) ? parsed.findings : [])
      .slice(0, MAX_ITEMS_PER_KIND)
      .flatMap(item => {
        const finding = normaliseFinding(item)
        return finding ? [{ ...finding, confidence: itemConfidence(item) }] : []
      })
    return Response.json({ beads, findings })
  } catch (e: unknown) {
    console.error('identify error:', e)
    const status = e instanceof Anthropic.APIError ? 502 : 500
    return Response.json({ error: 'Identification failed — try again shortly' }, { status })
  }
}
