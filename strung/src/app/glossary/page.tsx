'use client'
import { useState } from 'react'
import Nav from '@/components/Nav'

const terms = [
  { term:'Bail', cat:'Finding', def:'A loop or connector at the top of a pendant through which a chain passes. Can be a simple jump ring, a fold-over bail, or a wire-wrapped loop.' },
  { term:'Briolette', cat:'Bead Shape', def:'A teardrop or pear-shaped bead that is faceted all over, including across the top, with the hole drilled through the tip. Hangs beautifully as a drop.' },
  { term:'Cabochon', cat:'Bead Shape', def:'A stone that is polished smooth and flat on the back, rounded or domed on top. No facets. Typically set in bezels or wrapped in wire.' },
  { term:'Crimp Bead', cat:'Finding', def:'A small metal tube that is compressed with crimping pliers to secure beading wire. Holds the wire loop at clasp attachments.' },
  { term:'Crimp Cover', cat:'Finding', def:'A small metal bead that snaps closed around a finished crimp to hide it and make it look like a decorative bead.' },
  { term:'Dead Soft', cat:'Wire', def:'The softest temper of wire — very easy to bend and shape. Loses shape easily under tension. Good for wire wrapping and coiling.' },
  { term:'Ear Wire', cat:'Finding', def:'The component that goes through the ear piercing hole. Also called a French wire or shepherd hook. Usually sold in pairs.' },
  { term:'Eye Pin', cat:'Finding', def:'A straight wire with a pre-made loop at one end. Thread a bead on and make a loop at the other end to create a link in a chain or necklace.' },
  { term:'Faceted', cat:'Bead Type', def:'Cut with flat faces (facets) to catch and reflect light. Faceted beads sparkle more than smooth beads and show their colour more intensely.' },
  { term:'Finding', cat:'General', def:'Any metal component that is not a bead — clasps, ear wires, head pins, jump rings, crimp beads, chain, connectors. The hardware of jewellery making.' },
  { term:'Flush Cutter', cat:'Tool', def:'Wire cutters that cut cleanly on one side, leaving a flat end instead of a pinched point. Essential for cutting wire neatly without spikes.' },
  { term:'Gauge', cat:'Wire/Finding', def:'The thickness of wire or a head pin. Confusingly, higher gauge numbers = thinner wire. 20g is thicker than 26g.' },
  { term:'Gold Filled', cat:'Metal', def:'A thick layer of gold bonded to a base metal core under heat and pressure. Not the same as gold plated (which is much thinner). Durable, won\'t flake, and can last years with proper care.' },
  { term:'Half Hard', cat:'Wire', def:'A wire temper between dead soft and hard. Holds its shape better than dead soft, making it good for ear wires and structural elements.' },
  { term:'Head Pin', cat:'Finding', def:'A straight wire with a flat, ball, or decorative end. Thread a bead on and form a loop at the open top to create a dangle. The flat end stops the bead falling off.' },
  { term:'Jump Ring', cat:'Finding', def:'A small metal ring with a cut (gap) that can be opened and closed with pliers. Used to connect components. Never pull open sideways — always twist.' },
  { term:'Leverback', cat:'Finding', def:'An ear wire with a hinged closure that snaps shut, keeping the earring more securely in the ear than a plain French wire.' },
  { term:'Lobster Clasp', cat:'Finding', def:'A spring-loaded clasp shaped like a lobster claw. One of the most secure and common clasp types. Attaches to a jump ring or chain end.' },
  { term:'Rondelle', cat:'Bead Shape', def:'A disc-shaped bead — flat and wide with a hole through the centre of the disc. Often faceted. Used as spacers between larger beads.' },
  { term:'Round Nose Pliers', cat:'Tool', def:'Pliers with round, tapered, conical jaws. Used for forming loops and curves. The position on the jaw determines loop size — consistent placement = consistent loops.' },
  { term:'Seed Bead', cat:'Bead Type', def:'Tiny glass beads, typically 1-4mm. Used as spacers, in patterns, and for fine beading. Sized by number — 11/0 (small) to 6/0 (larger). Japanese seed beads (Miyuki, Toho) are more consistent in size than Czech.' },
  { term:'Simple Loop', cat:'Technique', def:'A loop formed by bending wire around round nose pliers without wrapping. Faster than a wrapped loop but can open under pressure.' },
  { term:'Sterling Silver', cat:'Metal', def:'92.5% pure silver, 7.5% other metals (usually copper) for strength. The standard for silver jewellery. Will tarnish over time but can be polished. Marked 925.' },
  { term:'Toggle Clasp', cat:'Finding', def:'A clasp consisting of a ring and a bar. The bar passes through the ring and rotates to lock. Elegant, visible, and becomes part of the design.' },
  { term:'Wrapped Loop', cat:'Technique', def:'A loop made by wrapping the tail wire around the stem 2-3 times after forming the loop. Permanent — cannot be opened. The most professional and secure method for all jewellery connections.' },
  { term:'Wire Gauge', cat:'Wire', def:'The thickness of wire. For beaded jewellery: 20-22g for frames and structural elements, 24-26g for most bead threading, 28-30g for binding and coiling.' },
  { term:'Work Hardening', cat:'Wire', def:'Wire becomes stiffer and more brittle the more it is bent back and forth. Over-worked wire will eventually snap. If wire feels stiff or springy, start with a fresh piece.' },
  { term:'Beading Wire', cat:'Stringing', def:'Stainless steel cable twisted together and coated in nylon. Available in different strand counts (7, 19, 49). More strands = more flexible and drape. Brand names include Soft Flex and Beadalon.' },
]

