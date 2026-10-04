# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Strung is an AI-powered beaded jewellery design studio. Stack: Next.js 15 (App Router), TypeScript, Supabase (auth + database), Anthropic SDK (Claude), and OpenAI (GPT Image 2 image generation). The Next.js app lives in the `strung/` subdirectory — all commands below must be run from there.

## Commands

```bash
cd strung
npm install        # install dependencies
npm run dev        # start dev server at localhost:3000
npm run build      # type-check and build for production
npm run start      # serve the production build
```

Lint with `npm run lint` (ESLint) and test with `npm test` (Vitest).

`.github/workflows/ci.yml` runs exactly these three on every pull request and on pushes to `main`: `npm ci`, then lint, test and build, on Node 22 from the `strung/` directory. It installs with `npm ci` rather than `npm install` so a lockfile that has drifted from `package.json` fails the run instead of being silently rewritten, and it sets **no environment variables** — the build must not require API keys or Supabase credentials. If a change makes the build need them, fix the change, not the workflow.

## Required Environment Variables

Create `strung/.env.local`:

```
ANTHROPIC_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...          # required for GPT Image 2 image generation
```

## Core Loop

**Stash → Make → Build → Journal**

1. User adds beads and findings to their Stash (`/inventory`)
2. AI reads the stash and generates a bespoke design on the Make page (`/make`)
3. User steps through the build instructions on the Build page (`/make/build/[id]`)
4. Completed and saved-for-later pieces appear in the Journal (`/journal`)

## Auth

Supabase email/password auth. **Almost everything requires a session.** `/api/sequence` is the only route with no auth check — the Palette page is the one feature that fully works signed out. Every other route calls `getUserFromRequest(req)` and returns 401 when there is no user. The one exception is the **list** form of `/api/builds` GET, which returns `[]` so the journal can render an empty state signed out. `GET ?id=` is *not* an exception — it returns 401 with `'Sign in to open this build.'`, because it answers with a single object and returning `[]` there handed the build page an array where it expects an object; the page's `!record?.id` guard then reported a misleading "Build not found" instead of prompting a sign-in. Match the shape of the response to the shape of the request.

Client-side, `getSession()` from `@/lib/authClient` checks auth state before save actions, and `getAuthHeaders()` attaches the bearer token. Pages that can render signed-out (e.g. `/make`) track a `signedOut` flag by checking for `res.status === 401` on their initial fetch.

## Pages

| URL | Nav label | Description |
|---|---|---|
| `/` | — | Landing / home |
| `/inventory` | Stash | Bead + findings CRUD, photo identification, bulk text stash parsing |
| `/make` | Make | AI design generator + refinement + GPT Image preview |
| `/make/build/[id]` | — | Step-by-step build mode; optional stash decrement on completion |
| `/sequence` | Palette | Colour palette + repeating bead sequence generator |
| `/codesign` | Co-Design | Conversational AI co-designer |
| `/journal` | Journal | Saved and completed builds |
| `/account` | Account | Sign in / sign up |
| `/auth/callback` | — | Supabase OAuth callback |
| `/guides` | Learn | Jewellery guides + streaming AI advisor scoped to the open guide section |
| `/glossary` | — | Static glossary (active under Learn nav item) |
| `/calculator` | Calculator | Bead count, wire length and approximate weight (`src/lib/beadMath.ts`) |
| `/not-found` | — | 404 |

Nav has 7 items (Stash, Make, Co-Design, Palette, Calculator, Learn, Journal) plus Account. Note the mismatch between route and label: `/sequence` is labelled **Palette**.

## API Routes

