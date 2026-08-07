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

Supabase email/password auth. **Almost everything requires a session.** `/api/sequence` is the only route with no auth check — the Palette page is the one feature that fully works signed out. Every other route calls `getUserFromRequest(req)` and returns 401 when there is no user (`/api/builds` GET is the exception: it returns `[]` rather than 401).

Client-side, `getSession()` from `@/lib/authClient` checks auth state before save actions, and `getAuthHeaders()` attaches the bearer token. Pages that can render signed-out (e.g. `/make`) track a `signedOut` flag by checking for `res.status === 401` on their initial fetch.

## Pages

| URL | Nav label | Description |
|---|---|---|
| `/` | — | Landing / home |
| `/inventory` | Stash | Bead + findings CRUD, photo identification, bulk text stash parsing |
| `/make` | Make | AI design generator + refinement + GPT Image preview |
| `/make/build/[id]` | — | Step-by-step build mode; optional stash decrement on completion |
| `/sequence` | Palette | Colour palette + repeating bead sequence generator |
| `/codesign` | — | Conversational AI co-designer |
| `/journal` | Journal | Saved and completed builds |
| `/account` | Account | Sign in / sign up |
| `/auth/callback` | — | Supabase OAuth callback |
| `/guides` | Learn | Jewellery guides + streaming AI advisor scoped to the open guide section |
| `/glossary` | — | Static glossary (active under Learn nav item) |
| `/calculator` | — | Utility calculator |
| `/not-found` | — | 404 |

Nav has 5 primary items (Stash, Make, Palette, Learn, Journal) plus Account. Note the mismatch between route and label: `/sequence` is labelled **Palette**.

## API Routes

| Route | Method(s) | Auth | What it does |
|---|---|---|---|
| `/api/inventory` | GET, POST, DELETE, PATCH | yes — 401 on all methods | CRUD for `beads` and `findings` tables |
| `/api/make` | POST | yes — 401 | AI generates one design as structured JSON. Validates `pieceType` and `style` against allowlists (`style` is the firm aesthetic constraint; `mood` stays optional free text underneath it). Accepts `previousDesign` + `adjustment` for refinement, and `recentTitles` to avoid repeats. Retries once on parse failure |
| `/api/make/image` | POST | yes — 401 | Builds an image prompt via Claude, calls OpenAI GPT Image 2 (`gpt-image-2`) |
| `/api/builds` | GET, POST, DELETE, PATCH | yes — GET returns `[]` without auth, others 401 | CRUD for `builds` table. `GET ?id=` returns a single build or 404 |
| `/api/sequence` | POST | **no** | Colour palette + bead sequence JSON. Validates `harmonyType` / `pieceType` against allowlists, sanitises `anchorFamily`, caps `beads` at 100 |
| `/api/codesign` | POST | yes — 401 | Streaming co-design chat (Claude) |
| `/api/advice` | POST | yes — 401 | Streaming jewellery advice (Claude) |
| `/api/identify` | POST | yes — 401 | Vision identification (Claude). Default: single bead (`kind: 'bead'`) or finding (`kind: 'finding'`). With `mode: 'multi'`: identifies every distinct bead/finding group in one photo, returns `{ beads: [], findings: [] }` with per-item `confidence` (`certain`/`likely`/`unsure`), normalised via `src/lib/stashItems.ts` |
| `/api/parse-stash` | POST | yes — 401 | Parses a plain-text stash description into `{ beads: [], findings: [] }` for the review flow (Claude) |

There is no `/api/designs` route.

## AI Response Patterns

Two patterns:

1. **JSON** (`/api/make`, `/api/identify`, `/api/sequence`, `/api/parse-stash`): Uses `client.messages.create()`, strips markdown fences, then `JSON.parse()`. Prompts say "Return ONLY valid JSON, no markdown, no backticks". Parse failures return `{ error: '...' }` with status 500. Use the shared `stripJsonFences()` helper from `@/lib/colour` rather than re-inlining `.replace(/```json|```/g, '').trim()`. `/api/identify` additionally falls back to extracting the outermost `{...}` block, checks `stop_reason === 'max_tokens'` before parsing, and returns 502 (not 500) for AI-side failures; `/api/make` retries the call once before giving up. Images are downscaled client-side to 1568px JPEG via `src/lib/imagePrep.ts` before upload — never send raw camera files (Vercel caps request bodies at 4.5MB).

