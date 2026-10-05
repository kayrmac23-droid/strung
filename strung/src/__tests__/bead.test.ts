import { describe, it, expect } from 'vitest'
import { beadFormFor, beadStyle, colourFamily, safeHex, stepColours, strandFromComponents, UNKNOWN_BEAD_HEX } from '@/lib/bead'

describe('beadFormFor', () => {
  it('reads the free-text shape by keyword', () => {
    expect(beadFormFor({ shape: 'rondelle' })).toBe('rondelle')
    expect(beadFormFor({ shape: 'Faceted' })).toBe('bicone')
    expect(beadFormFor({ shape: 'chip' })).toBe('chip')
    expect(beadFormFor({ shape: 'tube' })).toBe('tube')
  })
  it('treats seed beads as seeds even with no shape', () => {
    expect(beadFormFor({ type: 'seed' })).toBe('seed')
    expect(beadFormFor({ name: 'Oxblood 11/0' })).toBe('seed')
  })
  it('falls back to round', () => {
    expect(beadFormFor({ shape: 'teardrop' })).toBe('round')
    expect(beadFormFor({})).toBe('round')
  })
})

describe('beadStyle', () => {
  it('rings very dark beads so they show on the bench', () => {
    expect(String(beadStyle('#1E1B1A', 'round', 10).boxShadow)).toContain('0 0 0 1px')
    expect(String(beadStyle('#E8E1D3', 'round', 10).boxShadow)).not.toContain('0 0 0 1px')
  })
  it('never passes a bad hex through to CSS', () => {
    expect(String(beadStyle('red;background:url(x)', 'round', 10).background)).toContain(UNKNOWN_BEAD_HEX)
    expect(safeHex(undefined)).toBe(UNKNOWN_BEAD_HEX)
  })
})

describe('colourFamily', () => {
  it.each([
    ['#7A1F2B', 'red'], ['#B5482E', 'orange'], ['#D9A441', 'yellow'], ['#2F4A3A', 'green'],
    ['#4A4F8A', 'blue'], ['#8FB8BE', 'blue'], ['#7A5A8C', 'purple'], ['#D9A6A0', 'pink'],
    ['#E8E1D3', 'neutral'], ['#1E1B1A', 'neutral'], ['#5E6B6E', 'neutral'], ['nope', 'neutral'],
  ])('%s → %s', (hex, fam) => expect(colourFamily(hex)).toBe(fam))
})

describe('strandFromComponents', () => {
  const beads = [{ name: 'Garnet rondelle', hex: '#7A1F2B', shape: 'rondelle' }, { name: 'Pearl', hex: '#E8E1D3' }]
  it('colours only components that name a stash bead, case-insensitively', () => {
    const s = strandFromComponents([{ item: ' garnet RONDELLE ', quantity: 8 }, { item: 'Crimp bead', quantity: 2 }, { item: 'Pearl', quantity: 2 }], beads, 5)
    expect(s.length).toBe(5)
    expect(s[0].hex).toBe('#7A1F2B')
    expect(s.some(b => b.hex === '#E8E1D3')).toBe(true)
  })
  it('is empty when nothing matches or input is malformed', () => {
    expect(strandFromComponents([{ item: 'Wire' }], beads)).toEqual([])
    expect(strandFromComponents(undefined, beads)).toEqual([])
  })
})

describe('stepColours', () => {
  it('prefers the longest matching bead name', () => {
    const beads = [{ name: 'Garnet', hex: '#111111' }, { name: 'Garnet rondelle', hex: '#7A1F2B' }]
    expect(stepColours([{ instruction: 'String one garnet rondelle' }, { instruction: 'Crimp the end' }], beads))
      .toEqual(['#7A1F2B', null])
  })
})
