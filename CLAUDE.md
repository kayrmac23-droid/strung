# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Strung is an AI-powered beaded jewellery design studio. Stack: Next.js 15 (App Router), TypeScript, Supabase (auth + database), Anthropic SDK (Claude), and OpenAI (DALL-E 3 image generation). The Next.js app lives in the `strung/` subdirectory — all commands below must be run from there.

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
OPENAI_API_KEY=...          # required for DALL-E 3 image generation
```

## Core Loop

**Stash → Make → Build → Journal**

1. User adds beads and findings to their Stash (`/inventory`)
2. AI reads the stash and generates a bespoke design on the Make page (`/make`)
3. User steps through the build instructions on the Build page (`/make/build/[id]`)
4. Completed and saved-for-later pieces appear in the Journal (`/journal`)

## Auth

Supabase email/password auth. Auth is **optional** — unauthenticated users can generate designs but cannot save them. Saving always requires a session. The `getSession()` helper from `@/lib/authClient` is used client-side to check auth state before save actions.

## Pages

| URL | Nav label | Description |
|---|---|---|
| `/` | — | Landing / home |
| `/inventory` | Stash | Bead + findings CRUD |
| `/make` | Make | AI design generator |
| `/make/build/[id]` | — | Step-by-step build mode |
| `/codesign` | — | Conversational AI co-designer |
| `/journal` | Journal | Saved and completed builds |
| `/account` | Account | Sign in / sign up |
| `/auth/callback` | — | Supabase OAuth callback |
| `/guides` | Learn | Static jewellery guides |
| `/glossary` | — | Static glossary (active under Learn nav item) |
| `/calculator` | — | Utility calculator |

Nav has 4 primary items (Stash, Make, Learn, Journal) plus Account.

## API Routes

| Route | Method(s) | Auth required | What it does |
|---|---|---|---|
| `/api/inventory` | GET, POST, DELETE, PATCH | optional (GET returns empty without auth) | CRUD for `beads` and `findings` tables |
| `/api/make` | POST | no | AI generates one design as structured JSON |
| `/api/make/image` | POST | no | Builds a DALL-E 3 prompt via Claude, calls OpenAI DALL-E 3 |
| `/api/builds` | GET, POST, DELETE, PATCH | yes (GET returns `[]` without auth) | CRUD for `builds` table |
| `/api/designs` | GET, POST, DELETE, PATCH | yes | CRUD for `designs` table |
| `/api/codesign` | POST | no | Streaming co-design chat (Claude) |
| `/api/advice` | POST | no | Streaming jewellery advice (Claude) |
| `/api/identify` | POST | yes | Vision identification (Claude). Default: single bead (`kind: 'bead'`) or finding (`kind: 'finding'`). With `mode: 'multi'`: identifies every distinct bead/finding group in one photo, returns `{ beads: [], findings: [] }` with per-item `confidence` (`certain`/`likely`/`unsure`), normalised via `src/lib/stashItems.ts` |
| `/api/parse-stash` | POST | yes | Parses a plain-text stash description into `{ beads: [], findings: [] }` for the review flow (Claude) |

## AI Response Patterns

Two patterns:

1. **JSON** (`/api/make`, `/api/identify`): Uses `client.messages.create()`, strips markdown fences with `.replace(/```json|```/g, '').trim()`, then `JSON.parse()`. Prompts say "Return ONLY valid JSON, no markdown, no backticks". Parse failures return `{ error: '...' }` with status 500. `/api/identify` additionally falls back to extracting the outermost `{...}` block, checks `stop_reason === 'max_tokens'` before parsing, and returns 502 (not 500) for AI-side failures. Images are downscaled client-side to 1568px JPEG via `src/lib/imagePrep.ts` before upload — never send raw camera files (Vercel caps request bodies at 4.5MB).

2. **Streaming** (`/api/advice`, `/api/codesign`): Uses `client.messages.stream()`, pipes `content_block_delta` chunks into a `ReadableStream`, returns `text/plain`. The client reads with `res.body.getReader()`.

All AI routes use model `claude-sonnet-4-6` except `/api/advice` which uses `claude-sonnet-4-20250514`.

## Image Generation

`/api/make/image`: Claude first generates an optimised DALL-E prompt (under 850 chars) from the design JSON, then calls OpenAI's `dall-e-3` model at `1024x1024` / `hd` quality. Returns `{ imageUrl }`. The route returns `501` if `OPENAI_API_KEY` is not set.

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

The Supabase database requires these tables:

| Table | Type exported from |
|---|---|
| `beads` | `BeadItem` in `src/lib/supabase.ts` |
| `findings` | `FindingItem` in `src/lib/supabase.ts` |
| `builds` | no exported type — shape defined inline in pages |
| `designs` | `DesignItem` in `src/lib/supabase.ts` |

Shared types (`BeadItem`, `FindingItem`, `DesignItem`) live in `src/lib/supabase.ts`. Import them as `@/lib/supabase`.

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
