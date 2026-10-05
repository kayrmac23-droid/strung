import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Schematic from '@/components/Schematic'
import type { BeadItem, FindingItem } from '@/lib/supabase'

const beads = [
  { id: '1', name: 'Amber drops', colour: 'amber', hex: '#c8860a', shape: 'briolette', quantity: 8 },
  { id: '2', name: 'Teal seed beads', colour: 'teal', hex: '#008080', shape: 'round', quantity: 60 },
] as unknown as BeadItem[]

const findings = [
  { id: '3', name: 'Brass hoop', type: 'statement_component', metal: 'brass', quantity: 2 },
] as unknown as FindingItem[]

const components = [
  { item: 'Brass hoop', quantity: 2, note: 'frame' },
  { item: 'Amber drops', quantity: 6, note: 'fringe tips' },
  { item: 'Teal seed beads', quantity: 30, note: 'fringe' },
]

function svgOf(container: HTMLElement) {
  const svg = container.querySelector('svg')
  if (!svg) throw new Error('no svg rendered')
  return svg
}

describe('Schematic — single column (no assembly)', () => {
  it('renders one glyph per component for a design with no assembly field', () => {
    const { container } = render(<Schematic blueprint={{ components }} beads={beads} findings={findings} />)
    const svg = svgOf(container)
    // Three components, three labels, and the fixed single-column viewBox width.
    expect(svg.getAttribute('viewBox')).toMatch(/^0 0 520 /)
    expect(container.textContent).toContain('Brass hoop')
    expect(container.textContent).toContain('Amber drops')
  })

  it('renders the same single column when form is "strand"', () => {
    const blueprint = { components, assembly: { form: 'strand', anchor: null, strands: [] } }
    const { container } = render(<Schematic blueprint={blueprint} beads={beads} findings={findings} />)
    expect(svgOf(container).getAttribute('viewBox')).toMatch(/^0 0 520 /)
  })

  it('shows the empty state when there is nothing to diagram', () => {
    const { container } = render(<Schematic blueprint={{}} beads={beads} findings={findings} />)
    expect(container.querySelector('svg')).toBeNull()
    expect(container.textContent).toContain('No components to diagram yet.')
  })
})

describe('Schematic — branched', () => {
  const blueprint = {
    components,
    assembly: {
      form: 'branched',
      anchor: 'Brass hoop',
      strands: [
        { id: 1, attachAt: 'left', repeat: 2, elements: [{ item: 'Teal seed beads', quantity: 2 }] },
        { id: 2, attachAt: 'centre', repeat: 1, elements: [{ item: 'Teal seed beads', quantity: 4 }, { item: 'Amber drops', quantity: 1 }] },
      ],
    },
  }

  it('expands repeats into separate rendered strands', () => {
    const { container } = render(<Schematic blueprint={blueprint} beads={beads} findings={findings} />)
    // 2 left (repeat) + 1 centre = 3 columns, each numbered beneath.
    const numbers = [...container.querySelectorAll('text')].map((t) => t.textContent)
    expect(numbers).toContain('1')
    expect(numbers).toContain('2')
    expect(numbers).toContain('3')
    expect(numbers).not.toContain('4')
  })

  it('draws the anchor once, with a connector to every strand', () => {
    const { container } = render(<Schematic blueprint={blueprint} beads={beads} findings={findings} />)
    expect(container.textContent).toContain('Brass hoop')
    // One connector per strand, plus a vertical wire on each strand of 2+ glyphs.
    expect(container.querySelectorAll('line')).toHaveLength(3 + 3)
    // Glyph count is the sum of element quantities: 2 + 2 + 5, plus the anchor.
    expect(container.querySelectorAll('circle, ellipse, rect, polygon, path')).toHaveLength(2 + 2 + 5 + 1)
  })

  it('sizes the viewBox from the strand count and the longest strand', () => {
    const { container } = render(<Schematic blueprint={blueprint} beads={beads} findings={findings} />)
    const narrow = svgOf(container).getAttribute('viewBox')!.split(' ').map(Number)

    const wide = {
      ...blueprint,
      assembly: { ...blueprint.assembly, strands: [{ ...blueprint.assembly.strands[0], repeat: 9 }] },
    }
    const wider = render(<Schematic blueprint={wide} beads={beads} findings={findings} />)
    const wideBox = svgOf(wider.container).getAttribute('viewBox')!.split(' ').map(Number)

    expect(wideBox[2]).toBeGreaterThan(narrow[2])
    // The tall strand is gone, so the wide chandelier is also shorter.
    expect(wideBox[3]).toBeLessThan(narrow[3])
  })
})

