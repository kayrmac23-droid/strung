'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Bead, { CurrentBead, OpenBead } from '@/components/Bead'
import StrandLoader from '@/components/StrandLoader'
import { beadFormFor, nominalPx, safeHex, stepColours } from '@/lib/bead'
import { getAuthHeaders } from '@/lib/authClient'
import { planStashDecrements } from '@/lib/stashDecrement'
import { MAX_MINUTES, MAX_NOTES_CHARS } from '@/lib/builds'

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
  difficulty: string
  estimatedTime: string
  pieceType: string
  components: { item: string; quantity: number; note: string }[]
  steps: Step[]
}

interface Build {
  id: string
  title: string
  design: Design
  status: 'draft' | 'in_progress' | 'completed'
  current_step: number
  started_at: string | null
  completed_at: string | null
  time_taken_minutes: number | null
  rating: string | null
  notes: string | null
}

const isRecord = (v: unknown): boolean => !!v && typeof v === 'object' && !Array.isArray(v)

const ratingLabels: Record<string, string> = {
  loved_it: 'Loved it',
  good: 'Good',
  could_be_better: 'Could be better',
}

export default function BuildPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const router = useRouter()
  // Stash beads, only to colour the progress strand and the step's materials.
  // Best-effort: build mode works the same without them.
  const [stashBeads, setStashBeads] = useState<Array<{ name: string; hex?: string; shape?: string; type?: string }>>([])

  const [build, setBuild] = useState<Build | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState<string>('')
  const [showStashPrompt, setShowStashPrompt] = useState(false)
  const [decrementing, setDecrementing] = useState(false)
  const [stashNote, setStashNote] = useState('')
  const [signedOut, setSignedOut] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function loadBuild() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/builds?id=${encodeURIComponent(id)}`, { headers: await getAuthHeaders() })
        const record = await res.json().catch(() => null)
        if (cancelled) return
        setSignedOut(res.status === 401)
        if (!res.ok || record?.error || !record?.id) throw new Error(record?.error || 'Build not found')
        // builds.design is jsonb: guard the two fields every render reads so an
        // older or hand-edited row degrades to "no steps" instead of crashing.
        const design = record.design && typeof record.design === 'object' ? record.design : {}
        setBuild({
          ...record,
          design: {
            ...design,
            // Entries too: one null step threw on `activeStep.instruction`.
            steps: Array.isArray(design.steps) ? design.steps.filter(isRecord) : [],
            components: Array.isArray(design.components) ? design.components.filter(isRecord) : [],
          },
        })
        setNotes(record.notes || '')
        setRating(record.rating || '')
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Failed to load build'
        if (!cancelled) setError(message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBuild()
    ;(async () => {
      try {
        const res = await fetch('/api/inventory', { headers: await getAuthHeaders() })
        if (!res.ok) return
        const d = await res.json()
        if (!cancelled && Array.isArray(d.beads)) setStashBeads(d.beads)
      } catch { /* colours are decoration only */ }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const steps = build?.design.steps || []
  const totalSteps = steps.length

  const activeStepIndex = useMemo(() => {
    if (!build) return 0
    if (build.status === 'completed') return Math.max(0, totalSteps - 1)
    return Math.min(Math.max(build.current_step, 0), Math.max(totalSteps - 1, 0))
  }, [build, totalSteps])

  const activeStep = steps[activeStepIndex]

  async function patchBuild(updates: Partial<Build>): Promise<Build | null> {
    if (!build) return null
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/builds', {
        method: 'PATCH',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ id: build.id, ...updates }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to save')
      // Keep the guarded design already in state — the PATCH never changes it.
      setBuild(prev => (prev ? { ...data, design: prev.design } : data))
      if (typeof data.notes === 'string') setNotes(data.notes)
      if (typeof data.rating === 'string' || data.rating === null) setRating(data.rating || '')
      return data
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to save'
      setError(message)
      return null
    } finally {
      setSaving(false)
    }
  }

  // After completion, optionally subtract the exact materials used (design
  // components hold stash item names + quantities) from the stash. Best-effort:
  // completion has already succeeded, so any failure here is swallowed.
  async function decrementStash() {
    if (!build) return
    setDecrementing(true)
    try {
      const authHeaders = await getAuthHeaders({ 'Content-Type': 'application/json' })
      const res = await fetch('/api/inventory', { headers: await getAuthHeaders() })
      if (!res.ok) throw new Error('Could not load stash')
      const inv = await res.json()
      const beads: Array<{ id: string; name: string; quantity: number }> = inv.beads || []
      const findings: Array<{ id: string; name: string; quantity: number }> = inv.findings || []

      // Aggregate per stash row first so components that reference the same item
      // subtract the correct total in a single PATCH (see planStashDecrements).
      const targets = planStashDecrements(build.design.components || [], beads, findings)
      // fetch() only rejects on a network failure — a 429 or 500 resolves — so
      // each response has to be checked, or a failed update reads as success.
      const results = await Promise.all(targets.map(t =>
        fetch('/api/inventory', {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ table: t.table, id: t.id, data: { quantity: t.quantity } }),
        }).then(r => r.ok, () => false)
      ))
      const updated = results.filter(Boolean).length
      if (targets.length === 0) {
        setStashNote('None of the materials matched a stash item by name, so nothing was subtracted.')
      } else if (updated < targets.length) {
        setStashNote(`Updated ${updated} of ${targets.length} stash items — the rest could not be saved. Check your stash.`)
      } else {
        setStashNote(`Stash updated — ${updated} item${updated === 1 ? '' : 's'} subtracted.`)
      }
    } catch {
      setStashNote('Could not update your stash, but your finished build is saved.')
    } finally {
      setDecrementing(false)
      setShowStashPrompt(false)
    }
  }

  async function goToStep(stepIndex: number) {
    if (!build || build.status === 'completed') return
    // One PATCH: starting a draft used to be a separate request ahead of the
    // step change, which doubled the writes and could leave the step unsaved.
    await patchBuild({
      status: 'in_progress',
      current_step: stepIndex,
      ...(build.started_at ? {} : { started_at: new Date().toISOString() }),
    })
  }

  async function completeBuild() {
    if (!build || build.status === 'completed') return
    const startedAtMs = build.started_at ? new Date(build.started_at).getTime() : Date.now()
    const elapsedMs = Math.max(0, Date.now() - startedAtMs)
    // Capped at the API's limit: a draft started over a year ago otherwise
    // failed completion outright with "Invalid time_taken_minutes".
    const minutes = Math.min(MAX_MINUTES, Math.max(1, Math.round(elapsedMs / 60000)))
    const updated = await patchBuild({
      status: 'completed',
      current_step: Math.max(totalSteps - 1, 0),
      completed_at: new Date().toISOString(),
      time_taken_minutes: minutes,
      notes: notes.trim() || null,
      rating: rating || null,
    })
    if (updated?.status === 'completed' && (build.design.components?.length ?? 0) > 0) {
      setStashNote('')
      setShowStashPrompt(true)
    }
  }

  async function saveReflection() {
    if (!build) return
    await patchBuild({
      notes: notes.trim() || null,
      rating: rating || null,
    })
  }

  if (loading) {
    return (
      <>
        <Nav />
        <main id="main" className="page-main">
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 20px' }}><StrandLoader label="Laying out the steps…" /></div>
        </main>
      </>
    )
  }

  if (!build) {
    return (
      <>
        <Nav />
        <main id="main" className="page-main">
          <div className="wrap" style={{ paddingTop: 60, paddingBottom: 60 }}>
            <p role="alert" style={{ color: 'var(--madder-text)', fontFamily: 'var(--font-mono)' }}>{error || 'Build not found'}</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              {signedOut && <Link href="/account" className="btn-primary">Sign in</Link>}
              <Link href="/journal" className="btn-outline">Back to journal</Link>
            </div>
          </div>
        </main>
      </>
    )
  }

  const done = build.status === 'completed'
  const colours = stepColours(steps, stashBeads)
  const isLast = activeStepIndex >= totalSteps - 1
  const pad2 = (n: number) => String(n).padStart(2, '0')
  // What goes on the board: the step's material, else the stash bead its
  // instruction names (many steps leave `material` null). Longest name wins so
  // "garnet rondelle" beats "garnet". Nothing found → the panel is left out
  // rather than claiming the step needs nothing.
  const material = activeStep?.material?.trim() || ''
  const boardText = `${material} ${activeStep?.instruction ?? ''}`.toLowerCase()
  const materialBead = [...stashBeads]
    .filter(b => typeof b.name === 'string' && b.name.trim().length >= 3)
    .sort((a, b) => b.name.length - a.name.length)
    .find(b => boardText.includes(b.name.trim().toLowerCase()))
  const boardLabel = material || materialBead?.name || ''

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <main id="main" className="page-main page-main--bare" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Build mode drops the studio nav: one bar, one way out. */}
        <div className="build-bar">
          <Link href="/bench" className="link-quiet" style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase' }}>× Leave the bench</Link>
          <span style={{ color: 'var(--cream)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{build.title}</span>
          <span style={{ color: 'var(--tan)' }}>{done ? 'Finished' : totalSteps ? `${pad2(activeStepIndex + 1)} / ${pad2(totalSteps)}` : '—'}</span>
        </div>

        {error && <p role="alert" className="wrap" style={{ color: 'var(--madder-text)', fontFamily: 'var(--font-mono)', fontSize: 12, paddingTop: 16 }}>{error}</p>}

        {!done ? (
          <>
            <div className="wrap" style={{ flex: 1, maxWidth: 1180, paddingTop: 'clamp(24px,4vw,48px)', paddingBottom: 40, display: 'flex', flexDirection: 'column', gap: 'clamp(28px,4vw,48px)' }}>
              {totalSteps > 0 && (
                <nav aria-label="Steps" className="build-strand">
                  <div aria-hidden="true" className="build-strand-thread" />
                  {steps.map((_, i) => {
                    const cur = i === activeStepIndex
                    return (
                      <button key={i} type="button" onClick={() => goToStep(i)} disabled={saving || cur}
                        aria-label={`Step ${i + 1}${i < activeStepIndex ? ', done' : ''}`} aria-current={cur ? 'step' : undefined}>
                        <span style={{ height: 44, display: 'flex', alignItems: 'center' }}>
                          {cur ? <CurrentBead size={28} /> : i < activeStepIndex ? <Bead hex={colours[i] || '#9C8070'} size={20} /> : <OpenBead size={14} fill="var(--mocha)" />}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '.1em', color: cur ? 'var(--cream)' : 'var(--meta)' }}>{pad2(i + 1)}</span>
                      </button>
                    )
                  })}
                </nav>
              )}

              {activeStep ? (
                <div key={activeStepIndex} className="split" style={{ ['--min' as string]: '380px', gap: 'clamp(24px,4vw,56px)', alignItems: 'start', animation: 'ss-up .35s ease both' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                      <span className="numeral" aria-hidden="true" style={{ fontSize: 'clamp(79px,11.5vw,164px)', lineHeight: .8, letterSpacing: '-.04em', color: 'var(--seam)' }}>{pad2(activeStepIndex + 1)}</span>
                      {activeStep.technique && <span className="eyebrow eyebrow--lit" style={{ letterSpacing: '.14em' }}>{activeStep.technique}</span>}
                    </div>
                    <h1 className="display" style={{ fontSize: 'clamp(25px,3.1vw,43px)', lineHeight: 1.1, letterSpacing: '-.015em', textWrap: 'pretty' }}>{activeStep.instruction}</h1>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    {boardLabel && (
                      <div className="panel">
                        <div className="panel-head"><span>On the board for this step</span></div>
                        <div style={{ padding: '8px 22px 14px' }}>
                          <div className="row-line" style={{ padding: '10px 0' }}>
                            <div style={{ width: 24, display: 'flex', justifyContent: 'center' }}>
                              {materialBead ? <Bead hex={safeHex(materialBead.hex)} shape={beadFormFor(materialBead)} size={nominalPx(beadFormFor(materialBead)) * 1.8} /> : <OpenBead size={12} colour="var(--tan)" fill="transparent" />}
                            </div>
                            <span style={{ flex: 1, color: 'var(--cream)', fontSize: 15 }}>{boardLabel}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {activeStep.tip && (
                      <div className="well" style={{ padding: '20px 22px' }}>
                        <span className="eyebrow eyebrow--sm" style={{ color: 'var(--tan)' }}>From the margin</span>
                        <p style={{ marginTop: 8, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 17, lineHeight: 1.45 }}>{activeStep.tip}</p>
                      </div>
                    )}
                    {activeStep.technique && (
                      <Link href="/guides" className="link-under" style={{ alignSelf: 'flex-start', marginTop: 8 }}>Read up on {activeStep.technique.toLowerCase()} →</Link>
                    )}
                  </div>
                </div>
              ) : (
                <p className="aside-line" style={{ fontSize: 17 }}>No steps found for this design.</p>
              )}
            </div>

            <div className="build-controls">
              <button className="btn-outline" style={{ flex: '0 1 200px', padding: 20, fontSize: 12 }}
                disabled={saving || activeStepIndex <= 0} onClick={() => goToStep(activeStepIndex - 1)}>← Back</button>
              {isLast ? (
                <button className="btn-primary" style={{ flex: 1, padding: 20, fontSize: 12 }} disabled={saving} onClick={completeBuild}>
                  {saving ? 'Saving…' : 'Mark it finished'}
                </button>
              ) : (
                <button className="btn-primary" style={{ flex: 1, padding: 20, fontSize: 12 }} disabled={saving} onClick={() => goToStep(activeStepIndex + 1)}>
                  Next · step {pad2(activeStepIndex + 2)} →
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="wrap ss-up" style={{ flex: 1, maxWidth: 880, paddingTop: 'clamp(40px,6vw,80px)', paddingBottom: 'clamp(40px,6vw,80px)', display: 'flex', flexDirection: 'column', gap: 36 }}>
            {totalSteps > 0 && (
              <div aria-hidden="true" style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 32, maxWidth: 520 }}>
                <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: 'var(--saddle)' }} />
                {steps.map((_, i) => <Bead key={i} hex={colours[i] || '#9C8070'} size={20} />)}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h1 className="display" style={{ fontSize: 'clamp(52px,8.2vw,121px)', lineHeight: .88, letterSpacing: '-.035em' }}>Strung.</h1>
              <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 20, color: 'var(--tan)' }}>
                {build.title}{typeof build.time_taken_minutes === 'number' && build.time_taken_minutes > 0 ? ` · ${build.time_taken_minutes} minute${build.time_taken_minutes === 1 ? '' : 's'} at the bench.` : '.'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="eyebrow eyebrow--sm" style={{ letterSpacing: '.16em' }}>How did it come out</span>
              <div className="chip-row" role="group" aria-label="Rating">
                {Object.entries(ratingLabels).map(([value, label]) => (
                  <button key={value} type="button" className="chip" aria-pressed={rating === value} onClick={() => setRating(value)}>{label}</button>
                ))}
              </div>
            </div>
            <textarea
              className="input-base"
              aria-label="Notes on this piece"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={MAX_NOTES_CHARS}
              placeholder="What worked, what you'd tweak next time..."
              style={{ minHeight: 120, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 17 }}
            />

            {showStashPrompt && (
              <div className="panel">
                <div className="panel-head"><span>Take these out of your stash?</span></div>
                <div style={{ padding: '6px 22px 18px' }}>
                  {(build.design.components || []).map((c, i) => (
                    <div key={i} className="row-line" style={{ justifyContent: 'space-between', fontSize: 15 }}>
                      <span style={{ color: 'var(--cream)' }}>{c.item}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tan)' }}>−{c.quantity}</span>
                    </div>
                  ))}
                  <p className="aside-line" style={{ fontSize: 14, margin: '12px 0 14px' }}>Matched to your stash by name — anything worded differently is left alone.</p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn-primary btn-md" disabled={decrementing} onClick={decrementStash}>
                      {decrementing ? <><span className="spinner" />Updating…</> : 'Yes, subtract'}
                    </button>
                    <button className="btn-outline btn-md" disabled={decrementing} onClick={() => setShowStashPrompt(false)}>Not now</button>
                  </div>
                </div>
              </div>
            )}
            {stashNote && <p role="status" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.06em' }}>{stashNote}</p>}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn-primary" style={{ flex: '1 1 240px', padding: '18px 24px 17px', fontSize: 12 }} disabled={saving}
                onClick={async () => { if (await patchBuild({ notes: notes.trim() || null, rating: rating || null })) router.push('/journal') }}>
                {saving ? 'Saving…' : 'Into the journal →'}
              </button>
              <button className="btn-outline" style={{ padding: '17px 20px' }} disabled={saving} onClick={saveReflection}>Save notes</button>
              <Link href="/make" className="btn-outline" style={{ padding: '17px 20px' }}>Make another</Link>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
