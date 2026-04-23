'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Nav from '@/components/Nav'
import type { DesignItem } from '@/lib/supabase'

const STATUS_CONFIG = {
  saved:       { label: 'Saved',       color: 'var(--moonstone)' },
  in_progress: { label: 'In Progress', color: 'var(--gold)' },
  complete:    { label: 'Complete',    color: 'var(--sage)' },
} as const

const SOURCE_LABELS: Record<string, string> = {
  inspire:  'Inspire',
  codesign: 'Co-design',
  design:   'Design',
}

const DIFF_COLOR = (d?: string) =>
  d === 'Beginner' ? 'var(--sage)' : d === 'Advanced' ? 'var(--rose)' : 'var(--moonstone)'

type Status = DesignItem['status']

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function DesignCard({ design, onDelete, onPatch }: {
  design: DesignItem
  onDelete: (id: string) => void
  onPatch: (id: string, patch: Partial<DesignItem>) => void
}) {
  const [notes, setNotes] = useState(design.notes || '')
  const [status, setStatus] = useState<Status>(design.status)
  const [deleting, setDeleting] = useState(false)
  const notesRef = useRef<HTMLTextAreaElement>(null)

  const statusColor = STATUS_CONFIG[status].color

  async function handleStatusChange(s: Status) {
    setStatus(s)
    onPatch(design.id!, { status: s })
  }

  async function handleNotesBlur() {
    if (notes !== design.notes) {
      onPatch(design.id!, { notes })
    }
  }

  async function handleDelete() {
    if (!design.id) return
    setDeleting(true)
    await fetch(`/api/designs?id=${design.id}`, { method: 'DELETE' })
    onDelete(design.id)
  }

  // Auto-resize textarea
  function handleNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setNotes(e.target.value)
    const el = notesRef.current
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
  }

  return (
    <div className="card" style={{
      display: 'flex',
      flexDirection: 'column',
      borderLeft: `3px solid ${statusColor}`,
      transition: 'border-color 0.3s',
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div style={{ padding: '22px 22px 16px' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {design.type && <span className="tag">{design.type}</span>}
          {design.difficulty && (
            <span className="tag" style={{ borderColor: DIFF_COLOR(design.difficulty), color: DIFF_COLOR(design.difficulty) }}>
              {design.difficulty}
            </span>
          )}
          <span className="tag" style={{ borderColor: 'var(--border2)', color: 'var(--muted2)' }}>
            via {SOURCE_LABELS[design.source] || design.source}
          </span>
        </div>

        <h3 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 400,
          color: 'var(--cream)',
          lineHeight: 1.25,
          marginBottom: 6,
        }}>
          {design.title}
        </h3>

        {/* Blueprint preview */}
        {design.blueprint?.description && (
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 0 }}>
            {String(design.blueprint.description).slice(0, 120)}{String(design.blueprint.description).length > 120 ? '…' : ''}
          </p>
        )}
      </div>

      {/* Status row */}
      <div style={{ padding: '0 22px 14px', display: 'flex', gap: 4 }}>
        {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([s, cfg]) => (
          <button
            key={s}
            onClick={() => handleStatusChange(s)}
            style={{
              flex: 1,
              padding: '6px 0',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              border: `1px solid ${status === s ? cfg.color : 'var(--border)'}`,
              background: status === s ? `${cfg.color}18` : 'transparent',
              color: status === s ? cfg.color : 'var(--muted)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      {/* Notes */}
      <div style={{ padding: '0 22px 18px', flex: 1 }}>
        <textarea
          ref={notesRef}
          className="input-base"
          placeholder="Add notes…"
          value={notes}
          onChange={handleNotesChange}
          onBlur={handleNotesBlur}
          rows={2}
          style={{
            resize: 'none',
            minHeight: 60,
            fontSize: 14,
            lineHeight: 1.6,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        />
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 22px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg2)',
      }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.08em' }}>
          {formatDate(design.created_at)}
        </span>
        <button
          className="btn-ghost"
          onClick={handleDelete}
          disabled={deleting}
          style={{ fontSize: 9, padding: '5px 12px', color: 'var(--rose)', borderColor: 'rgba(196,112,112,0.2)' }}
        >
          {deleting ? <span className="spinner-dark" style={{ width: 10, height: 10 }} /> : '✕ Delete'}
        </button>
      </div>
    </div>
  )
}

export default function JournalPage() {
  const router = useRouter()
  const [designs, setDesigns] = useState<DesignItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tableError, setTableError] = useState(false)

  useEffect(() => {
    fetch('/api/designs')
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          if (
            data.error.toLowerCase().includes('does not exist') ||
            data.error.toLowerCase().includes('relation') ||
            data.error.toLowerCase().includes('table')
          ) {
            setTableError(true)
          } else {
            setError(data.error)
          }
        } else {
          setDesigns(Array.isArray(data) ? data : [])
        }
      })
      .catch(() => setError('Could not connect to the server.'))
      .finally(() => setLoading(false))
  }, [])

  function handleDelete(id: string) {
    setDesigns(prev => prev.filter(d => d.id !== id))
  }

  async function handlePatch(id: string, patch: Partial<DesignItem>) {
    const res = await fetch('/api/designs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    const updated = await res.json()
    if (!updated.error) {
      setDesigns(prev => prev.map(d => d.id === id ? { ...d, ...updated } : d))
    }
  }

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 60, minHeight: '100vh' }}>
        <div className="page-pad" style={{ maxWidth: 1100, margin: '0 auto', paddingTop: 52, paddingBottom: 80 }}>

          {/* Header */}
          <header style={{ marginBottom: 40 }}>
            <p className="section-eyebrow fade-up">Your Designs</p>
            <h1 className="fade-up-1" style={{
              fontSize: 44,
              color: 'var(--cream)',
              fontFamily: 'var(--font-display)',
              fontWeight: 400,
              margin: '8px 0 10px',
            }}>
              Design Journal
            </h1>
            <p className="fade-up-2" style={{ color: 'var(--text2)', fontSize: 17 }}>
              Every blueprint you&apos;ve saved — track progress, add notes, and revisit your ideas.
            </p>
          </header>

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
              <span className="spinner-dark" />
            </div>
          )}

          {/* Table missing */}
          {!loading && tableError && (
            <div className="card fade-up" style={{
              padding: '40px 36px',
              borderLeft: '3px solid var(--gold)',
              maxWidth: 640,
            }}>
              <p className="section-eyebrow" style={{ marginBottom: 12 }}>Setup Required</p>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--cream)', marginBottom: 12 }}>
                Your journal needs a table
              </h2>
              <p style={{ color: 'var(--text2)', fontSize: 16, lineHeight: 1.7, marginBottom: 20 }}>
                Set up your journal by creating the <code style={{ fontFamily: 'var(--font-mono)', fontSize: 13, background: 'var(--surface2)', padding: '2px 6px' }}>designs</code> table in Supabase. See the README for the SQL.
              </p>
              <button className="btn-outline" onClick={() => router.push('/inspire')}>
                ◉ Go to Inspire
              </button>
            </div>
          )}

          {/* API error */}
          {!loading && !tableError && error && (
            <div style={{
              background: 'rgba(196,112,112,0.06)',
              border: '1px solid rgba(196,112,112,0.2)',
              padding: '20px 24px',
              maxWidth: 560,
            }}>
              <p className="mono" style={{ fontSize: 11, color: 'var(--rose)', letterSpacing: '0.12em', marginBottom: 6 }}>ERROR</p>
              <p style={{ color: 'var(--text2)', fontSize: 15 }}>{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && !tableError && !error && designs.length === 0 && (
            <div className="fade-up" style={{ textAlign: 'center', padding: '80px 20px' }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                margin: '0 auto 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
              }}>◈</div>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 30,
                color: 'var(--cream)',
                fontWeight: 400,
                marginBottom: 12,
              }}>
                Your journal awaits
              </h2>
              <p style={{ color: 'var(--text2)', fontSize: 17, maxWidth: 420, margin: '0 auto 28px', lineHeight: 1.7 }}>
                Save blueprints from Inspire, Design, or Co-design and they&apos;ll appear here. Track your progress, note materials, and collect your favourite ideas.
              </p>
              <button className="btn-silver" onClick={() => router.push('/inspire')}>
                ◉ Get Inspired
              </button>
            </div>
          )}

          {/* Design grid */}
          {!loading && !tableError && !error && designs.length > 0 && (
            <>
              <div className="fade-up" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>
                  {designs.length} design{designs.length !== 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', gap: 12 }}>
                  {(Object.entries(STATUS_CONFIG) as [Status, typeof STATUS_CONFIG[Status]][]).map(([s, cfg]) => {
                    const count = designs.filter(d => d.status === s).length
                    return count > 0 ? (
                      <span key={s} className="mono" style={{ fontSize: 10, color: cfg.color, letterSpacing: '0.08em' }}>
                        {count} {cfg.label.toLowerCase()}
                      </span>
                    ) : null
                  })}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 16,
              }}>
                {designs.map((d, i) => (
                  <div key={d.id} className={`fade-up-${Math.min(i + 1, 4) as 1 | 2 | 3 | 4}`}>
                    <DesignCard
                      design={d}
                      onDelete={handleDelete}
                      onPatch={handlePatch}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

        </div>
      </main>
    </>
  )
}
