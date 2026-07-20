// Plans the stash subtractions when a build is completed.
//
// A design's components hold stash item names + quantities. On completion the
// build page offers to subtract what was used. This must aggregate by stash row
// FIRST: two components can reference the same stash item (e.g. a design that
// lists "silver jump rings" twice), and issuing one PATCH per component races —
// each reads the same starting quantity and the last write wins, so only one
// subtraction lands. Collapsing to one target per row makes the subtraction
// correct and lets the caller PATCH each row exactly once.

export type StashRow = { id: string; name: string; quantity: number }
export type UsedComponent = { item?: unknown; quantity?: unknown }
export type DecrementTarget = { table: 'beads' | 'findings'; id: string; quantity: number }

const norm = (s: string) => s.trim().toLowerCase()

export function planStashDecrements(
  components: UsedComponent[],
  beads: StashRow[],
  findings: StashRow[],
): DecrementTarget[] {
  // Sum the quantity used per (normalised) component name across all components.
  const usedByName = new Map<string, number>()
  for (const c of components) {
    if (!c || typeof c.item !== 'string') continue
    const key = norm(c.item)
    if (!key) continue
    const used = Number(c.quantity) || 0
    if (used <= 0) continue
    usedByName.set(key, (usedByName.get(key) ?? 0) + used)
  }

  const targets: DecrementTarget[] = []
  for (const [key, used] of usedByName) {
    // Beads take precedence over findings on a name tie (matches the app's
    // documented "checking beads first, then findings" behaviour).
    const bead = beads.find((b) => norm(b.name) === key)
    const row = bead ?? findings.find((f) => norm(f.name) === key)
    if (!row) continue // no name match — skip silently, best-effort by design
    targets.push({
      table: bead ? 'beads' : 'findings',
      id: row.id,
      quantity: Math.max(0, (Number(row.quantity) || 0) - used),
    })
  }
  return targets
}
