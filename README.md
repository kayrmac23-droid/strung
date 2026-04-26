# Strung

An AI-powered beaded jewellery design studio. Track your bead stash, generate blueprints from what you actually own, co-design pieces with an AI collaborator, and learn the techniques to bring it all to life.

---

## Features

| Page | What it does |
|---|---|
| **Inventory** (`/inventory`) | Log every bead and finding you own — name, type, colour, size, quantity. Full inline edit and delete. |
| **Inspire Me** (`/inspire`) | The AI reads your actual stash and generates three distinct, buildable design blueprints. Save any to your Journal. |
| **Design Studio** (`/codesign`) | Chat-based AI co-designer. Describe what you're imagining and collaboratively build a full blueprint. |
| **Design Brief** (`/design`) | Describe any piece in plain language and get a complete technical brief back in seconds. |
| **Palette Builder** (`/palette`) | Build harmonious colour stories across gemstones, metals, and mixed finishes. |
| **Bead Math** (`/calculator`) | Calculate exactly how many beads any piece needs — with length, size, knotting, and strand options. |
| **Design Journal** (`/journal`) | Every blueprint you save lives here. Track status: Saved → In Progress → Complete. |
| **Technique Guides** (`/guides`) | Wire wrapping, crimping, head pins — every core technique, clearly explained. |
| **AI Advisor** (`/advisor`) | Streamed expert answers on materials, techniques, tools, and design decisions. |
| **Glossary** (`/glossary`) | Quick-reference definitions for jewellery-making terms. |

---

## Tech Stack

- **Framework** — Next.js 15 (App Router)
- **Language** — TypeScript
- **AI** — Anthropic Claude (`claude-sonnet-4-20250514`) via the Anthropic SDK
- **Database** — Supabase (PostgreSQL)
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
```

### 3. Set up the database

Run the following SQL in your Supabase dashboard:

```sql
create table beads (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null,
  colour text not null,
  hex text not null default '#888888',
  size text not null,
  quantity integer not null default 0,
  shape text,
  notes text,
  created_at timestamptz default now()
);

create table findings (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null,
  metal text not null,
  size text,
  quantity integer not null default 0,
  notes text,
  created_at timestamptz default now()
);

create table designs (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  type text,
  difficulty text,
  source text not null default 'inspire',
  blueprint jsonb not null,
  notes text,
  status text not null default 'saved',
  created_at timestamptz default now()
);
```

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
