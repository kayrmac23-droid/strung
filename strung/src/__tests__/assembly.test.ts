import { describe, it, expect } from 'vitest'
import {
  validateAssembly,
  normaliseAssembly,
  expandStrands,
  layoutBranched,
  type AssemblyStrand,
} from '@/lib/assembly'
import { ASSEMBLY_SCHEMA_TEXT, ASSEMBLY_SCHEMA_COMPACT, ASSEMBLY_RULES, ASSEMBLY_FORMS } from '@/lib/designVocab'

const design = (assembly: unknown) => ({
  title: 'Fringe',
  components: [
    { item: 'Brass hoop', quantity: 2, note: 'frame' },
    { item: 'Amber drops', quantity: 8, note: 'fringe' },
    { item: 'Teal seed beads', quantity: 40, note: 'spacers' },
  ],
  ...(assembly === undefined ? {} : { assembly }),
})

const branched = {
  form: 'branched',
  anchor: 'Brass hoop',
  strands: [
    { id: 1, attachAt: 'left', repeat: 2, elements: [{ item: 'Teal seed beads', quantity: 2 }] },
    { id: 2, attachAt: 'centre', repeat: 1, elements: [{ item: 'Teal seed beads', quantity: 3 }, { item: 'Amber drops', quantity: 1 }] },
  ],
}

describe('validateAssembly', () => {
  it('passes a design with no assembly at all — the field is optional', () => {
    expect(validateAssembly(design(undefined))).toEqual([])
    expect(validateAssembly(design(null))).toEqual([])
    expect(validateAssembly(undefined)).toEqual([])
  })

  it('passes a well-formed branched assembly', () => {
    expect(validateAssembly(design(branched))).toEqual([])
  })

  it('matches component names case-insensitively and ignores surrounding space', () => {
    const v = validateAssembly(design({ ...branched, anchor: '  brass HOOP ' }))
    expect(v).toEqual([])
  })

  it('flags an element that is not in components[]', () => {
    const v = validateAssembly(
      design({ ...branched, strands: [{ id: 3, attachAt: 'left', repeat: 1, elements: [{ item: 'Moonstone rounds', quantity: 1 }] }] }),
    )
    expect(v).toHaveLength(1)
    expect(v[0]).toContain('Moonstone rounds')
    expect(v[0]).toContain('components[]')
  })

  it('flags an anchor that is not in components[]', () => {
    const v = validateAssembly(design({ ...branched, anchor: 'Silver ear wire' }))
    expect(v).toHaveLength(1)
    expect(v[0]).toContain('Silver ear wire')
  })

  it('allows a null anchor', () => {
    expect(validateAssembly(design({ form: 'strand', anchor: null, strands: [] }))).toEqual([])
  })

  it('flags a form outside the three allowed values', () => {
    const v = validateAssembly(design({ ...branched, form: 'chandelier' }))
    expect(v).toHaveLength(1)
    expect(v[0]).toContain('chandelier')
    for (const f of ASSEMBLY_FORMS) expect(v[0]).toContain(f)
  })

  it('reports every failure at once so one repair pass can fix them all', () => {
    const v = validateAssembly(
      design({
        form: 'tiered',
        anchor: 'Gold filigree',
        strands: [{ id: 1, attachAt: 'left', repeat: 1, elements: [{ item: 'Lapis rounds', quantity: 1 }] }],
      }),
    )
    expect(v).toHaveLength(3)
  })

  it('flags a drop or branched form with no strands', () => {
    const v = validateAssembly(design({ form: 'drop', anchor: 'Brass hoop', strands: [] }))
    expect(v).toHaveLength(1)
    expect(v[0]).toContain('strands')
  })

  it('never throws on garbage shapes', () => {
    expect(validateAssembly(design('branched')).length).toBe(1)
    expect(validateAssembly(design({ form: 'branched', anchor: 'Brass hoop', strands: 'nope' })).length).toBe(1)
    expect(validateAssembly({ components: 'nope', assembly: branched }).length).toBeGreaterThan(0)
  })
})

