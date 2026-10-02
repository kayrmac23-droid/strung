import { describe, it, expect } from 'vitest'
import { ALLOWED_TECHNIQUES, VALID_STYLES } from '@/lib/designVocab'
import {
  referencePool,
  ALL_REFERENCES,
  TAGGED_REFERENCES,
  REFERENCE_VOCABULARY,
  findReferences,
  getReference,
  sampleVariedReferences,
  isTagged,
  type TaggedReference,
} from '@/lib/referencePool'

const LIST_FIELDS = [
  'construction',
  'components',
  'metal_tone',
  'palette',
  'finish',
  'motifs',
  'style_tags',
  'strung_style_affinity',
  'technique_hints',
] as const

const SCALAR_FIELDS = ['piece_type', 'shot_type', 'form', 'scale', 'symmetry', 'density'] as const

describe('reference pool integrity', () => {
  it('covers all 157 board images exactly once, in order', () => {
    expect(ALL_REFERENCES).toHaveLength(157)
    ALL_REFERENCES.forEach((ref, i) => {
      expect(ref.image_number).toBe(i + 1)
      expect(ref.ref_id).toBe(`pin-${String(i + 1).padStart(3, '0')}`)
    })
  })

  it('splits into tagged, tutorial-excluded and duplicate, matching the stated counts', () => {
    const { counts } = referencePool
    expect(counts.total).toBe(ALL_REFERENCES.length)
    expect(TAGGED_REFERENCES).toHaveLength(counts.tagged)
    expect(ALL_REFERENCES.filter((r) => r.status === 'excluded')).toHaveLength(
      counts.excluded_tutorial,
    )
    expect(ALL_REFERENCES.filter((r) => r.status === 'duplicate')).toHaveLength(counts.duplicate)
    expect(counts.tagged + counts.excluded_tutorial + counts.duplicate).toBe(counts.total)
  })

  it('excludes exactly the six tutorial images the brief named', () => {
    const excluded = ALL_REFERENCES.filter((r) => r.status === 'excluded').map(
      (r) => r.image_number,
    )
    expect(excluded).toEqual([74, 113, 124, 127, 133, 134])
  })

  it('tags each duplicate pair once and points the second at the first', () => {
    const dupes = ALL_REFERENCES.filter((r) => r.status === 'duplicate')
    expect(dupes.map((r) => r.image_number)).toEqual([42, 108])
    for (const dupe of dupes) {
      const target = getReference(dupe.status === 'duplicate' ? dupe.duplicate_of : '')
      expect(target?.status).toBe('tagged')
    }
  })

  it('carries a pin id, pin url and image url on every record', () => {
    for (const ref of ALL_REFERENCES) {
      expect(ref.pin_id).toMatch(/^\d+$/)
      expect(ref.pin_url).toMatch(/^https:\/\/www\.pinterest\.com\/pin\//)
      expect(ref.image_url).toMatch(/^https:\/\/i\.pinimg\.com\//)
    }
  })
})

describe('controlled vocabulary', () => {
  it('uses only published vocabulary values in every tagged field', () => {
    for (const ref of TAGGED_REFERENCES) {
      for (const field of SCALAR_FIELDS) {
        expect(REFERENCE_VOCABULARY[field]).toContain(ref[field])
      }
      for (const field of LIST_FIELDS) {
        for (const value of ref[field]) {
          expect(REFERENCE_VOCABULARY[field]).toContain(value)
        }
      }
    }
  })

  it('publishes no vocabulary value that nothing uses', () => {
    for (const field of [...SCALAR_FIELDS, ...LIST_FIELDS]) {
      for (const value of REFERENCE_VOCABULARY[field]) {
        const used = TAGGED_REFERENCES.some((r) => {
          const v = r[field as keyof TaggedReference]
          return Array.isArray(v) ? v.includes(value) : v === value
        })
        expect(used, `${field}: "${value}" is in the vocabulary but tags nothing`).toBe(true)
      }
    }
  })

  it('keeps list fields free of duplicate entries', () => {
    for (const ref of TAGGED_REFERENCES) {
      for (const field of LIST_FIELDS) {
        expect(new Set(ref[field]).size).toBe(ref[field].length)
      }
    }
  })

  it('only hints techniques the design vocabulary already allows', () => {
    for (const ref of TAGGED_REFERENCES) {
      for (const technique of ref.technique_hints) {
        expect(ALLOWED_TECHNIQUES as readonly string[]).toContain(technique)
      }
    }
  })

  it('only maps affinity onto styles the app actually ships', () => {
    for (const ref of TAGGED_REFERENCES) {
      for (const style of ref.strung_style_affinity) {
        expect(VALID_STYLES as readonly string[]).toContain(style)
      }
    }
  })
})

describe('uncertainty is recorded, not hidden', () => {
  it('gives every material a confidence from the published scale', () => {
    for (const ref of TAGGED_REFERENCES) {
      expect(ref.materials.length).toBeGreaterThan(0)
      for (const material of ref.materials) {
        expect(REFERENCE_VOCABULARY.confidence).toContain(material.confidence)
        expect(REFERENCE_VOCABULARY.material_species).toContain(material.name)
        expect(material.alternatives).not.toContain(material.name)
      }
    }
  })

  it('offers an alternative wherever a material is uncertain', () => {
    const uncertain = TAGGED_REFERENCES.flatMap((r) =>
      r.materials.filter((m) => m.confidence === 'uncertain'),
    )
    expect(uncertain.length).toBeGreaterThan(0)
    for (const material of uncertain) {
      expect(material.alternatives.length).toBeGreaterThan(0)
    }
  })

  it('never states a measurement as fact', () => {
    for (const ref of TAGGED_REFERENCES) {
      const { range_mm, estimated, basis } = ref.dimensions
      if (range_mm === null) {
        expect(estimated).toBe(false)
        expect(basis).toBeNull()
      } else {
        expect(estimated).toBe(true)
        expect(basis).toBeTruthy()
        expect(range_mm).toHaveLength(2)
        expect(range_mm[0]).toBeLessThan(range_mm[1])
      }
    }
  })

  it('leaves most measurements null rather than guessing', () => {
    const measured = TAGGED_REFERENCES.filter((r) => r.dimensions.range_mm !== null)
    expect(measured.length).toBeLessThan(TAGGED_REFERENCES.length / 2)
  })
})

describe('the pool adds variety rather than narrowing', () => {
  it('spans more styles than the four the app ships', () => {
    expect(REFERENCE_VOCABULARY.style_tags.length).toBeGreaterThan(VALID_STYLES.length)
  })

  it('never lets one style tag or palette colour dominate the pool', () => {
    const half = TAGGED_REFERENCES.length / 2
    for (const field of ['style_tags', 'palette'] as const) {
      for (const value of REFERENCE_VOCABULARY[field]) {
        const hits = TAGGED_REFERENCES.filter((r) => r[field].includes(value)).length
        expect(hits, `${field}: "${value}" covers over half the pool`).toBeLessThan(half)
      }
    }
  })

  it('covers every piece type and form with at least one reference', () => {
    for (const field of ['piece_type', 'form'] as const) {
      for (const value of REFERENCE_VOCABULARY[field]) {
        expect(findReferences({ [field === 'form' ? 'form' : 'pieceType']: value }).length)
          .toBeGreaterThan(0)
      }
    }
  })
})

describe('query helpers', () => {
  it('returns the whole tagged pool for an empty query', () => {
    expect(findReferences()).toHaveLength(TAGGED_REFERENCES.length)
  })

  it('ands across fields and ors within a field', () => {
    const hoops = findReferences({ pieceType: 'earring', form: ['hoop', 'hoop_fringe'] })
    expect(hoops.length).toBeGreaterThan(0)
    for (const ref of hoops) {
      expect(ref.piece_type).toBe('earring')
      expect(['hoop', 'hoop_fringe']).toContain(ref.form)
    }
  })

  it('drops references below the requested tag confidence', () => {
    const high = findReferences({ minTagConfidence: 'high' })
    expect(high.length).toBeGreaterThan(0)
    expect(high.length).toBeLessThan(TAGGED_REFERENCES.length)
    expect(high.every((r) => r.tag_confidence === 'high')).toBe(true)
  })

  it('matches nothing for a value outside the vocabulary', () => {
    expect(findReferences({ pieceType: 'tiara' })).toEqual([])
    expect(findReferences({ palette: ['neon_orange'] })).toEqual([])
  })

  it('samples distinct references spread across forms', () => {
    const sample = sampleVariedReferences(6)
    expect(sample).toHaveLength(6)
    expect(new Set(sample.map((r) => r.ref_id)).size).toBe(6)
    expect(new Set(sample.map((r) => r.form)).size).toBe(6)
  })

  it('is deterministic for a seed and varies between seeds', () => {
    const ids = (seed: number) => sampleVariedReferences(5, seed).map((r) => r.ref_id)
    expect(ids(1)).toEqual(ids(1))
    expect(ids(1)).not.toEqual(ids(2))
  })

  it('never returns more than the filtered pool holds', () => {
    const cuffs = sampleVariedReferences(10, 0, { pieceType: 'cuff' })
    expect(cuffs).toHaveLength(1)
    expect(sampleVariedReferences(0)).toEqual([])
    expect(sampleVariedReferences(5, 0, { pieceType: 'tiara' })).toEqual([])
  })

  it('narrows isTagged correctly', () => {
    const excluded = ALL_REFERENCES.find((r) => r.image_number === 74)!
    expect(isTagged(excluded)).toBe(false)
    expect(isTagged(TAGGED_REFERENCES[0])).toBe(true)
  })
})
