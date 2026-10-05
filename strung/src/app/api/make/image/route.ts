import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getAuthenticatedClient } from '@/lib/auth'
import { rateLimit, tooManyRequests } from '@/lib/rateLimit'
import { MODEL, firstTextBlock, getToken, parseBody, truncStr, withEffort, logUsage } from '@/lib/apiRequest'
import { IMAGE_DAILY_CAP, checkDailyAllowance, recordDailyUse, dailyCapReached } from '@/lib/dailyCap'
import { buildFallbackImagePrompt, describeAssembly, IMAGE_PHOTO_SUFFIX } from '@/lib/imagePrompt'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// GPT Image 2 is the priciest upstream call in the app, so cap it tighter. This
// is the per-instance burst limit; the daily ceiling (IMAGE_DAILY_CAP) is persisted.
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60_000

const MAX_ASSEMBLY_CHARS = 5_000

function cleanComponents(v: unknown): { item: string; quantity: number; note: string }[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, 50).flatMap((c) => {
    if (!c || typeof c !== 'object') return []
    const r = c as Record<string, unknown>
    const item = truncStr(r.item, 200).trim()
    if (!item) return []
    const qty = Number(r.quantity)
    return [{ item, quantity: Number.isFinite(qty) ? Math.max(0, Math.min(9999, Math.round(qty))) : 1, note: truncStr(r.note, 300) }]
  })
}

function cleanSteps(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.slice(0, 50).flatMap((s) => {
    const instruction = s && typeof s === 'object' ? truncStr((s as Record<string, unknown>).instruction, 500).trim() : ''
    return instruction ? [instruction] : []
  })
}

