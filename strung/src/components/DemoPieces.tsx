import Bead, { Strand, StepStrand } from '@/components/Bead'
import { DEMO, demo } from '@/lib/demoBeads'

// Illustrative pieces shared by the landing and How it works pages.

const BUILD_DEMO_COLOURS = [DEMO.b1.hex, DEMO.b1.hex, DEMO.b12.hex]

export function BuildStepDemo() {
  return (
    <div className="well" style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 'clamp(22px,3vw,32px)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <span className="numeral" style={{ fontSize: 'clamp(52px,5.7vw,85px)', lineHeight: .8, color: 'var(--seam)' }}>04</span>
        <span className="eyebrow eyebrow--sm">of 08 · Stringing</span>
      </div>
      <p style={{ margin: 0, fontSize: 'clamp(18px,1.7vw,25px)', lineHeight: 1.3, color: 'var(--cream)' }}>Add a pearl between the third and fourth repeats to start the gather.</p>
      <StepStrand colours={BUILD_DEMO_COLOURS} current={3} total={8} beadSize={14} height={24} />
    </div>
  )
}

export function JournalDemoCard({ title, note, meta, verdict, ids }: { title: string; note: string; meta: string; verdict: string; ids: string[] }) {
  return (
    <div className="panel" style={{ padding: 'clamp(22px,2.6vw,32px)', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Strand gap={5} align="flex-start">{ids.map((id, i) => <Bead key={i} {...demo(id, 1.8)} />)}</Strand>
      <span className="display d-card">{title}</span>
      <span style={{ fontSize: 16, lineHeight: 1.5 }}>“{note}”</span>
      <div className="eyebrow eyebrow--sm" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, paddingTop: 12, borderTop: '1px solid var(--seam)', letterSpacing: '.12em' }}>
        <span>{meta}</span><span style={{ color: 'var(--sage)' }}>{verdict}</span>
      </div>
    </div>
  )
}
