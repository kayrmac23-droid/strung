import { describe, it, expect } from 'vitest'
import { normaliseSequenceResult } from '@/lib/sequenceResult'

const good = {
  title: 'Dusk Flow',
  colourStory: 'Soft.',
  harmonyType: 'Analogous',
  palette: [
    { role: 'Anchor', name: 'Plum', hex: '#663366', beadSuggestion: 'Czech 6mm', note: 'base' },
    { role: 'Accent', name: 'Gold', hex: '#c9a84c', beadSuggestion: 'Seed', note: 'pop' },
  ],
  sequence: [
    { label: 'A', colourName: 'Plum', hex: '#663366', count: 3, beadType: 'Round 6mm' },
    { label: 'B', colourName: 'Gold', hex: '#c9a84c', count: 1, beadType: 'Seed' },
  ],
  sequencePattern: 'A-A-B',
  repeats: 10,
  totalBeadsPerRepeat: 3,
  stashMatches: [],
  tip: 'Works.',
  metalRecommendation: { name: 'Gold Filled', hex: '#c8a858', reason: 'Warm' },
}

describe('normaliseSequenceResult', () => {
  it('passes a well-formed result through', () => {
    expect(normaliseSequenceResult(good)).toEqual(good)
  })

  it('returns null when there is no usable palette', () => {
    expect(normaliseSequenceResult({})).toBeNull()
    expect(normaliseSequenceResult(null)).toBeNull()
    expect(normaliseSequenceResult({ palette: 'red' })).toBeNull()
    expect(normaliseSequenceResult([good])).toBeNull()
  })

  it('fills every field the page reads, so a sparse reply cannot crash the render', () => {
    const r = normaliseSequenceResult({ palette: [{ name: 'Plum' }] })!
    expect(r.sequence).toEqual([])
    expect(r.stashMatches).toEqual([])
    expect(r.sequencePattern).toBe('')
    expect(r.metalRecommendation).toBeNull()
    expect(r.palette[0].hex).toBe('#888888')
    expect(r.title).toBe('Untitled palette')
  })

  it('drops pattern labels the sequence does not define', () => {
    const r = normaliseSequenceResult({ ...good, sequencePattern: 'A-Z-B-a' })!
    expect(r.sequencePattern).toBe('A-B-A')
  })

  it('replaces invalid hex values', () => {
    const r = normaliseSequenceResult({ ...good, palette: [{ name: 'X', hex: 'red; background:url(x)' }] })!
    expect(r.palette[0].hex).toBe('#888888')
  })

  it('clamps numbers', () => {
    const r = normaliseSequenceResult({ ...good, repeats: 1e9, sequence: [{ label: 'A', count: -4 }] })!
    expect(r.repeats).toBe(999)
    expect(r.sequence[0].count).toBe(1)
  })
})
