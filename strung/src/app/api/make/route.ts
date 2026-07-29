import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest, getAuthenticatedClient } from '@/lib/auth'
import { parseJsonLoose } from '@/lib/colour'
import { rateLimit, tooManyRequests } from '@/lib/rateLimit'
import {
  ALLOWED_TECHNIQUES,
  TECHNIQUE_LIST_TEXT,
  TECHNIQUE_GLOSSARY,
  DIFFICULTY_RUBRIC,
  REPEAT_STEP_RULE,
  ASSEMBLY_RULES,
  ASSEMBLY_SCHEMA_TEXT,
  isValidStyle,
  styleConstraint,
  type Style,
} from '@/lib/designVocab'
import { validateAssembly } from '@/lib/assembly'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Per-user cap on design generations (calls Claude at up to 4500 tokens twice).
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60_000

// previousDesign is JSON.stringify'd whole into the refine prompt, so cap it
// like every other free-text field. A real design is a few KB; this leaves
// generous headroom while rejecting anything pathological.
const MAX_PREVIOUS_DESIGN_CHARS = 20_000

function getToken(req: NextRequest) {
  return req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
}

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

// Loose terms that mark a component as a basic finding the maker is assumed to
// own (the prompt tells the model to assume these), so they need not be in stash.
const BASIC_FINDING_TERMS = ['jump ring', 'ear wire', 'earwire', 'head pin', 'headpin', 'eye pin', 'eyepin', 'clasp', 'crimp', 'beading wire', 'wire']

