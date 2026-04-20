import Link from 'next/link'
import Nav from '@/components/Nav'

const features = [
  { href:'/inventory', icon:'◈', label:'My Stash', title:'Inventory Tracker', desc:'Log every bead, finding, and spool of wire you own. Your stash, organised.', color:'var(--silver)' },
  { href:'/inspire', icon:'◉', label:'Inspire Me', title:'Blueprint Generator', desc:'Stuck staring at your beads? Tell the AI your vibe and it designs around what you actually have.', color:'var(--moonstone)' },
  { href:'/palette', icon:'◇', label:'Palette', title:'Colour & Gem Pairing', desc:'Generate harmonious colour stories for gemstones, metals, and finishes.', color:'var(--amethyst)' },
  { href:'/guides', icon:'◎', label:'Guides', title:'Technique Library', desc:'Wire wrapping, head pins, crimping, findings — everything for your style of making.', color:'var(--sage)' },
  { href:'/glossary', icon:'⊡', label:'Glossary', title:'Maker\'s Glossary', desc:'Every term you\'ll encounter when buying beads and findings, defined plainly.', color:'var(--steel2)' },
]

export default function Home() {
  return (
    <>
      <Nav />
      <main style={{paddingTop:60}}>
        {/* Hero */}
        <section style={{
          minHeight:'92vh',display:'flex',alignItems:'center',justifyContent:'center',
          position:'relative',overflow:'hidden',padding:'80px 40px'
        }}>
          {/* Background orb */}
          <div style={{
            position:'absolute',top:'40%',left:'50%',
            transform:'translate(-50%,-50%)',
            width:600,height:600,borderRadius:'50%',
            background:'radial-gradient(circle,rgba(122,154,184,0.06) 0%,transparent 70%)',
            animation:'pulse 8s ease-in-out infinite',
            pointerEvents:'none'
          }}/>
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
              Make something<br /><em style={{fontStyle:'italic',color:'var(--silver)'}}>beautiful.</em>
            </h1>
            <p className="fade-up-2" style={{
              fontSize:18,color:'var(--text2)',lineHeight:1.7,
              marginBottom:40,maxWidth:520,margin:'0 auto 40px'
            }}>
              Track your bead stash, get AI-generated design blueprints from what you actually own, and learn the techniques that bring it all together.
            </p>
            <div className="fade-up-3" style={{display:'flex',gap:14,justifyContent:'center',flexWrap:'wrap'}}>
              <Link href="/inventory" className="btn-silver">Add My Beads</Link>
              <Link href="/inspire" className="btn-outline">Get Inspired</Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section style={{padding:'80px 40px',maxWidth:1200,margin:'0 auto'}}>
          <div style={{textAlign:'center',marginBottom:56}}>
            <p className="section-eyebrow">Everything in one place</p>
            <h2 style={{fontSize:38,color:'var(--cream)',fontFamily:'var(--font-display)',fontWeight:400,marginTop:8}}>Your studio. Your stash.</h2>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:2}}>
            {features.map((f,i) => (
              <Link href={f.href} key={f.href} className={`fade-up-${Math.min(i+1,4)}`} style={{
                background:'var(--surface)',border:'1px solid var(--border)',
                padding:'36px',display:'flex',flexDirection:'column',gap:10,
                transition:'all 0.2s',textDecoration:'none',color:'inherit'
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--border2)';e.currentTarget.style.background='var(--surface2)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--surface)'}}>
                <div style={{fontSize:24,color:f.color,animation:'shimmer 4s ease-in-out infinite'}}>{f.icon}</div>
                <div style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'0.18em',textTransform:'uppercase',color:'var(--muted2)'}}>{f.label}</div>
                <h3 style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:400,color:'var(--cream)'}}>{f.title}</h3>
                <p style={{fontSize:15,color:'var(--text2)',lineHeight:1.6,flex:1}}>{f.desc}</p>
                <span style={{color:'var(--silver)',fontSize:16,alignSelf:'flex-end',marginTop:8}}>→</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Gemstone strip */}
        <div style={{
          borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)',
          padding:'16px 0',background:'var(--bg2)',overflow:'hidden',display:'flex'
        }}>
          {['Labradorite','Moonstone','Amethyst','Labradorite','Garnet','Aquamarine','Tourmaline','Rose Quartz','Tiger Eye','Iolite','Citrine','Prehnite'].map((g,i) => (
            <span key={i} style={{
              fontFamily:'var(--font-mono)',fontSize:10,letterSpacing:'0.16em',
              textTransform:'uppercase',color:'var(--muted2)',
              whiteSpace:'nowrap',padding:'0 28px',borderRight:'1px solid var(--border)',flexShrink:0
            }}>{g}</span>
          ))}
        </div>

        <footer style={{padding:'36px 40px',textAlign:'center',borderTop:'1px solid var(--border)'}}>
          <span className="mono" style={{fontSize:10,letterSpacing:'0.14em',color:'var(--muted2)'}}>STRUNG — AI BEADED JEWELLERY DESIGN STUDIO</span>
        </footer>
      </main>
    </>
  )
}