| Route | Method(s) | Auth | What it does |
|---|---|---|---|
| `/api/inventory` | GET, POST, DELETE, PATCH | yes — 401 on all methods | CRUD for `beads` and `findings` tables. Writes go through `cleanStashInput()` in `src/lib/stashItems.ts` (enum, hex, quantity and length checks — rejects with 400 naming the field). GET answers 500 if either table read fails, never an empty stash |
| `/api/make` | POST | yes — 401 | AI generates one design as structured JSON. Validates `pieceType` and `style` against allowlists (`style` is the firm aesthetic constraint; `mood` stays optional free text underneath it). Accepts `previousDesign` + `adjustment` for refinement, and `recentTitles` to avoid repeats. Retries once on a truncated, unparseable, wrongly shaped or stash-violating reply; 502 if neither attempt produced a design |
| `/api/make/image` | POST | yes — 401 | Builds an image prompt via Claude, calls OpenAI GPT Image 2 (`gpt-image-2`) |
| `/api/builds` | GET, POST, DELETE, PATCH | yes — bare `GET` returns `[]` without auth, `GET ?id=` and all other methods 401 | CRUD for `builds` table. `GET ?id=` returns a single build, 404, or 401. Writes go through `cleanBuildInput()` in `src/lib/builds.ts`, which strips `design.imageUrl` and caps the design at 100KB |
| `/api/sequence` | POST | **no** | Colour palette + bead sequence JSON. Validates `harmonyType` / `pieceType` against allowlists, sanitises `anchorFamily`, caps `beads` at 100. The model reply is shape-checked by `normaliseSequenceResult()` (`src/lib/sequenceResult.ts`) — 502 if no palette came back |
| `/api/codesign` | POST | yes — 401 | Streaming co-design chat (Claude). The history is rebuilt by `sanitiseChatMessages()` (`src/lib/chatMessages.ts`): text and inline base64 images only, empty turns dropped, last turn must be the user's |
| `/api/advice` | POST | yes — 401 | Streaming jewellery advice (Claude) |
| `/api/identify` | POST | yes — 401 | Vision identification (Claude). Identifies every distinct bead/finding group in one photo and returns `{ beads: [], findings: [] }` with per-item `confidence` (`certain`/`likely`/`unsure`), normalised via `src/lib/stashItems.ts`. There is only this multi mode — the Stash page sends `mode: 'multi'`, but the route ignores the field |
| `/api/parse-stash` | POST | yes — 401 | Parses a plain-text stash description into `{ beads: [], findings: [] }` for the review flow (Claude) |

There is no `/api/designs` route.

## AI Response Patterns

Two patterns:

1. **JSON** (`/api/make`, `/api/identify`, `/api/sequence`, `/api/parse-stash`): Uses `client.messages.create()`, strips markdown fences, then `JSON.parse()`. Prompts say "Return ONLY valid JSON, no markdown, no backticks". Parse failures return `{ error: '...' }` with status 500. Use the shared `stripJsonFences()` helper from `@/lib/colour` rather than re-inlining `.replace(/```json|```/g, '').trim()`. `/api/identify` additionally falls back to extracting the outermost `{...}` block, checks `stop_reason === 'max_tokens'` before parsing, and returns 502 (not 500) for AI-side failures; `/api/make` retries the call once before giving up. Images are downscaled client-side to 1568px JPEG via `src/lib/imagePrep.ts` before upload — never send raw camera files (Vercel caps request bodies at 4.5MB).

2. **Streaming** (`/api/advice`, `/api/codesign`): Uses `client.messages.stream()` and hands it to `streamTextResponse()` from `@/lib/apiRequest`, which awaits the first event before answering (so an upstream failure is a 502, not a 200 with an empty body), pipes text deltas into a `text/plain` `ReadableStream`, and cancels the upstream if the reader goes away. The client reads with `readTextStream()` from `@/lib/streamText` — never `decoder.decode(value)` without `{ stream: true }`, which corrupts multi-byte characters split across chunks.

Every AI route uses the same model, exported as `MODEL` from `src/lib/apiRequest.ts` (currently `claude-sonnet-5-5`). Import it rather than inlining the id — it was inlined at eight call sites, so a model change meant eight edits and a missed one left a route silently on the old model.

## Image Generation

`/api/make/image`: used by Make and Co-design, both **on demand** via a "Render preview" button — never automatically, since every design or revision would otherwise be a paid render (Make rendered after every design and refine until it was changed). The route rebuilds the design field by field with length caps before prompting. Claude first generates an optimised image prompt (under 850 chars) from the design JSON, then calls OpenAI's `gpt-image-2` model at `1024x1024` / `medium` quality (`high` is ~4× the price for a reference picture). GPT image models always return base64 (`b64_json`) — the `url` response format DALL·E used isn't supported — so the route wraps it in a `data:image/png;base64,…` URI and returns `{ imageUrl }`. The route returns `501` if `OPENAI_API_KEY` is not set, and `429` once the user has used `IMAGE_DAILY_CAP` renders in 24h (`takeDailyAllowance()` in `src/lib/dailyCap.ts`, counted in the `usage_events` table; fails open and logs if the table is unreachable). (Note: OpenAI removed `dall-e-3` from the API on 2026-05-12; GPT image models also require organization verification to call.)

