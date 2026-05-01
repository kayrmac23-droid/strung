import { describe, it, expect } from 'vitest'
import { harmonyScore, isAllowedTable, stripJsonFences, colourFamilies } from '@/lib/colour'

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
