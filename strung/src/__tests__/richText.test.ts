import { describe, it, expect } from 'vitest'
import {
  escapeHtml,
  formatRichText,
  GUIDE_PROSE,
  ADVISOR_ANSWER,
  CHAT_MESSAGE,
} from '@/lib/richText'

describe('escapeHtml', () => {
  it('escapes the markup characters', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    )
  })

  it('escapes & first so entities are not double-escaped', () => {
    // If & were replaced last it would hit the & in '&lt;' and produce
    // '&amp;lt;', rendering the literal text "&lt;" to the user.
    expect(escapeHtml('a & b < c')).toBe('a &amp; b &lt; c')
  })

  it('escapes quotes', () => {
    expect(escapeHtml(`"double" 'single'`)).toBe('&quot;double&quot; &#39;single&#39;')
  })

  it('leaves plain text alone', () => {
    expect(escapeHtml('just beads')).toBe('just beads')
  })
})

describe('formatRichText — escaping order', () => {
  it('escapes before markdown replacement, so source tags never go live', () => {
    const html = formatRichText('<img src=x onerror=alert(1)>', ADVISOR_ANSWER)
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('escapes inside a bold run', () => {
    const html = formatRichText('**<b>hi</b>**', ADVISOR_ANSWER)
    // The <strong> is ours; the <b> from the source text is escaped.
    expect(html).toContain('<strong')
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;')
    expect(html).not.toContain('<b>')
  })

  it('does not escape the tags it generates', () => {
    expect(formatRichText('**bold**', ADVISOR_ANSWER)).toContain('<strong style=')
  })
})

describe('formatRichText — structure', () => {
  it('wraps a single block in one paragraph', () => {
    const html = formatRichText('one line', ADVISOR_ANSWER)
    expect(html).toBe('<p style="margin-bottom:10px">one line</p>')
  })

  it('splits blank-line-separated blocks into separate paragraphs', () => {
    const html = formatRichText('first\n\nsecond', ADVISOR_ANSWER)
    expect(html.match(/<p /g)).toHaveLength(2)
    expect(html).toContain('first')
    expect(html).toContain('second')
  })

  it('applies the preset paragraph style and strong colour', () => {
    const html = formatRichText('**x**', GUIDE_PROSE)
    expect(html).toContain('line-height:1.8')
    expect(html).toContain('color:var(--silver3)')
  })

  it.each([
    ['an empty string', ''],
    ['whitespace only', '   \n  '],
  ])('returns an empty string for %s', (_label, input) => {
    expect(formatRichText(input, ADVISOR_ANSWER)).toBe('')
  })

  it('returns an empty string for a non-string input', () => {
    expect(formatRichText(undefined as unknown as string, ADVISOR_ANSWER)).toBe('')
  })
})

describe('formatRichText — lineBreaks', () => {
  it('turns single newlines into <br/> when enabled', () => {
    expect(formatRichText('a\nb', GUIDE_PROSE)).toContain('a<br/>b')
  })

  it('joins wrapped lines with a space when disabled', () => {
    const html = formatRichText('a\nb', ADVISOR_ANSWER)
    expect(html).toContain('a b')
    expect(html).not.toContain('<br/>')
  })
})

describe('formatRichText — lists', () => {
  it('groups consecutive bullets into ONE list', () => {
    // The previous implementation wrapped each <li> in its own <ul>, which put
    // a list margin between every single bullet.
    const html = formatRichText('- one\n- two\n- three', CHAT_MESSAGE)
    expect(html.match(/<ul/g)).toHaveLength(1)
    expect(html.match(/<li/g)).toHaveLength(3)
  })

  it('accepts • as a bullet marker', () => {
    expect(formatRichText('• one\n• two', CHAT_MESSAGE).match(/<li/g)).toHaveLength(2)
  })

  it('keeps prose and bullets in the same block as separate elements', () => {
    const html = formatRichText('Here goes:\n- one\n- two', CHAT_MESSAGE)
    expect(html).toContain('<p style="margin-bottom:10px">Here goes:</p>')
    expect(html.match(/<ul/g)).toHaveLength(1)
    expect(html.match(/<li/g)).toHaveLength(2)
    // Prose first, list after.
    expect(html.indexOf('<p')).toBeLessThan(html.indexOf('<ul'))
  })

  it('starts a new list after intervening prose', () => {
    const html = formatRichText('- a\nthen\n- b', CHAT_MESSAGE)
    expect(html.match(/<ul/g)).toHaveLength(2)
  })

  it('renders bold inside a list item', () => {
    expect(formatRichText('- **bold** item', CHAT_MESSAGE)).toContain('<strong style="color:var(--cream)">bold</strong>')
  })

  it('leaves bullets as literal text when lists are disabled', () => {
    const html = formatRichText('- one\n- two', ADVISOR_ANSWER)
    expect(html).not.toContain('<li')
    expect(html).toContain('- one')
  })
})

describe('presets', () => {
  it('GUIDE_PROSE preserves hard line breaks and does not make lists', () => {
    expect(GUIDE_PROSE.lineBreaks).toBe(true)
    expect(GUIDE_PROSE.lists).toBeFalsy()
  })

  it('ADVISOR_ANSWER makes neither lists nor line breaks', () => {
    expect(ADVISOR_ANSWER.lists).toBeFalsy()
    expect(ADVISOR_ANSWER.lineBreaks).toBeFalsy()
  })

  it('CHAT_MESSAGE is the only preset that makes lists', () => {
    expect(CHAT_MESSAGE.lists).toBe(true)
  })

  it.each([
    ['GUIDE_PROSE', GUIDE_PROSE],
    ['ADVISOR_ANSWER', ADVISOR_ANSWER],
    ['CHAT_MESSAGE', CHAT_MESSAGE],
  ])('%s styles resolve through CSS variables, not literal hex', (_label, preset) => {
    expect(preset.strongColour).toMatch(/^var\(--/)
    expect(preset.paragraphStyle).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })
})