describe('Schematic — join glyphs from technique', () => {
  // (a) Regression guard: a design with no technique and no assembly must render
  // exactly as before — a single spanning wire and NOT a single join glyph.
  it('draws plain straight joins when the design has no technique or assembly', () => {
    const noTech = { components, steps: [{ id: 1, material: 'Teal seed beads', technique: 'Stringing' }] }
    const { container } = render(<Schematic blueprint={noTech} beads={beads} findings={findings} />)
    // One spanning line for the column, no join glyphs at all.
    expect(container.querySelectorAll('line')).toHaveLength(1)
    expect(container.querySelectorAll('.join')).toHaveLength(0)
  })

  it('leaves saved designs (no steps field at all) as a single straight line', () => {
    const { container } = render(<Schematic blueprint={{ components }} beads={beads} findings={findings} />)
    expect(container.querySelectorAll('line')).toHaveLength(1)
    expect(container.querySelectorAll('.join')).toHaveLength(0)
  })

  // (b) A linked-chain strand renders wrapped-join glyphs.
  it('draws wrapped joins for a strand whose element is worked as Linked Chain', () => {
    const blueprint = {
      components: [
        { item: 'Brass hoop', quantity: 2, note: 'frame' },
        { item: 'Garnet rounds', quantity: 6, note: 'links' },
      ],
      steps: [{ id: 1, material: 'Garnet rounds', technique: 'Linked Chain' }],
      assembly: {
        form: 'branched',
        anchor: 'Brass hoop',
        strands: [{ id: 1, attachAt: 'centre', repeat: 1, elements: [{ item: 'Garnet rounds', quantity: 2 }] }],
      },
    }
    const { container } = render(<Schematic blueprint={blueprint} beads={beads} findings={findings} />)
    expect(container.querySelectorAll('.join-wrapped').length).toBeGreaterThan(0)
    // No plain spanning line on a wrapped strand — it is drawn per gap instead.
    expect(container.querySelectorAll('.join-straight')).toHaveLength(0)
  })

  // (c) A quantity-3 Linked Chain element yields three joins: the top link's
  // attachment cap plus a wrapped join between each of the three stacked copies.
  it('inserts a join between every expanded copy of a quantity-3 linked element', () => {
    const blueprint = {
      components: [
        { item: 'Brass hoop', quantity: 2, note: 'frame' },
        { item: 'Garnet rounds', quantity: 3, note: 'links' },
      ],
      steps: [{ id: 1, material: 'Garnet rounds', technique: 'Linked Chain' }],
      assembly: {
        form: 'branched',
        anchor: 'Brass hoop',
        strands: [{ id: 1, attachAt: 'centre', repeat: 1, elements: [{ item: 'Garnet rounds', quantity: 3 }] }],
      },
    }
    const { container } = render(<Schematic blueprint={blueprint} beads={beads} findings={findings} />)
    // 3 links → 3 joins: one attachment cap + two loop-to-loop joins between copies.
    expect(container.querySelectorAll('.join')).toHaveLength(3)
    expect(container.querySelectorAll('.join-cap')).toHaveLength(1)
    expect(container.querySelectorAll('.join-wrapped')).toHaveLength(2)
  })
})

describe('Schematic — bead size', () => {
  const sized = (size: unknown) =>
    [{ id: 's', name: 'Garnet rounds', colour: 'garnet', hex: '#7a1f2b', shape: 'round', quantity: 9, ...(size === undefined ? {} : { size }) }] as unknown as BeadItem[]
  const blueprint = { components: [{ item: 'Garnet rounds', quantity: 4 }, { item: 'Garnet rounds', quantity: 4 }] }
  const radius = (container: HTMLElement) => Number(container.querySelector('circle')!.getAttribute('r'))
  const height = (container: HTMLElement) => svgOf(container).getAttribute('viewBox')!.split(' ').map(Number)[3]

  it('renders a bead with no size at the default radius, identical to a medium bead', () => {
    const none = render(<Schematic blueprint={blueprint} beads={sized(undefined)} />).container
    const empty = render(<Schematic blueprint={blueprint} beads={sized('')} />).container
    const medium = render(<Schematic blueprint={blueprint} beads={sized('medium')} />).container
    expect(radius(none)).toBe(15)
    expect(empty.innerHTML).toBe(none.innerHTML)
    expect(medium.innerHTML).toBe(none.innerHTML)
  })

  it('scales the glyph radius with the stash size', () => {
    const seed = radius(render(<Schematic blueprint={blueprint} beads={sized('seed')} />).container)
    const statement = radius(render(<Schematic blueprint={blueprint} beads={sized('statement')} />).container)
    expect(seed).toBeLessThan(15)
    expect(statement).toBeGreaterThan(15)
  })

  it('opens the row spacing for oversized beads only', () => {
    const base = height(render(<Schematic blueprint={blueprint} beads={sized('medium')} />).container)
    const seed = height(render(<Schematic blueprint={blueprint} beads={sized('seed')} />).container)
    const statement = height(render(<Schematic blueprint={blueprint} beads={sized('statement')} />).container)
    expect(seed).toBe(base)
    expect(statement).toBeGreaterThan(base)
  })

  it('does not scale findings by their size field', () => {
    const sizedFinding = [{ ...findings[0], size: '40mm' }] as unknown as FindingItem[]
    const { container } = render(<Schematic blueprint={{ components: [{ item: 'Brass hoop' }] }} findings={sizedFinding} />)
    expect(radius(container)).toBe(15)
  })
})
