import { describe, it, expect } from 'vitest'
import { isAllowedTable, stripJsonFences, parseJsonLoose } from '@/lib/colour'

describe('isAllowedTable', () => {
  it('allows beads and findings', () => {
    expect(isAllowedTable('beads')).toBe(true)
    expect(isAllowedTable('findings')).toBe(true)
  })

  it('rejects arbitrary strings and null', () => {
    expect(isAllowedTable('users')).toBe(false)
    expect(isAllowedTable(null)).toBe(false)
    expect(isAllowedTable(undefined)).toBe(false)
    expect(isAllowedTable('')).toBe(false)
  })
})

describe('stripJsonFences', () => {
  it('removes markdown code fences', () => {
    expect(stripJsonFences('```json\n{"a":1}\n```')).toBe('{"a":1}')
    expect(stripJsonFences('```\n{"a":1}\n```')).toBe('{"a":1}')
  })

  it('leaves plain JSON untouched', () => {
    expect(stripJsonFences('{"a":1}')).toBe('{"a":1}')
  })
})

describe('parseJsonLoose', () => {
  it('parses plain JSON', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 })
  })

  it('parses JSON wrapped in markdown fences', () => {
    expect(parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJsonLoose('```\n{"b":2}\n```')).toEqual({ b: 2 })
  })

  it('recovers the outermost object when the model adds prose', () => {
    expect(parseJsonLoose('Sure! Here is your design:\n{"title":"X"}\nHope that helps.'))
      .toEqual({ title: 'X' })
  })

  it('recovers a nested-brace object from surrounding prose', () => {
    expect(parseJsonLoose('Prefix {"a":{"b":2}} suffix')).toEqual({ a: { b: 2 } })
  })

  it('throws when there is no JSON object at all', () => {
    expect(() => parseJsonLoose('no json here')).toThrow()
    expect(() => parseJsonLoose('')).toThrow()
  })
})

describe('isAllowedTable — non-string inputs', () => {
  it.each([
    ['a number', 0],
    ['a nonzero number', 1],
    ['an object', { table: 'beads' }],
    ['an array of a valid name', ['beads']],
    ['a boolean', true],
    ['a String object', new String('beads')],
  ])('rejects %s', (_label, value) => {
    // The signature takes `unknown` so a raw query-string or body value can be
    // handed straight in; the type check lives here rather than at each call
    // site, where it was easy to forget.
    expect(isAllowedTable(value)).toBe(false)
  })

  it('narrows the type for a valid name', () => {
    const value: unknown = 'beads'
    if (isAllowedTable(value)) {
      // Compiles only because the guard narrowed `unknown` to AllowedTable.
      const table: 'beads' | 'findings' = value
      expect(table).toBe('beads')
    } else {
      throw new Error('guard should have accepted "beads"')
    }
  })

  it('is case-sensitive', () => {
    expect(isAllowedTable('Beads')).toBe(false)
    expect(isAllowedTable('BEADS')).toBe(false)
  })
})
