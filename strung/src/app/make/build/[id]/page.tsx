'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { getAuthHeaders } from '@/lib/authClient'
import { planStashDecrements } from '@/lib/stashDecrement'

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

const ratingLabels: Record<string, string> = {
  loved_it: 'Loved it',
  good: 'Good',
  could_be_better: 'Could be better',
}

export default function BuildPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id

  const [build, setBuild] = useState<Build | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState<string>('')
  const [showStashPrompt, setShowStashPrompt] = useState(false)
  const [decrementing, setDecrementing] = useState(false)
  const [stashNote, setStashNote] = useState('')

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function loadBuild() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/builds?id=${encodeURIComponent(id)}`, { headers: await getAuthHeaders() })
        const record = await res.json()
        if (!res.ok || record?.error || !record?.id) throw new Error(record?.error || 'Build not found')
        if (cancelled) return
        setBuild(record)
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
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to save')
      setBuild(data)
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
      await Promise.all(targets.map(t =>
        fetch('/api/inventory', {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ table: t.table, id: t.id, data: { quantity: t.quantity } }),
        })
      ))
      setStashNote('Stash updated — used materials subtracted.')
    } catch {
      setStashNote('Could not update your stash, but your finished build is saved.')
    } finally {
      setDecrementing(false)
      setShowStashPrompt(false)
    }
  }

  async function startBuildIfDraft() {
    if (!build || build.status !== 'draft') return
    await patchBuild({
      status: 'in_progress',
      started_at: build.started_at || new Date().toISOString(),
    })
  }

  async function goToStep(stepIndex: number) {
    if (!build || build.status === 'completed') return
    await startBuildIfDraft()
    await patchBuild({ status: 'in_progress', current_step: stepIndex })
  }

  async function completeBuild() {
    if (!build || build.status === 'completed') return
    const startedAtMs = build.started_at ? new Date(build.started_at).getTime() : Date.now()
    const elapsedMs = Math.max(0, Date.now() - startedAtMs)
    const minutes = Math.max(1, Math.round(elapsedMs / 60000))
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
        <main style={{ paddingTop: 60, minHeight: '100vh' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <span className="spinner-dark" />
            </div>
          </div>
        </main>
      </>
    )
  }

  if (!build) {
    return (
      <>
        <Nav />
        <main style={{ paddingTop: 60, minHeight: '100vh' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '60px 40px' }}>
            <p style={{ color: 'var(--rose)', fontFamily: 'var(--font-mono)' }}>{error || 'Build not found'}</p>
            <div style={{ marginTop: 20 }}>
              <Link href="/journal" className="btn-outline">Back to journal</Link>
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 60, minHeight: '100vh' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '52px 40px 80px' }}>
          <p className="section-eyebrow">Build mode</p>
          <h1 style={{
            fontSize: 40,
            color: 'var(--cream)',
            fontFamily: 'var(--font-display)',
            fontWeight: 400,
            margin: '8px 0 8px',
          }}>
            {build.title}
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 17, marginBottom: 24 }}>
            {build.design.description}
          </p>

          {error && (
            <p style={{ color: 'var(--rose)', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 18 }}>{error}</p>
          )}

          <div className="card" style={{ padding: 28, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span className="tag">
                Step {totalSteps === 0 ? 0 : activeStepIndex + 1} / {totalSteps}
              </span>
              <span className="tag">
                {build.status === 'completed' ? 'Completed' : build.status === 'draft' ? 'Draft' : 'In progress'}
              </span>
            </div>

            {activeStep ? (
              <div style={{ marginTop: 18 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 400, color: 'var(--cream)', marginBottom: 10 }}>
                  {activeStep.instruction}
                </h2>
                {activeStep.material && (
                  <p style={{ color: 'var(--text2)', fontSize: 14, marginBottom: 6 }}>
                    Material: {activeStep.material}
                  </p>
                )}
                {activeStep.technique && (
                  <p style={{ color: 'var(--moonstone)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.09em' }}>
                    Technique: {activeStep.technique}
                  </p>
                )}
                {activeStep.tip && (
                  <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 10, fontStyle: 'italic' }}>
                    Tip: {activeStep.tip}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ color: 'var(--muted)', marginTop: 16 }}>No steps found for this design.</p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button
                className="btn-outline"
                disabled={saving || activeStepIndex <= 0 || build.status === 'completed'}
                onClick={() => goToStep(activeStepIndex - 1)}
              >
                ← Previous
              </button>
              <button
                className="btn-silver"
                disabled={saving || activeStepIndex >= totalSteps - 1 || build.status === 'completed'}
                onClick={() => goToStep(activeStepIndex + 1)}
              >
                Next step →
              </button>
              {build.status !== 'completed' && (
                <button className="btn-silver" disabled={saving} onClick={completeBuild}>
                  {saving ? 'Saving…' : 'Mark complete'}
                </button>
              )}
            </div>
          </div>

          {showStashPrompt && (
            <div className="card" style={{ padding: 20, marginBottom: 16, borderColor: 'var(--silver)' }}>
              <p style={{ color: 'var(--cream)', fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 4 }}>Nice work — you finished it.</p>
              <p style={{ color: 'var(--text2)', fontSize: 15, marginBottom: 14 }}>Subtract the materials you used from your stash?</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-silver" disabled={decrementing} onClick={decrementStash}>
                  {decrementing ? <><span className="spinner" />Updating…</> : 'Yes, subtract'}
                </button>
                <button className="btn-outline" disabled={decrementing} onClick={() => setShowStashPrompt(false)}>Not now</button>
              </div>
            </div>
          )}
          {stashNote && (
            <p style={{ color: 'var(--text2)', fontFamily: 'var(--font-mono)', fontSize: 12, marginBottom: 16, letterSpacing: '0.06em' }}>{stashNote}</p>
          )}

          <div className="card" style={{ padding: 24, marginBottom: 16 }}>
            <h3 style={{
              color: 'var(--cream)',
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              fontSize: 24,
              marginBottom: 14,
            }}>
              Reflection
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {Object.entries(ratingLabels).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setRating(value)}
                  style={{
                    padding: '8px 12px',
                    border: `1px solid ${rating === value ? 'var(--silver)' : 'var(--border)'}`,
                    color: rating === value ? 'var(--silver2)' : 'var(--muted)',
                    background: rating === value ? 'var(--surface2)' : 'var(--bg2)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              className="input-base"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What worked, what you'd tweak next time..."
              style={{ width: '100%', minHeight: 120, resize: 'vertical', marginBottom: 12 }}
            />
            <button className="btn-outline" disabled={saving} onClick={saveReflection}>
              {saving ? 'Saving…' : 'Save notes'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/journal" className="btn-outline">Back to journal</Link>
            <Link href="/make" className="btn-ghost">Create another design</Link>
          </div>
        </div>
      </main>
    </>
  )
}
