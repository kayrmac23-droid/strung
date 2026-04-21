# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Strung is an AI-powered beaded jewellery design studio built with Next.js 15 (App Router), TypeScript, the Anthropic SDK, and Supabase. The Next.js app lives in the `strung/` subdirectory — all commands below must be run from there.

## Commands

```bash
cd strung
npm install        # install dependencies
npm run dev        # start dev server at localhost:3000
npm run build      # type-check and build for production
npm run start      # serve the production build
```

There is no test runner or lint script configured.

## Required Environment Variables

Create `strung/.env.local`:

```
ANTHROPIC_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The Supabase database requires two tables: `beads` and `findings`, matching the `BeadItem` and `FindingItem` types defined in `src/lib/supabase.ts`.

## Architecture

### Pages → API → External Services

Each page is a `'use client'` React component. Pages that need AI or data call Next.js API routes, which in turn call Claude or Supabase:

| Page | API route(s) | What Claude does |
|---|---|---|
| `/inventory` | `/api/inventory` | None — CRUD only via Supabase |
| `/inspire` | `/api/inventory` + `/api/blueprints` | Reads user's actual stash, generates 3 distinct design blueprints as structured JSON |
| `/design` | `/api/design` | Generates a full design brief (components, steps, tools, variations) as structured JSON |
| `/advisor` | `/api/advice` | Streams a jewellery advice response (SSE-style `ReadableStream`) |
| `/palette` | None | Purely client-side gem/metal harmony scoring — no backend |
| `/guides` | None | Static content |
| `/glossary` | None | Static content |

### AI Response Patterns

Two patterns are used across the API routes:

1. **Streaming** (`/api/advice`): Uses `client.messages.stream()`, pipes `content_block_delta` chunks into a `ReadableStream`, returns `text/plain`. The client reads with `res.body.getReader()`.

2. **JSON** (`/api/blueprints`, `/api/design`, `/api/palette`): Uses `client.messages.create()`, strips markdown fences with `.replace(/\`\`\`json|\`\`\`/g, '').trim()`, then `JSON.parse()`. All three routes ask Claude to return "ONLY valid JSON, no markdown, no backticks" in the prompt. If parsing fails, they return `{ error: '...' }` with status 500.

All AI routes use model `claude-sonnet-4-20250514`.

### Supabase Access

`src/lib/supabase.ts` exports a singleton client and the `BeadItem`/`FindingItem` types. The `/api/inventory` route creates its own client via `getClient()` rather than importing the singleton — this is intentional for server-side use.

The inventory route handles GET (fetch both tables), POST (insert), DELETE (by id), and PATCH (update) — all validated against an allowlist of `['beads', 'findings']`.

### Styling Conventions

There is no CSS framework. Styling uses two layers:

- **Utility classes** defined in `src/app/globals.css`: `.card`, `.btn-silver`, `.btn-outline`, `.btn-ghost`, `.btn-gold`, `.tag`, `.input-base`, `.select-base`, `.label`, `.spinner`, `.spinner-dark`, `.section-eyebrow`, `.fade-up` through `.fade-up-4`, `.mono`, `.prose`.
- **Inline styles** for layout, spacing, and one-off values — used heavily throughout every page.

CSS custom properties (defined in `:root`) handle the colour palette. All colour references in new code should use these variables (e.g. `var(--silver)`, `var(--moonstone)`, `var(--rose)`, `var(--surface)`, `var(--border)`).

Fonts: `var(--font-display)` = Playfair Display (headings), `var(--font-body)` = Cormorant Garamond (prose), `var(--font-mono)` = DM Mono (labels, tags, meta).

### Path Alias

`@/` maps to `src/`. Import shared types and the Supabase client as `@/lib/supabase`, and the Nav component as `@/components/Nav`.
