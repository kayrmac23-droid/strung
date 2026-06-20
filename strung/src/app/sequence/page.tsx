'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import Nav from '@/components/Nav'
import type { BeadItem } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/authClient'

interface PaletteEntry {
  role: string
  name: string
  hex: string
  beadSuggestion: string
  note: string
}

interface SequenceEntry {
  label: string
  colourName: string
  hex: string
  count: number
  beadType: string
}

interface StashMatch {
  beadName: string
  colour: string
  hex: string
  role: string
  note: string
}

interface SequenceResult {
  title: string
  colourStory: string
  harmonyType: string
  palette: PaletteEntry[]
  sequence: SequenceEntry[]
  sequencePattern: string
  repeats: number
  totalBeadsPerRepeat: number
  stashMatches: StashMatch[]
  tip: string
  metalRecommendation: { name: string; hex: string; reason: string }
}

const HARMONY_TYPES = [
  { value: 'AI Picks', desc: 'Surprise me' },
  { value: 'Complementary', desc: 'Opposites attract' },
  { value: 'Analogous', desc: 'Adjacent hues' },
  { value: 'Triadic', desc: 'Three-way balance' },
  { value: 'Monochromatic', desc: 'One hue, many tones' },
  { value: 'Split-Complementary', desc: 'Softer contrast' },
  { value: 'Earth & Neutrals', desc: 'Warm naturals' },
  { value: 'Jewel Tones', desc: 'Rich & saturated' },
  { value: 'Pastel Dream', desc: 'Soft & dreamy' },
]

const COLOUR_FAMILIES = [
  'Surprise Me',
  'Reds & Pinks',
  'Oranges & Corals',
  'Yellows & Golds',
  'Greens',
  'Blues',
  'Purples & Violets',
  'Neutrals & Browns',
  'Metallics & Sheens',
]

const PIECE_TYPES = ['Any', 'Necklace', 'Bracelet', 'Earrings', 'Anklet']

