// Shared design vocabulary for the two AI routes that produce buildable
// designs (/api/make and /api/codesign). Both routes embed the same technique
// list, difficulty rubric, step-granularity rule and style constraint, so they
// live here rather than being copy-pasted into each prompt.

export const ALLOWED_TECHNIQUES = [
  'Stringing',
  'Simple Loop',
  'Jump Ring',
  'Crimping',
  'Wrapped Loop',
  'Briolette Wrap',
  'Linked Chain',
  'Wire Coiling',
  'Wire Wrapping',
  'Frame Forming',
  'Knotting',
] as const

export type Technique = (typeof ALLOWED_TECHNIQUES)[number]

// Quoted, comma-separated — the form every prompt uses inline.
export const TECHNIQUE_LIST_TEXT = ALLOWED_TECHNIQUES.map((t) => `"${t}"`).join(', ')

// Several tags are easy to conflate, so the prompt states what each one means.
// "Wire Wrapping" is decorative binding only — forming a frame is its own tag.
export const TECHNIQUE_GLOSSARY = `Technique meanings (use the tag that matches the actual action):
- "Stringing": beads onto a continuous flexible medium (beading wire, cord, thread, or chain) finished at both ends — NOT a bead loaded onto a head pin or eye pin. A bead on a head pin is finished with "Wrapped Loop" or "Simple Loop", never "Stringing".
- "Simple Loop": a plain round loop turned in a head pin or eye pin and closed, no wrap.
- "Wrapped Loop": a loop turned in wire and secured with two or three wraps around its own stem.
- "Briolette Wrap": wire threaded through a top-drilled bead, crossed above it and wrapped into a stem.
- "Linked Chain": a run of individually wire-wrapped beads joined loop-to-loop into a chain (rosary chain).
- "Wire Coiling": tight decorative coils of fine wire around a stem or core wire.
- "Wire Wrapping": decorative binding, or wrapping a wire tail against a form.
- "Frame Forming": hand-forming a hoop or frame from bare wire and wrapping beads onto it.`

// Metal-tone cohesion for structural findings. Stated in warm/cool tone
// families (not exact-metal equality) so brass+copper is fine but silver on a
// brass anchor is a mismatch. The stash metal values are silver, gold_filled,
// gold, copper, brass, oxidised, other.
export const METAL_COHESION_RULE = `Metal tone cohesion: the piece's structural findings — jump rings, ear wires, head pins, eye pins, clasps, and wire — must sit in the SAME tone family as the dominant structural anchor (the chandelier finding, connector, hoop, or frame the piece hangs from). Warm family: gold, gold_filled, brass, copper, and antiqued/oxidised brass. Cool family: silver and oxidised/gunmetal silver. Do not pair a cool-tone finding with a warm-tone anchor (e.g. a silver head pin on an antique-brass chandelier connector is a mismatch); choose findings in the anchor's tone family. Warm metals may mingle with each other (brass with copper, gold with brass) — that is not a mismatch. A deliberate warm/cool mix is only allowed for the bohemian style AND must be named as intentional in colourStory. When a needed finding isn't in the anchor's tone, assume it exists in that tone rather than switching family. Do NOT list a qty:0 'not used' finding as a rejected alternative in the materials.`

export const DIFFICULTY_RUBRIC = `Difficulty gating — assign difficulty from the techniques actually used:
- Beginner: Stringing, Simple Loop, Jump Ring, Crimping, Wrapped Loop, Briolette Wrap
- Intermediate: Linked Chain, Wire Coiling, Wire Wrapping, Knotting
- Advanced: Frame Forming, or any design combining three or more distinct techniques across twelve or more steps`

// Without this, a fourteen-link rosary chain becomes fourteen near-identical steps.
export const REPEAT_STEP_RULE = `One physical action per step — EXCEPT where a step is a repeating unit. Write a repeating unit ONCE and give it an explicit repeat count (e.g. "Repeat steps 3-4 until you have 12 links") instead of enumerating every repetition as its own step.`

// Optional structure field. Without it every design reads as one vertical run,
// so chandeliers and multi-drop earrings cannot be diagrammed. Both design
// routes describe it identically — the schema is generated from one object so
// the pretty (make) and compact (codesign) forms can never drift.
export const ASSEMBLY_FORMS = ['strand', 'drop', 'branched'] as const

export type AssemblyForm = (typeof ASSEMBLY_FORMS)[number]

export const ASSEMBLY_FORM_LIST_TEXT = ASSEMBLY_FORMS.map((f) => `"${f}"`).join(', ')

const ASSEMBLY_SCHEMA_SHAPE = {
  form: ASSEMBLY_FORMS.join('|'),
  anchor: 'exact component name the strands hang from, or null',
  strands: [
    {
      id: 1,
      attachAt: 'left|centre|right',
      repeat: 1,
      elements: [{ item: 'exact component name', quantity: 1 }],
    },
  ],
}

