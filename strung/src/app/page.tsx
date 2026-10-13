'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Bead, { Strand } from '@/components/Bead'
import { BuildStepDemo, JournalDemoCard } from '@/components/DemoPieces'
import PublicFooter from '@/components/PublicFooter'
import { DEMO, demo } from '@/lib/demoBeads'
import { getSession } from '@/lib/authClient'

// Public landing (2026-10 redesign, "Strung Landing v2"). Every bead on this
// page is an illustrative prop from lib/demoBeads — nobody's real stash.
//
// Copy follows the handoff except where it promised something the app does
// not do: Make does not deprioritise low-stock beads, and the stash decrement
// on completion is offered, not automatic.

const PIECES = ['necklace', 'pair of earrings', 'bracelet', 'pendant']
const MOODS = ['dark & moody', 'coastal', 'earthy', 'opulent'] as const
const PREVIEWS: Record<(typeof MOODS)[number], { ids: string[]; title: string; line: string }> = {
  'dark & moody': { ids: ['b9', 'b9', 'b1', 'b9', 'b12', 'b2', 'b12', 'b9', 'b1', 'b9', 'b9'], title: 'Oxblood Vespers', line: 'Garnet and pearl, gathering to a labradorite. About an hour.' },
  coastal: { ids: ['b10', 'b12', 'b3', 'b16', 'b3', 'b12', 'b10'], title: 'Low Tide', line: 'Aquamarine and larimar with pearl between. Fifteen minutes.' },
  earthy: { ids: ['b4', 'b14', 'b4', 'b6', 'b4', 'b14', 'b4'], title: 'Fern Ledger', line: 'Prehnite and forest fire-polish, tiger eye at the centre.' },
  opulent: { ids: ['b8', 'b15', 'b11', 'b6', 'b11', 'b15', 'b8'], title: 'Carnelian Hour', line: 'Tubes and citrine on matte black seeds. An afternoon.' },
}
const HERO_STRAND = ['b1', 'b9', 'b15', 'b6', 'b11', 'b14', 'b4', 'b10', 'b16', 'b13', 'b5', 'b2', 'b3', 'b12', 'b8']
const SPECIMENS = ['b1', 'b12', 'b2', 'b10', 'b11', 'b4', 'b13', 'b15', 'b5', 'b6', 'b3', 'b14']
const ENTRIES = [
  { title: 'Low Tide Drops', note: 'The aquamarine went almost grey under the lamp — better in daylight.', meta: 'Earrings · 47 min', verdict: 'Loved it', ids: ['b10', 'b12', 'b3', 'b12', 'b10'] },
  { title: 'Citrine Hour', note: 'Chips are uneven. Sort by size first next time.', meta: 'Bracelet · 1 h 20', verdict: 'Good', ids: ['b11', 'b6', 'b11', 'b15', 'b11', 'b6', 'b11'] },
  { title: 'Oxblood Vespers', note: 'Garnets reading darker than expected — good.', meta: 'Necklace · step 4 of 8', verdict: 'On the bench', ids: ['b9', 'b1', 'b9', 'b12', 'b2', 'b12', 'b9', 'b1', 'b9'] },
]

