'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import BeadIcon, { type BeadShape } from '@/components/BeadIcon'
import { getAuthHeaders } from '@/lib/authClient'

const gems = ['Labradorite','Moonstone','Amethyst','Garnet','Aquamarine','Tourmaline','Rose Quartz','Tiger Eye','Iolite','Citrine','Prehnite','Larimar']

// One card per destination route. Chrome (border, top-divider, glyph) is
// neutral by design — saturated colour is reserved for bead/gem elements only.
const features: { href: string; icon: BeadShape; label: string; title: string; desc: string }[] = [
  { href:'/inventory', icon:'bicone', label:'My Stash', title:'Inventory Tracker', desc:'Log every bead, finding, and spool of wire. Your materials, beautifully organised.' },
  { href:'/make', icon:'disc', label:'Blueprint Generator', title:'Make Something', desc:'Generate one complete design from your real stash, mood, and time — then build it step-by-step from draft to finished piece.' },
  { href:'/codesign', icon:'ring', label:'AI Co-Designer', title:'Design Studio', desc:'Chat your idea into existence. Your AI collaborator turns conversations into full blueprints and answers questions as you plan.' },
  { href:'/calculator', icon:'rondelle', label:'Build Planner', title:'Bead Math Calculator', desc:'Estimate bead counts and prep your materials so you never run out mid-project.' },
  { href:'/journal', icon:'chip', label:'Your Designs', title:'Design Journal', desc:'Every blueprint you save lives here. Plan, progress, and complete your pieces.' },
  { href:'/guides', icon:'round', label:'Techniques', title:'Technique Guides', desc:'Wire wrapping, crimping, head pins — every technique you need, clearly explained.' },
]

