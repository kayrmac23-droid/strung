# DESIGN.md — strung visual system

**"Velvet, Rewarmed" — the evening bench.** Locked 2026-07-22.

This file is canonical for all UI, styling, and visual-asset work in this repo. When existing code and this document disagree, this document wins. It is written to be executed by Claude Code and audited by Kayla.

---

## Register

strung is a jewel-box tool: a maker's studio used mostly at the lamp-lit end of the day, with the phone propped against the bead board. The interface is a mocha-velvet bench — warm dark browns in a deliberate tonal ladder — on which the user's beads are the only saturated colour. Chrome recedes; the stash performs. The brand mark is **the strand**: a thread, some beads, one of them madder red. The register is treasure, not task — but held to tool-grade precision: mono-labelled, hairline-structured, honest.

The previous identity (blue-black field, Playfair/Cormorant, silver scale, glowing orb, Unicode glyphs) is retired. Its best idea — *chrome defers, colour belongs to the beads* — survives at the centre of this system.

---

## The rules (grep-able)

These are auditable. Violations are bugs.

1. **THE RED CHANNEL LEADS.** Every dark surface token samples R > G ≥ B. (The sibling product AXIS is blue-black with the blue channel leading; strung must never drift there.) Test: sample any dark hex.
2. **NO SERIFS IN THE CHROME.** Interface and display type is Instrument Sans; labels and data are DM Mono. The single serif — Newsreader Italic — appears only as marginalia: journal entries, AI asides, empty-state lines. Test: `grep` font-family declarations.
3. **NO METAL IN THE INTERFACE.** No gold, brass, or silver hexes in tokens or components. Metals live in photography only. The accent is thread-red (madder). Test: `grep` tokens for metallic values.
4. **THE NAP.** Raised surfaces cast a soft warm shadow and catch a 1px cream "lamplight edge" on top. Shadows are welcome here — velvet has pile. (AXIS forbids shadows; strung embraces them. This is a deliberate divergence.)
5. **NO SKY.** No starfields, constellations, glow orbs, particles, or celestial gradients. Texture is material: nap, thread, wax, wood. The old glowing nav orb is retired.
6. **CHROME DEFERS, THE STASH SATURATES.** UI colour is neutral brown + cream + one madder accent. The only vivid colour anywhere is bead/stash data. Never decorate chrome with saturated colour.

---

## Tokens — the mocha ladder

Hue calibrated from Kayla's reference (2026-07-22): mocha, not burnt umber — G and B travel together just under a gentle red lead. Canvas→card is a ×2 lift in the red channel; that lift is the point.

```css
:root {
  /* the mocha ladder — every dark: R > G ≥ B */
  --bean:   #0D0A09;  /* level 0 · canvas — the bench */
  --roast:  #14100F;  /* recess  · wells, inputs, image placeholders */
  --mocha:  #1A1413;  /* level 1 · cards — the tray */
  --umber:  #2B2321;  /* level 2 · card header bands, hover, modals, sticky panels */
  --seam:   #3E3330;  /* hairline borders */
  --saddle: #544740;  /* hairline hover, strong rules, strand thread */
  --tan:    #9C8070;  /* suede accent — tag text/borders, secondary glyphs, unfilled strand beads */

  --cream:  #EDE6DB;  /* primary text, headings, primary button fill */
  --text2:  #B9ACA2;  /* body/secondary text */
  --meta:   #8D8078;  /* mono meta — caps sizes only */

  --madder:      #C4564C;  /* the red thread — accents, active, focus, the marked bead */
  --madder-deep: #A8352C;  /* pressed states, filled accents, selection background */

  --sage:  #8FA383;   /* success, in-stock, stash-matched */
  --ochre: #C99B3F;   /* warning, low quantity (semantic only — not decoration) */

  --nap: 0 10px 28px rgba(6,4,3,0.6);
  --lamplight: inset 0 1px 0 rgba(237,230,219,0.05);
}
```

### Value migration map (mechanical swap in `strung/src/app/globals.css`)

