import { describe, it, expect } from 'vitest'
import { buildFallbackImagePrompt, describeAssembly, DALLE_PHOTO_SUFFIX } from '@/lib/imagePrompt'

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

describe('describeAssembly', () => {
  const chandelier = {
    components: [
      { item: 'brass chandelier finding', quantity: 2 },
      { item: 'amber cabochon', quantity: 2 },
      { item: 'freshwater pearls', quantity: 8 },
    ],
    assembly: {
      form: 'branched',
      anchor: 'brass chandelier finding',
      strands: [
        { id: 1, attachAt: 'left', repeat: 1, elements: [{ item: 'freshwater pearls', quantity: 3 }] },
        { id: 2, attachAt: 'centre', repeat: 1, elements: [{ item: 'amber cabochon', quantity: 1 }] },
        { id: 3, attachAt: 'right', repeat: 1, elements: [{ item: 'freshwater pearls', quantity: 3 }] },
      ],
    },
  }

  it('returns empty for a design with no assembly (single-column render is fine)', () => {
    expect(describeAssembly({ components: [{ item: 'amazonite', quantity: 6 }] })).toBe('')
    expect(describeAssembly({})).toBe('')
    expect(describeAssembly(null)).toBe('')
  })

  it('returns empty for form "strand" — nothing branched to orient', () => {
    expect(describeAssembly({ assembly: { form: 'strand', anchor: null, strands: [] } })).toBe('')
  })

  it('states the anchor mounts at the top and strands hang below', () => {
    const t = describeAssembly(chandelier)
    expect(t).toContain('brass chandelier finding')
    expect(t).toMatch(/mounted at the very top/)
    expect(t).toMatch(/hang[s]? downward/)
    expect(t).toMatch(/Nothing sits above the top anchor/)
  })

  it('orders strand elements top to bottom and reflects quantities', () => {
    const t = describeAssembly({
      components: [
        { item: 'hoop', quantity: 1 },
        { item: 'seed beads', quantity: 6 },
        { item: 'drop', quantity: 1 },
      ],
      assembly: {
        form: 'drop',
        anchor: 'hoop',
        strands: [{ id: 1, attachAt: 'centre', repeat: 1, elements: [{ item: 'seed beads', quantity: 3 }, { item: 'drop', quantity: 1 }] }],
      },
    })
    expect(t).toContain('3× seed beads, then drop')
    expect(t).toMatch(/top to bottom/)
  })
})

describe('buildFallbackImagePrompt with assembly', () => {
  const design = {
    title: 'Amber Chandelier',
    pieceType: 'earrings',
    description: 'A branched drop earring.',
    components: [
      { item: 'brass chandelier finding', quantity: 2 },
      { item: 'amber cabochon', quantity: 2 },
    ],
    assembly: {
      form: 'branched',
      anchor: 'brass chandelier finding',
      strands: [{ id: 1, attachAt: 'centre', repeat: 1, elements: [{ item: 'amber cabochon', quantity: 1 }] }],
    },
  }

  it('folds the structural orientation into the prompt', () => {
    const p = buildFallbackImagePrompt(design)
    expect(p).toMatch(/brass chandelier finding is mounted at the very top/)
    expect(p.endsWith(DALLE_PHOTO_SUFFIX)).toBe(true)
  })

  it('keeps the orientation ahead of the suffix and within the ceiling', () => {
    const huge = { ...design, description: 'x'.repeat(4000), colourStory: 'y'.repeat(4000) }
    const p = buildFallbackImagePrompt(huge)
    expect(p.length).toBeLessThanOrEqual(850)
    expect(p.endsWith(DALLE_PHOTO_SUFFIX)).toBe(true)
    // Structure survives trimming because it sits ahead of the free-text prose.
    expect(p).toMatch(/mounted at the very top/)
  })
})
