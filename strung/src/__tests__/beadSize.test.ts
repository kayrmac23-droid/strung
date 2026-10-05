import { describe, it, expect } from 'vitest'
import { beadSizeMm, glyphScale, BEAD_SIZE_MM, REFERENCE_MM } from '@/lib/beadSize'

describe('beadSizeMm', () => {
  it('maps every stash size category to a diameter', () => {
    expect(beadSizeMm('seed')).toBe(1.5)
    expect(beadSizeMm('small')).toBe(3.5)
    expect(beadSizeMm('medium')).toBe(6)
    expect(beadSizeMm('large')).toBe(9.5)
    expect(beadSizeMm('statement')).toBe(13)
    expect(beadSizeMm('  Large ')).toBe(9.5)
  })

  it('reads an explicit millimetre size written as free text', () => {
    expect(beadSizeMm('8mm')).toBe(8)
    expect(beadSizeMm('4.5 mm round')).toBe(4.5)
  })

  it('returns null for anything it cannot read', () => {
    for (const v of [undefined, null, '', '   ', 'huge', '2 inch', '0mm', '400mm', 6, {}]) {
      expect(beadSizeMm(v)).toBeNull()
    }
  })

  it('does not treat inherited object keys as sizes', () => {
    expect(beadSizeMm('constructor')).toBeNull()
    expect(beadSizeMm('__proto__')).toBeNull()
  })
})

describe('glyphScale', () => {
  it('is exactly 1 for null, 0, non-finite and the reference size', () => {
    expect(glyphScale(null)).toBe(1)
    expect(glyphScale(undefined)).toBe(1)
    expect(glyphScale(0)).toBe(1)
    expect(glyphScale(NaN)).toBe(1)
    expect(glyphScale(REFERENCE_MM)).toBe(1)
    expect(glyphScale(BEAD_SIZE_MM.medium)).toBe(1)
  })

  it('increases strictly across the size categories', () => {
    const scales = ['seed', 'small', 'medium', 'large', 'statement'].map((s) => glyphScale(BEAD_SIZE_MM[s]))
    for (let i = 1; i < scales.length; i++) expect(scales[i]).toBeGreaterThan(scales[i - 1])
  })

  it('clamps so a glyph never vanishes or swamps its row', () => {
    expect(glyphScale(0.01)).toBe(0.5)
    expect(glyphScale(50)).toBe(1.5)
  })
})
