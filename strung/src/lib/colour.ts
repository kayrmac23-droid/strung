// Request/response plumbing shared by the API routes: the writable-table
// allowlist and the model-output JSON parser.

export const ALLOWED_TABLES = ['beads', 'findings'] as const
export type AllowedTable = (typeof ALLOWED_TABLES)[number]

/**
 * Accepts `unknown` so callers can hand it a raw value straight off a request
 * body or query string. Narrowing to a string happens here rather than at each
 * call site, where a `typeof table !== 'string'` check was easy to forget.
 */
export function isAllowedTable(table: unknown): table is AllowedTable {
  return typeof table === 'string' && (ALLOWED_TABLES as readonly string[]).includes(table)
}

export function stripJsonFences(raw: string): string {
  return raw.replace(/```json|```/g, '').trim()
}

// Parse a JSON object out of a model response. Strips markdown fences first,
// then falls back to the outermost {...} block when the model wraps the JSON in
// prose. Throws if no JSON object can be recovered. Shared by every route that
// asks Claude for "ONLY valid JSON" (make, identify, parse-stash) so the
// fence-strip + brace-fallback behaviour stays identical across them.
export function parseJsonLoose(raw: string): unknown {
  const clean = stripJsonFences(raw)
  try {
    return JSON.parse(clean)
  } catch {
    const first = clean.indexOf('{')
    const last = clean.lastIndexOf('}')
    if (first === -1 || last === -1 || last <= first) {
      throw new Error('No JSON object found in response')
    }
    return JSON.parse(clean.slice(first, last + 1))
  }
}
