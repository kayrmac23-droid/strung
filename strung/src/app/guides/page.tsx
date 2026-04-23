'use client'
import { useState } from 'react'
import Nav from '@/components/Nav'

const guides = [
  { id:'wrapped-loop', icon:'○', category:'Wire Work', title:'The Wrapped Loop', difficulty:'Beginner', time:'20 min',
    summary:'The single most important technique in beaded jewellery. Master this and you can make almost anything.',
    sections:[
      { heading:'What It Is & Why It Matters', body:`A wrapped loop is a secure, professional way to attach a bead to a wire and create a link. Unlike a simple loop (which can pop open), a wrapped loop is permanent — the wire coils around itself to lock it closed.\n\nOnce you can make a consistent wrapped loop, you can make: earrings with dangles, briolette drops, necklace stations, chandelier components, and wire-wrapped pendants. It's the foundation of almost every wire-based beaded jewellery style.` },
      { heading:'What You Need', body:`**Wire:** 24 gauge is standard for most beads. 22 gauge for heavier stones, 26 gauge for tiny beads with small holes.\n\n**Round nose pliers:** For forming the loop. The position of the bead on the pliers determines loop size — mark a consistent spot with tape.\n\n**Flat/chain nose pliers:** For holding the loop while you wrap. Two pairs are ideal.\n\n**Flush wire cutters:** For cutting wire cleanly. Cheap cutters leave a spike — worth investing in a decent pair.` },
      { heading:'Step by Step', body:`1. Thread your bead onto a head pin (or a piece of wire if you're making a link).\n\n2. Using flat nose pliers, bend the wire 90° directly above the bead — leave about 3mm of straight wire before the bend.\n\n3. Grip the bend with round nose pliers, positioning the jaw at the base of the 90° bend.\n\n4. Wrap the wire over the top jaw and around behind to form a loop. The wire should cross over itself.\n\n5. Hold the loop with flat nose pliers (don't let it rotate). Wrap the tail wire around the stem 2-3 times, working downward toward the bead.\n\n6. Cut the excess wire with flush cutters, then press the cut end in with flat nose pliers so there's no spike.` },
      { heading:'Common Mistakes', body:`**Loop too big or inconsistent:** You're not placing the pliers at the same spot each time. Mark your round nose pliers with tape.\n\n**Wraps are loose or gappy:** You need to tension the wire as you wrap — hold the loop firmly and pull the tail wire taut as you coil.\n\n**Wire kinks or breaks:** You're using work-hardened wire that's been bent back and forth too many times. Start fresh.\n\n**Loop is off-centre:** The bead is rotating as you form the loop. Grip closer to the bead before bending.` },
      { heading:'Wrapping Briolettes & Teardrops', body:`Briolettes have a hole drilled through the top point, not through the bead. Thread a thin wire through the hole, cross the two ends at the top, then wrap one wire around the other to form a stem — then make a wrapped loop from the stem.\n\nUse 26 or 28 gauge wire for briolettes. Thicker wire won't fit through the hole and will be harder to wrap neatly at the top.` },
    ]
  },
  { id:'head-pins', icon:'|', category:'Findings', title:'Head Pins & Eye Pins', difficulty:'Beginner', time:'15 min',
    summary:'The quickest way to turn a single bead into a dangle or a link.',
    sections:[
      { heading:'Head Pins vs Eye Pins', body:`**Head pin:** A straight wire with a flat pad or decorative end at the bottom. You thread a bead on, then make a loop at the top. Used for dangles and earring drops.\n\n**Eye pin:** A straight wire with a pre-made loop at one end. Thread a bead on, make a loop at the other end. Used for chain links and connecting multiple beads in a sequence.\n\nBoth come in different gauges (21g is standard) and lengths (30mm, 40mm, 50mm). Match the length to your bead plus enough wire to make a loop — you need at least 10-12mm of wire above the bead.` },
      { heading:'Simple Loop vs Wrapped Loop', body:`A **simple loop** is faster: grip the wire above the bead, bend it around the round nose pliers, and trim. The problem is it can open under tension — fine for lightweight earrings, not for necklaces or heavy beads.\n\nA **wrapped loop** is permanent and professional. Takes longer but won't open. Use wrapped loops for: anything that will take tension (necklace links), heavier beads, pieces you're selling.` },
      { heading:'Bead Fit on Head Pins', body:`The bead's hole must be smaller than the head of the pin — otherwise it slides off. Most gemstone beads have 0.5-1mm holes and work fine with standard head pins.\n\nIf the bead hole is too large: thread a smaller seed bead on first, then your main bead. The seed bead acts as a stopper.\n\nIf the wire is too thick for the hole: switch to a finer gauge head pin (24g instead of 21g).` },
      { heading:'Decorative Head Pins', body:`Beyond plain flat-head pins, you'll find: ball-end pins (a small ball instead of flat pad — elegant), eye pins (loop end), paddle pins (flat disc top), flower or leaf end pins. These add detail to the bottom of a dangle without needing to add an extra bead.\n\nFor your style of jewellery — wire-wrapped drops and chandelier earrings — ball-end head pins in silver are the most versatile option. They look intentional at the base of a dangle even when visible.` },
    ]
  },
  { id:'jump-rings', icon:'◯', category:'Findings', title:'Jump Rings', difficulty:'Beginner', time:'10 min',
    summary:'How to open, close, and use jump rings without ruining them.',
    sections:[
      { heading:'The Golden Rule', body:`Never pull a jump ring open by pulling the two ends apart (outward). This distorts the round shape and you can never get it perfectly round again.\n\nInstead: hold the ring with two pairs of flat nose pliers, one on each side of the cut. Twist one side toward you and one side away — opening it sideways. Close it the same way, pressing back until you feel and hear a slight click as the ends meet.` },
      { heading:'Sizes & Gauges', body:`Jump ring size is measured by inner diameter (ID) and wire gauge.\n\n- **4mm, 20g:** Small, neat, good for most earring and bracelet connections\n- **5mm, 18g:** Versatile, good for necklaces and heavier connections\n- **6mm+:** Large and visible — use when they're meant to be seen (as a design element)\n\nFor your style: 4mm silver jump rings are the workhorse. Keep 50+ in your kit at all times.` },
      { heading:'Soldered vs Unsoldered', body:`**Unsoldered (open):** Standard jump rings with a cut. Can be opened and closed. These are what you'll use most.\n\n**Soldered (closed):** No cut — they're a complete circle. Cannot be opened. Used as fixed connectors in chain necklaces or as decorative hoops you attach to.\n\nFor most beaded jewellery connections, unsoldered rings are fine — as long as you close them properly (ends meeting perfectly flush, no gap).` },
      { heading:'Common Issues', body:`**Ring keeps springing open:** You're not closing it fully. Press both flat nose pliers together firmly until the ends are flush and you feel resistance. Over-close slightly, then ease back.\n\n**Ring is now oval, not round:** You opened it the wrong way (pulled apart instead of twisting). Use a ring mandrel or the tapered end of your round nose pliers to reshape it.\n\n**Chain keeps coming apart:** Your jump rings are either not fully closed or are too thin a gauge for the weight of the pendant. Use a heavier gauge or two jump rings together for heavier pieces.` },
    ]
  },
  { id:'stringing', icon:'∼', category:'Stringing', title:'Stringing & Crimping', difficulty:'Beginner', time:'25 min',
    summary:'How to string beads on wire and finish them properly with crimps and clasps.',
    sections:[
      { heading:'Beading Wire vs Thread', body:`**Beading wire (Soft Flex, Beadalon):** Twisted steel cable coated in nylon. Comes in different strand counts — 19 or 49 strand is most flexible and drapes well. Use for most necklaces and bracelets. Doesn't stretch, is strong, and doesn't fray.\n\n**Elastic (Stretch Magic):** For stretch bracelets. Simple to make — just string beads, tie a surgeon's knot, put a small dab of G-S Hypo Cement on the knot, and trim. Quick and beginner-friendly.\n\n**Silk thread:** Traditional for pearls and knotted necklaces. Each bead is separated by a knot so if the thread breaks you don't lose all beads at once.` },
      { heading:'Crimping Step by Step', body:`Crimps are small metal tubes that you compress to secure beading wire.\n\n1. Thread a crimp tube onto your wire, then through the loop of your clasp, then back through the crimp tube.\n2. Leave a small loop of wire at the clasp — don't pull it tight.\n3. Slide the crimp tube up close to the clasp loop (2-3mm gap).\n4. Using crimping pliers (not flat nose), place the crimp in the inner notch (kidney-shaped) and squeeze — this creates a crease in the middle of the crimp.\n5. Rotate the crimp 90° and place in the outer notch (round) and squeeze — this folds the crimp in half, creating a neat round bead shape.\n6. Test by tugging firmly. If it slides, redo it.` },
      { heading:'Crimp Covers', body:`A crimp cover is a small metal shell that snaps over a finished crimp to hide it and make it look like a bead. Use round nose pliers to gently close the cover around the crimp — don't squeeze too hard or it collapses.\n\nThey're not essential but make finished pieces look significantly more polished. Available in silver, gold, and rose gold to match your findings.` },
      { heading:'Clasp Types', body:`**Lobster clasp:** Most common, secure, easy to use. Pairs with a jump ring or chain end.\n\n**Toggle clasp:** A bar that slides through a ring. Elegant and visible — part of the design. Good for bracelets but needs the bar to be slightly longer than the ring's diameter to stay closed reliably.\n\n**Magnetic clasp:** Easy to put on and take off — good for people with limited dexterity. Not secure enough for heavier necklaces or pieces you wear actively.\n\n**Spring ring:** Similar to lobster but smaller. Fine for lightweight necklaces.` },
    ]
  },
  { id:'wire-wrapping', icon:'~', category:'Wire Work', title:'Wire Wrapping Basics', difficulty:'Beginner', time:'30 min',
    summary:'How to wrap wire around a stone or bead to create a pendant or frame without glue.',
    sections:[
      { heading:'Wire Types & Gauges for Wrapping', body:`**20-22 gauge:** Frame wire — this forms the skeleton of your pendant. Thick enough to hold shape but workable with pliers.\n\n**26-28 gauge:** Binding wire — this wraps around the frame to hold everything together. Thin, flexible, and easy to coil neatly.\n\n**Dead soft vs half hard:** Dead soft is most malleable but loses shape. Half hard holds shape better but is harder to coil. For beginners, dead soft wire is easier to work with.` },
      { heading:'Simple Cabochon Wrap', body:`A cabochon is a smooth, flat-backed stone (as opposed to a faceted stone with a point).\n\n1. Cut a length of 20g wire (longer than you think you need — about 3x the circumference of the stone).\n2. Bend it in half and pinch at the centre with flat nose pliers.\n3. Wrap the two ends around the stone, crossing at the back.\n4. Bring both wires to the front, crossing over the stone.\n5. Use 26g binding wire to lash the frame wires together at the top, coiling neatly 4-5 times.\n6. Form a loop above the coils for hanging.\n\nThe stone should sit snug — not so tight it cracks, not so loose it falls out.` },
      { heading:'Wire Coiling', body:`Coiling wire neatly is a skill that comes with practice. The goal is tight, even coils with no gaps.\n\nHold the stem wire steady in one hand (or in a vise). With the other hand, wrap the thin wire around the stem in tight coils, working in one direction. Keep tension on the wire as you go — slack wire creates loops.\n\nCommon use: coiling wire around the neck of a briolette pendant, or creating a coiled bail.` },
      { heading:'Tools to Make It Easier', body:`**Wire jig:** Pegs arranged in a pattern that you wrap wire around to create consistent shapes. Great for making matching earring components.\n\n**Bail-making pliers:** Stepped pliers with different diameter barrels for making uniform loops and bails.\n\n**Nylon jaw pliers:** Straighten kinked wire without leaving marks.\n\n**Bead mat or bead board:** Velvet surface to work on — stops beads rolling, keeps components organised.` },
    ]
  },
  { id:'earring-anatomy', icon:'◇', category:'Construction', title:'Earring Construction', difficulty:'Beginner', time:'20 min',
    summary:'How most beaded earrings are actually built — from simple drops to chandeliers.',
    sections:[
      { heading:'Simple Drop Earring', body:`The simplest beaded earring: one bead on a head pin, finished with a wrapped loop, attached to an ear wire via a jump ring.\n\nComponents: 1x ear wire, 1x jump ring (4mm), 1x head pin, 1x bead.\n\nAssembly: thread bead onto head pin → make wrapped loop above bead → open jump ring → thread through the wrapped loop AND the ear wire loop → close jump ring.\n\nVariations: multiple beads on the head pin (stack them), different shaped beads, decorative head pins.` },
      { heading:'Dangle Earring (Multiple Components)', body:`For earrings with several drops — like the chandelier style you like:\n\n1. Make each individual bead drop (bead on head pin with wrapped loop)\n2. Connect drops to a chandelier finding or a jump ring chain\n3. Each layer adds visual complexity\n\nFor a 3-drop earring: make 3 individual wrapped loop drops → attach to a 3-hole connector finding or a piece of chain → attach chain or finding to ear wire.\n\nFor cascade earrings: connect drops to a longer chain, spacing them at different heights.` },
      { heading:'Hoop Earrings with Beads', body:`Beads on hoops can be done two ways:\n\n**Wire-wrapped:** Thread beads onto the hoop wire itself before closing. Works if the hoop has an open end you can thread through.\n\n**Dangling from hoop:** Make individual bead drops (wrapped loops on head pins) and attach them to the hoop via jump rings at intervals. The hoop becomes a bar the drops hang from.\n\nFor the style in your inspiration images — beads hanging around the circumference of a hoop — use the second method: 4-8 small drops attached to the hoop with 4mm jump rings.` },
      { heading:'Ear Wire Styles', body:`**French ear wire (shepherd hook):** The most common. A simple hook that passes through the ear. Most versatile.\n\n**Leverback:** Has a hinged closure — more secure, won't fall out. Good for heavy earrings.\n\n**Stud with loop:** A post with a loop at the front for attaching drops. Different look — the attachment point is at the ear, not dangling below.\n\n**Hoop (huggie):** Clicks closed. Can have drops attached or beads threaded on.\n\nFor your style: French ear wires in sterling silver or silver-filled are your bread and butter. Buy in packs of 50.` },
    ]
  },
]