2. **Streaming** (`/api/advice`, `/api/codesign`): Uses `client.messages.stream()`, pipes `content_block_delta` chunks into a `ReadableStream`, returns `text/plain`. The client reads with `res.body.getReader()`.

Every AI route uses model `claude-sonnet-4-6`.

## Image Generation

`/api/make/image`: Claude first generates an optimised image prompt (under 850 chars) from the design JSON, then calls OpenAI's `gpt-image-2` model at `1024x1024` / `high` quality. GPT image models always return base64 (`b64_json`) — the `url` response format DALL·E used isn't supported — so the route wraps it in a `data:image/png;base64,…` URI and returns `{ imageUrl }`. The route returns `501` if `OPENAI_API_KEY` is not set. (Note: OpenAI removed `dall-e-3` from the API on 2026-05-12; GPT image models also require organization verification to call.)

## Shared Design Vocabulary

`/api/make` and `/api/codesign` both produce buildable designs, so the parts of their prompts that must agree live in `src/lib/designVocab.ts` rather than in each route: `ALLOWED_TECHNIQUES` (also used to validate `steps[].technique`), the technique glossary, the difficulty rubric, the repeating-step rule, the `ASSEMBLY_*` block, and the `VALID_STYLES` allowlist with its descriptors. Change it there — never inline a copy into a prompt, or the two routes drift.

The Make page imports `VALID_STYLES` / `STYLE_LABELS` / `STYLE_DESCRIPTIONS` from the same module for its style selector, so the UI cannot offer a style the API would reject.

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

The Supabase database requires three tables:

| Table | Type exported from |
|---|---|
| `beads` | `BeadItem` in `src/lib/supabase.ts` |
| `findings` | `FindingItem` in `src/lib/supabase.ts` |
| `builds` | no exported type — shape defined inline in pages |

`src/lib/supabase.ts` exports only `BeadItem` and `FindingItem`. There is no `DesignItem` type and no `designs` table — saved designs are stored as the `design` jsonb column on `builds`.

Only `beads` and `findings` are writable through `/api/inventory`; the allowlist lives in `ALLOWED_TABLES` / `isAllowedTable()` in `@/lib/colour`, and any new table reachable by a `?table=` param must be added there.

The canonical `CREATE TABLE` SQL — including the `user_id` column on every table, `user_id` indexes, and per-user RLS policies — lives in README.md → "Set up the database". All three tables are per-user: the API filters every query by `user_id` and RLS enforces it. A table created without `user_id`/RLS will not work with these routes, and a missing table surfaces as PostgREST error `PGRST205` (logged server-side; the UI shows the sanitized "Database error").

`builds.rating` is `text` (`loved_it` / `good` / `could_be_better`), not an integer.

## Build Completion & Stash Decrement

When a build is marked complete, `/make/build/[id]` offers to subtract the materials used from the stash. It matches `design.components[].item` against bead and finding **names** using a trim + lowercase comparison, checking beads first, then findings. Unmatched components are skipped silently, and quantities floor at 0.

This is deliberately best-effort — completion has already been persisted by the time it runs, so failures are swallowed and surfaced only as a note in the UI. Because matching is name-based, a design component whose wording drifts from the stash entry will simply not decrement. Keep that in mind before relying on stash counts being exact.

## Styling Conventions

No CSS framework. Two layers:

- **Utility classes** in `src/app/globals.css`: `.card`, `.btn-silver`, `.btn-outline`, `.btn-ghost`, `.btn-gold`, `.tag`, `.input-base`, `.select-base`, `.label`, `.spinner`, `.spinner-dark`, `.section-eyebrow`, `.fade-up` through `.fade-up-4`, `.mono`, `.prose`.
- **Inline styles** for layout, spacing, and one-off values — used heavily throughout.

CSS custom properties (`:root`) handle the colour palette. Use variables in all new code: `var(--silver)`, `var(--moonstone)`, `var(--rose)`, `var(--surface)`, `var(--border)`, etc.

Fonts: `var(--font-display)` = Playfair Display (headings), `var(--font-body)` = Cormorant Garamond (prose), `var(--font-mono)` = DM Mono (labels/tags/meta).

## Path Alias

`@/` maps to `src/`. Examples: `@/lib/supabase`, `@/lib/auth`, `@/lib/authClient`, `@/components/Nav`.

## Known Constraints

- **Vercel**: Root directory must be set to `strung/`. Do not add a `vercel.json` with a `builds` key.
- **Next.js 15**: Components that use event handlers or browser APIs must have `'use client'` at the top.
- All pages are `'use client'` React components.