Keep existing variable names where they exist; swap values. Add the new tokens above. This preserves every existing reference and keeps the diff small.

| Current var | Current value | New value | Note |
|---|---|---|---|
| `--bg` | `#090a0d` | `#0D0A09` | bean |
| `--bg2` | `#0e1018` | `#14100F` | roast |
| `--bg3` | `#141720` | — | delete (unused) |
| `--surface` | `#181c26` | `#1A1413` | mocha |
| `--surface2` | `#1e2330` | `#2B2321` | umber |
| `--border` | `#252c3d` | `#3E3330` | seam |
| `--border2` | `#2e3750` | `#544740` | saddle |
| `--cream` | `#dde4ee` | `#EDE6DB` | warm cream |
| `--text` | `#c8d4e4` | `#B9ACA2` | body |
| `--text2` | `#8a9ab8` | `#8D8078` | secondary |
| `--muted` | `#8a99b5` | `#8D8078` | merge with text2 role |
| `--muted2` | `#808ea6` | `#7E7268` | timestamps |
| `--silver` / `--silver2` / `--silver3` | silver scale | — | retire; roles move to `--cream` (fills, emphasis) and `--tan` (accents) |
| `--moonstone` / `--moonstone2` | `#7a9ab8` / `#9bb8d4` | — | retire; eyebrow/link roles move to `--madder` or `--tan` |
| `--steel` / `--steel2` | `#4a5c72` / `#5a6e88` | — | retire; rules use `--seam` / `--saddle` |
| `--rose` | `#c47070` | `#C4564C` | errors join the madder family — one red means "look here" |
| `--sage` | `#6a9080` | `#8FA383` | recalibrated |
| `--amethyst` | `#8a70aa` | — | move to stash constants (it is bead data, not chrome) |
| `--gold` / `--gold2` / `--gold3` | gold scale | — | delete (Rule 3); guides module folds into globals |
| `--emerald` / `--emerald2` | unused | — | delete |

Also replace the inline `rgba()` literals that duplicate token values (nav background, orb gradients, tip boxes, warning boxes) with `color-mix(in srgb, var(--token) N%, transparent)` so future changes cascade.

---

## Layering — the tray stack

Four levels, each a physical thing on the bench:

| Level | Token | Job |
|---|---|---|
| 0 | bean | page canvas — the bench |
| recess | roast | wells sunk into canvas or cards: inputs, colour-story boxes, code, placeholders |
| 1 | mocha | cards — the tray. Takes `--nap` + `--lamplight` |
| 2 | umber | the tray's rim: card header bands, hover lift, modals, sticky panels |

Rules: adjacent surfaces never jump more than one level. Hairlines (`--seam`) separate same-level neighbours. Card grids keep the existing **2px mosaic gaps** — the gap is the bench showing through between trays. Containers are square (radius 0); interactive elements take a 2px "sanded" corner; beads are the only circles.

## Card anatomy

```
┌──────────────────────────────┐ ← 1px seam border; --lamplight on top; --nap below
│ HEADER BAND (umber)          │ ← title (Instrument Sans 600) + right-aligned mono meta/qty
├──────────────────────────────┤
│ BODY (mocha)                 │ ← tags in DM Mono caps, --tan
│   note in Newsreader italic  │
│  ┌────────────────────────┐  │
│  │ WELL (roast)           │  │ ← optional recess: colour story, swatches
│  └────────────────────────┘  │
└──────────────────────────────┘
```

Hover: body lifts toward umber, border warms to `--saddle`. Status colours appear only as text/dots (sage in-stock, ochre low, madder attention) — never as fills.

---

## Type

Loaded via `next/font/google` in `strung/src/app/layout.tsx`. **In:** Instrument Sans, Newsreader (italic). **Out:** Playfair Display, Cormorant Garamond. **Stays:** DM Mono.

| Face | Job | Setting |
|---|---|---|
| Instrument Sans | display + interface | 600 headings, tracked −0.02em; 500 UI emphasis; 400 body. Body 17px / 1.65. Never wide/extended cuts. |
| DM Mono | labels, data, honesty | 10–11px caps, 0.14em tracking: nav, tags, counts, timestamps, stamps ("AI RENDER · FOR REFERENCE ONLY"). |
| Newsreader Italic | the hand in the margin | journal lines, AI marginalia, empty states. Nowhere else (Rule 2). |