const categories = ['All', ...Array.from(new Set(terms.map(t => t.cat)))]

export default function GlossaryPage() {
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('All')
  const [expanded, setExpanded] = useState<string|null>(null)

  const filtered = terms.filter(t => {
    const matchSearch = !search || t.term.toLowerCase().includes(search.toLowerCase()) || t.def.toLowerCase().includes(search.toLowerCase())
    const matchCat = cat === 'All' || t.cat === cat
    return matchSearch && matchCat
  }).sort((a,b) => a.term.localeCompare(b.term))

  const catColours: Record<string,string> = {
    'Finding':'var(--moonstone)','Bead Shape':'var(--amethyst)','Bead Type':'var(--amethyst)',
    'Wire':'var(--sage)','Metal':'var(--silver)','Tool':'var(--steel2)',
    'Technique':'var(--rose)','General':'var(--muted)','Stringing':'var(--sage)',
    'Wire/Finding':'var(--sage)'
  }

  return (
    <>
      <Nav />
      <main style={{paddingTop:60,minHeight:'100vh'}}>
        <div style={{maxWidth:900,margin:'0 auto',padding:'52px 40px 80px'}}>
          <header style={{marginBottom:40}}>
            <p className="section-eyebrow fade-up">Reference</p>
            <h1 className="fade-up-1" style={{fontSize:44,color:'var(--cream)',fontFamily:'var(--font-display)',fontWeight:400,margin:'8px 0 10px'}}>Glossary</h1>
            <p className="fade-up-2" style={{color:'var(--text2)',fontSize:17}}>Every term you&apos;ll encounter when buying beads and findings — defined plainly.</p>
          </header>

          <div style={{display:'flex',gap:12,marginBottom:24,flexWrap:'wrap'}}>
            <input className="input-base" style={{flex:1,maxWidth:300}} placeholder="Search terms…" value={search} onChange={e=>setSearch(e.target.value)}/>
            <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
              {categories.map(c => (
                <button key={c} onClick={()=>setCat(c)} style={{
                  padding:'8px 14px',fontFamily:'var(--font-mono)',fontSize:10,
                  letterSpacing:'0.1em',textTransform:'uppercase',
                  background:cat===c?'var(--surface2)':'var(--surface)',
                  border:`1px solid ${cat===c?'var(--silver)':'var(--border)'}`,
                  color:cat===c?'var(--silver2)':'var(--muted)',cursor:'pointer',transition:'all 0.15s'
                }}>{c}</button>
              ))}
            </div>
          </div>

          <p className="mono" style={{fontSize:10,color:'var(--muted2)',marginBottom:16,letterSpacing:'0.1em'}}>{filtered.length} TERMS</p>

          <div style={{display:'flex',flexDirection:'column',gap:2}}>
            {filtered.map(t => (
              <div key={t.term} style={{
                background:'var(--surface)',border:'1px solid var(--border)',
                transition:'border-color 0.15s',
                borderColor:expanded===t.term?'var(--border2)':'var(--border)'
              }}>
                <button onClick={()=>setExpanded(expanded===t.term?null:t.term)} style={{
                  width:'100%',display:'flex',alignItems:'center',gap:14,
                  padding:'16px 20px',background:'none',border:'none',cursor:'pointer',textAlign:'left'
                }}>
                  <span style={{
                    fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'0.1em',
                    textTransform:'uppercase',color:catColours[t.cat]||'var(--muted)',
                    flexShrink:0,minWidth:80
                  }}>{t.cat}</span>
                  <span style={{fontFamily:'var(--font-display)',fontSize:18,color:'var(--cream)',flex:1}}>{t.term}</span>
                  <span style={{color:'var(--muted)',fontSize:14,transform:expanded===t.term?'rotate(90deg)':'rotate(0)',transition:'transform 0.2s'}}>›</span>
                </button>
                {expanded===t.term && (
                  <div style={{padding:'0 20px 18px 114px'}}>
                    <p style={{fontFamily:'var(--font-body)',fontSize:16,color:'var(--text2)',lineHeight:1.7}}>{t.def}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
