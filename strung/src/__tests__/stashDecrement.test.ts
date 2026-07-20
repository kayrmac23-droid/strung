import { describe, it, expect } from 'vitest'
import { planStashDecrements } from '@/lib/stashDecrement'

const beads = [
  { id: 'b1', name: 'Amazonite rounds', quantity: 6 },
  { id: 'b2', name: 'Matte teal seed beads', quantity: 40 },
]
const findings = [
  { id: 'f1', name: 'Silver jump rings', quantity: 20 },
  { id: 'f2', name: 'Silver lobster clasp', quantity: 1 },
]

describe('planStashDecrements', () => {
  it('subtracts matched components from the right table', () => {
    const targets = planStashDecrements(
      [{ item: 'Amazonite rounds', quantity: 6 }, { item: 'Silver lobster clasp', quantity: 1 }],
      beads,
      findings,
    )
    expect(targets).toContainEqual({ table: 'beads', id: 'b1', quantity: 0 })
    expect(targets).toContainEqual({ table: 'findings', id: 'f2', quantity: 0 })
  })

  it('aggregates duplicate component references into ONE target (the race bug)', () => {
    // Two components both reference the same stash row: the total used is 8, so
    // the single target must be 20 - 8 = 12, not 20 - 5 = 15 (last-write-wins).
    const targets = planStashDecrements(
      [{ item: 'Silver jump rings', quantity: 5 }, { item: 'silver jump rings', quantity: 3 }],
      beads,
      findings,
    )
    const jump = targets.filter(t => t.id === 'f1')
    expect(jump).toHaveLength(1)
    expect(jump[0].quantity).toBe(12)
  })

  it('matches case-insensitively and trims whitespace', () => {
    const targets = planStashDecrements([{ item: '  amazonite ROUNDS ', quantity: 2 }], beads, findings)
    expect(targets).toEqual([{ table: 'beads', id: 'b1', quantity: 4 }])
  })

  it('floors quantity at 0 when more is used than owned', () => {
    const targets = planStashDecrements([{ item: 'Silver lobster clasp', quantity: 5 }], beads, findings)
    expect(targets).toEqual([{ table: 'findings', id: 'f2', quantity: 0 }])
  })

  it('prefers beads over findings on a name collision', () => {
    const b = [{ id: 'bx', name: 'Connector', quantity: 10 }]
    const f = [{ id: 'fx', name: 'Connector', quantity: 10 }]
    const targets = planStashDecrements([{ item: 'Connector', quantity: 2 }], b, f)
    expect(targets).toEqual([{ table: 'beads', id: 'bx', quantity: 8 }])
  })

  it('skips unmatched, empty, zero, and non-numeric components', () => {
    const targets = planStashDecrements(
      [
        { item: 'Unknown gem', quantity: 3 },
        { item: '', quantity: 2 },
        { item: 'Amazonite rounds', quantity: 0 },
        { item: 'Amazonite rounds', quantity: 'lots' },
        { quantity: 2 },
      ],
      beads,
      findings,
    )
    expect(targets).toEqual([])
  })
})
