'use client'
import { useState, useEffect } from 'react'
import Nav from '@/components/Nav'

// ─── Constants ────────────────────────────────────────────────────────────────

const BEAD_SIZES: { label: string; mm: number }[] = [
  { label: 'Seed (2 mm)',       mm: 2  },
  { label: 'Small (4 mm)',      mm: 4  },
  { label: 'Medium (6 mm)',     mm: 6  },
  { label: 'Large (8 mm)',      mm: 8  },
  { label: 'Statement (12 mm)', mm: 12 },
]

const CLASP_OPTIONS: { label: string; mm: number }[] = [
  { label: 'No clasp',        mm: 0  },
  { label: 'Standard lobster',mm: 12 },
  { label: 'Toggle clasp',    mm: 20 },
  { label: 'Custom…',         mm: -1 },
]

const COMMON_LENGTHS = [
  { name: 'Seed necklace', length: '16"'    },
  { name: 'Princess',      length: '18"'    },
  { name: 'Matinee',       length: '22"'    },
  { name: 'Opera',         length: '32"'    },
  { name: 'Rope',          length: '45"'    },
  { name: 'Bracelet',      length: '7"'     },
  { name: 'Anklet',        length: '9–10"'  },
]

const BEAD_GUIDE = [
  { size: 'Seed',      range: '1–2 mm'  },
  { size: 'Small',     range: '3–4 mm'  },
  { size: 'Medium',    range: '5–7 mm'  },
  { size: 'Large',     range: '8–11 mm' },
  { size: 'Statement', range: '12 mm+'  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMm(value: number, unit: 'inches' | 'cm'): number {
  if (unit === 'inches') return value * 25.4
  return value * 10
}

function fmt(n: number, dp = 1): string {
  return n.toFixed(dp).replace(/\.0$/, '')
}

// ─── Bead diagram ─────────────────────────────────────────────────────────────

function BeadDiagram({ count, beadMm }: { count: number; beadMm: number }) {
  const display = Math.min(count, 40)
  const hasMore = count > 40
  // Scale circle size: clamp between 6–20px
  const size = Math.max(6, Math.min(20, beadMm * 2.2))

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 3,
      padding: '14px 0 4px',
    }}>
      {Array.from({ length: display }).map((_, i) => (
        <div
          key={i}
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, var(--moonstone2), var(--moonstone))`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            flexShrink: 0,
          }}
        />
      ))}
      {hasMore && (
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--muted)',
          letterSpacing: '0.08em',
          marginLeft: 4,
        }}>
          +{count - 40} more
        </span>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CalculatorPage() {
  // Inputs
  const [length, setLength] = useState<string>('18')
  const [unit, setUnit] = useState<'inches' | 'cm'>('inches')
  const [beadSizeIdx, setBeadSizeIdx] = useState(1) // Small 4mm default
  const [customMm, setCustomMm] = useState<string>('')
  const [claspIdx, setClaspIdx] = useState(1) // Standard lobster
  const [customClaspMm, setCustomClaspMm] = useState<string>('10')
  const [knot, setKnot] = useState(false)
  const [strands, setStrands] = useState(1)
  const [beadMaterial, setBeadMaterial] = useState<'gemstone' | 'glass'>('gemstone')

  // Results
  const [results, setResults] = useState<{
    beadsPerStrand: number
    totalBeads: number
    wireLengthCm: number
    weightG: number
    beadMm: number
  } | null>(null)

  useEffect(() => {
    const lengthNum = parseFloat(length)
    if (!lengthNum || lengthNum <= 0) { setResults(null); return }

    const lengthMm = toMm(lengthNum, unit)
    const beadMm = customMm ? parseFloat(customMm) : BEAD_SIZES[beadSizeIdx].mm
    if (!beadMm || beadMm <= 0) { setResults(null); return }

    const claspMm = claspIdx === 3
      ? (parseFloat(customClaspMm) || 0)
      : CLASP_OPTIONS[claspIdx].mm

    const usableLengthMm = Math.max(0, lengthMm - claspMm)

    // With knotting: each gap (between beads) adds 2 mm
    // n beads → n-1 gaps
    // usable = n * beadMm + (n-1) * 2  ← if knotting
    // solve for n:
    let beadsPerStrand: number
    if (knot) {
      beadsPerStrand = Math.floor((usableLengthMm + 2) / (beadMm + 2))
    } else {
      beadsPerStrand = Math.floor(usableLengthMm / beadMm)
    }
    beadsPerStrand = Math.max(0, beadsPerStrand)

    const totalBeads = beadsPerStrand * strands

    // Wire: length + 15 cm finishing allowance, per strand
    const wireLengthCm = ((lengthMm / 10) + 15) * strands

    // Weight: approximate g
    const gramsPerBead = beadMaterial === 'gemstone'
      ? 0.5 * beadMm
      : 0.3 * beadMm
    const weightG = totalBeads * gramsPerBead

    setResults({ beadsPerStrand, totalBeads, wireLengthCm, weightG, beadMm })
  }, [length, unit, beadSizeIdx, customMm, claspIdx, customClaspMm, knot, strands, beadMaterial])

  const isCustomClasp = claspIdx === 3

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 60, minHeight: '100vh' }}>
        <div className="page-pad" style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 52, paddingBottom: 96 }}>

          {/* ── Header ── */}
          <header style={{ marginBottom: 44 }}>
            <p className="section-eyebrow fade-up">Maker Tools</p>
            <h1 className="fade-up-1" style={{
              fontSize: 44,
              color: 'var(--cream)',
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              margin: '8px 0 10px',
            }}>
              Bead Calculator
            </h1>
            <p className="fade-up-2" style={{ color: 'var(--text2)', fontSize: 17, maxWidth: 560, lineHeight: 1.65 }}>
              Work out bead counts, wire lengths, and weight estimates before you string a single bead.
            </p>
          </header>

          {/* ── Calculator card ── */}
          <div className="card fade-up-2" style={{ padding: 32, marginBottom: 28, maxWidth: 720 }}>

            {/* Row 1: Length */}
            <div style={{ marginBottom: 24 }}>
              <label className="label" style={{ display: 'block', marginBottom: 8 }}>
                Finished length
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className="input-base"
                  value={length}
                  onChange={e => setLength(e.target.value)}
                  style={{ width: 110, fontSize: 16 }}
                  placeholder="18"
                />
                <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', overflow: 'hidden' }}>
                  {(['inches', 'cm'] as const).map(u => (
                    <button
                      key={u}
                      onClick={() => setUnit(u)}
                      style={{
                        padding: '8px 16px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.1em',
                        background: unit === u ? 'var(--surface2)' : 'transparent',
                        color: unit === u ? 'var(--cream)' : 'var(--muted)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Bead size */}
            <div style={{ marginBottom: 24 }}>
              <label className="label" style={{ display: 'block', marginBottom: 8 }}>
                Bead size
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="select-base"
                  value={beadSizeIdx}
                  onChange={e => { setBeadSizeIdx(Number(e.target.value)); setCustomMm('') }}
                  style={{ minWidth: 180, fontSize: 15 }}
                >
                  {BEAD_SIZES.map((b, i) => (
                    <option key={i} value={i}>{b.label}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label className="label" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>or custom mm:</label>
                  <input
                    type="number"
                    min={0.5}
                    step={0.5}
                    className="input-base"
                    value={customMm}
                    onChange={e => setCustomMm(e.target.value)}
                    placeholder="e.g. 3"
                    style={{ width: 80, fontSize: 15 }}
                  />
                </div>
              </div>
            </div>

            {/* Row 3: Clasp */}
            <div style={{ marginBottom: 24 }}>
              <label className="label" style={{ display: 'block', marginBottom: 8 }}>
                Clasp / findings allowance
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="select-base"
                  value={claspIdx}
                  onChange={e => setClaspIdx(Number(e.target.value))}
                  style={{ minWidth: 200, fontSize: 15 }}
                >
                  {CLASP_OPTIONS.map((c, i) => (
                    <option key={i} value={i}>{c.label} {c.mm > 0 ? `(${c.mm} mm)` : ''}</option>
                  ))}
                </select>
                {isCustomClasp && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label className="label" style={{ fontSize: 12 }}>mm:</label>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      className="input-base"
                      value={customClaspMm}
                      onChange={e => setCustomClaspMm(e.target.value)}
                      style={{ width: 80, fontSize: 15 }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Row 4: Options row */}
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 24, alignItems: 'flex-start' }}>

              {/* Knotting */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={knot}
                  onChange={e => setKnot(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: 'var(--moonstone)', cursor: 'pointer' }}
                />
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'var(--text)' }}>
                  Knot between each bead
                  <span style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em', marginTop: 1 }}>
                    +2 mm per gap
                  </span>
                </span>
              </label>

              {/* Strands */}
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 8 }}>Number of strands</label>
                <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', overflow: 'hidden', width: 'fit-content' }}>
                  {[1, 2, 3].map(n => (
                    <button
                      key={n}
                      onClick={() => setStrands(n)}
                      style={{
                        padding: '8px 20px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        background: strands === n ? 'var(--surface2)' : 'transparent',
                        color: strands === n ? 'var(--cream)' : 'var(--muted)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        borderRight: n < 3 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Material */}
              <div>
                <label className="label" style={{ display: 'block', marginBottom: 8 }}>Bead material</label>
                <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border)', overflow: 'hidden', width: 'fit-content' }}>
                  {(['gemstone', 'glass'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setBeadMaterial(m)}
                      style={{
                        padding: '8px 16px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        letterSpacing: '0.08em',
                        background: beadMaterial === m ? 'var(--surface2)' : 'transparent',
                        color: beadMaterial === m ? 'var(--cream)' : 'var(--muted)',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        borderRight: m === 'gemstone' ? '1px solid var(--border)' : 'none',
                        textTransform: 'capitalize',
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* ── Results ── */}
          {results && results.beadsPerStrand > 0 && (
            <div className="card fade-up" style={{
              padding: 32,
              maxWidth: 720,
              marginBottom: 40,
              borderLeft: '3px solid var(--moonstone)',
            }}>
              <p className="section-eyebrow" style={{ marginBottom: 20 }}>Results</p>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                gap: 20,
                marginBottom: 28,
              }}>
                {[
                  {
                    label: strands > 1 ? 'Beads per strand' : 'Beads needed',
                    value: results.beadsPerStrand.toLocaleString(),
                    sub: strands > 1 ? `${results.totalBeads.toLocaleString()} total` : undefined,
                  },
                  strands > 1
                    ? { label: 'Total beads', value: results.totalBeads.toLocaleString(), sub: `across ${strands} strands` }
                    : null,
                  {
                    label: 'Wire / thread',
                    value: `${fmt(results.wireLengthCm)} cm`,
                    sub: `${fmt(results.wireLengthCm / 2.54)} in`,
                  },
                  {
                    label: 'Est. weight',
                    value: `${fmt(results.weightG)} g`,
                    sub: beadMaterial === 'gemstone' ? 'gemstone approx.' : 'glass approx.',
                  },
                ].filter(Boolean).map((item, i) => (
                  <div key={i}>
                    <div style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      marginBottom: 4,
                    }}>
                      {item!.label}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 30,
                      color: 'var(--cream)',
                      lineHeight: 1.1,
                    }}>
                      {item!.value}
                    </div>
                    {item!.sub && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moonstone)', marginTop: 2, letterSpacing: '0.06em' }}>
                        {item!.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Bead diagram */}
              <div>
                <p style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  marginBottom: 4,
                }}>
                  Pattern preview (one strand)
                </p>
                <BeadDiagram count={results.beadsPerStrand} beadMm={results.beadMm} />
              </div>
            </div>
          )}

          {results && results.beadsPerStrand === 0 && (
            <div className="fade-up" style={{ maxWidth: 720, marginBottom: 40 }}>
              <p style={{ color: 'var(--rose)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.1em' }}>
                No beads fit — try a shorter clasp or smaller bead size.
              </p>
            </div>
          )}

          {/* ── Reference tables ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
            maxWidth: 720,
          }}>

            {/* Common lengths */}
            <div className="card fade-up-3" style={{ padding: '24px 28px' }}>
              <p className="section-eyebrow" style={{ marginBottom: 16, fontSize: 9 }}>Reference</p>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                color: 'var(--cream)',
                fontWeight: 400,
                marginBottom: 16,
              }}>
                Common lengths
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {COMMON_LENGTHS.map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: i < COMMON_LENGTHS.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text)' }}>
                      {row.name}
                    </span>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--moonstone)', letterSpacing: '0.06em' }}>
                      {row.length}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bead size guide */}
            <div className="card fade-up-3" style={{ padding: '24px 28px' }}>
              <p className="section-eyebrow" style={{ marginBottom: 16, fontSize: 9 }}>Reference</p>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 18,
                color: 'var(--cream)',
                fontWeight: 400,
                marginBottom: 16,
              }}>
                Bead size guide
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {BEAD_GUIDE.map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 0',
                      borderBottom: i < BEAD_GUIDE.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text)' }}>
                      {row.size}
                    </span>
                    <span className="mono" style={{ fontSize: 12, color: 'var(--gold)', letterSpacing: '0.06em' }}>
                      {row.range}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </main>
    </>
  )
}