// Validate a parsed design against the real stash. Returns a list of
// human-readable violation strings (empty === valid).
function validateDesign(design: unknown, beads: StashBead[], findings: StashFinding[]): string[] {
  const violations: string[] = []
  const d = (design && typeof design === 'object' ? design : {}) as {
    components?: unknown
    steps?: unknown
  }

  // Canonical stash: lowercased name -> owned quantity, plus display names.
  const owned = new Map<string, number>()
  const display = new Map<string, string>()
  for (const b of [...beads, ...findings]) {
    if (!b.name) continue
    const key = b.name.toLowerCase()
    owned.set(key, (owned.get(key) ?? 0) + (Number(b.quantity) || 0))
    if (!display.has(key)) display.set(key, b.name)
  }

  const used = new Map<string, number>()
  const components = Array.isArray(d.components) ? d.components : []
  for (const raw of components) {
    const c = (raw && typeof raw === 'object' ? raw : {}) as { item?: unknown; quantity?: unknown }
    const item = typeof c.item === 'string' ? c.item.trim() : ''
    if (!item) continue
    const key = item.toLowerCase()
    const qty = Number(c.quantity) || 0
    if (owned.has(key)) {
      used.set(key, (used.get(key) ?? 0) + qty)
    } else if (!BASIC_FINDING_TERMS.some((t) => key.includes(t))) {
      violations.push(`You used "${item}" which is not in the stash`)
    }
  }
  for (const [key, total] of used) {
    const have = owned.get(key) ?? 0
    if (total > have) {
      violations.push(`You used ${total} of "${display.get(key) ?? key}" but only ${have} are owned`)
    }
  }

  const steps = Array.isArray(d.steps) ? d.steps : []
  for (const raw of steps) {
    const s = (raw && typeof raw === 'object' ? raw : {}) as { technique?: unknown }
    const tech = s.technique
    if (tech === null || tech === undefined || tech === '') continue
    if (typeof tech !== 'string' || !(ALLOWED_TECHNIQUES as readonly string[]).includes(tech)) {
      violations.push(`You used technique "${String(tech)}" which is not in the allowed technique list`)
    }
  }

  // assembly is optional; when present it may only arrange components[].
  violations.push(...validateAssembly(design))

  return violations
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = rateLimit(`make:${user.id}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) return tooManyRequests(limit.retryAfter)

  let body: {
    pieceType?: string
    style?: string
    mood?: string
    timeAvailable?: TimeAvailable
    previousDesign?: unknown
    adjustment?: unknown
    recentTitles?: unknown
  }
  try {
    const raw = await req.json()
    body = raw && typeof raw === 'object' ? raw : {}
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const { pieceType, style, mood, timeAvailable, previousDesign, adjustment, recentTitles } = body

  const recentTitlesClean =
    Array.isArray(recentTitles) &&
    recentTitles.length <= 5 &&
    recentTitles.every((t) => typeof t === 'string' && t.length <= 100)
      ? (recentTitles as string[])
      : []

  if (adjustment !== undefined && (typeof adjustment !== 'string' || adjustment.length > 300)) {
    return NextResponse.json({ error: 'Invalid adjustment' }, { status: 400 })
  }
  if (previousDesign !== undefined && (typeof previousDesign !== 'object' || previousDesign === null || Array.isArray(previousDesign))) {
    return NextResponse.json({ error: 'Invalid previous design' }, { status: 400 })
  }
  if (previousDesign !== undefined && JSON.stringify(previousDesign).length > MAX_PREVIOUS_DESIGN_CHARS) {
    return NextResponse.json({ error: 'Previous design too large' }, { status: 400 })
  }
  const isRefine = typeof adjustment === 'string' && adjustment.trim().length > 0
    && typeof previousDesign === 'object' && previousDesign !== null && !Array.isArray(previousDesign)

  // Read the stash server-side (same queries as /api/inventory GET) rather
  // than trusting a client-supplied copy.
  const supabase = getAuthenticatedClient(getToken(req))
  const [beadsRes, findingsRes] = await Promise.all([
    supabase.from('beads').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('findings').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])
  if (beadsRes.error || findingsRes.error) {
    console.error('make stash load error:', beadsRes.error || findingsRes.error)
    return NextResponse.json({ error: 'Could not load your stash' }, { status: 500 })
  }
  const beads = (beadsRes.data || []).slice(0, 200) as StashBead[]
  const findings = (findingsRes.data || []).slice(0, 200) as StashFinding[]

  const truncStr = (v: unknown, max: number) => typeof v === 'string' ? v.slice(0, max) : ''
  const safeBeads = beads.map(b => ({ ...b, name: truncStr(b.name, 200), colour: truncStr(b.colour, 100), size: truncStr(b.size, 50), shape: truncStr(b.shape, 50) }))
  const safeFindings = findings.map(f => ({ ...f, name: truncStr(f.name, 200), type: truncStr(f.type, 50), metal: truncStr(f.metal, 50), size: truncStr(f.size, 50) }))
  // The client sends display-cased values ("Earrings", "Necklace"); normalise
  // to lowercase so they match the allowlist (and the JSON schema's piece types).
  const pieceTypeNorm = typeof pieceType === 'string' ? pieceType.trim().toLowerCase() : ''
  if (pieceTypeNorm && (!VALID_PIECE_TYPES.includes(pieceTypeNorm) || pieceTypeNorm.length > 50)) {
    return NextResponse.json({ error: 'Invalid piece type' }, { status: 400 })
  }
  // Style is validated the same way as piece type: normalise, then allowlist.
  const styleRaw = typeof style === 'string' ? style.trim().toLowerCase() : ''
  if (styleRaw && (styleRaw.length > 50 || !isValidStyle(styleRaw))) {
    return NextResponse.json({ error: 'Invalid style' }, { status: 400 })
  }
  const styleNorm: Style | '' = styleRaw && isValidStyle(styleRaw) ? styleRaw : ''
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

  let prompt = `You are an expert beaded jewellery designer. Generate ONE complete, specific design for a hobbyist maker to build right now using ONLY the materials in their stash.

THEIR STASH:
${stashSummary}

THEIR REQUEST:
- Piece type: ${pieceTypeNorm || 'any — choose the best fit for the stash'}
- Time available: ${selectedTime}
${styleNorm ? `\n${styleConstraint(styleNorm)}\n` : ''}
- Mood/vibe (secondary nuance only${styleNorm ? ', subordinate to the style above' : ''}): ${mood || 'open'}

CRITICAL RULES:
- Only use materials they actually have. Check quantities — if they have qty:2 of something, use at most 2.
- Assume basic findings are available by default (e.g. jump rings, ear wires, head pins, clasps, standard wire, and crimps) even if not listed.
- Treat stash findings marked as "statement_component" as the featured structural pieces (e.g. earring frames, chandeliers, focal connectors) and prioritise using them when present.
- If stash is empty or very sparse, design a simple piece and note what basic materials they'd need.
- The steps must be genuinely sequential and buildable — someone should be able to follow them with their hands.
- Technique tags must be from this exact list only: ${TECHNIQUE_LIST_TEXT}
${TECHNIQUE_GLOSSARY}
- ${REPEAT_STEP_RULE}
- Earrings: every bead and dangle component must be used in even quantities so the pair is symmetric. If a focal bead has an odd quantity, design around a matched pair or choose a different piece type.
- Necklaces and bracelets: do rough length math — state the target length and confirm the specified bead counts and sizes plausibly reach it. Bracelets are ~18cm, necklaces 40–45cm unless the design says otherwise.
- Seed beads cannot go on thick wire or leather; large-hole beads slide off fine chain — keep the stringing material sensible for the bead sizes used.
- ${DIFFICULTY_RUBRIC}

${ASSEMBLY_RULES}

Here is an EXAMPLE of the quality and granularity expected — it uses a made-up stash. Do NOT copy its materials or wording; only mirror its structure and level of detail:
EXAMPLE STASH — BEADS: matte teal seed beads (2mm, qty:40), amazonite rounds (8mm, qty:6), rose quartz chips (qty:14). FINDINGS: silver lobster clasp (qty:1), silver jump rings (qty:20).
EXAMPLE OUTPUT:
{
  "title": "Tidepool Wrap",
  "description": "A calm amazonite bracelet with a whisper of teal — everyday sea-glass softness.",
  "colourStory": "Milky amazonite rounds carry a soft blue-green, punctuated by matte teal seed beads that deepen the tone, with rose quartz chips warming the palette at the ends.",
  "difficulty": "Beginner",
  "estimatedTime": "20 mins",
  "pieceType": "bracelet",
  "materialsCheck": { "allAvailable": true, "notes": "Targets ~18cm: six 8mm amazonite plus seed-bead spacers reach length comfortably within stock." },
  "components": [
    { "item": "amazonite rounds", "quantity": 6, "note": "main stations along the strand" },
    { "item": "matte teal seed beads", "quantity": 20, "note": "spacers between each amazonite round" },
    { "item": "rose quartz chips", "quantity": 6, "note": "warm accents near the clasp" },
    { "item": "silver lobster clasp", "quantity": 1, "note": "closure" }
  ],
  "steps": [
    { "id": 1, "instruction": "Cut ~22cm of beading wire and crimp one end to the lobster clasp loop.", "material": "silver lobster clasp", "technique": "Crimping", "tip": "Leave a 2cm tail to thread back through the crimp bead." },
    { "id": 2, "instruction": "String three rose quartz chips, then one amazonite round.", "material": "rose quartz chips", "technique": "Stringing", "tip": "Keep tension snug so no wire shows between beads." },
    { "id": 3, "instruction": "Add four teal seed beads, then another amazonite round; repeat to the last round.", "material": "matte teal seed beads", "technique": "Stringing", "tip": "Check length against your wrist near the 18cm mark." },
    { "id": 4, "instruction": "Finish with three rose quartz chips to mirror the start.", "material": "rose quartz chips", "technique": "Stringing", "tip": "Symmetry at both ends reads as intentional." },
    { "id": 5, "instruction": "Crimp the closing end to a jump ring and trim the tail flush.", "material": "silver jump rings", "technique": "Crimping", "tip": "Twist jump rings sideways to open, never pull them apart." }
  ]
}
This example shows the target granularity — one physical action per step (with repeating units collapsed into a single step carrying a repeat count), a real material and technique on each, and a colourStory that names specific beads. It is an example of quality, not content to reuse.

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
  ${ASSEMBLY_SCHEMA_TEXT},
  "steps": [
    {
      "id": 1,
      "instruction": "Clear, specific instruction — one action per step, or one repeating unit with an explicit repeat count",
      "material": "Exact material name being used in this step, or null",
      "technique": "One of the allowed technique tags, or null",
      "tip": "A practical tip for this specific step, or null"
    }
  ]
}`

  if (recentTitlesClean.length > 0) {
    prompt += `

Do not repeat these recent designs — differ meaningfully in structure or featured materials: ${recentTitlesClean.join(', ')}`
  }

  if (isRefine) {
    prompt += `

The maker already has this design:
${JSON.stringify(previousDesign)}

Apply ONLY this requested change: "${(adjustment as string).trim()}"
Produce a revised version of the SAME design that applies this change while keeping everything else as stable as possible — keep the title, overall structure, and any unaffected components and steps unchanged unless the change requires otherwise. Return the full revised design in the exact same JSON schema described above, ONLY valid JSON, no markdown, no backticks.`
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4500,
      messages: [{ role: 'user', content: prompt }],
    })
    if (response.stop_reason === 'max_tokens') {
      console.error('make error: response truncated at max_tokens')
      return NextResponse.json({ error: 'Design too long — try again' }, { status: 502 })
    }
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    let design = parseJsonLoose(text)

    let violations = validateDesign(design, beads, findings)
    if (violations.length > 0) {
      // Retry ONCE: hand the model the exact violations and ask it to fix only those.
      const retryPrompt = `${prompt}

Your previous design had these problems that must be corrected:
${violations.map((v) => `- ${v}`).join('\n')}
Correct ONLY these issues while keeping everything else the same, and return the full corrected design in the exact same JSON schema, ONLY valid JSON, no markdown, no backticks.`
      try {
        const retry = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 4500,
          messages: [{ role: 'user', content: retryPrompt }],
        })
        if (retry.stop_reason !== 'max_tokens') {
          const retryText = retry.content[0].type === 'text' ? retry.content[0].text : ''
          const retryDesign = parseJsonLoose(retryText)
          const retryViolations = validateDesign(retryDesign, beads, findings)
          if (retryViolations.length === 0) {
            return NextResponse.json(retryDesign)
          }
          // Retry still invalid — prefer it and surface its remaining issues.
          design = retryDesign
          violations = retryViolations
        }
      } catch (retryErr) {
        console.error('make retry error:', retryErr)
        // Keep the original design + violations and fall through to soft-fail.
      }

      // Never hard-fail on validation: return the design with an honest check.
      if (design && typeof design === 'object') {
        ;(design as Record<string, unknown>).materialsCheck = {
          allAvailable: false,
          notes: `Automatic stash check found issues: ${violations.join('; ')}.`,
        }
      }
    }

    return NextResponse.json(design)
  } catch (e: unknown) {
    console.error('make error:', e)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}