export default function Home() {
  // State-aware CTA hierarchy: a new/empty/logged-out user is pointed at their
  // stash first (nothing to design from yet); a user with beads is pointed at
  // Make first. Default to the empty-stash treatment until the count loads so
  // the maroon primary never lands on the dead-end action for a new visitor.
  const [hasBeads, setHasBeads] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/inventory', { headers: await getAuthHeaders() })
        if (res.status === 401) return // logged out — keep empty-stash treatment
        const d = await res.json()
        setHasBeads((d.beads?.length ?? 0) > 0)
      } catch {
        // best-effort — leave the safe empty-stash default in place
      }
    })()
  }, [])

  const makeClass = hasBeads ? 'btn-primary' : 'btn-outline'
  const beadsClass = hasBeads ? 'btn-outline' : 'btn-primary'

  return (
    <>
      <Nav />
      <main style={{paddingTop:60}}>
        {/* Hero */}
        <section style={{
          minHeight:'90vh',display:'flex',alignItems:'center',justifyContent:'center',
          position:'relative',overflow:'hidden',padding:'80px clamp(20px,5vw,80px)'
        }}>
          {/* Grid lines */}
          <div style={{
            position:'absolute',inset:0,
            background:'repeating-linear-gradient(90deg,transparent,transparent calc(100%/8 - 1px),var(--border) calc(100%/8 - 1px),var(--border) calc(100%/8))',
            opacity:0.12,pointerEvents:'none'
          }}/>

          <div style={{position:'relative',zIndex:1,textAlign:'center',maxWidth:720}}>
            {/* Floating beads decoration */}
            <div className="fade-up" style={{display:'flex',justifyContent:'center',gap:8,marginBottom:28}}>
              {['#7a9ab8','#8a70aa','#6a9080','#a8b4c8','#c47070'].map((c,i) => (
                <div key={i} style={{
                  width:10,height:10,borderRadius:'50%',background:c,
                  boxShadow:`0 0 8px ${c}60`,
                  animation:`shimmer ${2+i*0.4}s ease-in-out infinite`
                }}/>
              ))}
            </div>

            <p className="section-eyebrow fade-up">AI Beaded Jewellery Studio</p>
            <h1 className="fade-up-1" style={{
              fontSize:'clamp(52px,9vw,88px)',
              fontFamily:'var(--font-display)',fontWeight:400,
              lineHeight:1.0,color:'var(--cream)',marginBottom:24
            }}>
              You already own<br /><em style={{fontStyle:'italic',color:'var(--silver)'}}>your next piece.</em>
            </h1>
            <p className="fade-up-2" style={{
              fontSize:18,color:'var(--text2)',lineHeight:1.7,
              marginBottom:40,maxWidth:520,margin:'0 auto 40px'
            }}>
              Track your bead stash, get AI-generated design blueprints from what you actually own, and learn the techniques that bring it all together.
            </p>
            <div className="fade-up-3" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:18}}>
              <div style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}}>
                <Link href="/make" className={makeClass}>Make Something</Link>
                <Link href="/inventory" className={beadsClass}>Add My Beads</Link>
              </div>
              <Link href="/codesign" className="btn-text">Or co-design it with AI →</Link>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="page-pad" style={{paddingTop:80,paddingBottom:80,borderTop:'1px solid var(--border)'}}>
          <div style={{maxWidth:900,margin:'0 auto'}}>
            <p className="section-eyebrow" style={{textAlign:'center'}}>How it works</p>
            <h2 style={{textAlign:'center',fontSize:'clamp(26px,4vw,36px)',color:'var(--cream)',fontFamily:'var(--font-display)',fontWeight:400,margin:'8px 0 52px'}}>
              From stash to finished piece
            </h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:2}}>
              {[
                { step:'01', icon:'bicone' as BeadShape, title:'Log your stash', body:'Add every bead and finding you own. The AI needs to know what you have to design around it.' },
                { step:'02', icon:'disc' as BeadShape, title:'Describe the vibe', body:'Tell the AI your mood, piece type, and time available. It generates a complete buildable design from your materials.' },
                { step:'03', icon:'round' as BeadShape, title:'Build from the blueprint', body:'Follow step-by-step build mode, save reflections, and track progress in your journal.' },
              ].map(s => (
                <div key={s.step} style={{padding:'36px 32px',background:'var(--surface)',border:'1px solid var(--border)'}}>
                  <div style={{fontFamily:'var(--font-mono)',fontSize:11,letterSpacing:'0.2em',color:'var(--muted2)',marginBottom:20}}>{s.step}</div>
                  <div style={{marginBottom:12}}><BeadIcon shape={s.icon} size={22} stroke="var(--tan)" /></div>
                  <h3 style={{fontFamily:'var(--font-display)',fontSize:19,color:'var(--cream)',fontWeight:400,marginBottom:10}}>{s.title}</h3>
                  <p style={{fontSize:15,color:'var(--text2)',lineHeight:1.6}}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features grid — 9 cards in a 3-col grid */}
        <section className="page-pad" style={{paddingTop:80,paddingBottom:80,maxWidth:1300,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:52}}>
            <p className="section-eyebrow">Everything you need</p>
            <h2 style={{fontSize:'clamp(26px,4vw,36px)',color:'var(--cream)',fontFamily:'var(--font-display)',fontWeight:400,marginTop:8}}>
              Your studio. Your stash.
            </h2>
          </div>
          <div className="grid-3">
            {features.map((f,i) => (
              <Link href={f.href} key={f.href} className={`card card--link feature-card fade-up-${Math.min(i+1,4)}`}>
                <div><BeadIcon shape={f.icon} size={22} stroke="var(--tan)" /></div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:11,letterSpacing:'0.18em',textTransform:'uppercase',color:'var(--muted2)'}}>{f.label}</div>
                <h3 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:400,color:'var(--cream)'}}>{f.title}</h3>
                <p style={{fontSize:14,color:'var(--text2)',lineHeight:1.6,flex:1}}>{f.desc}</p>
                <span style={{color:'var(--silver)',fontSize:15,alignSelf:'flex-end',marginTop:6}}>→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Gemstone strip */}
        <div style={{
          borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)',
          padding:'16px 0',background:'var(--bg2)',overflow:'hidden'
        }}>
          <div className="marquee-track">
            {[...gems,...gems].map((g,i) => (
              <span key={i} style={{
                fontFamily:'var(--font-mono)',fontSize:10,letterSpacing:'0.16em',
                textTransform:'uppercase',color:'var(--muted2)',
                whiteSpace:'nowrap',padding:'0 28px',borderRight:'1px solid var(--border)',flexShrink:0
              }}>{g}</span>
            ))}
          </div>
        </div>

        <footer className="page-pad" style={{paddingTop:48,paddingBottom:48,borderTop:'1px solid var(--border)'}}>
          <div style={{maxWidth:1200,margin:'0 auto',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:20}}>
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <span style={{width:7,height:7,borderRadius:'50%',background:'var(--madder)',display:'inline-block'}}/>
              <span style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:600,color:'var(--cream)',letterSpacing:'-0.01em'}}>strung</span>
            </div>
            <span className="mono" style={{fontSize:10,letterSpacing:'0.14em',color:'var(--muted2)'}}>AI BEADED JEWELLERY DESIGN STUDIO</span>
            <div style={{display:'flex',gap:20}}>
              {[{href:'/guides',label:'Guides'},{href:'/glossary',label:'Glossary'},{href:'/codesign',label:'Co-Design'}].map(l=>(
                <Link key={l.href} href={l.href} style={{fontFamily:'var(--font-mono)',fontSize:10,letterSpacing:'0.12em',textTransform:'uppercase',color:'var(--muted)'}}>{l.label}</Link>
              ))}
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}
