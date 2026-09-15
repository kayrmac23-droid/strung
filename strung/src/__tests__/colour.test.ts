import { describe, it, expect } from 'vitest'
import { harmonyScore, familyOf, isAllowedTable, stripJsonFences, parseJsonLoose, colourFamilies } from '@/lib/colour'

describe('harmonyScore', () => {
  it('returns placeholder when fewer than 2 colours selected', () => {
    expect(harmonyScore([]).score).toBe('—')
    expect(harmonyScore([{ n: 'Crimson', h: '#9b1b30' }]).score).toBe('—')
  })

  it('returns Tonal for colours from the same family', () => {
    const result = harmonyScore([
      { n: 'Crimson', h: '#9b1b30' },
      { n: 'Scarlet', h: '#c0392b' },
    ])
    expect(result.score).toBe('Tonal')
  })

  it('returns Complementary for two families', () => {
    const result = harmonyScore([
      { n: 'Crimson', h: '#9b1b30' },   // Reds & Pinks
      { n: 'Sky Blue', h: '#87ceeb' },  // Blues
    ])
    expect(result.score).toBe('Complementary')
  })

  it('returns Triad for three families', () => {
    const result = harmonyScore([
      { n: 'Crimson', h: '#9b1b30' },   // Reds & Pinks
      { n: 'Sky Blue', h: '#87ceeb' },  // Blues
      { n: 'Emerald', h: '#2e8b57' },   // Greens
    ])
    expect(result.score).toBe('Triad')
  })

  it('returns Complex for four or more families', () => {
    const result = harmonyScore([
      { n: 'Crimson', h: '#9b1b30' },   // Reds & Pinks
      { n: 'Sky Blue', h: '#87ceeb' },  // Blues
      { n: 'Emerald', h: '#2e8b57' },   // Greens
      { n: 'Amethyst', h: '#8a6aaa' },  // Purples & Violets
    ])
    expect(result.score).toBe('Complex')
  })
})

