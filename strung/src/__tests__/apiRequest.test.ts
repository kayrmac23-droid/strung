import { describe, it, expect } from 'vitest'
import { getToken, parseBody, firstTextBlock, truncStr, STREAM_ERROR_MARKER } from '@/lib/apiRequest'

const req = (init?: RequestInit) => new Request('https://example.test/api', init)

describe('getToken', () => {
  it('extracts the bearer token', () => {
    expect(getToken(req({ headers: { Authorization: 'Bearer abc123' } }))).toBe('abc123')
  })

  it('returns an empty string when the header is absent', () => {
    expect(getToken(req())).toBe('')
  })

  it('returns the raw value when the scheme is missing', () => {
    // No 'Bearer ' prefix to strip, so the value passes through as-is and the
    // resulting Supabase client simply has no rights.
    expect(getToken(req({ headers: { Authorization: 'abc123' } }))).toBe('abc123')
  })
})

describe('parseBody', () => {
  const json = (body: string) =>
    req({ method: 'POST', body, headers: { 'Content-Type': 'application/json' } })

  it('returns the parsed object', async () => {
    expect(await parseBody(json('{"a":1}'))).toEqual({ a: 1 })
  })

  it('returns null for unparseable JSON so the caller can answer 400', async () => {
    expect(await parseBody(json('{not json'))).toBeNull()
  })

  it('returns null for an empty body', async () => {
    expect(await parseBody(req({ method: 'POST' }))).toBeNull()
  })

  it.each([
    ['a number', '5'],
    ['a string', '"text"'],
    ['null', 'null'],
    ['an array', '[1,2,3]'],
  ])('collapses %s to {} rather than null', async (_label, body) => {
    // {} and null mean different things to callers: null is "malformed, send
    // 400", {} is "valid JSON, just nothing useful — fall through to field
    // validation". A bare array is valid JSON, so it must not read as malformed.
    expect(await parseBody(json(body))).toEqual({})
  })
})

describe('firstTextBlock', () => {
  it('reads the text of a single text block', () => {
    expect(firstTextBlock({ content: [{ type: 'text', text: 'hello' }] })).toBe('hello')
  })

  it('skips a leading non-text block', () => {
    // This is the whole reason the helper exists: content[0] assumed the first
    // block was text, so a leading thinking/tool_use block silently yielded ''
    // and the route reported a parse failure for a good response.
    expect(firstTextBlock({
      content: [
        { type: 'thinking', thinking: 'hmm' },
        { type: 'text', text: 'the answer' },
      ],
    })).toBe('the answer')
  })

  it('returns the first text block when there are several', () => {
    expect(firstTextBlock({
      content: [{ type: 'text', text: 'first' }, { type: 'text', text: 'second' }],
    })).toBe('first')
  })

  it('returns an empty string when no block is text', () => {
    expect(firstTextBlock({ content: [{ type: 'tool_use', id: 't1' }] })).toBe('')
  })

  it.each([
    ['an empty content array', { content: [] }],
    ['non-array content', { content: 'hello' }],
    ['a missing content key', {}],
    ['null', null],
    ['undefined', undefined],
  ])('returns an empty string for %s', (_label, msg) => {
    expect(firstTextBlock(msg as { content?: unknown } | null | undefined)).toBe('')
  })

  it('ignores a text block whose text is not a string', () => {
    expect(firstTextBlock({ content: [{ type: 'text', text: 42 }] })).toBe('')
  })
})

describe('truncStr', () => {
  it('passes a short string through unchanged', () => {
    expect(truncStr('bead', 100)).toBe('bead')
  })

  it('truncates to the cap', () => {
    expect(truncStr('x'.repeat(500), 10)).toBe('x'.repeat(10))
  })

  it('returns an empty string at a cap of 0', () => {
    expect(truncStr('bead', 0)).toBe('')
  })

  it.each([
    ['a number', 42],
    ['an object', { toString: () => 'evil' }],
    ['an array', ['a', 'b']],
    ['null', null],
    ['undefined', undefined],
    ['a boolean', true],
  ])('returns an empty string for %s rather than coercing it', (_label, value) => {
    // Coercing would let a client smuggle text past the length cap via
    // stringification — an object's toString is not bounded by `max`.
    expect(truncStr(value, 100)).toBe('')
  })
})

describe('STREAM_ERROR_MARKER', () => {
  it('is visible prose, not a silent sentinel', () => {
    // It is appended to a live stream and rendered to the user as-is, so it has
    // to read as an explanation rather than a token.
    expect(STREAM_ERROR_MARKER).toContain('cut short')
    expect(STREAM_ERROR_MARKER.startsWith('\n\n')).toBe(true)
  })
})
