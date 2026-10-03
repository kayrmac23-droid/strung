'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import Schematic from '@/components/Schematic'
import StrandLoader from '@/components/StrandLoader'
import type { BeadItem, FindingItem } from '@/lib/supabase'
import { getAuthHeaders, getSession } from '@/lib/authClient'
import { VALID_STYLES, STYLE_LABELS, STYLE_DESCRIPTIONS, type Style } from '@/lib/designVocab'
import type { Assembly } from '@/lib/assembly'

const pieceTypes = ['Any', 'Earrings', 'Necklace', 'Bracelet', 'Pendant', 'Anklet']
const moods = ['Dark & moody', 'Ethereal & dreamy', 'Earthy & rustic', 'Bold & dramatic', 'Delicate & feminine', 'Celestial & mystical', 'Coastal & breezy', 'Rich & opulent']
const times = [
  { value: '15min', label: '15 minutes', sub: 'Quick & simple' },
  { value: '1hour', label: '1 hour', sub: 'Moderate' },
  { value: 'afternoon', label: 'Afternoon', sub: 'Complex welcome' },
]

interface Step {
  id: number
  instruction: string
  material: string | null
  technique: string | null
  tip: string | null
}

interface Design {
  title: string
  description: string
  colourStory: string
  difficulty: string
  estimatedTime: string
  pieceType: string
  materialsCheck: { allAvailable: boolean; notes: string }
  components: { item: string; quantity: number; note: string }[]
  // Optional — absent for plain single-strand pieces, and for every design
  // saved before the field existed.
  assembly?: Assembly
  steps: Step[]
}

// The design without its preview image. imageUrl is a ~2MB base64 data URI
// that only this page renders; it was being saved into builds.design (bloating
// every journal load) and re-uploaded with every refine request.
function storable(d: Design & { imageUrl?: string }): Design {
  const rest = { ...d }
  delete rest.imageUrl
  return rest
}