describe('colourFamilies data integrity', () => {
  it('has 8 families', () => {
    expect(colourFamilies).toHaveLength(8)
  })

  it('every colour has a name and valid hex', () => {
    for (const family of colourFamilies) {
      for (const sub of family.subcategories) {
        for (const colour of sub.colours) {
          expect(colour.n).toBeTruthy()
          expect(colour.h).toMatch(/^#[0-9a-f]{6}$/i)
        }
      }
    }
  })
})

describe('isAllowedTable', () => {
  it('allows beads and findings', () => {
    expect(isAllowedTable('beads')).toBe(true)
    expect(isAllowedTable('findings')).toBe(true)
  })

  it('rejects arbitrary strings and null', () => {
    expect(isAllowedTable('users')).toBe(false)
    expect(isAllowedTable(null)).toBe(false)
    expect(isAllowedTable(undefined)).toBe(false)
    expect(isAllowedTable('')).toBe(false)
  })
})

describe('stripJsonFences', () => {
  it('removes markdown code fences', () => {
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(stripJsonFences('```\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('leaves plain JSON untouched', () => {
    expect(stripJsonFences('{"a":1}')).toBe('{"a":1}')
  })
})

describe('parseJsonLoose', () => {
  it('parses plain JSON', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses JSON wrapped in markdown fences', () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJsonLoose('```\n{"b":2}\n```')).toEqual({ b: 2 })
  })

  it('recovers the outermost object when the model adds prose', () => {
    expect(parseJsonLoose('Sure! Here is your design:\n{"title":"X"}\nHope that helps.'))
      .toEqual({ title: 'X' })
  })

  it('recovers a nested-brace object from surrounding prose', () => {
    expect(parseJsonLoose('Prefix {"a":{"b":2}} suffix')).toEqual({ a: { b: 2 } })
  })

  it('throws when there is no JSON object at all', () => {
    expect(() => parseJsonLoose('no json here')).toThrow()
    expect(() => parseJsonLoose('')).toThrow()
  })
})

// ── Regressions for the family miscount ──────────────────────────────────────
// harmonyScore used to ask "which families contain any selected NAME?", so a
// colour whose name appears in two families incremented the total twice. Two
// names collide in the palette data: Periwinkle (a Blue at #ccccff and a
// Purple at #8c93cf) and Antique Gold (#b8860b, in both Yellows & Golds and
// Metallics & Sheens). Each case below returned the wrong score before the fix.

describe('harmonyScore — colours whose name spans two families', () => {
  it('counts a blue Periwinkle once, not once per family sharing the name', () => {
    // Periwinkle (Blues) + Gold (Yellows & Golds) is two families. The old
    // count reached three and reported Triad.
    const result = harmonyScore([
      { n: 'Periwinkle', h: '#ccccff' },
      { n: 'Gold', h: '#c9a84c' },
    ])
    expect(result.score).toBe('Complementary')
  })

  it('counts Antique Gold once although it sits in two families', () => {
    // Previously Triad, for what is plainly two families.
    const result = harmonyScore([
      { n: 'Antique Gold', h: '#b8860b' },
      { n: 'Crimson', h: '#9b1b30' },
    ])
    expect(result.score).toBe('Complementary')
  })

  it('separates the two Periwinkles by hex', () => {
    const result = harmonyScore([
      { n: 'Periwinkle', h: '#ccccff' },  // Blues
      { n: 'Periwinkle', h: '#8c93cf' },  // Purples & Violets
    ])
    expect(result.score).toBe('Complementary')
  })

  it('still reports a genuine Triad', () => {
    const result = harmonyScore([
      { n: 'Periwinkle', h: '#ccccff' },  // Blues
      { n: 'Gold', h: '#c9a84c' },        // Yellows & Golds
      { n: 'Emerald', h: '#2e8b57' },     // Greens
    ])
    expect(result.score).toBe('Triad')
  })
})

describe('harmonyScore — deduplication', () => {
  it('treats the same swatch picked twice as one colour', () => {
    // Was Complementary: the duplicate counted toward the family total twice.
    expect(harmonyScore([
      { n: 'Periwinkle', h: '#ccccff' },
      { n: 'Periwinkle', h: '#ccccff' },
    ]).score).toBe('Tonal')
  })

  it('is case-insensitive about hex when deduplicating', () => {
    expect(harmonyScore([
      { n: 'Crimson', h: '#9b1b30' },
      { n: 'Crimson', h: '#9B1B30' },
    ]).score).toBe('Tonal')
  })
})

describe('harmonyScore — nothing placeable', () => {
  it('returns the placeholder when no colour is in the palette library', () => {
    const result = harmonyScore([
      { n: 'Not A Real Colour', h: '#123456' },
      { n: 'Also Invented', h: '#654321' },
    ])
    expect(result.score).toBe('—')
    expect(result.note).toMatch(/not in the palette library/i)
  })

  it('scores the placeable colours and ignores the rest', () => {
    const result = harmonyScore([
      { n: 'Crimson', h: '#9b1b30' },
      { n: 'Not A Real Colour', h: '#123456' },
    ])
    expect(result.score).toBe('Tonal')
  })

  it('tolerates malformed entries without throwing', () => {
    expect(() => harmonyScore([
      null as unknown as { n: string; h: string },
      { n: 'Crimson', h: '#9b1b30' },
      { n: 'Sky Blue', h: '#87ceeb' },
    ])).not.toThrow()
  })
})

describe('familyOf', () => {
  it('resolves the blue Periwinkle by name and hex', () => {
    expect(familyOf({ n: 'Periwinkle', h: '#ccccff' })).toBe('Blues')
  })

  it('resolves the purple Periwinkle by name and hex', () => {
    expect(familyOf({ n: 'Periwinkle', h: '#8c93cf' })).toBe('Purples & Violets')
  })

  it('matches hex case-insensitively', () => {
    expect(familyOf({ n: 'Periwinkle', h: '#CCCCFF' })).toBe('Blues')
  })

  it('falls back to the first family with the name when the hex is unknown', () => {
    // A hand-edited swatch should still land somewhere rather than dropping
    // out of the harmony count entirely.
    expect(familyOf({ n: 'Periwinkle', h: '#000000' })).toBe('Blues')
  })

  it('resolves a name that appears in exactly one family', () => {
    expect(familyOf({ n: 'Emerald', h: '#2e8b57' })).toBe('Greens')
  })

  it('returns null for a colour that is not in the palette', () => {
    expect(familyOf({ n: 'Invented', h: '#123456' })).toBeNull()
  })

  it.each([
    ['an empty name', { n: '', h: '#ccccff' }],
    ['a non-string name', { n: 42 as unknown as string, h: '#ccccff' }],
  ])('returns null for %s', (_label, colour) => {
    expect(familyOf(colour as { n: string; h: string })).toBeNull()
  })

  it('returns a family name that exists in the palette data', () => {
    const names = colourFamilies.map(f => f.name)
    expect(names).toContain(familyOf({ n: 'Crimson', h: '#9b1b30' }))
  })
})

describe('isAllowedTable — non-string inputs', () => {
  it.each([
    ['a number', 0],
    ['a nonzero number', 1],
    ['an object', { table: 'beads' }],
    ['an array of a valid name', ['beads']],
    ['a boolean', true],
    ['a String object', new String('beads')],
  ])('rejects %s', (_label, value) => {
    // The signature takes `unknown` so a raw query-string or body value can be
    // handed straight in; the type check lives here rather than at each call
    // site, where it was easy to forget.
    expect(isAllowedTable(value)).toBe(false)
  })

  it('narrows the type for a valid name', () => {
    const value: unknown = 'beads'
    if (isAllowedTable(value)) {
      // Compiles only because the guard narrowed `unknown` to AllowedTable.
      const table: 'beads' | 'findings' = value
      expect(table).toBe('beads')
    } else {
      throw new Error('guard should have accepted "beads"')
    }
  })

  it('is case-sensitive', () => {
    expect(isAllowedTable('Beads')).toBe(false)
    expect(isAllowedTable('BEADS')).toBe(false)
  })
})
