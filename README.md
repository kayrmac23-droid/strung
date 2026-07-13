# Strung

An AI-powered beaded jewellery design studio. Track your bead stash, generate blueprints from what you actually own, co-design pieces with an AI collaborator, and learn the techniques to bring it all to life.

---

## Features

| Page | What it does |
|---|---|
| **Inventory** (`/inventory`) | Log every bead and finding you own — name, type, colour, size, quantity. Photograph a bead or finding and Claude identifies it for you. Full inline edit and delete. |
| **Inspire Me** (`/inspire`) | The AI reads your actual stash and generates three distinct, buildable design blueprints. Save any to your Journal. |
| **Design Studio** (`/codesign`) | Chat-based AI co-designer. Describe what you're imagining and collaboratively build a full blueprint. |
| **Design Brief** (`/design`) | Describe any piece in plain language and get a complete technical brief back in seconds. |
| **Palette Builder** (`/palette`) | Describe a mood, style, and occasion and Claude generates a full colour palette — gems, metals, finishes, and pairing suggestions. |
| **Bead Math** (`/calculator`) | Calculate exactly how many beads any piece needs — with length, size, knotting, and strand options. |
| **Design Journal** (`/journal`) | Every blueprint you save lives here. Track status: Saved → In Progress → Complete. |
| **Technique Guides** (`/guides`) | Wire wrapping, crimping, head pins — every core technique, clearly explained. |
| **AI Advisor** (`/advisor`) | Streamed expert answers on materials, techniques, tools, and design decisions. |
| **Glossary** (`/glossary`) | Quick-reference definitions for jewellery-making terms. |

---

## Tech Stack

- **Framework** — Next.js 15 (App Router)
- **Language** — TypeScript
- **AI** — Anthropic Claude (`claude-sonnet-4-6`; `/api/advice` still on `claude-sonnet-4-20250514`) via the Anthropic SDK — text, streaming, and vision
- **Image generation** — OpenAI DALL-E 3 (`/api/make/image`)
- **Database** — Supabase (PostgreSQL, per-user rows with Row Level Security)
- **Styling** — CSS custom properties + inline styles (no CSS framework)
- **Fonts** — Playfair Display, Cormorant Garamond, DM Mono

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
OPENAI_API_KEY=your_openai_api_key   # required for DALL-E 3 images (/api/make/image returns 501 without it)
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

create table public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  type text,
  difficulty text,
  source text not null default 'inspire',
  blueprint jsonb not null,
  notes text,
  status text not null default 'saved',
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
  rating integer,
  created_at timestamptz not null default now()
);

create index beads_user_id_idx on public.beads (user_id);
create index findings_user_id_idx on public.findings (user_id);
create index designs_user_id_idx on public.designs (user_id);
create index builds_user_id_idx on public.builds (user_id);

alter table public.beads enable row level security;
alter table public.findings enable row level security;
alter table public.designs enable row level security;
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

create policy "designs_select_own"  on public.designs  for select using (auth.uid() = user_id);
create policy "designs_insert_own"  on public.designs  for insert with check (auth.uid() = user_id);
create policy "designs_update_own"  on public.designs  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "designs_delete_own"  on public.designs  for delete using (auth.uid() = user_id);

create policy "builds_select_own"   on public.builds   for select using (auth.uid() = user_id);
create policy "builds_insert_own"   on public.builds   for insert with check (auth.uid() = user_id);
create policy "builds_update_own"   on public.builds   for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "builds_delete_own"   on public.builds   for delete using (auth.uid() = user_id);
```

> **Migrating from an earlier version of this README?** The old SQL had no `user_id` column and no RLS — the API filters every query by `user_id`, so tables created from it will not work. Recreate them (or add the column and policies) before using the app.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
strung/
└── strung/               # Next.js app
    └── src/
        ├── app/
        │   ├── page.tsx          # Homepage
        │   ├── layout.tsx        # Root layout
        │   ├── globals.css       # Design tokens + utility classes
        │   ├── inventory/        # Stash tracker
        │   ├── inspire/          # Blueprint generator
        │   ├── codesign/         # AI chat co-designer
        │   ├── design/           # Design brief generator
        │   ├── palette/          # Colour theory tool
        │   ├── calculator/       # Bead math calculator
        │   ├── journal/          # Saved designs
        │   ├── guides/           # Technique guides
        │   ├── advisor/          # Streaming AI advisor
        │   ├── glossary/         # Term definitions
        │   └── api/              # Route handlers
        ├── components/
        │   └── Nav.tsx
        └── lib/
            └── supabase.ts       # Client + shared types
```

---

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Type-check and build for production
npm run start    # Serve the production build
```
