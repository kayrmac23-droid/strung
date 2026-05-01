'use client'
import { useState } from 'react'
import Nav from '@/components/Nav'
import { colourFamilies, metalTones, harmonyScore } from '@/lib/colour'

export default function PalettePage() {
  const [selected, setSelected] = useState<{n:string,h:string}[]>([])
  const [metal, setMetal] = useState(metalTones[0])
  const [openFamily, setOpenFamily] = useState<string|null>('Blues')

  function toggle(colour: {n:string,h:string}) {
    setSelected(s =>
      s.find(x=>x.n===colour.n)
        ? s.filter(x=>x.n!==colour.n)
        : s.length < 6 ? [...s, colour] : s
    )
  }

  const harmony = harmonyScore(selected)

  return (
    <>
      <Nav />
      <main style={{paddingTop:60,minHeight:'100vh'}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'52px 40px 80px'}}>
          <header style={{marginBottom:40}}>
            <p className="section-eyebrow fade-up">Colour Theory</p>
            <h1 className="fade-up-1" style={{fontSize:44,color:'var(--cream)',fontFamily:'var(--font-display)',fontWeight:400,margin:'8px 0 10px'}}>Colour Palette Builder</h1>
            <p className="fade-up-2" style={{color:'var(--text2)',fontSize:17}}>Pick up to 6 colours from any bead type, choose a metal, and see how they work together.</p>
          </header>

          <div className="palette-grid">
            {/* Colour picker */}
            <div>
              {colourFamilies.map(family => (
                <div key={family.name} style={{marginBottom:4}}>
                  <button onClick={()=>setOpenFamily(openFamily===family.name?null:family.name)} style={{
                    width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
                    padding:'12px 16px',background:'var(--surface)',border:'1px solid var(--border)',
                    cursor:'pointer',transition:'all 0.15s',textAlign:'left'
                  }}>
                    <span style={{fontFamily:'var(--font-display)',fontSize:17,color:'var(--cream)'}}>{family.name}</span>
                    <span style={{color:'var(--muted)',fontSize:14,transform:openFamily===family.name?'rotate(90deg)':'none',transition:'transform 0.2s'}}>›</span>
                  </button>

                  {openFamily===family.name && (
                    <div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderTop:'none',padding:'16px'}}>
                      {family.subcategories.map(sub => (
                        <div key={sub.name} style={{marginBottom:16}}>
                          <p className="label" style={{marginBottom:10}}>{sub.name}</p>
                          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                            {sub.colours.map(colour => {
                              const isSelected = !!selected.find(x=>x.n===colour.n)
                              return (
                                <button key={colour.n} onClick={()=>toggle(colour)} style={{
                                  display:'flex',alignItems:'center',gap:7,padding:'6px 12px',
                                  background:isSelected?'var(--surface2)':'var(--surface)',
                                  border:`1px solid ${isSelected?'var(--silver)':'var(--border)'}`,
                                  cursor:'pointer',transition:'all 0.15s'
                                }}>
                                  <div style={{width:14,height:14,borderRadius:'50%',background:colour.h,border:'1px solid rgba(255,255,255,0.1)',flexShrink:0}}/>
                                  <span style={{fontFamily:'var(--font-body)',fontSize:13,color:isSelected?'var(--cream)':'var(--text2)'}}>{colour.n}</span>
                                  {isSelected&&<span style={{color:'var(--silver)',fontSize:11}}>✓</span>}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Palette panel */}
            <div style={{position:'sticky',top:80,display:'flex',flexDirection:'column',gap:14}}>
              {/* Selected */}
              <div className="card" style={{padding:22}}>
                <h3 style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:400,color:'var(--cream)',marginBottom:12}}>
                  Your Palette {selected.length>0&&<span className="mono" style={{fontSize:11,color:'var(--muted)',fontFamily:'var(--font-mono)'}}>({selected.length}/6)</span>}
                </h3>
                {selected.length===0 ? (
                  <p style={{color:'var(--muted)',fontSize:14,fontStyle:'italic'}}>Select colours to build your palette</p>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {selected.map(c => (
                      <div key={c.n} style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:24,height:24,borderRadius:'50%',background:c.h,border:'1px solid rgba(255,255,255,0.1)',flexShrink:0}}/>
                        <span style={{fontFamily:'var(--font-body)',fontSize:14,color:'var(--cream)',flex:1}}>{c.n}</span>
                        <span className="mono" style={{fontSize:9,color:'var(--muted)'}}>{c.h}</span>
                        <button onClick={()=>toggle(c)} style={{background:'none',border:'none',color:'var(--muted2)',cursor:'pointer',fontSize:14,padding:'0 4px'}}
                          onMouseEnter={e=>(e.currentTarget.style.color='var(--rose)')}
                          onMouseLeave={e=>(e.currentTarget.style.color='var(--muted2)')}>×</button>
                      </div>
                    ))}
                    <div style={{display:'flex',height:10,marginTop:6,overflow:'hidden',borderRadius:2}}>
                      {selected.map(c=><div key={c.n} style={{flex:1,background:c.h}}/>)}
                    </div>
                  </div>
                )}
              </div>

              {/* Metal */}
              <div className="card" style={{padding:22}}>
                <h3 style={{fontFamily:'var(--font-display)',fontSize:18,fontWeight:400,color:'var(--cream)',marginBottom:12}}>Metal Tone</h3>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {metalTones.map(m=>(
                    <button key={m.name} onClick={()=>setMetal(m)} style={{
                      display:'flex',alignItems:'center',gap:8,padding:'8px 10px',textAlign:'left',
                      background:metal.name===m.name?'var(--surface2)':'transparent',
                      border:`1px solid ${metal.name===m.name?'var(--silver)':'transparent'}`,
                      cursor:'pointer',transition:'all 0.15s',width:'100%'
                    }}>
                      <div style={{width:18,height:18,borderRadius:'50%',background:m.hex,border:'1px solid rgba(255,255,255,0.1)',flexShrink:0}}/>
                      <div>
                        <p style={{fontFamily:'var(--font-body)',fontSize:13,color:'var(--cream)'}}>{m.name}</p>
                        <p style={{fontFamily:'var(--font-mono)',fontSize:9,color:'var(--muted)',marginTop:1}}>{m.note}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Harmony */}
              {selected.length>=2&&(
                <div style={{background:'var(--surface)',border:'1px solid var(--border)',padding:18}}>
                  <span className="mono" style={{fontSize:10,letterSpacing:'0.12em',color:'var(--moonstone)'}}>HARMONY RATING</span>
                  <p style={{fontFamily:'var(--font-display)',fontSize:22,color:'var(--cream)',margin:'6px 0 4px'}}>{harmony.score}</p>
                  <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.5}}>{harmony.note}</p>
                  <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                    <p className="mono" style={{fontSize:9,color:'var(--muted)',letterSpacing:'0.1em'}}>WITH {metal.name.toUpperCase()}</p>
                    <p style={{fontSize:12,color:'var(--text2)',marginTop:4}}>{metal.note}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
