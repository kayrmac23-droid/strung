'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import StrandLoader from '@/components/StrandLoader'
import Bead, { Strand } from '@/components/Bead'
import { nominalPx, strandFromComponents, type StashBeadLike } from '@/lib/bead'
import StrandEmpty from '@/components/StrandEmpty'
import { getAuthHeaders, getSession } from '@/lib/authClient'

interface Design {
  title: string
  description: string
  difficulty: string
  estimatedTime: string
  steps: { id: number; instruction: string }[]
  pieceType: string
  components?: { item?: unknown; quantity?: unknown }[]
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

const ratingLabels: Record<string, string> = {
  loved_it: 'Loved it',
  good: 'Good',
  could_be_better: 'Could be better',
}

type Filter = 'all' | 'in_progress' | 'draft' | 'completed'
const FILTERS: [Filter, string][] = [['all', 'All'], ['in_progress', 'On the bench'], ['draft', 'Ideas'], ['completed', 'Finished']]
const STATUS: Record<string, [string, string]> = {
  in_progress: ['On the bench', 'var(--cream)'],
  completed: ['Finished', 'var(--sage)'],
  draft: ['Idea', 'var(--tan)'],
}

// builds.design is jsonb, so an older or hand-edited row can lack steps. One
// such row used to throw on `design.steps.length` and blank the whole journal.
function withSafeDesign(b: Build): Build {
  const d = b.design && typeof b.design === 'object' ? b.design : ({} as Design)
  return { ...b, design: { ...d, steps: Array.isArray(d.steps) ? d.steps : [] } }
}


export default function JournalPage() {
  const [builds, setBuilds] = useState<Build[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  // Stash beads colour each piece's strand; decoration only, so best-effort.
  const [stash, setStash] = useState<StashBeadLike[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [signedOut, setSignedOut] = useState(false)

  // The fetch itself. Its first action is an await, so the mount effect never
  // calls setState synchronously (react-hooks/set-state-in-effect).
  async function refresh() {
    try {
      // The list route answers [] when signed out, so check the session too —
      // otherwise a signed-out visitor is told they have no saved ideas.
      setSignedOut(!(await getSession()))
      const res = await fetch('/api/builds', { headers: await getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setBuilds(Array.isArray(data) ? data.map(withSafeDesign) : [])
      fetch('/api/inventory', { headers: await getAuthHeaders() })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (d && Array.isArray(d.beads)) setStash(d.beads) })
        .catch(() => {})
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
      const res = await fetch(`/api/builds?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: await getAuthHeaders() })
      if (!res.ok) throw new Error('Failed to delete')
      setBuilds(b => b.filter(x => x.id !== id))
    } catch {
      setDeleteError(id)
    }
    finally { setDeletingId(null) }
  }

  const counts = {
    completed: builds.filter(b => b.status === 'completed').length,
    in_progress: builds.filter(b => b.status === 'in_progress').length,
    draft: builds.filter(b => b.status === 'draft').length,
  }
  const active = builds.filter(b => filter === 'all' || b.status === filter)

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })

  return (
    <>
      <Nav />
      <main id="main" className="page-main">
        <div className="wrap screen ss-up">
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p className="eyebrow eyebrow--lit">Journal</p>
              <h1 className="display d-1">Everything <em>strung</em>.</h1>
            </div>
            {!loading && builds.length > 0 && (
              <dl style={{ display: 'flex', gap: 'clamp(20px,3vw,40px)' }}>
                {([['Finished', counts.completed], ['On the bench', counts.in_progress], ['Ideas', counts.draft]] as const).map(([l, v]) => (
                  <div key={l} style={{ display: 'flex', flexDirection: 'column-reverse' }}>
                    <dt className="eyebrow eyebrow--sm">{l}</dt>
                    <dd className="display" style={{ fontSize: 'var(--fs-heading-lg)', lineHeight: 1, margin: 0 }}>{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </header>

          <div className="chip-row" role="group" aria-label="Filter pieces">
            {FILTERS.map(([k, label]) => (
              <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{label}</button>
            ))}
          </div>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><StrandLoader /></div>
          ) : error ? (
            <div role="alert" className="well" style={{ textAlign: 'center', padding: '48px 20px', borderColor: 'var(--rose)' }}>
              <p style={{ fontSize: 'var(--fs-base)', marginBottom: 16 }}>Couldn&apos;t load your journal. Check your connection and try again.</p>
              <button onClick={load} className="btn-outline">Retry</button>
            </div>
          ) : signedOut && builds.length === 0 ? (
            <StrandEmpty line="Sign in to see the pieces you've saved and built.">
              <Link href="/account" className="btn-outline">Sign in →</Link>
            </StrandEmpty>
          ) : active.length === 0 ? (
            <StrandEmpty line={filter === 'completed'
              ? 'No finished pieces yet. Start a build to make something.'
              : filter === 'in_progress' ? 'Nothing on the bench right now.'
              : 'No saved ideas yet. Generate a design and save it for later.'}>
              <Link href="/make" className="btn-outline">Go to Make →</Link>
            </StrandEmpty>
          ) : (
            <div className="tray-grid tray-grid--fill" style={{ ['--min' as string]: '270px' }}>
              {active.map(build => {
                const done = build.status === 'completed'
                const total = Math.max(build.design.steps.length, 1)
                const stepNow = Math.min(build.current_step + 1, total)
                const [statusLabel, statusColour] = STATUS[build.status] ?? ['Saved', 'var(--tan)']
                const rating = build.rating ? ratingLabels[build.rating] : null
                const strand = strandFromComponents(build.design.components, stash, 9)
                const note = build.notes || build.design.description
                return (
                  <article key={build.id} className="panel journal-card">
                    <Link href={`/make/build/${build.id}`} className="journal-card-link" aria-label={`${build.title} — ${done ? 'view steps' : build.status === 'in_progress' ? 'continue' : 'start building'}`}>
                      <div className={done ? 'journal-plate journal-plate--done' : 'journal-plate'}>
                        <Strand gap={done ? 4 : 5} height={done ? 20 : 28} style={{ padding: '0 20px', width: '100%', justifyContent: 'center' }}>
                          {strand.length
                            ? strand.map((b, i) => <Bead key={i} hex={b.hex} shape={b.form} size={nominalPx(b.form) * (done ? 1.4 : 2.2)} />)
                            : <span />}
                        </Strand>
                        {!done && (
                          <span className="eyebrow eyebrow--sm">
                            {build.status === 'in_progress' ? `Step ${stepNow} of ${total} — continue` : 'Ready to build'}
                          </span>
                        )}
                      </div>
                      <div style={{ padding: '18px 20px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div className="eyebrow eyebrow--sm" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, letterSpacing: '.12em' }}>
                          <span style={{ color: statusColour }}>{statusLabel}{rating ? ` · ${rating}` : ''}</span>
                          <span>{formatDate(build.completed_at || build.created_at)}</span>
                        </div>
                        <h2 className="display d-card">{build.title}</h2>
                        {note && <p className="aside-line" style={{ color: 'var(--text2)' }}>{note}</p>}
                        <span className="eyebrow eyebrow--sm" style={{ letterSpacing: '.12em' }}>
                          {[build.design.pieceType, build.design.difficulty, done && typeof build.time_taken_minutes === 'number' && build.time_taken_minutes > 0 ? `${build.time_taken_minutes} min` : null].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    </Link>
                    <div style={{ padding: '0 20px 16px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12 }}>
                      {confirmingId === build.id ? (
                        <>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--text2)', letterSpacing: '0.06em' }}>Delete this piece?</span>
                          <button className="link-quiet" style={{ color: 'var(--madder-text)' }} onClick={() => deleteBuild(build.id)} disabled={deletingId === build.id}>
                            {deletingId === build.id ? 'removing…' : 'yes, delete'}
                          </button>
                          <button className="link-quiet" onClick={() => setConfirmingId(null)} disabled={deletingId === build.id}>cancel</button>
                        </>
                      ) : (
                        <button className="link-quiet link-quiet--danger" onClick={() => { setDeleteError(null); setConfirmingId(build.id) }} aria-label={`Remove ${build.title}`}>× remove</button>
                      )}
                    </div>
                    {deleteError === build.id && (
                      <p role="alert" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--fs-2xs)', color: 'var(--madder-text)', padding: '0 20px 14px', letterSpacing: '0.06em', textAlign: 'right' }}>
                        Failed to delete. Try again.
                      </p>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