## Shared Route Helpers

`src/lib/apiRequest.ts` holds the plumbing every API route repeats. Use it rather than re-inlining a copy:

- `getToken(req)` — bearer token, or `''` when absent.
- `parseBody(req)` — `null` when the body is not valid JSON (answer 400), `{}` when it parses to a non-object (a number, string, `null`, or array) so the caller falls through to its own field validation.
- `firstTextBlock(msg)` — the first `type: 'text'` block of an Anthropic response, `''` if there is none. **Never read `content[0]` directly** — that assumes the first block is text, so a leading non-text block silently yields `''` and the route reports a parse failure for a good response.
- `truncStr(v, max)` — clamp a prompt field; non-strings become `''` rather than being coerced, so an object's `toString` cannot smuggle text past the cap.
- `STREAM_ERROR_MARKER` — appended in-band when a stream dies partway. Past the first chunk the status line is already sent, so this is the only way to tell the reader the text is incomplete.
- `streamTextResponse(stream, label)` — the whole streaming response for `/api/advice` and `/api/codesign`; see AI Response Patterns.
- `withEffort(level)` — spread into every non-streaming `messages.create()`. On `claude-sonnet-5-5`, omitting `output_config` runs adaptive thinking at default effort: those tokens bill as output and count against `max_tokens`. Levels in use: `medium` for `/api/make` and `/api/identify`, `low` for the image-prompt writer, `/api/parse-stash` and `/api/sequence`. Do not pass `temperature`/`top_p`/`top_k` — non-default sampling values are rejected on this model.
- `logUsage(label, msg)` — one `ai-usage` JSON line (input/output/cache tokens, stop reason) per call; grep the runtime logs for it to see real cost and whether a reply was cut off by `max_tokens`.

`src/lib/richText.ts` is the single HTML escaper and formatter for everything rendered through `dangerouslySetInnerHTML` (the guide body, the advisor answer, the co-design chat bubble). Call `formatRichText(text, PRESET)` with `GUIDE_PROSE`, `ADVISOR_ANSWER` or `CHAT_MESSAGE`. **Escaping runs over the raw text before any markdown replacement** — reversing that order would let markup in the source survive as live HTML. Do not add a fourth local escaper.

## Shared Design Vocabulary

`/api/make` and `/api/codesign` both produce buildable designs, so the parts of their prompts that must agree live in `src/lib/designVocab.ts` rather than in each route: `ALLOWED_TECHNIQUES` (also used to validate `steps[].technique`), the technique glossary, the difficulty rubric, the repeating-step rule, the `ASSEMBLY_*` block, and the `VALID_STYLES` allowlist with its descriptors. Change it there — never inline a copy into a prompt, or the two routes drift.

The Make page imports `VALID_STYLES` / `STYLE_LABELS` / `STYLE_DESCRIPTIONS` from the same module for its style selector, so the UI cannot offer a style the API would reject.

## Design Reference Pool

`src/data/referencePool.json` holds 157 tagged references from a Pinterest inspiration board, read through `src/lib/referencePool.ts`. It is **descriptive, not prescriptive** — it exists to widen the range Strung can draw on. The four styles in `designVocab.ts` remain the only firm aesthetic constraint; **never feed the pool to a design prompt as a style constraint**, and never let it narrow what the app will generate.

149 records are tagged, 6 are tutorial graphics marked `status: 'excluded'`, and 2 are duplicate images marked `status: 'duplicate'` pointing at the record that carries the tags. Filter with `isTagged()` or use the pre-filtered `TAGGED_REFERENCES`.

Every value comes from the image, not from the source board's keyword tags (those were unreliable and are not used). Fields are controlled vocabularies published in the JSON's `vocabulary` block so the tags merge with other sources; a test asserts both that nothing uses an unpublished value and that nothing is published that tags nothing. `technique_hints` is constrained to `ALLOWED_TECHNIQUES` and `strung_style_affinity` to `VALID_STYLES`, so neither can drift from `designVocab.ts`.

