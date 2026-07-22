'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import { getAuthHeaders } from '@/lib/authClient'

interface Design {
  title: string
  description: string
  difficulty: string
  estimatedTime: string
  steps: { id: number; instruction: string }[]
  pieceType: string
}

interface Build {
  id: string
  title: string
  design: Design
  status: string
  current_step: number
  started_at: string | null
  completed_at: string | null
  time_taken_minutes: number | null
  rating: string | null
  notes: string | null
  created_at: string
}

const ratingLabels: Record<string, { label: string; icon: string; color: string }> = {
  loved_it: { label: 'Loved it', icon: '◈', color: 'var(--silver)' },
  good: { label: 'Good', icon: '◉', color: 'var(--sage)' },
  could_be_better: { label: 'Could be better', icon: '◎', color: 'var(--moonstone)' },
}

const diffColor = (d: string) =>
  d === 'Beginner' ? 'var(--sage)' : d === 'Advanced' ? 'var(--rose)' : 'var(--moonstone)'

export default function JournalPage() {
  const [builds, setBuilds] = useState<Build[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState<'in_progress' | 'completed'>('in_progress')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // The fetch itself. Its first action is an await, so the mount effect never
  // calls setState synchronously (react-hooks/set-state-in-effect).
  async function refresh() {
    try {
      const res = await fetch('/api/builds', { headers: await getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setBuilds(Array.isArray(data) ? data : [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  // Manual retry: show the spinner and clear any prior error, then refetch.
  async function load() {
    setLoading(true)
    setError(false)
    await refresh()
  }

  useEffect(() => { ;(async () => { await refresh() })() }, [])

  async function deleteBuild(id: string) {
    setConfirmingId(null)
    setDeletingId(id)
    try {
      const res = await fetch(`/api/builds?id=${id}`, { method: 'DELETE', headers: await getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to delete')
      setBuilds(b => b.filter(x => x.id !== id))
    } catch {
      setDeleteError(id)
    }
    finally { setDeletingId(null) }
  }

  const inProgress = builds.filter(b => b.status === 'draft' || b.status === 'in_progress')
  const completed = builds.filter(b => b.status === 'completed')

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const active = tab === 'in_progress' ? inProgress : completed

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 60, minHeight: '100vh' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '52px 40px 80px' }}>

          <header style={{ marginBottom: 40 }}>
            <p className="section-eyebrow fade-up">Your Work</p>
            <h1 className="fade-up-1" style={{
              fontSize: 44, color: 'var(--cream)',
              fontFamily: 'var(--font-display)', fontWeight: 400, margin: '8px 0 10px'
            }}>Journal</h1>
            <p className="fade-up-2" style={{ color: 'var(--text2)', fontSize: 17 }}>
              Every piece you&apos;ve built or saved to make.
            </p>
          </header>

          {/* Stats row */}
          {!loading && builds.length > 0 && (
            <div className="fade-up-2" style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, marginBottom: 32
            }}>
              {[
                ['Saved ideas', inProgress.length, '◎'],
                ['Completed', completed.length, '◈'],
                ['Loved it', completed.filter(b => b.rating === 'loved_it').length, '◉'],
              ].map(([label, val, icon]) => (
                <div key={String(label)} className="card" style={{ padding: '18px 22px' }}>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted)',
                    letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6
                  }}>{String(icon)} {String(label)}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--silver2)' }}>{String(val)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 24 }}>
            {([['in_progress', `Ideas (${inProgress.length})`], ['completed', `Completed (${completed.length})`]] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: '9px 20px', fontFamily: 'var(--font-mono)', fontSize: 11,
                letterSpacing: '0.12em', textTransform: 'uppercase',
                background: tab === t ? 'var(--surface2)' : 'var(--surface)',
                border: `1px solid ${tab === t ? 'var(--silver)' : 'var(--border)'}`,
                color: tab === t ? 'var(--silver2)' : 'var(--muted)',
                cursor: 'pointer', transition: 'all 0.15s'
              }}>{label}</button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
              <span className="spinner-dark" />
            </div>
          ) : error ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              border: '1px dashed var(--rose)', color: 'var(--text2)'
            }}>
              <div style={{ fontSize: 40, marginBottom: 12, color: 'var(--rose)' }}>⚠</div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, marginBottom: 16 }}>
                Couldn&apos;t load your journal. Check your connection and try again.
              </p>
              <button onClick={load} className="btn-outline">Retry</button>
            </div>
          ) : active.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '60px 20px',
              border: '1px dashed var(--border)', color: 'var(--muted)'
            }}>
              <div style={{ fontSize: 40, marginBottom: 12, color: 'var(--border2)', animation: 'shimmer 3s ease-in-out infinite' }}>
                {tab === 'in_progress' ? '◎' : '◈'}
              </div>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, marginBottom: 16 }}>
                {tab === 'in_progress'
                  ? 'No saved ideas yet. Generate a design and save it for later.'
                  : 'No completed pieces yet. Start a build to make something.'}
              </p>
              <Link href="/make" className="btn-outline">Go to Make →</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {active.map(build => {
                const r = build.rating ? ratingLabels[build.rating] : null
                const stepsDone = build.status === 'completed' ? build.design.steps.length : build.current_step
                const stepsTotal = build.design.steps.length
                const safeStepsTotal = Math.max(stepsTotal, 1)
                const progressRatio = Math.min(Math.max(stepsDone / safeStepsTotal, 0), 1)

                return (
                  <div key={build.id} className="card" style={{ padding: 28 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                          {build.design.difficulty && (
                            <span className="tag" style={{
                              borderColor: diffColor(build.design.difficulty),
                              color: diffColor(build.design.difficulty)
                            }}>{build.design.difficulty}</span>
                          )}
                          {build.design.pieceType && (
                            <span className="tag">{build.design.pieceType}</span>
                          )}
                          {r && (
                            <span className="tag" style={{ borderColor: r.color, color: r.color }}>
                              {r.icon} {r.label}
                            </span>
                          )}
                          {build.status === 'in_progress' && (
                            <span className="tag" style={{ borderColor: 'var(--moonstone)', color: 'var(--moonstone)' }}>
                              In progress · step {Math.min(stepsDone + 1, safeStepsTotal)}/{safeStepsTotal}
                            </span>
                          )}
                          {build.status === 'draft' && (
                            <span className="tag" style={{ color: 'var(--muted)' }}>Saved idea</span>
                          )}
                        </div>

                        <h3 style={{
                          fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400,
                          color: 'var(--cream)', marginBottom: 6
                        }}>{build.title}</h3>
                        <p style={{ color: 'var(--text2)', fontSize: 15, marginBottom: 10 }}>
                          {build.design.description}
                        </p>

                        {build.notes && (
                          <p style={{
                            fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--muted)',
                            fontStyle: 'italic', marginBottom: 10, lineHeight: 1.5
                          }}>{build.notes}</p>
                        )}

                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.08em' }}>
                            {formatDate(build.created_at)}
                          </span>
                          {build.time_taken_minutes && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.08em' }}>
                              {build.time_taken_minutes} min
                            </span>
                          )}
                          {build.design.steps.length > 0 && (
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted2)', letterSpacing: '0.08em' }}>
                              {build.design.steps.length} steps
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Progress ring for in-progress */}
                      {build.status === 'in_progress' && (
                        <div style={{ flexShrink: 0 }}>
                          <svg width="48" height="48" viewBox="0 0 48 48">
                            <circle cx="24" cy="24" r="20" fill="none" stroke="var(--border)" strokeWidth="2" />
                            <circle cx="24" cy="24" r="20" fill="none" stroke="var(--silver)"
                              strokeWidth="2" strokeLinecap="round"
                              strokeDasharray={`${2 * Math.PI * 20}`}
                              strokeDashoffset={`${2 * Math.PI * 20 * (1 - progressRatio)}`}
                              transform="rotate(-90 24 24)"
                              style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
                            <text x="24" y="28" textAnchor="middle"
                              style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fill: 'var(--silver2)' }}>
                              {Math.round(progressRatio * 100)}%
                            </text>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{
                      display: 'flex', gap: 10, marginTop: 20, alignItems: 'center', flexWrap: 'wrap',
                      paddingTop: 16, borderTop: '1px solid var(--border)'
                    }}>
                      <Link
                        href={`/make/build/${build.id}`}
                        className={build.status === 'completed' ? 'btn-outline' : 'btn-silver'}
                        style={{ padding: '8px 20px' }}
                      >
                        {build.status === 'completed'
                          ? 'View steps →'
                          : build.status === 'in_progress' ? 'Continue →' : 'Start building →'}
                      </Link>

                      {confirmingId === build.id ? (
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text2)', letterSpacing: '0.06em' }}>
                            Delete this piece?
                          </span>
                          <button
                            onClick={() => deleteBuild(build.id)}
                            disabled={deletingId === build.id}
                            style={{
                              background: 'none', border: 'none', color: 'var(--rose)',
                              fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', letterSpacing: '0.08em'
                            }}
                          >
                            {deletingId === build.id ? 'removing…' : 'yes, delete'}
                          </button>
                          <button
                            onClick={() => setConfirmingId(null)}
                            disabled={deletingId === build.id}
                            style={{
                              background: 'none', border: 'none', color: 'var(--muted2)',
                              fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer', letterSpacing: '0.08em'
                            }}
                          >
                            cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setDeleteError(null); setConfirmingId(build.id) }}
                          style={{
                            background: 'none', border: 'none', color: 'var(--muted2)',
                            fontSize: 12, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                            letterSpacing: '0.08em', transition: 'color 0.15s', marginLeft: 'auto'
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--rose)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--muted2)'}
                        >
                          × remove
                        </button>
                      )}
                    </div>
                    {deleteError === build.id && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--rose)', marginTop: 8, letterSpacing: '0.06em', textAlign: 'right' }}>
                        Failed to delete. Try again.
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
