# Strung

An AI-powered beaded jewellery design studio. Track your bead stash, generate designs from what you actually own, build them step by step, and log every finished piece.

---

## The Core Loop

**Stash → Make → Build → Journal**

1. Add your beads and findings to the **Stash**
2. The AI reads your stash and generates a bespoke design on **Make**
3. Step through the instructions in **Build** mode
4. Finished and saved pieces live in your **Journal**

---

## Features

| Page | Nav | What it does |
|---|---|---|
| **Stash** (`/inventory`) | Stash | Log every bead and finding you own — name, type, colour, size, quantity. Photograph an item and Claude identifies it, or paste a plain-text description of your whole stash and review the parsed result before saving. Full inline edit and delete. |
| **Make** (`/make`) | Make | Pick a piece type, mood, and how much time you have. Claude reads your stash and generates one complete, buildable design — components, colour story, and numbered steps. Refine it in plain language, then view it two ways: a **Visual** AI render, or a **Schematic** — a deterministic SVG diagram that lays the design out as a strand using your stash's real colours and shapes. Save it or start building. |
| **Build** (`/make/build/[id]`) | — | Step-by-step build mode. Tracks your current step, time taken, notes, and a rating. On completion it offers to subtract the materials you used from your stash automatically. |
| **Palette** (`/sequence`) | Palette | Choose a colour harmony, an anchor colour family, and a piece type. Claude returns a 3–5 colour palette, a repeating bead sequence with a pattern unit, a metal recommendation, and any close matches from your stash. |
| **Co-design** (`/codesign`) | — | Chat-based AI co-designer. Describe what you're imagining and collaboratively build a full design — with the same Visual render and Schematic diagram as Make — then save it straight to your builds. |
| **Journal** (`/journal`) | Journal | Every saved build lives here. Track status: Draft → In Progress → Complete. |
| **Learn** (`/guides`) | Learn | Wire wrapping, crimping, head pins, earring construction, and more — with a streaming AI advisor that answers questions in the context of the guide you're reading. |
| **Glossary** (`/glossary`) | — | Quick-reference definitions for jewellery-making terms. Reachable under the Learn nav item. |
| **Bead Math** (`/calculator`) | — | Calculate exactly how many beads a piece needs — with length, size, knotting, and strand options. |
| **Account** (`/account`) | Account | Sign in / sign up. |

**You need an account for almost everything.** The Palette page is the only feature that works fully signed out — every other AI and data route requires a session.

---

## Tech Stack

- **Framework** — Next.js 15 (App Router)
- **Language** — TypeScript
- **AI** — Anthropic Claude (`claude-sonnet-4-6`) via the Anthropic SDK — text, streaming, and vision
- **Image generation** — OpenAI GPT Image 2 (`/api/make/image`)
- **Database** — Supabase (PostgreSQL, per-user rows with Row Level Security)
- **Styling** — CSS custom properties + inline styles (no CSS framework)
- **Fonts** — Playfair Display, Cormorant Garamond, DM Mono
- **Testing** — Vitest + Testing Library

---

## API Routes

| Route | Methods | Auth | What it does |
|---|---|---|---|
| `/api/inventory` | GET, POST, PATCH, DELETE | yes | CRUD for `beads` and `findings` |
| `/api/make` | POST | yes | Generates one design as structured JSON; also handles refinements |
| `/api/make/image` | POST | yes | Claude writes an image prompt from the design, then calls OpenAI GPT Image 2 (`gpt-image-2`). Returns `501` without `OPENAI_API_KEY` |
| `/api/sequence` | POST | **no** | Colour palette + repeating bead sequence, with stash matching |
| `/api/builds` | GET, POST, PATCH, DELETE | yes | CRUD for `builds`. GET returns `[]` when signed out rather than erroring |
| `/api/codesign` | POST | yes | Streaming co-design chat |
| `/api/advice` | POST | yes | Streaming jewellery advice (used by the guides page) |
| `/api/identify` | POST | yes | Vision identification of a bead or finding; `mode: 'multi'` identifies every distinct group in one photo |
| `/api/parse-stash` | POST | yes | Parses a plain-text stash description into beads and findings |

All AI routes use `claude-sonnet-4-6`. Images are downscaled client-side to 1568px JPEG before upload (Vercel caps request bodies at 4.5MB).

Every route that hits a paid upstream (Anthropic / OpenAI) is rate limited with an in-memory sliding window — keyed per user, or per IP for the public `/api/sequence` route — and returns `429` with a `Retry-After` header when the window is full. The image route is capped tighter, since GPT Image 2 at `high` quality is the most expensive call in the app. The limit is per serverless instance, so it's a first line of defence against runaway loops rather than a strict global billing cap.

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
└── strung/               # Next.js app — run all commands from here
    └── src/
        ├── app/
        │   ├── page.tsx          # Homepage
        │   ├── layout.tsx        # Root layout
        │   ├── globals.css       # Design tokens + utility classes
        │   ├── inventory/        # Stash tracker
        │   ├── make/             # Design generator
        │   │   └── build/[id]/   # Step-by-step build mode
        │   ├── sequence/         # Palette + bead sequence builder
        │   ├── codesign/         # AI chat co-designer
        │   ├── journal/          # Saved builds
        │   ├── guides/           # Technique guides + streaming advisor
        │   ├── glossary/         # Term definitions
        │   ├── calculator/       # Bead math
        │   ├── account/          # Sign in / sign up
        │   ├── auth/callback/    # Supabase auth callback
        │   └── api/              # Route handlers
        ├── components/
        │   ├── Nav.tsx
        │   └── Schematic.tsx     # Deterministic SVG design diagram
        ├── lib/
        │   ├── supabase.ts       # Client + shared types
        │   ├── auth.ts           # Server-side auth helpers
        │   ├── authClient.ts     # Client-side auth helpers
        │   ├── colour.ts         # Colour + JSON parsing utilities
        │   ├── imagePrep.ts      # Client-side image downscaling
        │   ├── stashItems.ts     # Normalises AI-identified items
        │   ├── stashDecrement.ts # Plans per-row stash subtractions on build completion
        │   ├── visual.ts         # Shared AI image-prompt builder
        │   └── rateLimit.ts      # In-memory sliding-window rate limiter
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
