import { describe, it, expect } from 'vitest'
import {
  sanitiseChatMessages,
  trimChatHistory,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_BASE64_CHARS,
  MAX_IMAGES_TOTAL,
  MAX_MESSAGES,
  MAX_HISTORY_IMAGE_CHARS,
  PHOTO_PLACEHOLDER,
  type OutgoingMessage,
} from '@/lib/chatMessages'

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

describe('trimChatHistory', () => {
  const user = (content: OutgoingMessage['content']): OutgoingMessage => ({ role: 'user', content })
  const assistant = (content: string): OutgoingMessage => ({ role: 'assistant', content })
  const photoTurn = (data = 'aGVsbG8=') => user([img(data), { type: 'text', text: 'this one?' }])
  const imageCount = (ms: OutgoingMessage[]) =>
    ms.flatMap(m => (typeof m.content === 'string' ? [] : m.content)).filter(b => b.type === 'image').length

  it('keeps a long chat under the route limits, so it never locks itself out', () => {
    const history: OutgoingMessage[] = []
    for (let i = 0; i < 40; i++) history.push(photoTurn(), assistant(`reply ${i}`))
    history.push(user('and now?'))
    const trimmed = trimChatHistory(history)
    expect(trimmed.length).toBeLessThanOrEqual(MAX_MESSAGES)
    expect(imageCount(trimmed)).toBe(MAX_IMAGES_TOTAL)
    expect(trimmed[trimmed.length - 1]).toEqual(user('and now?'))
    expect(sanitiseChatMessages(trimmed).ok).toBe(true)
  })

  it('keeps the newest photos and replaces older ones with a note', () => {
    const history = [photoTurn('b2xk'), assistant('nice'), photoTurn('bmV3')]
    const trimmed = trimChatHistory(history)
    expect(imageCount(trimmed)).toBe(2)
    const many = Array.from({ length: MAX_IMAGES_TOTAL + 1 }, (_, i) => [photoTurn(`p${i}`), assistant('ok')]).flat()
    const out = trimChatHistory([...many, user('so?')])
    const first = out[0].content as { type: string; text?: string }[]
    expect(first[0]).toEqual({ type: 'text', text: PHOTO_PLACEHOLDER })
  })

  it('drops photos that would push the request body past the size budget', () => {
    const big = 'x'.repeat(Math.ceil(MAX_HISTORY_IMAGE_CHARS / 2) + 1)
    const trimmed = trimChatHistory([photoTurn(big), assistant('ok'), photoTurn(big)])
    expect(imageCount(trimmed)).toBe(1)
  })

  it('starts on a user turn after slicing', () => {
    const history: OutgoingMessage[] = []
    for (let i = 0; i < MAX_MESSAGES; i++) history.push(user(`q${i}`), assistant(`a${i}`))
    history.push(user('last'))
    expect(trimChatHistory(history)[0].role).toBe('user')
  })
})
