import { describe, it, expect } from 'vitest'
import {
  ALLOWED_TECHNIQUES,
  TECHNIQUE_LIST_TEXT,
  VALID_STYLES,
  STYLE_DESCRIPTIONS,
  STYLE_LABELS,
  STYLE_MENU,
  isValidStyle,
  styleConstraint,
} from '@/lib/designVocab'
import { metalColours } from '@/lib/stash-colours'

describe('ALLOWED_TECHNIQUES', () => {
  it('separates decorative wrapping from frame forming and names linked chain', () => {
    expect(ALLOWED_TECHNIQUES).toContain('Wire Wrapping')
    expect(ALLOWED_TECHNIQUES).toContain('Frame Forming')
    expect(ALLOWED_TECHNIQUES).toContain('Linked Chain')
  })

  it('has no duplicates', () => {
    expect(new Set(ALLOWED_TECHNIQUES).size).toBe(ALLOWED_TECHNIQUES.length)
  })

  it('renders every technique quoted into the prompt list', () => {
    for (const t of ALLOWED_TECHNIQUES) {
      expect(TECHNIQUE_LIST_TEXT).toContain(`"${t}"`)
    }
  })
})

describe('isValidStyle', () => {
  it('accepts every allowlisted style', () => {
    for (const s of VALID_STYLES) expect(isValidStyle(s)).toBe(true)
  })

  it('rejects free text and near-misses', () => {
    expect(isValidStyle('')).toBe(false)
    expect(isValidStyle('Vintage Brass')).toBe(false)
    expect(isValidStyle('goth')).toBe(false)
  })
})

describe('styleConstraint', () => {
  it('returns an empty string when no style is requested', () => {
    expect(styleConstraint('')).toBe('')
  })

  it('includes the descriptor and the stash-wins override', () => {
    const block = styleConstraint('delicate_gold')
    expect(block).toContain(STYLE_DESCRIPTIONS.delicate_gold)
    expect(block).toContain('materialsCheck.notes')
    expect(block).toMatch(/overrides the style/i)
  })
})

describe('style metadata', () => {
  it('has a label, a descriptor and a menu line for every style', () => {
    for (const s of VALID_STYLES) {
      expect(STYLE_LABELS[s]).toBeTruthy()
      expect(STYLE_DESCRIPTIONS[s]).toBeTruthy()
      expect(STYLE_MENU).toContain(s)
    }
  })
})

describe('metalColours', () => {
  it('covers every FindingItem metal with a hex value', () => {
    const metals = ['silver', 'gold_filled', 'gold', 'copper', 'brass', 'oxidised', 'other']
    for (const m of metals) {
      expect(metalColours[m]).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})
