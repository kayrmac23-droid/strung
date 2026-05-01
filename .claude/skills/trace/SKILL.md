---
name: trace
description: Trace the full data flow for a strung page from UI to API to Claude/Supabase and back. Args: /trace <page-name> e.g. /trace inspire
---

# Trace — strung data flow

Given a page name, read all the relevant files and produce a concise end-to-end data flow summary.

## Step 1 — Locate the page

The page file is at `strung/src/app/<page-name>/page.tsx`. Read it. If the file doesn't exist, list the directories under `strung/src/app/` and tell the user the valid page names.

## Step 2 — Find all fetch calls

Scan the page for:
- `fetch('/api/...')` calls — note the path, method, and request body shape
- Any direct Supabase calls (`supabase.from(...)`)
- State variables that hold the results

## Step 3 — Read each API route

For every `/api/<route>` found, read `strung/src/app/api/<route>/route.ts`. Extract:
- HTTP method(s) handled
- What it reads from the request
- Whether it calls Claude (`client.messages.create` / `client.messages.stream`) or Supabase (`.from(...)`) or both
- The Claude model and approximate prompt intent (one sentence)
- The response shape (JSON object structure, or streaming text)

## Step 4 — Produce the trace

Output a compact table followed by one paragraph:

**Table format:**
| Layer | Detail |
|---|---|
| Page | `src/app/<name>/page.tsx` — what triggers the fetch (user action / on mount) |
| State | key state variables that hold the result |
| Fetch | `POST /api/<route>` — what's sent in the body |
| Route | `src/app/api/<route>/route.ts` |
| AI / DB | Claude `claude-sonnet-4-20250514` — what the prompt asks for, OR Supabase table(s) queried |
| Response | shape of the data returned (e.g. `{ blueprints: Blueprint[] }`) |
| Client handling | how the page consumes the response (JSON parse / streaming reader / direct state set) |

If a page calls multiple routes, produce one table block per route, then a short paragraph tying them together.

**Paragraph:** One sentence on the happy path — what the user does, what data moves, what they see.

Keep the whole output under 40 lines.