async function buildPrompt(design: Record<string, unknown>): Promise<string> {
  // The assembly describes what mounts at top vs what hangs below. Deriving it
  // here (rather than handing over the raw assembly JSON) gives the model the
  // orientation in plain English so the render matches the schematic instead of
  // inverting the piece.
  const structure = describeAssembly(design)
  const summary = {
    title: design.title,
    description: design.description,
    pieceType: design.pieceType,
    colourStory: design.colourStory,
    components: design.components,
    ...(structure ? { structure } : {}),
    steps: design.steps,
  }

  // The prompt-writer is non-critical: if the call fails, truncates at
  // max_tokens or comes back empty, fall back to a deterministic prompt so the
  // preview still renders. A thrown error used to escape to the route's catch
  // and fail the whole render as a 500, so an Anthropic hiccup broke previews
  // even though OpenAI was fine.
  let res: Anthropic.Message
  try {
    res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 400,
      ...withEffort('low'),
      messages: [
        {
          role: 'user',
          content: `You are writing a prompt for an image generation model to generate a photorealistic image of a specific finished handmade beaded jewellery piece.

Here is the complete design:
${JSON.stringify(summary, null, 2)}

Write a single dense paragraph (under 850 characters) that describes EXACTLY what this finished piece looks like as if seen in a photo. Be specific about:
- The exact arrangement and structure (how beads are laid out, strung, or connected)
- Each component: precise colours, sizes, shapes, quantities, and their positions
- How elements connect (wrapped loops, jump rings, crimp beads, stringing pattern, etc.)
- The overall silhouette and feel of the finished piece
${structure ? '- CRITICAL orientation: honour the "structure" field EXACTLY — the named anchor is mounted at the top and every strand hangs downward below it in the given order. Never invert it (do not put a hanging drop or cabochon at the top).\n' : ''}
Then append exactly this sentence: "${IMAGE_PHOTO_SUFFIX}"

Output ONLY the prompt text, nothing else.`,
        },
      ],
    })
  } catch (e) {
    console.error('make/image: prompt-writer failed, using fallback prompt:', e)
    return buildFallbackImagePrompt(design)
  }

  logUsage('make/image prompt', res)
  const text = firstTextBlock(res).trim()
  if (res.stop_reason === 'max_tokens' || !text) {
    console.error('make/image: prompt-writer truncated or empty, using fallback prompt')
    return buildFallbackImagePrompt(design)
  }
  return text
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = rateLimit(`make-image:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) return tooManyRequests(limit.retryAfter)

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Image generation not configured' }, { status: 501 })
  }

  try {
    const raw = await parseBody(req)
    if (!raw) return NextResponse.json({ error: 'Invalid design' }, { status: 400 })
    const design: Record<string, unknown> = {
      title: typeof raw.title === 'string' ? raw.title.slice(0, 200) : '',
      description: typeof raw.description === 'string' ? raw.description.slice(0, 500) : '',
      pieceType: typeof raw.pieceType === 'string' ? raw.pieceType.slice(0, 50) : '',
      colourStory: typeof raw.colourStory === 'string' ? raw.colourStory.slice(0, 500) : '',
      // Rebuilt field by field rather than passed through: these are
      // JSON.stringify'd into a paid prompt, so an unclamped component note or
      // step was an unbounded lever on the bill, and a null step threw.
      components: cleanComponents(raw.components),
      steps: cleanSteps(raw.steps),
      // Carried through so the prompt can describe top-vs-hanging orientation.
      // describeAssembly is fully defensive about the shape, but cap its size.
      assembly: raw.assembly && typeof raw.assembly === 'object' && JSON.stringify(raw.assembly).length <= MAX_ASSEMBLY_CHARS
        ? raw.assembly
        : undefined,
    }
    if (!design.title) return NextResponse.json({ error: 'Invalid design' }, { status: 400 })

    // Checked after validation and the config check, and before the first paid
    // call (the prompt-writer), so a capped user costs nothing. The use itself
    // is recorded only once an image has come back — see recordDailyUse.
    const supabase = getAuthenticatedClient(getToken(req))
    const allowance = await checkDailyAllowance(supabase, user.id, 'image', IMAGE_DAILY_CAP)
    if (!allowance.allowed) return dailyCapReached()

    const prompt = await buildPrompt(design)

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt,
        n: 1,
        size: '1024x1024',
        // medium is ~1/4 the price of high; the render is a reference picture,
        // not the deliverable.
        quality: 'medium',
      }),
    })

    if (!res.ok) {
      console.error('OpenAI image error:', res.status, await res.json().catch(() => ({})))
      // Never proxy OpenAI's status straight through. Their 401 (our API key is
      // bad or unverified) and 429 (our org is rate-limited) are our problems,
      // not the maker's, and those codes already mean something specific on our
      // own API contract — 401 is "your session is invalid" everywhere else in
      // this app, and 429 is our own rate limiter. Forwarding them conflates an
      // upstream fault with a client fault for anything reading status alone.
      // Only a 400 is genuinely about the submitted design; everything else is
      // an upstream fault and reports as 502.
      return res.status === 400
        ? NextResponse.json(
            { error: 'This design could not be turned into an image — try adjusting it and generating again.' },
            { status: 400 },
          )
        : NextResponse.json(
            { error: 'The image service is unavailable right now. Please try again in a moment.' },
            { status: 502 },
          )
    }

    // GPT image models always return base64 (b64_json) — the `url` response
    // format DALL-E used isn't supported — so wrap it in a data URI the
    // client <img> can render directly.
    const data = await res.json() as { data?: { b64_json?: string }[] }
    const b64 = data.data?.[0]?.b64_json
    if (!b64) {
      console.error('OpenAI image returned no image data:', JSON.stringify(data).slice(0, 300))
      return NextResponse.json({ error: 'Image generation failed' }, { status: 502 })
    }
    await recordDailyUse(supabase, user.id, 'image')
    const imageUrl = `data:image/png;base64,${b64}`
    return NextResponse.json({ imageUrl })
  } catch (e: unknown) {
    console.error('image route error:', e)
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
  }
}