export default function GuidesPage() {
  const [active, setActive] = useState(guides[0])
  const [section, setSection] = useState(0)
  const [aiQ, setAiQ] = useState('')
  const [aiA, setAiA] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  async function ask() {
    if (!aiQ.trim()||aiLoading) return
    setAiLoading(true); setAiA('')
    const context = `Guide: "${active.title}", section: "${active.sections[section].heading}"`
    try {
      const res = await fetch('/api/advice', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ question: aiQ, context }),
      })
      const reader = res.body!.getReader()
      const dec = new TextDecoder()
      let full = ''
      while(true) {
        const {done,value} = await reader.read()
        if(done) break
        full += dec.decode(value)
        setAiA(full)
      }
    } catch { setAiA('Error.') }
    finally { setAiLoading(false); setAiQ('') }
  }

  const diffColor = (d:string) => d==='Beginner'?'var(--sage)':d==='Advanced'?'var(--rose)':'var(--moonstone)'

  const fmt = (text:string) => text
    .replace(/\*\*(.+?)\*\*/g,'<strong style="color:var(--silver3)">$1</strong>')
    .split('\n\n').map(p=>`<p style="margin-bottom:13px;color:var(--text);font-family:var(--font-body);font-size:17px;line-height:1.8">${p.replace(/\n/g,'<br/>')}</p>`).join('')

  return (
    <>
      <Nav />
      <main style={{paddingTop:60,minHeight:'100vh'}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'52px 40px 80px'}}>
          <header style={{marginBottom:40}}>
            <p className="section-eyebrow fade-up">Technique Library</p>
            <h1 className="fade-up-1" style={{fontSize:44,color:'var(--cream)',fontFamily:'var(--font-display)',fontWeight:400,margin:'8px 0 10px'}}>Guides</h1>
            <p className="fade-up-2" style={{color:'var(--text2)',fontSize:17}}>Practical techniques for the style of jewellery you actually want to make.</p>
          </header>

          <div className="guides-grid">
            {/* Sidebar */}
            <aside style={{display:'flex',flexDirection:'column',gap:2,position:'sticky',top:76}}>
              {guides.map(g => (
                <button key={g.id} onClick={()=>{setActive(g);setSection(0);setAiA('')}} style={{
                  display:'flex',alignItems:'flex-start',gap:12,padding:'14px 16px',
                  background:'var(--surface)',border:`1px solid ${active.id===g.id?'var(--silver)':'var(--border)'}`,
                  textAlign:'left',cursor:'pointer',transition:'all 0.15s',width:'100%'
                }}>
                  <span style={{fontSize:16,color:'var(--silver)',marginTop:2,flexShrink:0}}>{g.icon}</span>
                  <div>
                    <p style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'0.14em',textTransform:'uppercase',color:'var(--muted2)'}}>{g.category}</p>
                    <p style={{fontFamily:'var(--font-display)',fontSize:14,color:'var(--cream)',marginTop:2}}>{g.title}</p>
                    <div style={{display:'flex',alignItems:'center',gap:4,marginTop:3,fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)'}}>
                      <span style={{color:diffColor(g.difficulty),fontSize:7}}>⬤</span>
                      <span>{g.difficulty}</span><span>·</span><span>{g.time}</span>
                    </div>
                  </div>
                </button>
              ))}
            </aside>

            {/* Content */}
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div className="card" style={{padding:26}}>
                <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                  <span className="tag">{active.category}</span>
                  <span className="tag" style={{borderColor:diffColor(active.difficulty),color:diffColor(active.difficulty)}}>{active.difficulty}</span>
                  <span className="mono muted" style={{fontSize:10}}>{active.time} read</span>
                </div>
                <h2 style={{fontSize:30,color:'var(--cream)',fontFamily:'var(--font-display)',fontWeight:400,marginBottom:8}}>{active.title}</h2>
                <p style={{color:'var(--text2)',fontSize:15}}>{active.summary}</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:18,paddingTop:16,borderTop:'1px solid var(--border)'}}>
                  {active.sections.map((s,i) => (
                    <button key={i} onClick={()=>setSection(i)} style={{
                      fontFamily:'var(--font-mono)',fontSize:10,letterSpacing:'0.08em',
                      padding:'6px 12px',background:'var(--bg2)',
                      border:`1px solid ${section===i?'var(--silver)':'var(--border)'}`,
                      color:section===i?'var(--silver2)':'var(--muted)',cursor:'pointer',transition:'all 0.15s'
                    }}>{s.heading}</button>
                  ))}
                </div>
              </div>

              <div className="card" style={{padding:30}}>
                <h3 style={{fontFamily:'var(--font-display)',fontSize:24,fontWeight:400,color:'var(--silver2)',marginBottom:18}}>{active.sections[section].heading}</h3>
                <div dangerouslySetInnerHTML={{__html:fmt(active.sections[section].body)}}/>
                <div style={{display:'flex',marginTop:22,paddingTop:18,borderTop:'1px solid var(--border)'}}>
                  {section>0&&<button className="btn-outline" onClick={()=>setSection(s=>s-1)}>← Previous</button>}
                  {section<active.sections.length-1&&<button className="btn-silver" style={{marginLeft:'auto'}} onClick={()=>setSection(s=>s+1)}>Next →</button>}
                </div>
              </div>

              <div className="card" style={{padding:26}}>
                <div style={{display:'flex',gap:10,alignItems:'flex-start',marginBottom:14}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:'var(--silver)',marginTop:6,animation:'glow 3s ease-in-out infinite',flexShrink:0}}/>
                  <div>
                    <p className="mono" style={{fontSize:10,letterSpacing:'0.14em',color:'var(--muted)'}}>ASK ABOUT THIS</p>
                    <p style={{fontSize:14,color:'var(--text2)',marginTop:2}}>Questions about <em>{active.sections[section].heading}</em>?</p>
                  </div>
                </div>
                {aiA&&<div style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:18,marginBottom:14,fontSize:15,color:'var(--text)',fontFamily:'var(--font-body)',lineHeight:1.7}}
                  dangerouslySetInnerHTML={{__html:aiA.replace(/\*\*(.+?)\*\*/g,'<strong style="color:var(--silver3)">$1</strong>').split('\n\n').map(p=>`<p style="margin-bottom:10px">${p}</p>`).join('')}}/>}
                <div style={{display:'flex',gap:10}}>
                  <input type="text" className="input-base" style={{flex:1}}
                    placeholder="e.g. 'My loops keep opening' or 'What size crimp should I use?'"
                    value={aiQ} onChange={e=>setAiQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ask()}/>
                  <button className="btn-silver" onClick={ask} disabled={aiLoading}>{aiLoading?<span className="spinner"/>:'Ask'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
