'use client'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Bead, { Strand } from '@/components/Bead'
import PublicFooter from '@/components/PublicFooter'
import { BuildStepDemo, JournalDemoCard } from '@/components/DemoPieces'
import { demo } from '@/lib/demoBeads'

// How it works — public, its own route (2026-10 redesign). Visuals are
// illustrative props from lib/demoBeads.
//
// Copy departs from the handoff where it described features that do not
// exist: Make returns one design (not a choice of three), Build has no
// in-step "ask", the stash decrement is offered rather than automatic, the
// journal takes no photos, and nothing feeds journal notes back into Make.

const TOC = [
  ['01', 'Add what you have', '2 min'],
  ['02', 'Say what you want', '10 sec'],
  ['03', 'Get a design', '1 min'],
  ['04', 'Build it', '15 min – an afternoon'],
  ['05', 'Log it', '30 sec'],
] as const

const PASTED = 'garnet rondelle 6x4 — 1 strand\nFW pearl 7mm x16\nlabradorite 8mm (18)\n11/0 seed, oxblood, 20g\ncarnelian tube 10x4 x12'
const PARSED = [['b1', 'Garnet rondelle', '42'], ['b12', 'Freshwater pearl', '16'], ['b2', 'Labradorite', '18'], ['b9', 'Oxblood seed', '~640'], ['b15', 'Carnelian tube', '12']]
const BRIEFS = [
  { text: 'Something dark for a wedding in October.', read: 'Necklace · dark & moody · formal' },
  { text: 'Earrings, under twenty minutes, use up the larimar.', read: 'Earrings · 15 min · larimar first' },
  { text: 'Surprise me.', read: 'Anything · from what you have' },
]
const OPTIONS = [
  { title: 'Oxblood Vespers', meta: 'Necklace · 1 h · Intermediate', ids: ['b9', 'b9', 'b1', 'b9', 'b12', 'b2', 'b12', 'b9', 'b1', 'b9', 'b9'], sel: true },
  { title: 'Garnet Ledger', meta: 'Necklace · 40 min · Easy', ids: ['b1', 'b8', 'b1', 'b8', 'b1', 'b8', 'b1', 'b8', 'b1'] },
  { title: 'Single Moon', meta: 'Pendant · 25 min · Easy', ids: ['b9', 'b9', 'b9', 'b3', 'b9', 'b9', 'b9'] },
]
const USED = [['Aquamarine rondelle', '22 → 14'], ['Freshwater pearl', '16 → 12'], ['Moonstone', '30 → 28']]