**Uncertainty is part of the data.** Material and metal names are visual guesses — 232 of 315 material entries are `confidence: 'uncertain'` and carry `alternatives`. Surface them as guesses or not at all; never state one as fact. No measurement was taken from any image: `dimensions.range_mm` is null unless a hand in frame gave a scale reference, and where present `estimated` is true.

`findReferences(query)` ands across fields and ors within one. `sampleVariedReferences(count, seed)` spreads a deterministic sample across distinct forms so a sample reads as a range rather than one silhouette repeated.

**Nothing consumes this yet** — it is data plus a loader, deliberately not wired into any route, because wiring it into `/api/make` is exactly the move that would turn a variety pool into a style constraint. Decide a consumer before it ages into the same dead weight as the palette exports below.

## Design Assembly

`assembly` is an **optional** top-level field on a design: `{ form: 'strand' | 'drop' | 'branched', anchor, strands[] }`, where each strand has an `attachAt`, a `repeat` count and `elements` ordered top to bottom. It describes arrangement only — every item it names must already appear in `components[]`.

`src/lib/assembly.ts` holds everything runtime about it: `validateAssembly()` (called from `validateDesign()` in `/api/make`, so failures feed the existing one-shot repair retry; called again on the parsed blueprint in the codesign page, which streams and so has no retry — an invalid assembly is dropped there), `normaliseAssembly()` and the branched layout maths. The prompt schema and rules live in `designVocab.ts` as `ASSEMBLY_SCHEMA_TEXT` (pretty, for `/api/make`), `ASSEMBLY_SCHEMA_COMPACT` (one line, for the codesign blueprint) and `ASSEMBLY_RULES`; all three derive from one shape object so the routes cannot drift.

`src/components/Schematic.tsx` picks its layout from `normaliseAssembly()`: null (no assembly, `form: 'strand'`, or an unusable shape) renders the original single column, anything else renders the branched diagram — an anchor glyph at top centre with each strand hanging below it. `builds.design` is jsonb and rows saved before this field exist, so the single column must stay the default.

## Supabase Access

### Client-side
`src/lib/supabase.ts` exports the singleton `supabase` client (used for auth session management). `src/lib/authClient.ts` exports `getAuthHeaders()` and `getSession()` for use in `'use client'` components.

### Server-side (API routes)
**All API routes that read or write user data must filter rows by `user_id`.**

Use `getAuthenticatedClient(token)` from `@/lib/auth` to create a Supabase client with the user's JWT in the `Authorization` header so Row Level Security (RLS) applies. Use `getUserFromRequest(request)` to extract the `User` object from the `Authorization: Bearer <token>` header.

```typescript
import { getUserFromRequest, getAuthenticatedClient } from '@/lib/auth'

export async function GET(request: Request) {
  const user = await getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const supabase = getAuthenticatedClient(request.headers.get('Authorization')!.replace('Bearer ', ''))
  // ...
}
```

Do **not** use the singleton client from `src/lib/supabase.ts` in API routes — RLS will not apply.

### Database tables

The Supabase database requires three tables (plus an optional fourth, `usage_events`, which backs the daily image cap — see README):

| Table | Type exported from |
|---|---|
| `beads` | `BeadItem` in `src/lib/supabase.ts` |
| `findings` | `FindingItem` in `src/lib/supabase.ts` |
| `builds` | no exported type — shape defined inline in pages |

`src/lib/supabase.ts` exports only `BeadItem` and `FindingItem`. There is no `DesignItem` type and no `designs` table — saved designs are stored as the `design` jsonb column on `builds`.

Only `beads` and `findings` are writable through `/api/inventory`; the allowlist lives in `ALLOWED_TABLES` / `isAllowedTable()` in `@/lib/colour`, and any new table reachable by a `?table=` param must be added there — along with its field rules in `cleanStashInput()`.

