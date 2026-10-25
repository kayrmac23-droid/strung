// The /api/make prompt, split by how often each part changes.
//
// The prompt used to be one user message that opened with the maker's stash
// and request, followed by ~2.5k tokens of rules, example and schema that are
// identical on every call. Prompt caching is a prefix match, so leading with
// per-user content meant none of the static text could ever be cached — every
// generation, refinement and repair retry paid full price for it again.
//
// Now the static text is the system prompt (cached, shared by every call), the
// stash is the first user block (cached per maker, so a refine or the repair
// retry within five minutes reads it back), and only the request itself —
// piece type, style, refine instruction, retry feedback — is billed fresh.

import type Anthropic from '@anthropic-ai/sdk'
import {
  TECHNIQUE_LIST_TEXT,
  TECHNIQUE_GLOSSARY,
  METAL_COHESION_RULE,
  DIFFICULTY_RUBRIC,
  REPEAT_STEP_RULE,
  ASSEMBLY_RULES,
  ASSEMBLY_SCHEMA_TEXT,
  styleConstraint,
  type Style,
} from '@/lib/designVocab'
import { isStructuralFindingType } from '@/lib/assembly'
import { CACHE_EPHEMERAL } from '@/lib/apiRequest'

export type TimeAvailable = '15min' | '1hour' | 'afternoon'

export type PromptBead = { name: string; colour: string; size?: string; quantity: number; shape?: string }
export type PromptFinding = { name: string; type: string; metal: string; quantity: number; size?: string }

const TIME_MAP: Record<TimeAvailable, string> = {
  '15min': '15 minutes — extremely simple, 3-5 steps maximum',
  '1hour': 'about 1 hour — moderate complexity, up to 10 steps',
  'afternoon': 'a few hours — can be complex, multiple techniques fine',
}

/**
 * Everything in the make prompt that does not depend on the maker or the
 * request. It must stay byte-identical between calls — interpolating anything
 * per-request into it (a date, the stash, the style) silently turns every
 * cache read back into a full-price write.
 */
export const MAKE_SYSTEM_PROMPT = `You are an expert beaded jewellery designer. Generate ONE complete, specific design for a hobbyist maker to build right now using ONLY the materials in their stash. The maker's stash and request follow in their message.

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
- ${METAL_COHESION_RULE}
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

/** The system prompt as a single cached block. */
export const MAKE_SYSTEM: Anthropic.TextBlockParam[] = [
  { type: 'text', text: MAKE_SYSTEM_PROMPT, cache_control: CACHE_EPHEMERAL },
]

/** The stash as the prompt lists it. Inputs are expected to be length-clamped already. */
export function stashSummaryText(beads: PromptBead[], findings: PromptFinding[]): string {
  return [
    beads.length > 0
      ? `BEADS:\n${beads.map((b) => `- ${b.name} (${b.colour}, ${b.size || 'size unknown'}, qty: ${b.quantity}${b.shape ? ', ' + b.shape : ''})`).join('\n')}`
      : 'No beads in stash.',
    findings.length > 0
      ? `FINDINGS:\n${findings.map((f) => `- ${f.name} (${f.type}, ${f.metal}, qty: ${f.quantity}${f.size ? ', ' + f.size : ''})${isStructuralFindingType(f.type) ? ' [structural — can be an assembly anchor]' : ''}`).join('\n')}`
      : 'No findings in stash.',
  ].join('\n\n')
}

export type MakeRequest = {
  pieceType: string
  style: Style | ''
  mood: string
  timeAvailable?: TimeAvailable
  recentTitles: string[]
  /** Set only for a refinement: the design to revise and the change to apply. */
  refine?: { previousDesign: unknown; adjustment: string }
}

/** The per-request instruction: what to make, plus any refine instruction. */
export function makeRequestText(r: MakeRequest): string {
  const selectedTime = r.timeAvailable ? TIME_MAP[r.timeAvailable] : '1 hour'
  let text = `THEIR REQUEST:
- Piece type: ${r.pieceType || 'any — choose the best fit for the stash'}
- Time available: ${selectedTime}
${r.style ? `\n${styleConstraint(r.style)}\n` : ''}
- Mood/vibe (secondary nuance only${r.style ? ', subordinate to the style above' : ''}): ${r.mood || 'open'}`

  if (r.recentTitles.length > 0) {
    text += `

Do not repeat these recent designs — differ meaningfully in structure or featured materials: ${r.recentTitles.join(', ')}`
  }

  if (r.refine) {
    text += `

The maker already has this design:
${JSON.stringify(r.refine.previousDesign)}

Apply ONLY this requested change: "${r.refine.adjustment.trim()}"
Produce a revised version of the SAME design that applies this change while keeping everything else as stable as possible — keep the title, overall structure, and any unaffected components and steps unchanged unless the change requires otherwise. Return the full revised design in the exact same JSON schema described above, ONLY valid JSON, no markdown, no backticks.`
  }
  return text
}

/**
 * Feedback for the one repair retry.
 *
 * The retry used to say "keep everything else the same" without showing the
 * model what it had produced, so it regenerated from scratch and could
 * introduce fresh problems. When the first reply parsed, it is now included.
 */
export function retryFeedbackText(violations: string[], previousDesign: unknown): string {
  const shown = previousDesign
    ? `Your previous design was:
${JSON.stringify(previousDesign)}

`
    : ''
  return `${shown}Your previous design had these problems that must be corrected:
${violations.map((v) => `- ${v}`).join('\n')}
Correct ONLY these issues while keeping everything else the same, and return the full corrected design in the exact same JSON schema, ONLY valid JSON, no markdown, no backticks.`
}

/**
 * The user turn: stash (cache breakpoint), then request, then retry feedback.
 * The breakpoint sits on the stash rather than the end of the message so the
 * cached prefix is the part a refine or retry actually repeats.
 */
export function makeUserContent(stash: string, request: string, retryFeedback?: string): Anthropic.TextBlockParam[] {
  const blocks: Anthropic.TextBlockParam[] = [
    { type: 'text', text: `THEIR STASH:\n${stash}`, cache_control: CACHE_EPHEMERAL },
    { type: 'text', text: request },
  ]
  if (retryFeedback) blocks.push({ type: 'text', text: retryFeedback })
  return blocks
}