function Step({ id, n, title, children, visual, last }: { id: string; n: string; title: string; children: React.ReactNode; visual: React.ReactNode; last?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="split" style={{ padding: 'clamp(64px,8vw,128px) 0', borderBottom: last ? 'none' : '1px solid var(--seam)', alignItems: 'start', scrollMarginTop: 'var(--nav-h-public)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <span className="numeral" aria-hidden="true" style={{ fontSize: 'clamp(88px,11vw,180px)' }}>{n}</span>
        <h2 id={`${id}-h`} className="display" style={{ fontSize: 'clamp(36px,4.4vw,68px)', lineHeight: .98 }}>{title}</h2>
        {children}
      </div>
      {visual}
    </section>
  )
}

export default function HowItWorksPage() {
  return (
    <>
      <Nav variant="public" />
      <main id="main" className="page-main page-main--public">
        <div className="wrap wrap--wide">

          <section aria-labelledby="hiw-h" className="split" style={{ padding: 'clamp(56px,8vw,128px) 0 clamp(48px,6vw,88px)', gap: '28px clamp(32px,5vw,80px)', alignItems: 'end', borderBottom: '1px solid var(--seam)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <span className="eyebrow">How it works</span>
              <h1 id="hiw-h" className="display ss-up" style={{ fontSize: 'clamp(52px,8vw,136px)', lineHeight: .9 }}>Tray to wrist in <span className="soft">five steps.</span></h1>
            </div>
            <nav aria-label="Steps" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {TOC.map(([n, title, time]) => (
                <a key={n} href={`#s${Number(n)}`} className="toc-row">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '.14em', color: 'var(--madder-text)' }}>{n}</span>
                  <span style={{ fontSize: 19, flex: 1 }}>{title}</span>
                  <span className="eyebrow" style={{ letterSpacing: '.12em' }}>{time}</span>
                </a>
              ))}
            </nav>
          </section>

          <Step id="s1" n="01" title="Add what you have." visual={
            <div style={{ background: 'var(--mocha)', border: '1px solid var(--seam)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))' }}>
              <div style={{ padding: 24, borderRight: '1px solid var(--seam)', fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 2, color: 'var(--meta)', whiteSpace: 'pre-line' }}>{PASTED}</div>
              <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column' }}>
                {PARSED.map(([id, name, qty]) => (
                  <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--hair)' }}>
                    <div style={{ width: 22, display: 'flex', justifyContent: 'center' }}><Bead {...demo(id, 1.4)} /></div>
                    <span style={{ flex: 1, fontSize: 15, color: 'var(--cream)' }}>{name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--meta)' }}>{qty}</span>
                  </div>
                ))}
              </div>
            </div>
          }>
            <p style={{ maxWidth: '44ch' }}>Photograph a tray or paste a supplier receipt. strung splits it into groups — type, colour, size, rough count — and you correct anything it got wrong before it goes in. Do it once; finishing a build can take what you used back out.</p>
            <div className="eyebrow" style={{ display: 'flex', gap: 28, flexWrap: 'wrap', letterSpacing: '.12em' }}><span>Photo · list · receipt</span><span>~2 min</span></div>
          </Step>

          <Step id="s2" n="02" title="Say it like you'd say it." visual={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {BRIEFS.map(b => (
                <div key={b.text} style={{ padding: 'clamp(22px,2.6vw,32px)', background: 'var(--mocha)', border: '1px solid var(--seam)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span className="display" style={{ fontSize: 'clamp(24px,2.4vw,34px)', lineHeight: 1.15, letterSpacing: '-.02em' }}>“{b.text}”</span>
                  <span className="eyebrow eyebrow--sm">{b.read}</span>
                </div>
              ))}
            </div>
          }>
            <p style={{ maxWidth: '44ch' }}>Pick a piece, a mood and how long you&apos;ve got — or skip all of it and let it choose from what you have. Rather put it in your own words? Co-design takes it as a conversation.</p>
          </Step>

          <Step id="s3" n="03" title="Keep it, or try another." visual={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {OPTIONS.map(o => (
                <div key={o.title} style={{ padding: 'clamp(20px,2.4vw,28px)', background: o.sel ? 'var(--garnet-wash)' : 'var(--mocha)', border: `1px solid ${o.sel ? 'var(--button-accent-hover)' : 'var(--seam)'}`, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <Strand height={30} align="flex-start">{o.ids.map((id, i) => <Bead key={i} {...demo(id, 1.8)} />)}</Strand>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                    <span className="display" style={{ fontSize: 26, lineHeight: 1.05, letterSpacing: '-.02em' }}>{o.title}</span>
                    <span className="eyebrow eyebrow--sm" style={{ letterSpacing: '.12em' }}>{o.meta}</span>
                  </div>
                </div>
              ))}
            </div>
          }>
            <p style={{ maxWidth: '44ch' }}>Every design comes with a bead list checked against your stash, a time estimate and a difficulty. Not quite right? Adjust it in a sentence, ask for another, or talk it through in co-design until it is.</p>
          </Step>

          <Step id="s4" n="04" title="Build with the phone propped up." visual={<BuildStepDemo />}>
            <p style={{ maxWidth: '44ch' }}>One instruction per screen, big type, a strand that fills in as you go. Stuck on a technique? The Learn guides walk through it, with an advisor you can ask.</p>
          </Step>

          <Step id="s5" n="05" title="Finish, and it remembers." last visual={
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <JournalDemoCard title="Low Tide Drops" note="The aquamarine went almost grey under the lamp — better in daylight." meta="Earrings · 47 min" verdict="Loved it" ids={['b10', 'b12', 'b3', 'b12', 'b10']} />
              <div className="well" style={{ padding: '16px clamp(22px,2.6vw,32px)', display: 'flex', flexDirection: 'column' }}>
                {USED.map(([name, delta]) => (
                  <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--meta)' }}>
                    <span style={{ color: 'var(--text2)' }}>{name}</span><span>{delta}</span>
                  </div>
                ))}
              </div>
            </div>
          }>
            <p style={{ maxWidth: '44ch' }}>Mark it finished and strung offers to take the beads you used out of your stash. Rate it and add a line about how it went — it all stays in your journal.</p>
          </Step>

          <section aria-labelledby="hiw-close" style={{ padding: 'clamp(80px,10vw,160px) 0 clamp(64px,8vw,120px)', borderTop: '1px solid var(--seam)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 32 }}>
            <h2 id="hiw-close" className="display" style={{ fontSize: 'clamp(48px,7vw,116px)', lineHeight: .92, maxWidth: '12ch' }}>Start with step one.</h2>
            <Link href="/account?mode=signup" className="btn-primary btn-lg">Start your stash →</Link>
          </section>

          <PublicFooter />
        </div>
      </main>
    </>
  )
}
