'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Bead, { Strand, StepStrand } from '@/components/Bead'
import StrandLoader from '@/components/StrandLoader'
import StrandEmpty from '@/components/StrandEmpty'
import type { BeadItem } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/authClient'
import { beadFormFor, nominalPx, safeHex, stepColours, strandFromComponents } from '@/lib/bead'

// The Bench — the signed-in home (2026-10 redesign). Everything on it is the
// maker's own data: the stash on one thread, the build in progress, what's
// running low, and ideas saved for later.
//
// The handoff's "Tonight, from what you own · refreshes daily" grid would be
// three paid design calls per maker per day with nobody asking for them, so
// that slot shows saved drafts instead; Make is one tap away for anything new.

interface Step { instruction?: string; material?: string | null }
interface Design {
  description?: string
  pieceType?: string
  estimatedTime?: string
  components?: { item?: unknown; quantity?: unknown }[]
  steps?: Step[]
}
interface Build {
  id: string
  title: string
  design: Design | null
  status: string
  current_step: number
  started_at: string | null
  created_at: string
}

// The handoff's threshold. Seed beads come in hundreds, so ten left is low for
// anything; it's a nudge, not a rule Make enforces.
const LOW = 10

const today = () => new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }).replace(',', '')

export default function BenchPage() {
  const [state, setState] = useState<'loading' | 'signedOut' | 'error' | 'ready'>('loading')
  const [beads, setBeads] = useState<BeadItem[]>([])
  const [builds, setBuilds] = useState<Build[]>([])

  async function load() {
    try {
      const headers = await getAuthHeaders()
      const [inv, b] = await Promise.all([
        fetch('/api/inventory', { headers }),
        fetch('/api/builds', { headers }),
      ])
      if (inv.status === 401) { setState('signedOut'); return }
      if (!inv.ok || !b.ok) throw new Error('load failed')
      const d = await inv.json()
      const list = await b.json()
      setBeads(Array.isArray(d.beads) ? d.beads : [])
      setBuilds(Array.isArray(list) ? list : [])
      setState('ready')
    } catch {
      setState('error')
    }
  }

  useEffect(() => { ;(async () => { await load() })() }, [])

  const onBench = builds
    .filter(b => b.status === 'in_progress')
    .sort((a, b) => Date.parse(b.started_at ?? b.created_at) - Date.parse(a.started_at ?? a.created_at))[0]
  const drafts = builds.filter(b => b.status === 'draft').slice(0, 3)
  const low = beads.filter(b => (Number(b.quantity) || 0) < LOW).sort((a, b) => a.quantity - b.quantity).slice(0, 5)
  const strandBeads = beads.slice(0, 28)

  return (
    <>
      <Nav />
      <main id="main" className="page-main">
        <div className="wrap ss-up" style={{ paddingTop: 'clamp(28px,5vw,64px)', paddingBottom: 80, display: 'flex', flexDirection: 'column', gap: 'clamp(40px,5vw,64px)' }}>
          <header style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <p className="eyebrow eyebrow--lit">{today()} · the evening bench</p>
            <h1 className="display" style={{ fontSize: 'clamp(46px,8.2vw,124px)', maxWidth: '13ch' }}>
              What will you <em>string</em> tonight?
            </h1>
          </header>

          {state === 'loading' ? (
            <div style={{ padding: 60 }}><StrandLoader label="Laying out your bench…" /></div>
          ) : state === 'signedOut' ? (
            <StrandEmpty line="Sign in and your bench lays itself out — stash, build in progress, saved ideas.">
              <Link href="/account" className="btn-primary btn-md">Sign in →</Link>
            </StrandEmpty>
          ) : state === 'error' ? (
            <div role="alert" className="well" style={{ padding: 28, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <span>Couldn&apos;t load your bench. Check your connection and try again.</span>
              <button className="btn-outline" onClick={() => { setState('loading'); load() }}>Retry</button>
            </div>
          ) : (
            <>
              {/* The whole stash on one thread */}
              {strandBeads.length > 0 ? (
                <Link href="/inventory" style={{ display: 'block' }} aria-label={`Open stash — ${beads.length} bead types`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    <span className="eyebrow" style={{ letterSpacing: '.14em' }}>Your stash on one thread · {beads.length} bead type{beads.length === 1 ? '' : 's'}</span>
                    <span className="link-under">Open stash →</span>
                  </div>
                  <div className="well" style={{ height: 84, padding: '0 22px', overflowX: 'auto', boxShadow: 'inset 0 2px 10px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center' }}>
                    <Strand height={84} gap={0} style={{ flex: 1, justifyContent: 'space-between', gap: 'clamp(8px,1.6vw,22px)', minWidth: 'max-content' }}>
                      {strandBeads.map(b => {
                        const form = beadFormFor(b)
                        return <Bead key={b.id ?? b.name} hex={safeHex(b.hex)} shape={form} size={nominalPx(form) * 2.4} title={b.name} />
                      })}
                    </Strand>
                  </div>
                </Link>
              ) : (
                <div className="well" style={{ padding: 28, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span className="aside-line" style={{ fontSize: 18 }}>Nothing strung yet — add your first bead and we&apos;ll begin.</span>
                  <Link href="/inventory" className="btn-primary btn-md">Add beads →</Link>
                </div>
              )}

              <div className="bench-grid">
                {/* On the bench */}
                <section className="panel" aria-labelledby="onbench-h" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="panel-head">
                    <span id="onbench-h"><span aria-hidden="true" style={{ color: 'var(--button-accent-hover)' }}>●</span>&nbsp; On the bench</span>
                    {onBench && <span>Step {Math.min(onBench.current_step + 1, Math.max(onBench.design?.steps?.length ?? 1, 1))} of {Math.max(onBench.design?.steps?.length ?? 1, 1)}</span>}
                  </div>
                  {onBench ? (
                    <OnBench build={onBench} beads={beads} />
                  ) : (
                    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      <p className="aside-line" style={{ fontSize: 18 }}>Nothing on the bench right now.</p>
                      <div><Link href="/make" className="btn-primary btn-md">Make something →</Link></div>
                    </div>
                  )}
                </section>

                {/* Running low */}
                <section className="panel" aria-labelledby="low-h" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div className="panel-head"><span id="low-h">Running low</span></div>
                  <div style={{ padding: '10px 22px 20px', display: 'flex', flexDirection: 'column' }}>
                    {low.length === 0 ? (
                      <p className="aside-line" style={{ marginTop: 10 }}>{beads.length ? 'Nothing under ten. Plenty to work with.' : 'Add beads and anything getting scarce shows up here.'}</p>
                    ) : (
                      <>
                        {low.map(b => {
                          const form = beadFormFor(b)
                          return (
                            <div key={b.id ?? b.name} className="row-line" style={{ padding: '13px 0' }}>
                              <div style={{ width: 28, display: 'flex', justifyContent: 'center' }}><Bead hex={safeHex(b.hex)} shape={form} size={nominalPx(form) * 1.8} /></div>
                              <span style={{ flex: 1, color: 'var(--cream)', fontSize: 15 }}>{b.name}</span>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.12em', color: 'var(--ochre)' }}>{b.quantity} LEFT</span>
                            </div>
                          )
                        })}
                        <p className="aside-line" style={{ marginTop: 16 }}>Make checks quantities, so no design asks for more than you have.</p>
                      </>
                    )}
                  </div>
                </section>
              </div>

              {/* Saved for later */}
              <section aria-labelledby="saved-h" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <h2 id="saved-h" className="display d-3">Saved for later</h2>
                  <Link href="/journal" className="eyebrow" style={{ letterSpacing: '.14em' }}>All saved ideas in the journal →</Link>
                </div>
                <div className="tray-grid" style={{ ['--min' as string]: '260px' }}>
                  {drafts.map(d => {
                    const strand = strandFromComponents(d.design?.components, beads, 11)
                    const meta = [d.design?.pieceType, d.design?.estimatedTime].filter(Boolean).join(' · ')
                    return (
                      <Link key={d.id} href={`/make/build/${d.id}`} className="tray-btn">
                        <div className="well" style={{ height: 110, border: 'none', borderBottom: '1px solid var(--seam)', display: 'flex', alignItems: 'center', padding: '0 18px' }}>
                          <Strand gap={6} height={110} style={{ flex: 1, justifyContent: 'center' }}>
                            {strand.length ? strand.map((b, i) => <Bead key={i} hex={b.hex} shape={b.form} size={nominalPx(b.form) * 2} />) : <span />}
                          </Strand>
                        </div>
                        <div style={{ padding: '20px 22px 22px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                          {meta && <span className="eyebrow" style={{ color: 'var(--tan)', letterSpacing: '.14em' }}>{meta}</span>}
                          <span className="display" style={{ fontSize: 30, lineHeight: 1.05, letterSpacing: '-.02em' }}>{d.title}</span>
                          {d.design?.description && <span className="aside-line" style={{ color: 'var(--text2)', flex: 1 }}>{d.design.description}</span>}
                          <span className="eyebrow" style={{ marginTop: 8, color: 'var(--cream)', letterSpacing: '.14em' }}>Start building →</span>
                        </div>
                      </Link>
                    )
                  })}
                  <Link href="/make" className="tray-btn" style={{ justifyContent: 'center', padding: '28px 22px', gap: 10, minHeight: 160 }}>
                    <span className="eyebrow" style={{ color: 'var(--tan)', letterSpacing: '.14em' }}>From what you own</span>
                    <span className="display" style={{ fontSize: 30, lineHeight: 1.05, letterSpacing: '-.02em' }}>Draft something new</span>
                    <span className="eyebrow" style={{ marginTop: 8, color: 'var(--cream)', letterSpacing: '.14em' }}>Open Make →</span>
                  </Link>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  )
}

function OnBench({ build, beads }: { build: Build; beads: BeadItem[] }) {
  const steps = Array.isArray(build.design?.steps) ? build.design!.steps! : []
  const total = Math.max(steps.length, 1)
  const cur = Math.min(Math.max(build.current_step, 0), total - 1)
  const colours = stepColours(steps, beads)
  const instruction = steps[cur]?.instruction
  return (
    <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <h3 className="display" style={{ fontSize: 'clamp(36px,4.6vw,64px)', lineHeight: 1, letterSpacing: '-.02em' }}>{build.title}</h3>
      {steps.length > 0 && (
        <div style={{ maxWidth: 520 }}><StepStrand colours={colours} current={cur} total={total} /></div>
      )}
      {typeof instruction === 'string' && instruction && (
        <p style={{ fontSize: 19, lineHeight: 1.5, color: 'var(--cream)', maxWidth: '46ch' }}>{instruction}</p>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Link href={`/make/build/${build.id}`} className="btn-primary btn-md">Continue at step {cur + 1} →</Link>
        <Link href="/journal" className="btn-outline btn-md">Journal</Link>
      </div>
    </div>
  )
}