export default function MakePage() {
  const router = useRouter()
  const [beads, setBeads] = useState<BeadItem[]>([])
  const [findings, setFindings] = useState<FindingItem[]>([])
  const [stashLoaded, setStashLoaded] = useState(false)
  const [signedOut, setSignedOut] = useState(false)

  const [pieceType, setPieceType] = useState('Any')
  const [style, setStyle] = useState<Style | ''>('')
  const [mood, setMood] = useState('')
  const [timeAvailable, setTimeAvailable] = useState('1hour')

  const [design, setDesign] = useState<Design & { imageUrl?: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [adjustment, setAdjustment] = useState('')
  const [refining, setRefining] = useState(false)
  const [recentTitles, setRecentTitles] = useState<string[]>([])
  const [view, setView] = useState<'visual' | 'schematic'>('visual')
  const [stashError, setStashError] = useState(false)
  // Bumped whenever the design on screen changes. A preview request only
  // applies its result if the counter still matches what it started with —
  // otherwise "Try another" while a render was in flight dropped the old
  // design's picture onto the new design.
  const imageRequest = useRef(0)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/inventory', { headers: await getAuthHeaders() })
        if (res.status === 401) {
          setSignedOut(true)
          return
        }
        setSignedOut(false)
        if (!res.ok) throw new Error('stash load failed')
        const d = await res.json()
        setBeads(d.beads || [])
        setFindings(d.findings || [])
      } catch {
        setStashError(true)
      } finally {
        setStashLoaded(true)
      }
    })()
  }, [])

  async function generate() {
    if (loading) return
    setLoading(true); setError(''); setDesign(null)
    imageRequest.current++
    setImageLoading(false); setImageError('')
    try {
      const res = await fetch('/api/make', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          pieceType: pieceType === 'Any' ? '' : pieceType,
          style,
          mood,
          timeAvailable,
          recentTitles,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || 'Generation failed — please try again.')
      setDesign(data)
      if (typeof data.title === 'string' && data.title) {
        setRecentTitles(prev => [data.title, ...prev.filter(t => t !== data.title)].slice(0, 5))
      }
      fetchImage(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  async function refine() {
    if (!design || loading || refining || !adjustment.trim()) return
    setRefining(true); setError('')
    try {
      const previousDesign = storable(design)
      const res = await fetch('/api/make', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          pieceType: pieceType === 'Any' ? '' : pieceType,
          style,
          mood,
          timeAvailable,
          previousDesign,
          adjustment: adjustment.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || 'Adjustment failed — please try again.')
      setDesign(data)
      setAdjustment('')
      fetchImage(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Adjustment failed')
    } finally {
      setRefining(false)
    }
  }

  async function fetchImage(d: Design) {
    const request = ++imageRequest.current
    const current = () => request === imageRequest.current
    setImageLoading(true)
    setImageError('')
    try {
      const res = await fetch('/api/make/image', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(storable(d)),
      })
      const data = await res.json().catch(() => ({}))
      if (!current()) return
      if (res.ok && data.imageUrl) {
        setDesign(prev => prev ? { ...prev, imageUrl: data.imageUrl } : prev)
        return
      }
      // The preview is non-critical to the design, but a silent blank looks
      // broken — surface why it didn't render so it's actionable.
      setImageError(
        res.status === 501
          ? 'Preview images aren’t configured on this deployment (missing OPENAI_API_KEY).'
          : 'Couldn’t render a preview image — the design itself is ready to build.'
      )
    } catch {
      if (current()) setImageError('Couldn’t render a preview image — the design itself is ready to build.')
    } finally {
      if (current()) setImageLoading(false)
    }
  }

  function retryImage() {
    if (design && !imageLoading) fetchImage(design)
  }

  async function startBuilding() {
    if (!design || saving) return
    if (!await getSession()) { setError('Sign in to save your designs.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: design.title,
          design: storable(design),
          status: 'in_progress',
          current_step: 0,
          started_at: new Date().toISOString(),
        }),
      })
      const build = await res.json().catch(() => ({}))
      if (!res.ok || build.error || !build.id) throw new Error(build.error || 'Failed to start build')
      router.push(`/make/build/${build.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start build')
      setSaving(false)
    }
  }

  async function saveForLater() {
    if (!design || saving) return
    if (!await getSession()) { setError('Sign in to save your designs.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: design.title,
          design: storable(design),
          status: 'draft',
          current_step: 0,
        }),
      })
      const build = await res.json().catch(() => ({}))
      if (!res.ok || build.error) throw new Error(build.error || 'Failed to save')
      router.push('/journal')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save')
      setSaving(false)
    }
  }

  const diffColor = (d: string) =>
    d === 'Beginner' ? 'var(--sage)' : d === 'Advanced' ? 'var(--rose)' : 'var(--moonstone)'

  return (
    <>
      <Nav />
      <main id="main" className="page-main">
        <div className="page-pad" style={{ maxWidth: 900, margin: '0 auto', paddingTop: 52, paddingBottom: 80 }}>

          <header style={{ marginBottom: 40 }}>
            <p className="section-eyebrow fade-up">Design Generator</p>
            <h1 className="fade-up-1" style={{
              fontSize: 44, color: 'var(--cream)',
              fontFamily: 'var(--font-display)', fontWeight: 400, margin: '8px 0 10px'
            }}>Make Something</h1>
            <p className="fade-up-2" style={{ color: 'var(--text2)', fontSize: 17 }}>
              Tell the AI what you&apos;re after. It reads your stash and designs one piece you can build right now.
            </p>
          </header>

          {/* Signed-out prompt */}
          {signedOut && (
            <div className="fade-up-2" style={{
              padding: '12px 18px', background: 'var(--surface)',
              border: '1px solid var(--border)', marginBottom: 24
            }}>
              <span style={{ fontSize: 14, color: 'var(--text2)', fontFamily: 'var(--font-body)' }}>
                <Link href="/account" style={{ color: 'var(--moonstone)', textDecoration: 'underline' }}>Sign in</Link> to load your stash.
              </span>
            </div>
          )}

          {/* Stash status */}
          {stashLoaded && !signedOut && (
            <div className="fade-up-2" style={{
              display: 'flex', gap: 20, padding: '12px 18px',
              background: 'var(--surface)', border: '1px solid var(--border)',
              marginBottom: 24, alignItems: 'center', flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: beads.length > 0 ? 'var(--sage)' : 'var(--rose)' }} />
                <span className="mono" style={{ fontSize: 11, color: 'var(--text2)', letterSpacing: '0.08em' }}>
                  {beads.length} bead{beads.length !== 1 ? 's' : ''} in stash
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: findings.length > 0 ? 'var(--sage)' : 'var(--rose)' }} />
                <span className="mono" style={{ fontSize: 11, color: 'var(--text2)', letterSpacing: '0.08em' }}>
                  {findings.length} finding{findings.length !== 1 ? 's' : ''} in stash
                </span>
              </div>
              {stashError && (
                <span role="alert" style={{ fontSize: 14, color: 'var(--rose)', fontFamily: 'var(--font-body)' }}>
                  Couldn’t load your stash — designs may not reflect what you own. Refresh to try again.
                </span>
              )}
              {!stashError && beads.length === 0 && findings.length === 0 && (
                <span style={{ fontSize: 14, color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>
                  Add materials to your stash for personalised designs — or generate anyway for a general idea.
                </span>
              )}
            </div>
          )}

          {/* Brief form */}
          <div className="card fade-up-2" style={{ padding: 32, marginBottom: 32 }}>
            <div className="blueprint-grid" style={{ gap: 20, marginBottom: 24 }}>
              <div>
                <label className="label">Piece type</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {pieceTypes.map(p => (
                    <button key={p} onClick={() => setPieceType(p)} style={{
                      padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: 10,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      background: pieceType === p ? 'var(--surface2)' : 'var(--bg2)',
                      border: `1px solid ${pieceType === p ? 'var(--silver)' : 'var(--border)'}`,
                      color: pieceType === p ? 'var(--silver2)' : 'var(--muted)',
                      cursor: 'pointer', transition: 'all 0.15s'
                    }}>{p}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Time available</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {times.map(t => (
                    <button key={t.value} onClick={() => setTimeAvailable(t.value)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: timeAvailable === t.value ? 'var(--surface2)' : 'var(--bg2)',
                      border: `1px solid ${timeAvailable === t.value ? 'var(--silver)' : 'var(--border)'}`,
                      cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left'
                    }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: timeAvailable === t.value ? 'var(--cream)' : 'var(--text2)' }}>{t.label}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>{t.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="label">Style</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                <button onClick={() => setStyle('')} title="No style constraint" style={{
                  padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: 10,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  background: style === '' ? 'var(--surface2)' : 'var(--bg2)',
                  border: `1px solid ${style === '' ? 'var(--silver)' : 'var(--border)'}`,
                  color: style === '' ? 'var(--silver2)' : 'var(--muted)',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}>Open</button>
                {VALID_STYLES.map(s => (
                  <button key={s} onClick={() => setStyle(s)} title={STYLE_DESCRIPTIONS[s]} style={{
                    padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: 10,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    background: style === s ? 'var(--surface2)' : 'var(--bg2)',
                    border: `1px solid ${style === s ? 'var(--silver)' : 'var(--border)'}`,
                    color: style === s ? 'var(--silver2)' : 'var(--muted)',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}>{STYLE_LABELS[s]}</button>
                ))}
              </div>
              {style && (
                <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 8, fontFamily: 'var(--font-body)' }}>
                  {STYLE_DESCRIPTIONS[style]}
                </p>
              )}
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="label">Mood / vibe</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                <button onClick={() => setMood('')} style={{
                  padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: 10,
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  background: mood === '' ? 'var(--surface2)' : 'var(--bg2)',
                  border: `1px solid ${mood === '' ? 'var(--silver)' : 'var(--border)'}`,
                  color: mood === '' ? 'var(--silver2)' : 'var(--muted)',
                  cursor: 'pointer', transition: 'all 0.15s'
                }}>Open</button>
                {moods.map(m => (
                  <button key={m} onClick={() => setMood(m)} style={{
                    padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: 10,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    background: mood === m ? 'var(--surface2)' : 'var(--bg2)',
                    border: `1px solid ${mood === m ? 'var(--silver)' : 'var(--border)'}`,
                    color: mood === m ? 'var(--silver2)' : 'var(--muted)',
                    cursor: 'pointer', transition: 'all 0.15s'
                  }}>{m}</button>
                ))}
              </div>
            </div>
            <button className="btn-silver" style={{ width: '100%', justifyContent: 'center', padding: '14px' }}
              onClick={generate} disabled={loading || signedOut}>
              {loading
                ? <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <span className="strand-loader"><i/><i/><i/></span>
                    <span style={{ textAlign: 'center', lineHeight: 1.3 }}>Reading stash &amp; designing…</span>
                  </span>
                : signedOut
                  ? 'Sign in to design'
                  : 'Design Something'}
            </button>
          </div>

          {error && (
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, marginBottom: 20, color: 'var(--rose)' }}>
              {error === 'Sign in to save your designs.'
                ? <><Link href="/account" style={{ color: 'var(--moonstone)', textDecoration: 'underline' }}>Sign in</Link> to save your designs.</>
                : error}
            </p>
          )}

          {/* Design output */}
          {design && (
            <div className="fade-up">
              {/* Header card */}
              <div style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderTop: '3px solid var(--silver)', padding: 36, marginBottom: 16
              }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                  <span className="tag" style={{ borderColor: diffColor(design.difficulty), color: diffColor(design.difficulty) }}>
                    {design.difficulty}
                  </span>
                  <span className="tag">{design.estimatedTime}</span>
                  <span className="tag">{design.pieceType}</span>
                  {design.materialsCheck?.allAvailable === false && (
                    <span className="tag" style={{ borderColor: 'var(--rose)', color: 'var(--rose)' }}>⚠ Check materials</span>
                  )}
                </div>
                <h2 style={{
                  fontSize: 36, color: 'var(--cream)', fontFamily: 'var(--font-display)',
                  fontWeight: 400, marginBottom: 8
                }}>{design.title}</h2>
                <p style={{ color: 'var(--text2)', fontSize: 17, marginBottom: 16 }}>{design.description}</p>

                <div style={{
                  background: 'var(--bg2)', border: '1px solid var(--border)',
                  padding: '14px 18px', marginBottom: 16
                }}>
                  <span className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--moonstone)' }}>COLOUR STORY</span>
                  <p style={{ color: 'var(--text)', fontSize: 15, marginTop: 6, lineHeight: 1.6 }}>{design.colourStory}</p>
                </div>

                {/* Visual (AI render) + Schematic (buildable diagram) */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {([['visual', 'Visual'], ['schematic', 'Schematic']] as const).map(([v, label]) => (
                      <button key={v} onClick={() => setView(v)} style={{
                        padding: '6px 14px', fontFamily: 'var(--font-mono)', fontSize: 10,
                        letterSpacing: '0.1em', textTransform: 'uppercase',
                        background: view === v ? 'var(--surface2)' : 'var(--bg2)',
                        border: `1px solid ${view === v ? 'var(--silver)' : 'var(--border)'}`,
                        color: view === v ? 'var(--silver2)' : 'var(--muted)',
                        cursor: 'pointer', transition: 'all 0.15s'
                      }}>{label}</button>
                    ))}
                  </div>

                  {view === 'schematic' ? (
                    <>
                      <Schematic blueprint={design} beads={beads} findings={findings} />
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.1em', marginTop: 6 }}>
                        BUILDABLE DIAGRAM · MATCHED TO YOUR STASH
                      </p>
                    </>
                  ) : imageLoading && !design.imageUrl ? (
                    <div style={{
                      height: 320, background: 'var(--roast)', border: '1px solid var(--seam)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
                    }}>
                      <StrandLoader />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--meta)', letterSpacing: '0.1em' }}>
                        RENDERING DESIGN…
                      </span>
                    </div>
                  ) : design.imageUrl ? (
                    <div style={{ position: 'relative' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={design.imageUrl}
                        alt={design.title}
                        style={{ width: '100%', display: 'block', border: '1px solid var(--border)', maxHeight: 420, objectFit: 'cover' }}
                      />
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        padding: '24px 16px 10px',
                        background: 'linear-gradient(to top, rgba(13,10,9,0.85) 0%, transparent 100%)'
                      }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--tan)', letterSpacing: '0.12em' }}>
                          AI RENDER · FOR REFERENCE ONLY
                        </span>
                      </div>
                    </div>
                  ) : imageError ? (
                    <div style={{
                      padding: '14px 16px', background: 'var(--bg2)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'
                    }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--text2)' }}>
                        {imageError}
                      </span>
                      <button className="btn-ghost" onClick={retryImage} disabled={imageLoading} style={{ flexShrink: 0 }}>
                        Retry preview
                      </button>
                    </div>
                  ) : (
                    <div style={{ padding: '32px 16px', textAlign: 'center', border: '1px dashed var(--border)', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.08em' }}>
                      Preview will appear here.
                    </div>
                  )}
                </div>

                {design.materialsCheck?.notes && (
                  <div style={{
                    background: 'rgba(200,112,112,0.05)', border: '1px solid rgba(200,112,112,0.2)',
                    padding: '12px 16px', marginBottom: 16
                  }}>
                    <span className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--rose)' }}>MATERIALS NOTE</span>
                    <p style={{ color: 'var(--text2)', fontSize: 14, marginTop: 6 }}>{design.materialsCheck.notes}</p>
                  </div>
                )}

                {/* CTAs */}
                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  <button className="btn-silver" style={{ flex: 1, justifyContent: 'center', padding: '14px' }}
                    onClick={startBuilding} disabled={saving}>
                    {saving ? <><span className="spinner" />Starting…</> : '→ Start Building'}
                  </button>
                  <button className="btn-outline" onClick={saveForLater} disabled={saving}>
                    Save for later
                  </button>
                  <button className="btn-outline" onClick={generate} disabled={loading}>
                    Try another
                  </button>
                </div>

                {/* Refine */}
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <label className="label">Adjust this design</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input-base"
                      style={{ flex: 1 }}
                      placeholder="e.g. swap the garnets for moonstone · fewer steps"
                      value={adjustment}
                      maxLength={300}
                      onChange={e => setAdjustment(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && adjustment.trim()) refine() }}
                      disabled={refining || loading}
                    />
                    <button className="btn-outline" onClick={refine} disabled={refining || loading || !adjustment.trim()}>
                      {refining ? <><span className="spinner-dark" />Adjusting…</> : 'Adjust'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Materials + Steps preview */}
              <div className="blueprint-grid">
                <div className="card" style={{ padding: 28 }}>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400,
                    color: 'var(--cream)', marginBottom: 16
                  }}>Materials</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(design.components || []).map((c, i) => (
                      <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--silver)',
                          minWidth: 20, marginTop: 2
                        }}>×{c.quantity}</span>
                        <div>
                          <p style={{ color: 'var(--cream)', fontSize: 15 }}>{c.item}</p>
                          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 2 }}>{c.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ padding: 28 }}>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400,
                    color: 'var(--cream)', marginBottom: 16
                  }}>Steps preview</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(design.steps || []).slice(0, 5).map((s) => (
                      <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                        <span style={{
                          width: 22, height: 22, background: 'var(--surface2)',
                          border: '1px solid var(--border)', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 10,
                          color: 'var(--muted)', flexShrink: 0
                        }}>{s.id}</span>
                        <div>
                          <p style={{ color: 'var(--text2)', fontSize: 14, lineHeight: 1.4 }}>{s.instruction}</p>
                          {s.technique && (
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em',
                              color: 'var(--moonstone)', textTransform: 'uppercase', marginTop: 3, display: 'block'
                            }}>{s.technique}</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {(design.steps || []).length > 5 && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.08em' }}>
                        + {(design.steps || []).length - 5} more steps in build mode
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