Wordmark: **"strung" lowercase**, Instrument Sans 600, on its thread (see below). Metadata title stays "Strung — Beaded Jewellery Design Studio" (sentence casing in prose is fine; the *mark* is lowercase).

---

## The strand system

The identity mark. One thread, some beads, one madder. Thread = `--saddle` 1px; unfilled beads = `--tan` 1px outline circles; filled beads use real stash colours; the marked bead is `--madder`. Replaces: the glowing orb (wordmark), `.spinner`/`.spinner-dark` (loader), the journal's SVG progress ring (progress), and glyph empty states.

### Wordmark

```html
<span class="wm">strung</span>
<svg class="wm-thread" viewBox="0 0 84 10" aria-hidden="true">
  <line x1="0" y1="5" x2="84" y2="5" stroke="var(--saddle)" stroke-width="1"/>
  <circle cx="14" cy="5" r="3.2" fill="var(--madder)"/>
  <circle cx="30" cy="5" r="2.4" fill="none" stroke="var(--tan)" stroke-width="1"/>
  <circle cx="44" cy="5" r="2.4" fill="none" stroke="var(--tan)" stroke-width="1"/>
</svg>
```

### Loading strand (replaces both spinners)

```html
<div class="strand-loader" aria-label="Loading">
  <i></i><i></i><i></i>
</div>
```
```css
.strand-loader{position:relative; width:160px; height:18px}
.strand-loader::before{content:""; position:absolute; inset:8.5px 0 auto; height:1px; background:var(--saddle)}
.strand-loader i{position:absolute; top:5px; width:8px; height:8px; border-radius:50%;
  animation:strand-slide 1.2s cubic-bezier(.45,0,.55,1) infinite alternate}
.strand-loader i:nth-child(1){left:8px; top:4px; width:10px; height:10px; background:var(--madder)}
.strand-loader i:nth-child(2){left:32px; background:var(--tan); animation-delay:.12s}
.strand-loader i:nth-child(3){left:54px; background:var(--saddle); animation-delay:.24s}
@keyframes strand-slide{to{transform:translateX(72px)}}
@media (prefers-reduced-motion: reduce){.strand-loader i{animation:none}}
```

Loading copy stays in DM Mono caps beside it ("READING STASH & DESIGNING…").

### Progress strand (replaces the journal ring)