export default function Home() {
  const [pi, setPi] = useState(0)
  const [mi, setMi] = useState(0)
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => { getSession().then(s => setSignedIn(!!s)).catch(() => {}) }, [])
  const start = signedIn ? '/bench' : '/account?mode=signup'
  const pv = PREVIEWS[MOODS[mi]]

  return (
    <>
      <Nav variant="public" />
      <main id="main" className="page-main page-main--public">
        <div className="wrap wrap--wide">

          <section aria-labelledby="hero-h" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(40px,5vw,72px)', padding: 'clamp(64px,10vw,160px) 0 clamp(56px,7vw,104px)' }}>
            <h1 id="hero-h" className="display d-hero ss-up">You already own your <span className="soft">next piece.</span></h1>
            <div className="ss-up-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,380px),1fr))', gap: '28px clamp(32px,5vw,80px)', alignItems: 'end', paddingTop: 28, borderTop: '1px solid var(--seam)' }}>
              <p style={{ fontSize: 'var(--fs-intro)', lineHeight: 1.45, color: 'var(--text2)', maxWidth: '34ch' }}>
                strung reads the beads you actually have and designs something you can make tonight — then stays with you at the bench until it&apos;s done.
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Link href={start} className="btn-primary btn-lg">Start your stash →</Link>
                <a href="#make" className="btn-outline btn-lg" style={{ padding: '17px 26px' }}>Try a brief</a>
              </div>
            </div>
          </section>

          <div aria-hidden="true" style={{ borderTop: '1px solid var(--seam)', borderBottom: '1px solid var(--seam)', overflow: 'hidden' }}>
            <Strand spread height={80} inset={24}>
              {HERO_STRAND.map((id, i) => <Bead key={i} {...demo(id, 2.6)} />)}
            </Strand>
          </div>

          <section id="stash" aria-labelledby="stash-h" style={{ padding: 'clamp(80px,10vw,160px) 0 0', display: 'flex', flexDirection: 'column', gap: 'clamp(36px,4vw,56px)' }}>
            <div className="split" style={{ ['--min' as string]: '400px', gap: '24px clamp(32px,5vw,80px)', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <span className="eyebrow">Stash</span>
                <h2 id="stash-h" className="display d-2">Snap your tray. It sorts the rest.</h2>
              </div>
              <p style={{ maxWidth: '44ch' }}>
                strung identifies each group in a photo — type, colour, size, rough count — or reads a pasted list. It designs only from what&apos;s here, and checks every design against what you have.
              </p>
            </div>
            <div className="tray-grid tray-grid--fill" style={{ ['--min' as string]: '150px' }}>
              {SPECIMENS.map(id => {
                const b = DEMO[id]
                return (
                  <div key={id} style={{ background: 'var(--mocha)', border: '1px solid var(--seam)', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--roast)', borderBottom: '1px solid var(--seam)' }}>
                      <Bead {...demo(id, Math.min(5, 52 / b.px))} />
                    </div>
                    <div style={{ padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 'var(--fs-md)', color: 'var(--cream)', lineHeight: 1.3 }}>{b.name}</span>
                      <span className="eyebrow eyebrow--sm" style={{ letterSpacing: '.12em' }}>{b.size} · {b.qty}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section id="make" aria-labelledby="make-h" style={{ padding: 'clamp(80px,10vw,160px) 0 0', display: 'flex', flexDirection: 'column', gap: 'clamp(32px,4vw,48px)', scrollMarginTop: 'calc(var(--nav-h-public) + 16px)' }}>
            <span className="eyebrow" id="make-h">Make · tap the underlined words</span>
            <p className="display" style={{ fontSize: 'var(--fs-display-xl)', lineHeight: 1.14, color: 'var(--deemph)' }}>
              Make me a{' '}
              <button type="button" className="brief-word" onClick={() => setPi(i => (i + 1) % PIECES.length)} aria-label={`Piece: ${PIECES[pi]}. Change`}>{PIECES[pi]}</button>
              {' '}that feels{' '}
              <button type="button" className="brief-word" onClick={() => setMi(i => (i + 1) % MOODS.length)} aria-label={`Mood: ${MOODS[mi]}. Change`}>{MOODS[mi]}</button>.
            </p>
            <div className="tray-grid" style={{ ['--min' as string]: '360px' }} aria-live="polite">
              <div className="well" style={{ minHeight: 180, display: 'flex', alignItems: 'center', padding: '0 24px' }}>
                <Strand gap={7} height={180} style={{ flex: 1, justifyContent: 'center' }}>
                  {pv.ids.map((id, i) => <Bead key={i} {...demo(id, 2.8)} />)}
                </Strand>
              </div>
              <div style={{ padding: 'clamp(22px,3vw,36px)', background: 'var(--mocha)', border: '1px solid var(--seam)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10 }}>
                <span className="eyebrow eyebrow--sm" style={{ color: 'var(--sage)' }}>● All from your stash</span>
                <span className="display" style={{ fontSize: 'var(--fs-display-xs)', lineHeight: 1 }}>{pv.title}</span>
                <span style={{ fontSize: 'var(--fs-base)' }}>{pv.line}</span>
              </div>
            </div>
          </section>

          <section aria-labelledby="build-h" style={{ padding: 'clamp(80px,10vw,160px) 0 0' }}>
            <div className="split panel" style={{ ['--min' as string]: '400px', gap: 'clamp(24px,4vw,64px)', alignItems: 'center', padding: 'clamp(28px,4vw,56px)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <span className="eyebrow">Build</span>
                <h2 id="build-h" className="display" style={{ fontSize: 'var(--fs-display-md)', lineHeight: .98 }}>Readable from across the bench.</h2>
                <p style={{ maxWidth: '42ch' }}>One step at a time, big enough to follow with your phone propped up. When you finish, it offers to take what you used out of your stash.</p>
              </div>
              <BuildStepDemo />
            </div>
          </section>

          <section aria-labelledby="journal-h" style={{ padding: 'clamp(80px,10vw,160px) 0 0', display: 'flex', flexDirection: 'column', gap: 'clamp(32px,4vw,48px)' }}>
            <div className="split" style={{ ['--min' as string]: '400px', gap: '24px clamp(32px,5vw,80px)', alignItems: 'end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <span className="eyebrow">Journal</span>
                <h2 id="journal-h" className="display d-2">Keep every piece.</h2>
              </div>
              <p style={{ maxWidth: '44ch' }}>How long it took, how it came out, and a line about what you&apos;d change next time.</p>
            </div>
            <div className="tray-grid" style={{ ['--min' as string]: '240px' }}>
              {ENTRIES.map(e => <JournalDemoCard key={e.title} {...e} />)}
            </div>
          </section>

          <section aria-labelledby="close-h" style={{ padding: 'clamp(96px,12vw,180px) 0 clamp(64px,8vw,120px)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 32 }}>
            <h2 id="close-h" className="display" style={{ fontSize: 'var(--fs-display-xl)', lineHeight: .92, maxWidth: '12ch' }}>Start with one bead.</h2>
            <Link href={start} className="btn-primary btn-lg">Start your stash →</Link>
            <span style={{ fontSize: 'var(--fs-md)', color: 'var(--meta)' }}>Free to start. Your stash stays yours.</span>
          </section>

          <PublicFooter />
        </div>
      </main>
    </>
  )
}
