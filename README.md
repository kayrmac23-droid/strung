# Strung

An AI-powered beaded jewellery design studio. Track your bead stash, generate designs from what you actually own, build them step by step, and log every finished piece.

---

## The Core Loop

**Stash → Make → Build → Journal**

1. Add your beads and findings to the **Stash**
2. The AI reads your stash and generates a bespoke design on **Make**
3. Step through the instructions in **Build** mode
4. Finished and saved pieces live in your **Journal**

Signed in, home is the **Bench**: your stash on one thread, the build you're partway through, what's running low, and ideas you saved for later.

---

## Features

| Page | Nav | What it does |
|---|---|---|
| **Landing** (`/`) | — | Public front page. Public nav: How it works · Sign in · Start free (or "Open studio" when signed in). |
| **How it works** (`/how-it-works`) | How it works | Public five-step explainer. Public pages only ever draw illustrative beads, never anyone's real stash. |
| **Bench** (`/bench`) | Bench | Signed-in home, built only from your own data: the stash on one thread, the build in progress, beads running low (fewer than ten left), and saved ideas. |
| **Stash** (`/inventory`) | Stash | A ledger of every bead and finding you own — name, type, colour, size, quantity — with a colour-spectrum filter and a detail panel with ± quantity. Photograph a tray of beads and Claude identifies every distinct group in the photo, or paste a plain-text description of your whole stash; either way you review the parsed items before saving. |
| **Make** (`/make`) | Make | Write the brief as a sentence — piece, mood, style and how much time you have. Claude reads your stash and generates one complete, buildable design — components, colour story, and numbered steps — keeping techniques, difficulty, and metal-tone cohesion consistent (structural findings match the anchor's warm or cool tone family). Materials show need vs. have against your stash. Refine it in plain language, or try another. View it two ways: a **Diagram** — a deterministic SVG schematic that lays the design out in your stash's real colours, shapes and sizes, as a single strand or, for drops and chandeliers, a branched arrangement hanging from an anchor — or a **Render**, an AI image made only when you press "Render preview". Save it or start building. |
| **Co-design** (`/codesign`) | Make → Co-design | Chat-based AI co-designer. Describe what you're imagining and build a full design together — with the same Diagram as Make and the same on-demand Render — then save it straight to your builds. |
| **Palette** (`/sequence`) | Make → Palette | Choose a colour harmony, an anchor colour family, and a piece type. Claude returns a 3–5 colour palette, a repeating bead sequence with a pattern unit, a metal recommendation, and any close matches from your stash. "Daylight proof" lays the strand on calico for a colour check. |
| **Build** (`/make/build/[id]`) | — | Step-by-step build mode with its own bar and sticky Back/Next. Tracks your current step, time taken, notes, and a rating. On completion it offers to subtract the materials you used from your stash (best-effort — see below). |
| **Journal** (`/journal`) | Journal | Every saved build, filterable by Ideas, On the bench, and Finished. |
| **Learn** (`/guides`) | Learn | Wire wrapping, crimping, head pins, earring construction, and more — with a streaming AI advisor that answers in the context of the guide section you're reading. |
| **Glossary** (`/glossary`) | Learn | Quick-reference definitions for jewellery-making terms. |
| **Bead math** (`/calculator`) | Learn | How many beads a piece needs — with length, size, knotting, and strand options — plus wire length and an approximate weight. |
| **Account** (`/account`) | avatar | Sign in / sign up. |

Make, Co-design and Palette are three tabs of one tool (`MakeTabs`). On phones, Bench · Stash · Make · Journal move to a bottom tab bar.

**You need an account for almost everything.** The Palette page is the only feature that works fully signed out — every other AI and data route requires a session.

**Stash decrement is name-based.** When a build is completed, each design component is matched to a stash bead or finding by exact name (trimmed, case-insensitive). A component whose wording drifts from your stash entry is skipped, so don't treat stash counts as exact.

---

## Tech Stack

- **Framework** — Next.js 15 (App Router)
- **Language** — TypeScript
- **AI** — Anthropic Claude (`claude-sonnet-5-5`, set once as `MODEL` in `src/lib/apiRequest.ts`) via the Anthropic SDK — text, streaming, and vision
- **Image generation** — OpenAI GPT Image 2 (`/api/make/image`)
- **Database** — Supabase (PostgreSQL, per-user rows with Row Level Security)
- **Styling** — CSS custom properties + inline styles (no CSS framework)
- **Fonts** — Gloock (headings), Instrument Sans (UI and body), Newsreader italic (marginalia) and DM Mono (labels), self-hosted via `next/font/local` — never `next/font/google`, which fails the build when the download does
- **Testing** — Vitest + Testing Library
- **CI** — GitHub Actions (`.github/workflows/ci.yml`): `npm ci`, lint, test, build on Node 22, with no environment variables set

---

## API Routes

| Route | Methods | Auth | What it does |
|---|---|---|---|
| `/api/inventory` | GET, POST, PATCH, DELETE | yes | CRUD for `beads` and `findings`. Writes are validated per field (enums, `#rrggbb` hex, whole-number quantity, length caps) |
| `/api/make` | POST | yes | Generates one design as structured JSON; also handles refinements. Validates `pieceType` and `style` against allowlists, and retries once on a truncated or invalid reply (`502` if both fail) |
| `/api/make/image` | POST | yes | Claude writes an image prompt from the design, then calls OpenAI GPT Image 2 (`gpt-image-2`, 1024×1024, `medium` quality). Only ever called on demand. Returns `501` without `OPENAI_API_KEY`, `429` past the daily cap |
| `/api/sequence` | POST | **no** | Colour palette + repeating bead sequence, with stash matching |
| `/api/builds` | GET, POST, PATCH, DELETE | yes | CRUD for `builds`. The list GET returns `[]` when signed out rather than erroring; `GET ?id=` returns 401. Writes are validated, and a design's preview image is never stored |
| `/api/codesign` | POST | yes | Streaming co-design chat. The message history is rebuilt from validated blocks before it reaches Claude |
| `/api/advice` | POST | yes | Streaming jewellery advice (used by the guides page) |
| `/api/identify` | POST | yes | Vision identification: every distinct bead/finding group in one photo, each with a `certain` / `likely` / `unsure` confidence |
| `/api/parse-stash` | POST | yes | Parses a plain-text stash description into beads and findings |

All AI routes use `claude-sonnet-5-5`. Images are downscaled client-side to 1568px JPEG before upload (Vercel caps request bodies at 4.5MB). The streaming routes wait for the first event before answering, so an upstream failure comes back as a `502` rather than a `200` with an empty body.

Every API route is rate limited with an in-memory fixed window — keyed per user, or per IP for the public `/api/sequence` route — and returns `429` with a `Retry-After` header when the window is full. The AI routes allow 10–30 calls a minute (the image route is the tightest at 10); the plain CRUD routes allow 120. The limit is per serverless instance, so it's a first line of defence against runaway loops, not a strict global billing cap. The image route also has a real cross-instance cap — 25 renders per user per 24 hours, stored in Supabase (see the optional `usage_events` table below).

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/kayrmac23-droid/strung.git
cd strung/strung
npm install
```

### 2. Set up environment variables

Create `strung/.env.local`:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=your_openai_api_key   # required for GPT Image 2 images (/api/make/image returns 501 without it)
```

### 3. Set up the database

Run the following SQL in your Supabase dashboard (SQL Editor → New query). Every table is per-user: each row carries a `user_id`, the API filters every query by it, and Row Level Security enforces it at the database layer.

```sql
create table public.beads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null,
  colour text not null default '',
  hex text not null default '#888888',
  size text not null default '',
  quantity integer not null default 1,
  shape text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.findings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  type text not null,
  metal text not null,
  size text,
  quantity integer not null default 1,
  notes text,
  created_at timestamptz not null default now()
);

create table public.builds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  design jsonb not null,
  status text not null default 'draft',
  current_step integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  time_taken_minutes integer,
  notes text,
  rating text,
  created_at timestamptz not null default now()
);

create index beads_user_id_idx on public.beads (user_id);
create index findings_user_id_idx on public.findings (user_id);
create index builds_user_id_idx on public.builds (user_id);

alter table public.beads enable row level security;
alter table public.findings enable row level security;
alter table public.builds enable row level security;

-- Each user can only touch their own rows.
create policy "beads_select_own"    on public.beads    for select using (auth.uid() = user_id);
create policy "beads_insert_own"    on public.beads    for insert with check (auth.uid() = user_id);
create policy "beads_update_own"    on public.beads    for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "beads_delete_own"    on public.beads    for delete using (auth.uid() = user_id);

create policy "findings_select_own" on public.findings for select using (auth.uid() = user_id);
create policy "findings_insert_own" on public.findings for insert with check (auth.uid() = user_id);
create policy "findings_update_own" on public.findings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "findings_delete_own" on public.findings for delete using (auth.uid() = user_id);

create policy "builds_select_own"   on public.builds   for select using (auth.uid() = user_id);
create policy "builds_insert_own"   on public.builds   for insert with check (auth.uid() = user_id);
create policy "builds_update_own"   on public.builds   for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "builds_delete_own"   on public.builds   for delete using (auth.uid() = user_id);
```

#### Optional: daily image-render cap

`/api/make/image` (the one expensive call) is limited to 25 renders per user per 24 hours, counted in a small table so the limit holds across serverless instances. Without this table the cap is simply not enforced (the route logs `daily cap read failed (allowing)` and carries on), so run it once:

```sql
create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind text not null,
  created_at timestamptz not null default now()
);

create index usage_events_user_kind_time_idx on public.usage_events (user_id, kind, created_at desc);

alter table public.usage_events enable row level security;

-- Select and insert only: a user must not be able to delete their own rows to reset the count.
create policy "usage_events_select_own" on public.usage_events for select using (auth.uid() = user_id);
create policy "usage_events_insert_own" on public.usage_events for insert with check (auth.uid() = user_id);
```

Notes for anyone upgrading from an earlier version of this README:

- The old SQL had no `user_id` column and no RLS. The API filters every query by `user_id`, so tables created from it will not work — recreate them, or add the column and policies.
- `builds.rating` is now `text` (`loved_it` / `good` / `could_be_better`), not `integer`.
- The `designs` table is no longer used — saved designs live in `builds`. You can drop it.

A missing table surfaces as PostgREST error `PGRST205` in the server logs; the UI just shows "Database error".

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
strung/
├── CLAUDE.md             # Conventions and gotchas for working on the code — read before changing it
├── DESIGN.md             # Visual system (tokens, type, beads, voice) — canonical for UI work
├── .github/workflows/    # CI: lint, test, build
└── strung/               # Next.js app — run all commands from here
    └── src/
        ├── app/
        │   ├── page.tsx          # Public landing
        │   ├── layout.tsx        # Root layout + self-hosted fonts
        │   ├── globals.css       # Design tokens + utility classes
        │   ├── fonts/            # woff2 files + OFL licences
        │   ├── how-it-works/     # Public explainer
        │   ├── bench/            # Signed-in home
        │   ├── inventory/        # Stash
        │   ├── make/             # Design generator
        │   │   └── build/[id]/   # Step-by-step build mode
        │   ├── codesign/         # AI chat co-designer
        │   ├── sequence/         # Palette + bead sequence builder
        │   ├── journal/          # Saved builds
        │   ├── guides/           # Technique guides + streaming advisor
        │   ├── glossary/         # Term definitions
        │   ├── calculator/       # Bead math
        │   ├── account/          # Sign in / sign up
        │   ├── auth/callback/    # Supabase auth callback
        │   └── api/              # Route handlers
        ├── components/
        │   ├── Nav.tsx           # Studio + public nav, phone tab bar, MakeTabs
        │   ├── Bead.tsx          # CSS-drawn <Bead>, <Strand>, <StepStrand>
        │   ├── Schematic.tsx     # Deterministic SVG design diagram
        │   ├── BeadIcon.tsx      # Bead-shape micro-icons
        │   ├── StrandLoader.tsx  # Loading state
        │   ├── StrandEmpty.tsx   # Empty state
        │   ├── DemoPieces.tsx    # Illustrative pieces for the public pages
        │   └── PublicFooter.tsx
        ├── data/
        │   └── referencePool.json # Tagged design references — loaded, deliberately not wired into any route yet
        ├── lib/
        │   ├── supabase.ts       # Client + shared types
        │   ├── auth.ts           # Server-side auth helpers
        │   ├── authClient.ts     # Client-side auth helpers
        │   ├── apiRequest.ts     # Shared route plumbing: MODEL, effort, body parsing, streaming, usage logs
        │   ├── colour.ts         # Writable-table allowlist + model JSON parsing
        │   ├── designVocab.ts    # Shared prompt vocabulary for /make + /codesign (techniques, styles, metal cohesion, assembly rules)
        │   ├── assembly.ts       # Assembly validation + branched-layout maths
        │   ├── bead.ts           # Bead forms, colour families, strand colouring from the stash
        │   ├── beadSize.ts       # Size category → glyph scale
        │   ├── demoBeads.ts      # Illustrative beads for public pages
        │   ├── richText.ts       # The one HTML escaper/formatter for rendered AI text
        │   ├── imagePrep.ts      # Client-side image downscaling
        │   ├── imagePrompt.ts    # Deterministic image-prompt fallback
        │   ├── stashItems.ts     # Normalises AI-identified items; validates stash writes
        │   ├── builds.ts         # Validates build writes
        │   ├── chatMessages.ts   # Validates the co-design chat history
        │   ├── sequenceResult.ts # Normalises the Palette model reply
        │   ├── streamText.ts     # Client-side reader for the streaming routes
        │   ├── beadMath.ts       # Bead weight for the calculator
        │   ├── stash-colours.ts  # Bead + metal colour constants for the stash pickers
        │   ├── stashDecrement.ts # Plans per-row stash subtractions on build completion
        │   ├── referencePool.ts  # Loader + queries for the reference pool
        │   ├── dailyCap.ts       # Cross-instance daily image cap (usage_events)
        │   └── rateLimit.ts      # In-memory per-instance rate limiter
        └── __tests__/
```

---

## Commands

Run from the `strung/` subdirectory:

```bash
npm run dev        # Start dev server at localhost:3000
npm run build      # Type-check and build for production
npm run start      # Serve the production build
npm run lint       # ESLint
npm test           # Vitest
```

---

## Deploying

Deploys to Vercel. Set the project's **root directory** to `strung/`. Do not add a `vercel.json` with a `builds` key.

Set the same four environment variables in the Vercel project. The build itself needs none of them (CI builds with no env set), but every AI and data route fails at runtime without them. OpenAI's GPT image models also require organization verification on the OpenAI account before they can be called.
