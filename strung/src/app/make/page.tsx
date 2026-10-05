'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Nav, { MakeTabs } from '@/components/Nav'
import Bead, { OpenBead } from '@/components/Bead'
import { beadFormFor, nominalPx, safeHex, stepColours } from '@/lib/bead'
import Schematic from '@/components/Schematic'
import StrandLoader from '@/components/StrandLoader'
import type { BeadItem, FindingItem } from '@/lib/supabase'
import { getAuthHeaders, getSession } from '@/lib/authClient'
import { VALID_STYLES, STYLE_LABELS, STYLE_DESCRIPTIONS, type Style } from '@/lib/designVocab'
import type { Assembly } from '@/lib/assembly'

// The brief is a sentence (2026-10 redesign): "Make me a [piece] that feels
// [mood], with [time] at the bench." Each underlined word cycles through its
// options. `value` is what /api/make receives; `say` is how it reads in the
// sentence.
const pieceTypes = [
  { value: 'Any', say: 'something' },
  { value: 'Earrings', say: 'a pair of earrings' },
  { value: 'Necklace', say: 'a necklace' },
  { value: 'Bracelet', say: 'a bracelet' },
  { value: 'Pendant', say: 'a pendant' },
  { value: 'Anklet', say: 'an anklet' },
]
const moods = [
  { value: '', say: 'right for the stash' },
  ...['Dark & moody', 'Ethereal & dreamy', 'Earthy & rustic', 'Bold & dramatic', 'Delicate & feminine', 'Celestial & mystical', 'Coastal & breezy', 'Rich & opulent']
    .map(m => ({ value: m, say: m.toLowerCase() })),
]
const times = [
  { value: '15min', say: 'fifteen minutes' },
  { value: '1hour', say: 'about an hour' },
  { value: 'afternoon', say: 'a whole afternoon' },
]
const cycle = <T,>(list: T[], cur: number) => (cur + 1) % list.length
// Starting points for the adjust box. Tapping one fills the box rather than
// sending it — every adjustment is a paid design call.
const ADJUST_HINTS = ['Fewer steps', 'Make it asymmetric', 'Make it longer', 'Use a different accent bead']

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
  // Diagram first: it's free, and the render is a paid call made on request.
  const [view, setView] = useState<'visual' | 'schematic'>('schematic')
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
    // Not while a refine is in flight either: its reply would land after this
    // one and replace the new design with an adjusted copy of the old one.
    if (loading || refining) return
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
      // No automatic render: each preview is a paid image call, so it runs only
      // when the maker asks for it ("Render preview").
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
      // The design changed, so a render still in flight belongs to the old one:
      // invalidate it (refine used to do this by starting a new render itself).
      imageRequest.current++
      setImageLoading(false); setImageError('')
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
          : res.status === 429
            ? (typeof data.error === 'string' && data.error) || 'Too many previews in a row — wait a moment and try again.'
            : 'Couldn’t render a preview image — the design itself is ready to build.'
      )
    } catch {
      if (current()) setImageError('Couldn’t render a preview image — the design itself is ready to build.')
    } finally {
      if (current()) setImageLoading(false)
    }
  }

  // First render and retry are the same action now that nothing renders on its own.
  function retryImage() {
    if (design && !imageLoading) fetchImage(design)
  }

  async function startBuilding() {
    // Saving mid-refine would store the design the maker is busy changing.
    if (!design || saving || refining) return
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
    // Saving mid-refine would store the design the maker is busy changing.
    if (!design || saving || refining) return
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

  const pieceIdx = Math.max(0, pieceTypes.findIndex(p => p.value === pieceType))
  const moodIdx = Math.max(0, moods.findIndex(m => m.value === mood))
  const timeIdx = Math.max(0, times.findIndex(t => t.value === timeAvailable))
  const allInStash = design?.materialsCheck?.allAvailable !== false
  const stashByName = new Map(beads.map(b => [b.name.trim().toLowerCase(), b]))
  const findingByName = new Map(findings.map(f => [f.name.trim().toLowerCase(), f]))
  const colours = design ? stepColours(design.steps, beads) : []

  return (
    <>
      <Nav />
      <main id="main" className="page-main">
        <MakeTabs />
        <div className="wrap ss-up" style={{ paddingTop: 'clamp(28px,4vw,48px)', paddingBottom: 80, display: 'flex', flexDirection: 'column', gap: 40 }}>

          {signedOut && (
            <div className="well" style={{ padding: '12px 18px' }}>
              <span style={{ fontSize: 15 }}>
                <Link href="/account" className="link-under">Sign in</Link>&nbsp; to load your stash and design from it.
              </span>
            </div>
          )}

          {!design && !loading && (
            <section aria-labelledby="brief-h" style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
              <h1 id="brief-h" className="sr-only">Make something</h1>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p className="display" style={{ fontSize: 'clamp(34px,5.4vw,78px)', lineHeight: 1.1, letterSpacing: '-.02em', color: 'var(--meta)', maxWidth: '20ch', textWrap: 'pretty' }}>
                  Make me{' '}
                  <button type="button" className="brief-word" style={{ borderBottomWidth: 2 }} aria-label={`Piece: ${pieceTypes[pieceIdx].say}. Change`}
                    onClick={() => setPieceType(pieceTypes[cycle(pieceTypes, pieceIdx)].value)}>{pieceTypes[pieceIdx].say}</button>
                  {' '}that feels{' '}
                  <button type="button" className="brief-word" style={{ borderBottomWidth: 2 }} aria-label={`Mood: ${moods[moodIdx].say}. Change`}
                    onClick={() => setMood(moods[cycle(moods, moodIdx)].value)}>{moods[moodIdx].say}</button>
                  , with{' '}
                  <button type="button" className="brief-word" style={{ borderBottomWidth: 2 }} aria-label={`Time: ${times[timeIdx].say}. Change`}
                    onClick={() => setTimeAvailable(times[cycle(times, timeIdx)].value)}>{times[timeIdx].say}</button>
                  {' '}at the bench.
                </p>
                <span className="eyebrow">Tap an underlined word to change it</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="eyebrow eyebrow--sm" style={{ letterSpacing: '.16em' }}>Style · optional</span>
                <div className="chip-row" role="group" aria-label="Style">
                  <button type="button" className="chip" aria-pressed={style === ''} onClick={() => setStyle('')} title="No style constraint">Open</button>
                  {VALID_STYLES.map(st => (
                    <button key={st} type="button" className="chip" aria-pressed={style === st} onClick={() => setStyle(st)} title={STYLE_DESCRIPTIONS[st]}>{STYLE_LABELS[st]}</button>
                  ))}
                </div>
                {style && <p className="aside-line">{STYLE_DESCRIPTIONS[style]}</p>}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <button className="btn-primary btn-lg" style={{ padding: '18px 34px 17px', letterSpacing: '.16em' }}
                  onClick={generate} disabled={loading || refining || signedOut}>
                  {signedOut ? 'Sign in to design' : 'Design it'}
                </button>
                {stashLoaded && !signedOut && (
                  stashError ? (
                    <span role="alert" style={{ fontSize: 15, color: 'var(--madder-text)' }}>
                      Couldn’t load your stash — designs may not reflect what you own. Refresh to try again.
                    </span>
                  ) : beads.length === 0 && findings.length === 0 ? (
                    <span className="aside-line" style={{ fontSize: 17 }}>Your stash is empty — <Link href="/inventory" className="link-under">add beads</Link> for designs built from what you own, or design anyway for a general idea.</span>
                  ) : (
                    <span className="aside-line" style={{ fontSize: 17 }}>Reads all {beads.length} bead type{beads.length === 1 ? '' : 's'} and {findings.length} finding{findings.length === 1 ? '' : 's'} before it draws anything.</span>
                  )
                )}
              </div>
            </section>
          )}

          {loading && (
            <div className="well" style={{ minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <StrandLoader label="Reading stash & designing…" />
            </div>
          )}

          {error && (
            <p role="alert" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--madder-text)' }}>
              {error === 'Sign in to save your designs.'
                ? <><Link href="/account" className="link-under">Sign in</Link>&nbsp; to save your designs.</>
                : error}
            </p>
          )}

          {design && (
            <section aria-labelledby="design-h" className="ss-up" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 760 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {design.difficulty && <span className="tag">{design.difficulty}</span>}
                    {design.estimatedTime && <span className="tag">{design.estimatedTime}</span>}
                    {design.pieceType && <span className="tag">{design.pieceType}</span>}
                    {allInStash
                      ? <span className="tag" style={{ color: 'var(--sage)' }}>● All in stash</span>
                      : <span className="tag" style={{ color: 'var(--ochre)' }}>● Check materials</span>}
                  </div>
                  <h2 id="design-h" className="display d-1" style={{ fontSize: 'clamp(54px,8vw,124px)', lineHeight: .9 }}>{design.title}</h2>
                  <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'clamp(18px,1.8vw,22px)', lineHeight: 1.45, color: 'var(--text2)', maxWidth: '50ch' }}>{design.description}</p>
                </div>
                <button type="button" className="link-under" onClick={() => { setDesign(null); setError(''); imageRequest.current++; setImageLoading(false) }} disabled={saving || refining}>← Change the brief</button>
              </div>

              <div className="split" style={{ ['--min' as string]: '420px', gap: 2, alignItems: 'start' }}>
                <div className="panel">
                  <div role="tablist" aria-label="Design view" className="chip-row" style={{ padding: 10, background: 'var(--umber)', borderBottom: '1px solid var(--seam)' }}>
                    {([['schematic', 'Diagram'], ['visual', 'Render']] as const).map(([v, label]) => (
                      <button key={v} role="tab" aria-selected={view === v} className="chip" style={{ padding: '8px 14px', fontSize: 10 }} onClick={() => setView(v)}>{label}</button>
                    ))}
                  </div>
                  {view === 'schematic' ? (
                    <div style={{ background: 'var(--roast)', padding: 12 }}>
                      <Schematic blueprint={design} beads={beads} findings={findings} />
                      <p className="eyebrow eyebrow--sm" style={{ marginTop: 6, letterSpacing: '.12em' }}>Buildable diagram · matched to your stash</p>
                    </div>
                  ) : imageLoading && !design.imageUrl ? (
                    <div className="render-well">
                      <StrandLoader label="Rendering design…" />
                    </div>
                  ) : design.imageUrl ? (
                    <div style={{ position: 'relative' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={design.imageUrl} alt={design.title} style={{ width: '100%', display: 'block', maxHeight: 520, objectFit: 'cover' }} />
                      <span className="eyebrow eyebrow--sm" style={{ position: 'absolute', left: 16, bottom: 12, color: 'var(--tan)', padding: '4px 8px', background: 'color-mix(in srgb, var(--bean) 80%, transparent)' }}>AI render · for reference only</span>
                    </div>
                  ) : (
                    <div className="render-well" style={{ flexDirection: 'column', gap: 14, padding: 24, textAlign: 'center' }}>
                      {imageError && <span style={{ fontSize: 15, color: 'var(--text2)', maxWidth: '40ch' }}>{imageError}</span>}
                      <button className="btn-outline" onClick={retryImage} disabled={imageLoading}>{imageError ? 'Retry preview' : 'Render preview'}</button>
                      <span className="eyebrow eyebrow--sm" style={{ color: 'var(--tan)' }}>AI render · for reference only</span>
                    </div>
                  )}
                </div>

                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {design.colourStory && (
                    <div className="well" style={{ padding: '22px 24px' }}>
                      <span className="eyebrow eyebrow--sm" style={{ color: 'var(--tan)' }}>Colour story</span>
                      <p style={{ marginTop: 8, fontSize: 16, lineHeight: 1.6 }}>{design.colourStory}</p>
                    </div>
                  )}
                  <div className="panel">
                    <div className="panel-head"><span>Materials</span><span>Need / have</span></div>
                    <div style={{ padding: '6px 24px 16px' }}>
                      {(design.components || []).map((c, i) => {
                        const key = typeof c.item === 'string' ? c.item.trim().toLowerCase() : ''
                        const bead = stashByName.get(key)
                        const finding = bead ? undefined : findingByName.get(key)
                        const have = bead ? bead.quantity : finding?.quantity
                        const need = Number(c.quantity) || 0
                        const ok = typeof have === 'number' && have >= need
                        const form = bead ? beadFormFor(bead) : null
                        return (
                          <div key={i} className="row-line" style={{ alignItems: 'flex-start' }}>
                            <div style={{ width: 24, display: 'flex', justifyContent: 'center', paddingTop: 5 }}>
                              {bead && form ? <Bead hex={safeHex(bead.hex)} shape={form} size={nominalPx(form) * 1.8} /> : <OpenBead size={12} colour="var(--tan)" fill="transparent" />}
                            </div>
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                              <span style={{ color: 'var(--cream)', fontSize: 15 }}>{c.item}</span>
                              {typeof have === 'number' && (
                                <div style={{ height: 2, background: 'var(--roast)', maxWidth: 200 }}>
                                  <div style={{ height: 2, width: `${Math.min(100, have > 0 ? need / have * 100 : 100)}%`, background: ok ? 'var(--sage)' : 'var(--ochre)' }} />
                                </div>
                              )}
                              {c.note && <span style={{ fontSize: 13, color: 'var(--meta)' }}>{c.note}</span>}
                            </div>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.06em', whiteSpace: 'nowrap', color: typeof have === 'number' && !ok ? 'var(--ochre)' : 'var(--text2)' }}>
                              {need}{typeof have === 'number' ? ` / ${have}` : ''}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {design.materialsCheck?.notes && (
                    <div className="well" style={{ padding: '14px 24px' }}>
                      <span className="eyebrow eyebrow--sm" style={{ color: allInStash ? 'var(--tan)' : 'var(--ochre)' }}>Materials note</span>
                      <p style={{ marginTop: 6, fontSize: 15 }}>{design.materialsCheck.notes}</p>
                    </div>
                  )}
                  <div style={{ padding: '20px 24px', background: 'var(--mocha)', border: '1px solid var(--seam)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="btn-primary" style={{ flex: '1 1 200px', padding: '16px 22px 15px' }} onClick={startBuilding} disabled={saving || refining}>
                        {saving ? <><span className="spinner" />Starting…</> : 'Start building →'}
                      </button>
                      <button className="btn-outline" style={{ padding: '15px 18px' }} onClick={saveForLater} disabled={saving || refining}>Save</button>
                      <button className="btn-outline" style={{ padding: '15px 18px' }} onClick={generate} disabled={loading || refining}>Try another</button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, paddingTop: 12, borderTop: '1px solid var(--seam)' }}>
                      <input
                        className="input-base"
                        style={{ flex: 1, minWidth: 0 }}
                        aria-label="Adjust this design"
                        placeholder="Adjust it — e.g. swap the garnets for moonstone"
                        value={adjustment}
                        maxLength={300}
                        onChange={e => setAdjustment(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && adjustment.trim()) refine() }}
                        disabled={refining || loading}
                      />
                      <button className="btn-outline" onClick={refine} disabled={refining || loading || !adjustment.trim()}>
                        {refining ? <><span className="spinner" />Adjusting…</> : 'Adjust'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {ADJUST_HINTS.map(h => (
                        <button key={h} type="button" className="chip" style={{ padding: '6px 10px', fontSize: 10, letterSpacing: '.08em' }} onClick={() => setAdjustment(h)} disabled={refining || loading}>{h}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {(design.steps || []).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <span className="eyebrow" style={{ letterSpacing: '.14em' }}>The build · {design.steps.length} step{design.steps.length === 1 ? '' : 's'}</span>
                  <ol className="tray-grid tray-grid--fill" style={{ ['--min' as string]: '240px', listStyle: 'none' }}>
                    {design.steps.map((st, i) => (
                      <li key={st.id ?? i} style={{ padding: '18px 20px', background: 'var(--mocha)', border: '1px solid var(--seam)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span className="numeral" style={{ fontSize: 30, lineHeight: 1, color: 'var(--saddle)' }}>{String(i + 1).padStart(2, '0')}</span>
                          {colours[i] ? <Bead hex={colours[i]!} size={11} /> : <OpenBead size={8} colour="var(--tan)" fill="transparent" />}
                        </div>
                        <span style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--cream)' }}>{st.instruction}</span>
                        {st.technique && <span className="eyebrow eyebrow--sm" style={{ color: 'var(--tan)', letterSpacing: '.12em' }}>{st.technique}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </>
  )
}