SVG: a `--saddle` line; one circle per step. Completed steps are filled beads (use the build's actual bead colours when available, else `--madder` for the current step); remaining steps are `--saddle`-outlined circles. Steps thread on left → right.

### Empty state — the limp thread

A slack curve with one unfilled bead, plus a single Newsreader-italic line:

```html
<svg viewBox="0 0 360 34" aria-hidden="true">
  <path d="M4,10 C 90,34 250,30 356,12" fill="none" stroke="var(--saddle)" stroke-width="1"/>
  <circle cx="180" cy="30.5" r="4" fill="none" stroke="var(--tan)" stroke-width="1"/>
</svg>
<p class="empty-line">Nothing strung yet — add your first bead and we'll begin.</p>
```

Existing empty-state copy ("No beads yet…", "Lost in the stash.") is kept verbatim.

---

## Iconography

The Unicode glyph set (◈ ◉ ◎ ◇ ⊡ …) retires. Replace with a small drawn SVG micro-icon set in the Schematic's own vocabulary — round, rondelle, bicone, chip, tube, clasp, hook — at 1.25px `--cream` stroke, sized 16/20px. The tool's icons are its own diagrams at small size. Typographic marks (→, ×, ▾) stay as type. `components/Schematic.tsx` is the source of the shape grammar; extract its bead-shape primitives into shared icon components.

## Buttons & inputs

Retire the `clip-path` chamfer and the silver gradient; delete the dead `.btn-gold` rule.

```css
.btn-primary{font-family:var(--font-mono); font-size:11px; letter-spacing:.14em; text-transform:uppercase;
  background:var(--cream); color:var(--bean); border:1px solid var(--cream);
  padding:11px 20px 10px; border-radius:2px; position:relative; cursor:pointer}
.btn-primary::after{content:""; position:absolute; left:10%; right:10%; bottom:5px; height:1px;
  background:var(--madder-deep); transform:scaleX(0); transform-origin:left; transition:transform .25s}
.btn-primary:hover::after{transform:scaleX(1)}          /* the thread appears under the label */
.btn-outline{background:transparent; color:var(--cream); border:1px solid var(--saddle); border-radius:2px}
.btn-outline:hover{border-color:var(--cream)}
.btn-text{color:var(--madder); border-bottom:1px solid var(--madder-deep)}  /* mono caps text link */
:focus-visible{outline:1px solid var(--madder); outline-offset:2px}
```

Inputs: `--roast` background, `--seam` border, radius 2px, Instrument Sans 16px; focus border `--madder`. Selects keep DM Mono 11px caps with the custom `▾`.

## Voice

Unchanged. The register shift is visual, not verbal. Keep: "Lost in the stash.", "Reading stash & designing…", "AI RENDER · FOR REFERENCE ONLY", "BUILDABLE DIAGRAM · MATCHED TO YOUR STASH". No affirmations, no exclamation marks, craft-literate and direct.

## The proofing card

New component for palette/sequence surfaces: one tap lays the working strand onto calico `#F4F0E8` (ink text `#23201A`, hairline `#DCD5C6`) for a daylight colour check — the digital equivalent of carrying a piece to the window. Bead-rim mechanic applies on both fields: any bead within ~12 L* of its field gets a 1px rim — cream rim on the dark field, ink rim on calico.

---

## Implementation order (each step shippable alone)

1. **Tokens** — `strung/src/app/globals.css`: apply the migration map; add new tokens; replace inline `rgba()` literals with `color-mix()`; delete dead rules (`.btn-gold`, unused vars).
2. **Fonts** — `strung/src/app/layout.tsx`: Instrument Sans + Newsreader in; Playfair + Cormorant out; DM Mono stays. Body 17px Instrument Sans.
3. **Buttons/inputs** — `globals.css`: de-chamfer, new set per above; focus ring.
4. **Guides** — fold `guides/page.module.css` into globals; gold usages map to `--tan` (labels) and `--cream` (emphasis).
5. **Stash constants** — move `beadColours` (24 hexes) and `typeColours` (incl. stray `#c8b8a8`, `#c87040`) out of `inventory/page.tsx` into a shared module (`src/lib/stash-colours.ts`); they are product data.
6. **Strand components** — `src/components/`: StrandLoader, StrandProgress (replaces journal ring), StrandEmpty, wordmark thread in Nav; retire spinners, orb, glyph empty states. Extract Schematic shape primitives as micro-icons.
7. **Render prompts** — `src/lib/visual.ts`: update DALL-E background language to match the field ("deep warm mocha-brown velvet, soft lamplight" — never blue-black), so AI renders sit naturally on the new surfaces.

**Deferred:** day theme (`[data-theme="day"]` calico value swap — the "Daylight Bench" set is parked in the design thread); proofing card build; specimen-plate journal export.

## Escape-kit audit (vs AXIS — run after implementing)

| Trait | strung must show | Test |
|---|---|---|
| Field | espresso/mocha, red channel leads | sample darks: R > G ≥ B |
| Body type | grotesk | no serif chrome in grep |
| Display | lowercase grotesk wordmark | "strung", never Playfair |
| Accent | thread-red, no metal | no metallic hexes |
| Depth | nap + lamplight shadows | cards cast umber |
| Corners | 2px sanded interactive | border-radius audit |
| Icons | drawn bead shapes | no ◈ ◉ ◎ |
| Atmosphere | material only | no stars/orbs/glow |
| Photography | jewel-lit material imagery | hero surfaces |
| Mark | the strand | thread + beads + one madder |
