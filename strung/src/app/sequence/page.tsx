'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import Nav, { MakeTabs } from '@/components/Nav'
import Bead from '@/components/Bead'
import StrandLoader from '@/components/StrandLoader'
import { luminance, safeHex } from '@/lib/bead'
import type { BeadItem } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/authClient'

import type { SequenceEntry, SequenceResult } from '@/lib/sequenceResult'

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

// Two repeats of the unit on a thread, so the rhythm reads. On the proof card
// the thread and the rims flip to ink.
function BeadSequenceStrip({ pattern, sequence, proof }: { pattern: string; sequence: SequenceEntry[]; proof: boolean }) {
  const seqMap = Object.fromEntries(sequence.map(s => [s.label, s]))
  const labels = pattern.split('-').filter(l => l in seqMap)
  if (labels.length === 0) return null
  const display = [...labels, ...labels, ...labels]
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, height: 44, minWidth: 'max-content', padding: '0 4px' }}>
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: proof ? 'var(--calico-edge)' : 'var(--saddle)' }} />
        {display.map((label, i) => {
          const hex = safeHex(seqMap[label].hex)
          return <Bead key={i} hex={hex} size={i % labels.length === 0 ? 18 : 14}
            style={proof && luminance(hex) > 0.8 ? { boxShadow: '0 0 0 1px rgba(35,32,26,.25)' } : undefined} />
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10, fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', color: proof ? 'var(--calico-meta)' : 'var(--meta)' }}>
        {labels.map((l, i) => <span key={i}>{l} · {seqMap[l].colourName}</span>)}
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
  // Daylight proof: lays the result on calico for a window-light colour check
  // (DESIGN §The proofing card).
  const [proof, setProof] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/inventory', { headers: await getAuthHeaders() })
        if (res.ok) {
          const d = await res.json()
          setBeads(d.beads || [])
        }
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
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed — please try again.')
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

  const ink = proof ? 'var(--calico-ink)' : 'var(--cream)'
  const body = proof ? 'var(--calico-ink)' : 'var(--text2)'
  const metaC = proof ? 'var(--calico-meta)' : 'var(--meta)'

  return (
    <>
      <Nav />
      <main id="main" className="page-main">
        <MakeTabs />
        <div className="wrap ss-up" style={{ paddingTop: 'clamp(28px,4vw,48px)', paddingBottom: 80, display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
            <h1 className="display" style={{ fontSize: 'clamp(44px,6vw,92px)', lineHeight: .95, maxWidth: '12ch' }}>Find the colour <em>first.</em></h1>
            {result && (
              <button type="button" aria-pressed={proof} onClick={() => setProof(p => !p)} className="proof-toggle">
                <span aria-hidden="true" className={`proof-switch${proof ? ' is-on' : ''}`} />Daylight proof
              </button>
            )}
          </div>

          <p className="aside-line" style={{ fontSize: 18, maxWidth: '52ch' }}>
            {!stashLoaded ? 'Checking your stash…'
              : beads.length > 0 ? `Pick a harmony and an anchor — it matches the palette against your ${beads.length} bead type${beads.length === 1 ? '' : 's'} where it can.`
              : 'Pick a harmony and an anchor. Works signed out; with a stash, it matches the palette to beads you own.'}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="eyebrow eyebrow--sm" style={{ letterSpacing: '.16em' }}>Harmony</span>
              <div className="chip-row" role="group" aria-label="Harmony">
                {HARMONY_TYPES.map(h => (
                  <button key={h.value} type="button" className="chip" aria-pressed={harmonyType === h.value} title={h.desc} onClick={() => setHarmonyType(h.value)}>{h.value}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="eyebrow eyebrow--sm" style={{ letterSpacing: '.16em' }}>Anchor</span>
              <div className="chip-row" role="group" aria-label="Anchor colour family">
                {COLOUR_FAMILIES.map(f => (
                  <button key={f} type="button" className="chip" aria-pressed={anchorFamily === f} onClick={() => setAnchorFamily(f)}>{f}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="eyebrow eyebrow--sm" style={{ letterSpacing: '.16em' }}>Piece</span>
              <div className="chip-row" role="group" aria-label="Piece type">
                {PIECE_TYPES.map(pt => (
                  <button key={pt} type="button" className="chip" aria-pressed={pieceType === pt} onClick={() => setPieceType(pt)}>{pt}</button>
                ))}
              </div>
            </div>
            <div>
              <button className="btn-primary btn-lg" onClick={generate} disabled={loading}>
                {result ? 'Try another palette' : 'Find a palette'}
              </button>
            </div>
          </div>

          {error && <p role="alert" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--madder-text)' }}>{error}</p>}

          {loading && (
            <div className="well" style={{ minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <StrandLoader label="Mixing a palette…" />
            </div>
          )}

          {result && !loading && (
            <section aria-labelledby="palette-h" className="ss-up" style={{ background: proof ? 'var(--calico)' : 'var(--mocha)', border: `1px solid ${proof ? 'var(--calico-edge)' : 'var(--seam)'}`, boxShadow: 'var(--nap)', transition: 'background .3s' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(result.palette.length, 6))}, minmax(0,1fr))`, height: 'clamp(160px,22vw,280px)' }}>
                {result.palette.map((p, i) => {
                  const hex = safeHex(p.hex)
                  const light = luminance(hex) > 0.5
                  return (
                    <div key={i} title={p.beadSuggestion} style={{ background: hex, display: 'flex', alignItems: 'flex-end', padding: 14,
                      boxShadow: !proof && luminance(hex) < 0.2 ? 'inset 0 0 0 1px rgba(237,230,219,.12)' : proof && luminance(hex) > 0.8 ? 'inset 0 0 0 1px var(--calico-edge)' : 'none' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', lineHeight: 1.5, textTransform: 'uppercase', color: light ? '#23201A' : '#EDE6DB', overflowWrap: 'anywhere' }}>
                        {p.role}<br />{hex.toUpperCase()}
                      </span>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding: 'clamp(20px,3vw,32px)', display: 'flex', flexDirection: 'column', gap: 26 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="eyebrow eyebrow--sm" style={{ color: metaC }}>{result.harmonyType} · {pieceType} · {result.repeats} repeats · {totalBeads} beads</span>
                  <h2 id="palette-h" className="display" style={{ fontSize: 'clamp(32px,3.6vw,52px)', lineHeight: 1, color: ink }}>{result.title}</h2>
                  <p style={{ fontSize: 16, lineHeight: 1.6, color: body, maxWidth: '60ch' }}>{result.colourStory}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span className="eyebrow eyebrow--sm" style={{ color: metaC }}>Sequence · {result.sequencePattern} · repeated ×{result.repeats}</span>
                  <BeadSequenceStrip pattern={result.sequencePattern} sequence={result.sequence} proof={proof} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,280px),1fr))', gap: 24 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span className="eyebrow eyebrow--sm" style={{ color: metaC }}>Palette</span>
                    {result.palette.map((p, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontSize: 15, color: ink }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: metaC, minWidth: 70 }}>{p.role}</span>
                        <span>{p.name}{p.beadSuggestion && <span style={{ color: metaC, fontSize: 13 }}> — {p.beadSuggestion}</span>}</span>
                      </div>
                    ))}
                  </div>
                  {result.metalRecommendation && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <span className="eyebrow eyebrow--sm" style={{ color: metaC }}>Metal</span>
                      <p style={{ fontSize: 16, lineHeight: 1.55, color: body }}><span style={{ color: ink }}>{result.metalRecommendation.name}</span> — {result.metalRecommendation.reason}</p>
                    </div>
                  )}
                  {result.stashMatches && result.stashMatches.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="eyebrow eyebrow--sm" style={{ color: metaC }}>In your stash</span>
                      {result.stashMatches.map((m, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '6px 0' }}>
                          {m.hex ? <Bead hex={safeHex(m.hex)} size={14} style={{ marginTop: 5 }} /> : <span style={{ width: 14 }} />}
                          <span style={{ flex: 1, fontSize: 15, color: ink }}>{m.beadName}{m.note && <span style={{ display: 'block', fontSize: 13, color: body }}>{m.note}</span>}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: proof ? '#4E6B44' : 'var(--sage)' }}>{m.role}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {result.tip && (
                  <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 17, lineHeight: 1.5, color: proof ? 'var(--calico-meta)' : 'var(--tan)', paddingTop: 18, borderTop: `1px solid ${proof ? 'var(--calico-edge)' : 'var(--seam)'}` }}>{result.tip}</p>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  )
}
