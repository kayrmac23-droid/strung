import { describe, it, expect } from 'vitest'
import { cleanStashInput } from '@/lib/stashItems'
import { cleanBuildInput, storableDesign, MAX_DESIGN_CHARS } from '@/lib/builds'

const bead = { name: ' Labradorite ', type: 'gemstone', colour: 'grey', hex: '#7A9AB8', size: 'small', quantity: 4 }
const finding = { name: 'Ear wires', type: 'ear_wire', metal: 'silver', quantity: 10 }

describe('cleanStashInput', () => {
  it('accepts a valid bead, trimming and lowercasing hex', () => {
    expect(cleanStashInput('beads', bead, false)).toEqual({
      ok: true,
      fields: { name: 'Labradorite', type: 'gemstone', colour: 'grey', hex: '#7a9ab8', size: 'small', quantity: 4 },
    })
  })

  it('drops unknown keys (the field whitelist)', () => {
    const r = cleanStashInput('findings', { ...finding, user_id: 'someone-else', id: 'x', confidence: 'likely' }, false)
    expect(r.ok && Object.keys(r.fields).sort()).toEqual(['metal', 'name', 'quantity', 'type'])
  })

  it.each([
    ['a bad hex', { ...bead, hex: 'banana' }],
    ['a negative quantity', { ...bead, quantity: -40 }],
    ['a fractional quantity', { ...bead, quantity: 2.5 }],
    ['a string quantity', { ...bead, quantity: '4' }],
    ['an unknown type', { ...bead, type: 'plastic' }],
    ['a blank name', { ...bead, name: '   ' }],
    ['an over-long note', { ...bead, notes: 'x'.repeat(1001) }],
    ['an object name', { ...bead, name: { toString: (): string => 'x' } }],
  ])('rejects %s', (_label, input) => {
    expect(cleanStashInput('beads', input, false).ok).toBe(false)
  })

  it('requires name, type and metal on insert but not on update', () => {
    expect(cleanStashInput('findings', { name: 'x', type: 'clasp' }, false)).toEqual({ ok: false, error: 'Missing metal' })
    expect(cleanStashInput('findings', { quantity: 0 }, true)).toEqual({ ok: true, fields: { quantity: 0 } })
  })

  it('still validates a field that an update does send', () => {
    expect(cleanStashInput('beads', { name: '' }, true).ok).toBe(false)
  })

  it('stores empty optional text as null', () => {
    const r = cleanStashInput('beads', { ...bead, notes: '  ', shape: null }, false)
    expect(r.ok && r.fields.notes).toBeNull()
    expect(r.ok && r.fields.shape).toBeNull()
  })

  it('rejects a non-object', () => {
    expect(cleanStashInput('beads', null, false).ok).toBe(false)
    expect(cleanStashInput('beads', [bead], false).ok).toBe(false)
  })
})

describe('cleanBuildInput', () => {
  const design = { title: 'T', components: [], steps: [] }

  it('accepts a new build', () => {
    expect(cleanBuildInput({ title: 'T', design, status: 'draft', current_step: 0 }, false)).toEqual({
      ok: true,
      fields: { title: 'T', design, status: 'draft', current_step: 0 },
    })
  })

  it('requires title and design on insert only', () => {
    expect(cleanBuildInput({ design }, false).ok).toBe(false)
    expect(cleanBuildInput({ title: 'T' }, false).ok).toBe(false)
    expect(cleanBuildInput({ status: 'completed' }, true)).toEqual({ ok: true, fields: { status: 'completed' } })
  })

  it.each([
    ['an unknown status', { status: 'banana' }],
    ['an unknown rating', { rating: 5 }],
    ['a negative step', { current_step: -1 }],
    ['a bad timestamp', { completed_at: 'yesterday-ish' }],
    ['a string design', { design: 'x' }],
    ['non-string notes', { notes: 12 }],
  ])('rejects %s', (_label, input) => {
    expect(cleanBuildInput(input, true).ok).toBe(false)
  })

  it('allows clearing nullable fields', () => {
    expect(cleanBuildInput({ rating: null, notes: null, completed_at: null }, true)).toEqual({
      ok: true,
      fields: { rating: null, notes: null, completed_at: null },
    })
  })

  it('strips the base64 preview image from a design', () => {
    const r = cleanBuildInput({ title: 'T', design: { ...design, imageUrl: 'data:image/png;base64,' + 'A'.repeat(MAX_DESIGN_CHARS) } }, false)
    expect(r).toEqual({ ok: true, fields: { title: 'T', design } })
  })

  it('rejects an oversized design', () => {
    const r = cleanBuildInput({ title: 'T', design: { ...design, blob: 'A'.repeat(MAX_DESIGN_CHARS) } }, false)
    expect(r).toEqual({ ok: false, error: 'Design too large' })
  })

  it('storableDesign does not mutate its input', () => {
    const d = { title: 'T', imageUrl: 'x' }
    expect(storableDesign(d)).toEqual({ title: 'T' })
    expect(d.imageUrl).toBe('x')
  })
})
