import { describe, it, expect } from 'vitest'
import {
  MAKE_SYSTEM,
  MAKE_SYSTEM_PROMPT,
  stashSummaryText,
  makeRequestText,
  makeUserContent,
  retryFeedbackText,
} from '@/lib/makePrompt'

const bead = { name: 'Amazonite rounds', colour: 'blue-green', size: 'medium', quantity: 6, shape: 'round' }
const finding = { name: 'Brass chandelier', type: 'statement_component', metal: 'brass', quantity: 2 }

describe('MAKE_SYSTEM_PROMPT', () => {
  it('is one cached block', () => {
    expect(MAKE_SYSTEM).toHaveLength(1)
    expect(MAKE_SYSTEM[0].text).toBe(MAKE_SYSTEM_PROMPT)
    expect(MAKE_SYSTEM[0].cache_control).toEqual({ type: 'ephemeral' })
  })

  // Below 512 tokens the model silently skips the cache. ~4 chars per token
  // puts the floor near 2,000 chars; the prompt is several times that.
  it('is comfortably above the cacheable minimum', () => {
    expect(MAKE_SYSTEM_PROMPT.length).toBeGreaterThan(6000)
  })

  it('carries the rules, example and schema but no per-request slot', () => {
    expect(MAKE_SYSTEM_PROMPT).toContain('CRITICAL RULES:')
    expect(MAKE_SYSTEM_PROMPT).toContain('EXAMPLE OUTPUT:')
    expect(MAKE_SYSTEM_PROMPT).toContain('Return ONLY valid JSON')
    expect(MAKE_SYSTEM_PROMPT).not.toContain('THEIR STASH')
    expect(MAKE_SYSTEM_PROMPT).not.toContain('THEIR REQUEST')
    expect(MAKE_SYSTEM_PROMPT).not.toContain('STYLE (firm constraint')
  })
})

describe('stashSummaryText', () => {
  it('lists beads and findings and marks structural findings', () => {
    const text = stashSummaryText([bead], [finding])
    expect(text).toContain('- Amazonite rounds (blue-green, medium, qty: 6, round)')
    expect(text).toContain('- Brass chandelier (statement_component, brass, qty: 2)')
    expect(text).toContain('[structural — can be an assembly anchor]')
  })

  it('says so when the stash is empty', () => {
    expect(stashSummaryText([], [])).toBe('No beads in stash.\n\nNo findings in stash.')
  })
})

describe('makeRequestText', () => {
  const base = { pieceType: 'earrings', style: '' as const, mood: '', recentTitles: [] }

  it('states the request and falls back to open defaults', () => {
    const text = makeRequestText({ ...base, pieceType: '' })
    expect(text).toContain('Piece type: any — choose the best fit for the stash')
    expect(text).toContain('Time available: 1 hour')
    expect(text).toContain('): open')
    expect(text).not.toContain('STYLE (firm constraint')
  })

  it('includes the style constraint when a style is chosen', () => {
    const text = makeRequestText({ ...base, style: 'bohemian', timeAvailable: '15min' })
    expect(text).toContain('STYLE (firm constraint')
    expect(text).toContain('subordinate to the style above')
    expect(text).toContain('15 minutes')
  })

  it('adds recent titles and the refine instruction', () => {
    const text = makeRequestText({
      ...base,
      recentTitles: ['Tidepool Wrap'],
      refine: { previousDesign: { title: 'Old' }, adjustment: '  make it longer ' },
    })
    expect(text).toContain('Do not repeat these recent designs')
    expect(text).toContain('Tidepool Wrap')
    expect(text).toContain('{"title":"Old"}')
    expect(text).toContain('Apply ONLY this requested change: "make it longer"')
  })
})

describe('makeUserContent', () => {
  it('puts the only breakpoint on the stash block, ahead of the request', () => {
    const blocks = makeUserContent('STASH', 'REQUEST')
    expect(blocks.map((b) => b.text)).toEqual(['THEIR STASH:\nSTASH', 'REQUEST'])
    expect(blocks[0].cache_control).toEqual({ type: 'ephemeral' })
    expect(blocks[1].cache_control).toBeUndefined()
  })

  // The retry must start with the same bytes as the first call so it reads the
  // system prompt and stash back from the cache.
  it('keeps the first call as the exact prefix of the retry', () => {
    const first = makeUserContent('STASH', 'REQUEST')
    const retry = makeUserContent('STASH', 'REQUEST', 'FIX')
    expect(retry.slice(0, first.length)).toEqual(first)
    expect(retry[2]).toEqual({ type: 'text', text: 'FIX' })
  })
})

describe('retryFeedbackText', () => {
  it('shows the previous design when there is one', () => {
    const text = retryFeedbackText(['bad qty'], { title: 'Draft' })
    expect(text).toContain('Your previous design was:\n{"title":"Draft"}')
    expect(text).toContain('- bad qty')
  })

  it('omits it when the first reply did not parse', () => {
    const text = retryFeedbackText(['not JSON'], null)
    expect(text).not.toContain('Your previous design was')
    expect(text.startsWith('Your previous design had these problems')).toBe(true)
  })
})