The canonical `CREATE TABLE` SQL — including the `user_id` column on every table, `user_id` indexes, and per-user RLS policies — lives in README.md → "Set up the database". All three tables are per-user: the API filters every query by `user_id` and RLS enforces it. A table created without `user_id`/RLS will not work with these routes, and a missing table surfaces as PostgREST error `PGRST205` (logged server-side; the UI shows the sanitized "Database error").

`builds.rating` is `text` (`loved_it` / `good` / `could_be_better`), not an integer.

## Build Completion & Stash Decrement

When a build is marked complete, `/make/build/[id]` offers to subtract the materials used from the stash. It matches `design.components[].item` against bead and finding **names** using a trim + lowercase comparison, checking beads first, then findings. Unmatched components are skipped silently, and quantities are rounded to whole numbers and floor at 0.

This is deliberately best-effort — completion has already been persisted by the time it runs, so failures never undo it. Each PATCH's response is checked, though (`fetch` resolves on a 4xx/5xx), and the note says how many rows were updated, or that none matched — it used to report success regardless. Because matching is name-based, a design component whose wording drifts from the stash entry will simply not decrement. Keep that in mind before relying on stash counts being exact.

## Styling Conventions

No CSS framework. Two layers:

- **Utility classes** in `src/app/globals.css`: `.card`, `.btn-silver`, `.btn-outline`, `.btn-ghost`, `.btn-gold`, `.tag`, `.input-base`, `.select-base`, `.label`, `.spinner`, `.spinner-dark`, `.section-eyebrow`, `.fade-up` through `.fade-up-4`, `.mono`, `.prose`.
- **Inline styles** for layout, spacing, and one-off values — used heavily throughout.

CSS custom properties (`:root`) handle the colour palette. Use variables in all new code: `var(--silver)`, `var(--moonstone)`, `var(--rose)`, `var(--surface)`, `var(--border)`, etc.

Fonts: `var(--font-display)` = Instrument Serif (headings), `var(--font-body)` = Instrument Sans (UI + prose), `var(--font-serif)` = Newsreader italic (marginalia only), `var(--font-mono)` = DM Mono (labels/tags/meta).

Fonts are **self-hosted** via `next/font/local` from `src/app/fonts/` (latin-subset woff2 plus each family's OFL licence). Do not switch back to `next/font/google`: it downloads from Google during the build, and a failed download fails the whole build with "Build failed because of webpack errors". The CSP `font-src` is `'self'` only, so a font loaded from a third-party URL will also be blocked at runtime. To add a weight, download its woff2 into that folder and add it to `layout.tsx`.

**Text colour vs UI colour.** `--madder` (#C4564C) is 3.74:1 on `--mocha` cards — fine for borders, dots and focus rings (WCAG 1.4.11 asks 3:1 of non-text) but under the 4.5:1 AA floor for the 10–11px mono caps it was being used at. Small text on the accent uses `--madder-text` (#D17A72, 5.60:1); `--madder` itself is unchanged and stays for every non-text use. Likewise `--field-edge` (#6E6A66, 3.31:1 on `--roast`) is the input/select border — `--seam` was 1.62:1 there, an effectively invisible control boundary. Every token keeps R > G ≥ B per DESIGN Rule 1.

**Responsive layout.** Horizontal page padding comes from `.page-pad` (40px, stepping down to 20px and 14px on phones) — set only `paddingTop`/`paddingBottom` inline, never `padding: '52px 40px …'`. Two- and three-column grids use `.blueprint-grid` / `.form-grid-3` / `.stats-grid-4`, which collapse on narrow screens; an inline `gridTemplateColumns` does not.

**Page shell.** Every page renders `<main id="main" className="page-main">` rather than repeating `paddingTop: 60` / `minHeight: '100vh'` inline. `.page-main` carries both, and `id="main"` is the target of the `.skip-link` that `Nav` renders as the first focusable element on the page. Use `100dvh`, never `100vh` — mobile browser chrome makes `100vh` overflow the viewport.

## Path Alias

`@/` maps to `src/`. Examples: `@/lib/supabase`, `@/lib/auth`, `@/lib/authClient`, `@/components/Nav`.

## Known Constraints

- **Vercel**: Root directory must be set to `strung/`. Do not add a `vercel.json` with a `builds` key.
- **Next.js 15**: Components that use event handlers or browser APIs must have `'use client'` at the top.
- All pages are `'use client'` React components.
