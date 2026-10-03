import { describe, it, expect } from 'vitest'
import { sanitiseChatMessages, MAX_IMAGES_PER_MESSAGE, MAX_IMAGE_BASE64_CHARS } from '@/lib/chatMessages'

const img = (data = 'aGVsbG8=', media_type = 'image/jpeg') => ({ type: 'image', source: { type: 'base64', media_type, data } })

describe('sanitiseChatMessages', () => {
  it('accepts a plain user turn', () => {
    expect(sanitiseChatMessages([{ role: 'user', content: 'hi' }])).toEqual({
      ok: true,
      messages: [{ role: 'user', content: 'hi' }],
    })
  })

  it('rebuilds blocks, dropping unknown keys', () => {
    const r = sanitiseChatMessages([
      { role: 'user', content: [{ type: 'text', text: 'look', cache_control: { type: 'ephemeral' } }, img()], extra: 1 },
    ])
    expect(r).toEqual({
      ok: true,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: 'look' },
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'aGVsbG8=' } },
        ],
      }],
    })
  })

  it.each([
    ['not an array', 'hello'],
    ['an empty array', []],
    ['a null entry', [null]],
    ['a bad role', [{ role: 'system', content: 'x' }]],
    ['numeric content', [{ role: 'user', content: 5 }]],
    ['a null block', [{ role: 'user', content: [null] }]],
    ['an unknown block type', [{ role: 'user', content: [{ type: 'tool_use' }] }]],
    ['a non-string text block', [{ role: 'user', content: [{ type: 'text', text: 5 }] }]],
  ])('rejects %s instead of throwing', (_label, input) => {
    expect(sanitiseChatMessages(input).ok).toBe(false)
  })

  it('rejects a url image source, which would make the API fetch an arbitrary URL', () => {
    const r = sanitiseChatMessages([{ role: 'user', content: [{ type: 'image', source: { type: 'url', url: 'https://x.test/a.png' } }] }])
    expect(r).toEqual({ ok: false, error: 'Invalid image' })
  })

  it('rejects unsupported image formats and images on assistant turns', () => {
    expect(sanitiseChatMessages([{ role: 'user', content: [img('aGVsbG8=', 'image/svg+xml')] }]).ok).toBe(false)
    expect(sanitiseChatMessages([
      { role: 'user', content: 'a' },
      { role: 'assistant', content: [img()] },
      { role: 'user', content: 'b' },
    ]).ok).toBe(false)
  })

  it('enforces image count and size caps', () => {
    const many = Array.from({ length: MAX_IMAGES_PER_MESSAGE + 1 }, () => img())
    expect(sanitiseChatMessages([{ role: 'user', content: many }])).toEqual({ ok: false, error: 'Too many images in message' })
    const huge = img('a'.repeat(MAX_IMAGE_BASE64_CHARS + 1))
    expect(sanitiseChatMessages([{ role: 'user', content: [huge] }])).toEqual({ ok: false, error: 'Image too large' })
  })

  it('drops empty assistant turns so one failed reply does not poison the history', () => {
    const r = sanitiseChatMessages([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'again' },
    ])
    expect(r.ok && r.messages.map(m => m.role)).toEqual(['user', 'user'])
  })

  it('requires the last turn to be the user', () => {
    expect(sanitiseChatMessages([{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }]).ok).toBe(false)
  })

  it('drops leading assistant turns', () => {
    const r = sanitiseChatMessages([{ role: 'assistant', content: 'hi' }, { role: 'user', content: 'a' }])
    expect(r.ok && r.messages).toEqual([{ role: 'user', content: 'a' }])
  })
})