function BeadSequenceStrip({ pattern, sequence }: { pattern: string; sequence: SequenceEntry[] }) {
  const seqMap = Object.fromEntries(sequence.map(s => [s.label, s]))
  const labels = pattern.split('-').filter(l => l in seqMap)
  if (labels.length === 0) return null
  // Show two repeats so the rhythm is visible
  const display = [...labels, ...labels]
  const repeatLen = labels.length

  return (
    <div style={{ overflowX: 'auto', padding: '12px 0 16px' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minWidth: 'max-content', padding: '0 2px' }}>
        {display.map((label, i) => {
          const entry = seqMap[label]
          const isRepeatBoundary = i === repeatLen
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              {isRepeatBoundary && (
                <div style={{
                  width: 1, alignSelf: 'stretch', background: 'var(--border2)',
                  margin: '0 2px', flexShrink: 0
                }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: entry.hex,
                  border: '2px solid rgba(255,255,255,0.12)',
                  boxShadow: `0 0 10px ${entry.hex}55, inset 0 1px 3px rgba(255,255,255,0.2)`,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted)',
                  letterSpacing: '0.06em'
                }}>{label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PaletteSwatch({ entry }: { entry: PaletteEntry }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 100 }}>
      <div style={{
        height: 64, background: entry.hex,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: `0 4px 16px ${entry.hex}40`,
      }} />
      <div>
        <span className="mono" style={{ fontSize: 9, color: 'var(--moonstone)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {entry.role}
        </span>
        <p style={{ color: 'var(--cream)', fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 400, marginTop: 2 }}>
          {entry.name}
        </p>
        <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3, fontFamily: 'var(--font-body)' }}>
          {entry.beadSuggestion}
        </p>
      </div>
    </div>
  )
}

export default function SequencePage() {
  const [beads, setBeads] = useState<BeadItem[]>([])
  const [stashLoaded, setStashLoaded] = useState(false)

  const [harmonyType, setHarmonyType] = useState('AI Picks')
  const [anchorFamily, setAnchorFamily] = useState('Surprise Me')
  const [pieceType, setPieceType] = useState('Any')

  const [result, setResult] = useState<SequenceResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/inventory', { headers: await getAuthHeaders() })
        const d = await res.json()
        setBeads(d.beads || [])
      } catch {
        // stash is optional
      } finally {
        setStashLoaded(true)
      }
    })()
  }, [])

  async function generate() {
    if (loading) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/api/sequence', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ harmonyType, anchorFamily, pieceType, beads }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const totalBeads = result
    ? result.totalBeadsPerRepeat * result.repeats
    : 0

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 60, minHeight: '100vh' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '52px 40px 80px' }}>

          <header style={{ marginBottom: 40 }}>
            <p className="section-eyebrow fade-up">Colour Studio</p>
            <h1 className="fade-up-1" style={{
              fontSize: 44, color: 'var(--cream)',
              fontFamily: 'var(--font-display)', fontWeight: 400, margin: '8px 0 10px'
            }}>Sequence Builder</h1>
            <p className="fade-up-2" style={{ color: 'var(--text2)', fontSize: 17 }}>
              Choose a colour harmony and let the AI design a palette and repeating bead sequence you can string by feel.
            </p>
          </header>

          {/* Stash indicator */}
          {stashLoaded && (
            <div className="fade-up-2" style={{
              display: 'flex', gap: 20, padding: '12px 18px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              marginBottom: 24, alignItems: 'center', flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: beads.length > 0 ? 'var(--sage)' : 'var(--border2)'
                }} />
                <span className="mono" style={{ fontSize: 11, color: 'var(--text2)', letterSpacing: '0.08em' }}>
                  {beads.length > 0
                    ? `${beads.length} bead${beads.length !== 1 ? 's' : ''} in stash — AI will match where possible`
                    : 'No stash — add beads in Stash for personalised matches'}
                </span>
              </div>
            </div>
          )}

          {/* Input card */}
          <div className="card fade-up-2" style={{ padding: 32, marginBottom: 32 }}>

            {/* Harmony type */}
            <div style={{ marginBottom: 24 }}>
              <label className="label">Colour harmony</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {HARMONY_TYPES.map(h => (
                  <button key={h.value} onClick={() => setHarmonyType(h.value)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    padding: '9px 14px', cursor: 'pointer', transition: 'all 0.15s',
                    background: harmonyType === h.value ? 'var(--surface2)' : 'var(--bg2)',
                    border: `1px solid ${harmonyType === h.value ? 'var(--silver)' : 'var(--border)'}`,
                  }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: harmonyType === h.value ? 'var(--silver2)' : 'var(--muted)',
                    }}>{h.value}</span>
                    <span style={{
                      fontFamily: 'var(--font-body)', fontSize: 12,
                      color: harmonyType === h.value ? 'var(--text2)' : 'var(--muted2)',
                      marginTop: 2
                    }}>{h.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Anchor colour family */}
            <div style={{ marginBottom: 24 }}>
              <label className="label">Anchor colour family</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {COLOUR_FAMILIES.map(f => (
                  <button key={f} onClick={() => setAnchorFamily(f)} style={{
                    padding: '7px 14px', cursor: 'pointer', transition: 'all 0.15s',
                    background: anchorFamily === f ? 'var(--surface2)' : 'var(--bg2)',
                    border: `1px solid ${anchorFamily === f ? 'var(--silver)' : 'var(--border)'}`,
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: anchorFamily === f ? 'var(--silver2)' : 'var(--muted)',
                  }}>{f}</button>
                ))}
              </div>
            </div>

            {/* Piece type */}
            <div style={{ marginBottom: 28 }}>
              <label className="label">Piece type</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {PIECE_TYPES.map(p => (
                  <button key={p} onClick={() => setPieceType(p)} style={{
                    padding: '7px 14px', cursor: 'pointer', transition: 'all 0.15s',
                    background: pieceType === p ? 'var(--surface2)' : 'var(--bg2)',
                    border: `1px solid ${pieceType === p ? 'var(--silver)' : 'var(--border)'}`,
                    fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: pieceType === p ? 'var(--silver2)' : 'var(--muted)',
                  }}>{p}</button>
                ))}
              </div>
            </div>

            <button
              className="btn-silver"
              style={{ width: '100%', justifyContent: 'center', padding: 14 }}
              onClick={generate}
              disabled={loading}
            >
              {loading
                ? <><span className="spinner" />Designing your sequence…</>
                : '◈ Generate Colour Sequence'}
            </button>
          </div>

          {error && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, marginBottom: 20, color: 'var(--rose)' }}>
              {error}
            </p>
          )}

          {/* Result */}
          {result && (
            <div className="fade-up">

              {/* Header */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderTop: '3px solid var(--moonstone)', padding: 36, marginBottom: 16
              }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  <span className="tag" style={{ borderColor: 'var(--moonstone)', color: 'var(--moonstone)' }}>
                    {result.harmonyType}
                  </span>
                  <span className="tag">{pieceType}</span>
                  <span className="tag">{result.repeats} repeats</span>
                  <span className="tag">{totalBeads} beads total</span>
                </div>
                <h2 style={{
                  fontSize: 36, color: 'var(--cream)', fontFamily: 'var(--font-display)',
                  fontWeight: 400, marginBottom: 10
                }}>{result.title}</h2>
                <p style={{ color: 'var(--text2)', fontSize: 16, lineHeight: 1.7, fontFamily: 'var(--font-body)' }}>
                  {result.colourStory}
                </p>
              </div>

              {/* Palette swatches */}
              <div className="card" style={{ padding: 28, marginBottom: 16 }}>
                <h3 style={{
                  fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400,
                  color: 'var(--cream)', marginBottom: 20
                }}>◈ Colour Palette</h3>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {result.palette.map((entry, i) => (
                    <PaletteSwatch key={i} entry={entry} />
                  ))}
                </div>
              </div>

              {/* Bead sequence strip */}
              <div className="card" style={{ padding: 28, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400, color: 'var(--cream)'
                  }}>◉ Bead Sequence</h3>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--text2)', letterSpacing: '0.06em' }}>
                    {result.sequencePattern} · ×{result.repeats}
                  </span>
                </div>

                <BeadSequenceStrip pattern={result.sequencePattern} sequence={result.sequence} />

                {/* Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  {result.sequence.map((s, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 80 }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: '50%', background: s.hex,
                          border: '1.5px solid rgba(255,255,255,0.1)', flexShrink: 0
                        }} />
                        <span className="mono" style={{ fontSize: 11, color: 'var(--silver)', letterSpacing: '0.06em' }}>
                          {s.label}
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ color: 'var(--cream)', fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 400 }}>
                          {s.colourName}
                        </span>
                        <span style={{ color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-mono)', marginLeft: 10 }}>
                          {s.beadType}
                        </span>
                      </div>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.06em' }}>
                        ×{s.count} per repeat
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

                {/* Metal recommendation */}
                <div className="card" style={{ padding: 24 }}>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400,
                    color: 'var(--cream)', marginBottom: 14
                  }}>◎ Metal Pairing</h3>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: result.metalRecommendation.hex,
                      border: '2px solid rgba(255,255,255,0.1)',
                      boxShadow: `0 0 10px ${result.metalRecommendation.hex}55`,
                      flexShrink: 0
                    }} />
                    <div>
                      <p style={{ color: 'var(--cream)', fontSize: 15, fontFamily: 'var(--font-display)', fontWeight: 400 }}>
                        {result.metalRecommendation.name}
                      </p>
                      <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 4, fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
                        {result.metalRecommendation.reason}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Colour theory tip */}
                <div style={{
                  background: 'rgba(122,154,184,0.06)', border: '1px solid rgba(122,154,184,0.2)',
                  padding: 24
                }}>
                  <span className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--moonstone)' }}>
                    COLOUR THEORY
                  </span>
                  <p style={{ color: 'var(--text)', fontSize: 14, marginTop: 10, lineHeight: 1.7, fontFamily: 'var(--font-body)' }}>
                    {result.tip}
                  </p>
                </div>
              </div>

              {/* Stash matches */}
              {result.stashMatches && result.stashMatches.length > 0 && (
                <div className="card" style={{ padding: 24, marginBottom: 16 }}>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400,
                    color: 'var(--cream)', marginBottom: 14
                  }}>◇ Your Stash Matches</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {result.stashMatches.map((m, i) => (
                      <div key={i} style={{
                        display: 'flex', gap: 12, alignItems: 'flex-start',
                        padding: '12px 16px', background: 'var(--bg2)', border: '1px solid var(--border)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 140 }}>
                          {m.hex && (
                            <div style={{
                              width: 14, height: 14, borderRadius: '50%',
                              background: m.hex, flexShrink: 0,
                              border: '1px solid rgba(255,255,255,0.1)'
                            }} />
                          )}
                          <div>
                            <p style={{ color: 'var(--cream)', fontSize: 14 }}>{m.beadName}</p>
                            <span className="mono" style={{ fontSize: 9, color: 'var(--moonstone)', letterSpacing: '0.08em' }}>
                              {m.role}
                            </span>
                          </div>
                        </div>
                        <p style={{ color: 'var(--text2)', fontSize: 13, fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
                          {m.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate another */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-outline" onClick={generate} disabled={loading}>
                  Try another sequence
                </button>
              </div>

            </div>
          )}
        </div>
      </main>
    </>
  )
}