// Pretty-printed, indented two spaces to sit inside a multi-line schema block.
export const ASSEMBLY_SCHEMA_TEXT = `"assembly": ${JSON.stringify(ASSEMBLY_SCHEMA_SHAPE, null, 2).replace(/\n/g, '\n  ')}`

// Single line, for the minified blueprint schema in the codesign system prompt.
export const ASSEMBLY_SCHEMA_COMPACT = `"assembly":${JSON.stringify(ASSEMBLY_SCHEMA_SHAPE)}`

export const ASSEMBLY_RULES = `ASSEMBLY — how the piece hangs together (the "assembly" field):
- assembly is OPTIONAL. Omit it entirely for a plain single-strand necklace or bracelet — those render fine without it.
- form "strand" is one continuous run (necklace, bracelet). "drop" is a single vertical dangle (simple drop earring). "branched" is multiple drops hanging from a shared anchor (chandelier, hoop fringe, tiered earring).
- anchor is the TOP mount point that bears the piece — it must be a structural finding (an ear wire, a hoop, a filigree connector, a chandelier finding, a statement_component). In the stash these are the findings flagged [structural — can be an assembly anchor]. Null for form "strand".
- NEVER put a bead, cabochon, drop, briolette, teardrop or any dangling element in anchor — those hang FROM the anchor as strand elements. Putting a drop or cabochon in anchor builds the piece upside down.
- elements are ordered TOP to BOTTOM as the piece hangs.
- repeat means this identical strand appears N times across the anchor. Use it for evenly spaced fringe rather than listing the same strand repeatedly.
- Vary element counts between strands to make a chandelier taper — that is how the shape is expressed.
- CRITICAL: every item named in assembly must already appear in components[]. assembly describes arrangement only, never introduces new materials.
- Each strand's elements MUST list every bead in that physical drop, top to bottom, exactly as the steps build it — including junction and spacer beads (e.g. rondelles) that sit between other beads. If the steps describe a drop as rondelle → fire-polished → teardrop, the strand must list those three elements in that order, not a single teardrop. The assembly and the steps describe the same physical object and must show the same beads in the same order. Strand element quantities must reconcile with components[] and with the step counts.
- For earrings, assembly describes ONE earring. components[] still covers the pair.
- WORKED EXAMPLE (a chandelier earring): the chandelier finding (or hoop) is the anchor at the top; a central cabochon and pearl drops hang below it. The anchor is the structural finding — NOT the cabochon:
  "assembly": { "form": "branched", "anchor": "brass chandelier finding", "strands": [
    { "id": 1, "attachAt": "left", "repeat": 1, "elements": [{ "item": "freshwater pearls", "quantity": 3 }] },
    { "id": 2, "attachAt": "centre", "repeat": 1, "elements": [{ "item": "amber cabochon", "quantity": 1 }] },
    { "id": 3, "attachAt": "right", "repeat": 1, "elements": [{ "item": "freshwater pearls", "quantity": 3 }] } ] }
  Note the cabochon and pearls are strand elements hanging below; only the chandelier finding is the anchor.`

export const VALID_STYLES = ['vintage_brass', 'delicate_gold', 'bohemian', 'crystal_sparkle'] as const

export type Style = (typeof VALID_STYLES)[number]

export const STYLE_DESCRIPTIONS: Record<Style, string> = {
  vintage_brass:
    'antiqued brass and copper, Czech pressed and Picasso glass, bead caps and filigree, warm opaque colour, short drops with a large focal',
  delicate_gold:
    'gold-filled findings, small faceted gemstone rondelles, fine chain and tiny metal spacers, long slim lines, no ornament',
  bohemian:
    'mixed metals, gemstone chips and irregular shapes, layered and asymmetric, earthy palette',
  crystal_sparkle:
    'bicones and briolettes, bright silver or gold, heavily faceted and light-catching',
}

// Display labels for the style selector in the UI.
export const STYLE_LABELS: Record<Style, string> = {
  vintage_brass: 'Vintage Brass',
  delicate_gold: 'Delicate Gold',
  bohemian: 'Bohemian',
  crystal_sparkle: 'Crystal Sparkle',
}

export function isValidStyle(style: string): style is Style {
  return (VALID_STYLES as readonly string[]).includes(style)
}

// The style is a firm constraint, but never a licence to invent materials —
// the stash wins and any shortfall is reported instead of papered over.
export const STYLE_OVERRIDE_RULE = `Buildability from the actual stash ALWAYS overrides the style. Never invent components to satisfy a style. If the stash cannot support the requested style, build the best piece the stash genuinely allows and say so plainly in materialsCheck.notes.`

// Prompt block for a chosen style, or an empty string when none was requested.
export function styleConstraint(style: Style | ''): string {
  if (!style) return ''
  return `STYLE (firm constraint — governs materials, palette, proportion and finish): ${style} — ${STYLE_DESCRIPTIONS[style]}
${STYLE_OVERRIDE_RULE}`
}

// Every style spelled out, for prompts that let the model pick one.
export const STYLE_MENU = VALID_STYLES.map((s) => `- ${s}: ${STYLE_DESCRIPTIONS[s]}`).join('\n')
