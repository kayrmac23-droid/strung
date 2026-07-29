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
