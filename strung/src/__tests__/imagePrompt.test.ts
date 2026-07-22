import { describe, it, expect } from 'vitest'
import { buildFallbackImagePrompt, DALLE_PHOTO_SUFFIX } from '@/lib/imagePrompt'

describe('buildFallbackImagePrompt', () => {
  const design = {
    title: 'Tidepool Wrap',
    description: 'A calm amazonite bracelet.',
    pieceType: 'bracelet',
    colourStory: 'Milky amazonite with teal seed beads.',
    components: [
      { item: 'amazonite rounds', quantity: 6 },
      { item: 'matte teal seed beads', quantity: 20 },
    ],
  }

  it('always ends with the photographic suffix', () => {
    expect(buildFallbackImagePrompt(design).endsWith(DALLE_PHOTO_SUFFIX)).toBe(true)
  })

  it('includes the title, piece type, and component names', () => {
    const p = buildFallbackImagePrompt(design)
    expect(p).toContain('Tidepool Wrap')
    expect(p).toContain('bracelet')
    expect(p).toContain('amazonite rounds')
    expect(p).toContain('6× amazonite rounds')
  })

  it('keeps the suffix intact even when the body is huge (trims body, not suffix)', () => {
    const huge = { ...design, description: 'x'.repeat(5000), colourStory: 'y'.repeat(5000) }
    const p = buildFallbackImagePrompt(huge)
    expect(p.endsWith(DALLE_PHOTO_SUFFIX)).toBe(true)
    expect(p.length).toBeLessThanOrEqual(850)
  })

  it('falls back to a generic piece type and omits missing fields safely', () => {
    const p = buildFallbackImagePrompt({})
    expect(p).toContain('beaded jewellery piece')
    expect(p.endsWith(DALLE_PHOTO_SUFFIX)).toBe(true)
  })

  it('ignores malformed component entries without throwing', () => {
    const p = buildFallbackImagePrompt({ ...design, components: [null, { quantity: 3 }, { item: 'clasp', quantity: 1 }] })
    expect(p).toContain('clasp')
  })
})