describe('normaliseAssembly', () => {
  it('returns null for a design with no assembly — pre-assembly saved builds', () => {
    expect(normaliseAssembly(design(undefined))).toBeNull()
    expect(normaliseAssembly(null)).toBeNull()
    expect(normaliseAssembly({ components: [] })).toBeNull()
  })

  it('returns null for form "strand" so it renders as a single column', () => {
    expect(normaliseAssembly(design({ form: 'strand', anchor: null, strands: [] }))).toBeNull()
  })

  it('returns null when no strand has any elements', () => {
    expect(normaliseAssembly(design({ form: 'branched', anchor: 'Brass hoop', strands: [{ elements: [] }] }))).toBeNull()
  })

  it('normalises a branched assembly and defaults missing fields', () => {
    const a = normaliseAssembly(design({ form: 'branched', anchor: 'Brass hoop', strands: [{ elements: [{ item: 'Amber drops' }] }] }))
    expect(a).not.toBeNull()
    expect(a!.form).toBe('branched')
    expect(a!.anchor).toBe('Brass hoop')
    expect(a!.strands[0]).toMatchObject({ attachAt: 'centre', repeat: 1 })
    expect(a!.strands[0].elements[0]).toEqual({ item: 'Amber drops', quantity: 1 })
  })

  it('clamps absurd repeat and quantity values', () => {
    const a = normaliseAssembly(design({ form: 'branched', anchor: null, strands: [{ repeat: 9999, elements: [{ item: 'Amber drops', quantity: 9999 }] }] }))
    expect(a!.strands[0].repeat).toBeLessThanOrEqual(12)
    expect(a!.strands[0].elements[0].quantity).toBeLessThanOrEqual(12)
  })

  it('treats "center" and "middle" as centre', () => {
    const a = normaliseAssembly(design({ form: 'drop', anchor: null, strands: [{ attachAt: 'center', elements: [{ item: 'x' }] }, { attachAt: 'middle', elements: [{ item: 'y' }] }] }))
    expect(a!.strands.map((s) => s.attachAt)).toEqual(['centre', 'centre'])
  })
})

const strand = (attachAt: AssemblyStrand['attachAt'], id: number, repeat = 1): AssemblyStrand => ({
  id,
  attachAt,
  repeat,
  elements: [{ item: `bead ${id}`, quantity: 1 }],
})

describe('expandStrands', () => {
  it('orders left, then centre, then right', () => {
    const out = expandStrands([strand('right', 1), strand('centre', 2), strand('left', 3)])
    expect(out.map((s) => s.attachAt)).toEqual(['left', 'centre', 'right'])
  })

  it('keeps authored order within one attach point', () => {
    const out = expandStrands([strand('left', 1), strand('left', 2), strand('left', 3)])
    expect(out.map((s) => s.id)).toEqual([1, 2, 3])
  })

  it('expands repeat into that many rendered strands', () => {
    const out = expandStrands([strand('centre', 1, 3), strand('right', 2)])
    expect(out.map((s) => s.id)).toEqual([1, 1, 1, 2])
  })
})

describe('layoutBranched', () => {
  it('grows wider with more strands and taller with longer ones', () => {
    const narrow = layoutBranched([3, 3])
    const wide = layoutBranched([3, 3, 3, 3, 3, 3, 3, 3])
    const tall = layoutBranched([3, 12])
    expect(wide.width).toBeGreaterThan(narrow.width)
    expect(wide.columns).toHaveLength(8)
    expect(tall.height).toBeGreaterThan(narrow.height)
  })

  it('centres the columns on the anchor and spaces them evenly', () => {
    const { columns, anchorX } = layoutBranched([1, 1, 1])
    expect(columns[1]).toBeCloseTo(anchorX)
    expect(columns[1] - columns[0]).toBeCloseTo(columns[2] - columns[1])
    expect((columns[0] + columns[2]) / 2).toBeCloseTo(anchorX)
  })

  it('keeps a single drop inside the viewBox', () => {
    const { width, columns, anchorX, height, strandTop } = layoutBranched([4])
    expect(columns).toEqual([anchorX])
    expect(anchorX).toBeGreaterThan(0)
    expect(anchorX).toBeLessThan(width)
    expect(height).toBeGreaterThan(strandTop)
  })

  it('survives an empty strand list', () => {
    const l = layoutBranched([])
    expect(l.width).toBeGreaterThan(0)
    expect(l.height).toBeGreaterThan(0)
  })
})

describe('assembly prompt vocabulary', () => {
  it('describes the same schema in both the pretty and compact forms', () => {
    for (const key of ['form', 'anchor', 'strands', 'attachAt', 'repeat', 'elements', 'item', 'quantity']) {
      expect(ASSEMBLY_SCHEMA_TEXT).toContain(`"${key}"`)
      expect(ASSEMBLY_SCHEMA_COMPACT).toContain(`"${key}"`)
    }
    expect(ASSEMBLY_SCHEMA_COMPACT).not.toContain('\n')
  })

  it('states that assembly is optional and may not introduce materials', () => {
    expect(ASSEMBLY_RULES).toMatch(/OPTIONAL/)
    expect(ASSEMBLY_RULES).toContain('components[]')
    for (const f of ASSEMBLY_FORMS) expect(ASSEMBLY_RULES).toContain(`"${f}"`)
  })
})
