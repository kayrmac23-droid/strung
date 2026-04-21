'use client'
import { useState } from 'react'
import Nav from '@/components/Nav'

const gemFamilies = [
  { name:'Blues & Greys', gems:[{n:'Labradorite',h:'#6a88a0'},{n:'Aquamarine',h:'#7ab4c8'},{n:'Iolite',h:'#5a6898'},{n:'Blue Topaz',h:'#78aac8'},{n:'Sodalite',h:'#3a5878'},{n:'Kyanite',h:'#5878b0'}]},
  { name:'Purples', gems:[{n:'Amethyst',h:'#8a6aaa'},{n:'Charoite',h:'#7a5a98'},{n:'Lepidolite',h:'#9a80b8'},{n:'Sugilite',h:'#8060a0'},{n:'Tanzanite',h:'#6858a0'},{n:'Lavender Jade',h:'#a090bc'}]},
  { name:'Greens', gems:[{n:'Prehnite',h:'#8aaa80'},{n:'Chrysoprase',h:'#6aaa70'},{n:'Malachite',h:'#3a8850'},{n:'Moss Agate',h:'#7a9060'},{n:'Aventurine',h:'#5a9870'},{n:'Jade',h:'#4a9068'}]},
  { name:'Warm Tones', gems:[{n:'Garnet',h:'#a03040'},{n:'Carnelian',h:'#c87040'},{n:'Citrine',h:'#c8a040'},{n:'Tiger Eye',h:'#a07030'},{n:'Sunstone',h:'#c09050'},{n:'Amber',h:'#b88030'}]},
  { name:'Neutrals', gems:[{n:'Moonstone',h:'#c8d0dc'},{n:'Labradorite',h:'#808898'},{n:'Smoky Quartz',h:'#806858'},{n:'Howlite',h:'#d0ccc8'},{n:'Pyrite',h:'#a09050'},{n:'Hematite',h:'#585860'}]},
  { name:'Pinks & Reds', gems:[{n:'Rose Quartz',h:'#d0a0a8'},{n:'Rhodonite',h:'#c07880'},{n:'Pink Tourmaline',h:'#c87090'},{n:'Rhodochrosite',h:'#d06878'},{n:'Kunzite',h:'#c8a0c0'},{n:'Ruby',h:'#b03050'}]},
]

const metalTones = [
  {name:'Sterling Silver',hex:'#a8b8c8',note:'Cool, versatile, suits blues and purples'},
  {name:'Fine Silver',hex:'#c0ccd8',note:'Brightest silver, good for delicate work'},
  {name:'Gold Filled',hex:'#c8a858',note:'Warm, lifts earthy and warm-toned gems'},
  {name:'Rose Gold Filled',hex:'#c89080',note:'Romantic, pairs with pinks and neutrals'},
  {name:'Oxidised Silver',hex:'#606870',note:'Dark, moody — makes gems pop dramatically'},
  {name:'Antique Brass',hex:'#907840',note:'Earthy, pairs with stones like tiger eye and garnet'},
  {name:'Copper',hex:'#b06840',note:'Warm rustic feel, patinas beautifully over time'},
]

export default function PalettePage() {
  const [selected, setSelected] = useState<string[]>([])
  const [metal, setMetal] = useState(metalTones[0])

  function toggle(gemName: string) {
    setSelected(s => s.includes(gemName) ? s.filter(x=>x!==gemName) : s.length < 5 ? [...s, gemName] : s)
  }

  const selectedGems = gemFamilies.flatMap(f=>f.gems).filter(g=>selected.includes(g.n))

  function harmonyScore(): { score: string; note: string } {
    if (selected.length < 2) return { score:'—', note:'Select 2+ gems to see harmony rating' }
    const families = gemFamilies.filter(f=>f.gems.some(g=>selected.includes(g.n))).length
    if (families === 1) return { score:'Tonal', note:'Same-family gems create a cohesive, layered look — elegant and safe.' }
    if (families === 2) return { score:'Complementary', note:'Two gem families create natural contrast without clashing.' }
    if (families === 3) return { score:'Triad', note:'Three families — works if there\'s one dominant gem with two accents.' }
    return { score:'Complex', note:'Many families — keep it cohesive by choosing one hero gem and using others sparingly.' }
  }

  const harmony = harmonyScore()

  return (
    <>
      <Nav />
      <main style={{paddingTop:60,minHeight:'100vh'}}>
        <div style={{maxWidth:1100,margin:'0 auto',padding:'52px 40px 80px'}}>
          <header style={{marginBottom:40}}>
            <p className="section-eyebrow fade-up">Colour Theory</p>
            <h1 className="fade-up-1" style={{fontSize:44,color:'var(--cream)',fontFamily:'var(--font-display)',fontWeight:400,margin:'8px 0 10px'}}>Gem Palette Builder</h1>
            <p className="fade-up-2" style={{color:'var(--text2)',fontSize:17}}>Select up to 5 gemstones, choose a metal, and see how they work together.</p>
          </header>

          <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:24,alignItems:'start'}}>
            {/* Gem picker */}
            <div>
              {gemFamilies.map(family => (
                <div key={family.name} style={{marginBottom:28}}>
                  <p className="label" style={{marginBottom:12}}>{family.name}</p>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {family.gems.map(gem => {
                      const isSelected = selected.includes(gem.n)
                      return (
                        <button key={gem.n} onClick={()=>toggle(gem.n)} style={{
                          display:'flex',alignItems:'center',gap:8,padding:'8px 14px',
                          background:isSelected?'var(--surface2)':'var(--surface)',
                          border:`1px solid ${isSelected?'var(--silver)':'var(--border)'}`,
                          cursor:'pointer',transition:'all 0.15s'
                        }}>
                          <div style={{
                            width:16,height:16,borderRadius:'50%',background:gem.h,
                            border:'1px solid rgba(255,255,255,0.1)',flexShrink:0
                          }}/>
                          <span style={{fontFamily:'var(--font-body)',fontSize:14,color:isSelected?'var(--cream)':'var(--text2)'}}>{gem.n}</span>
                          {isSelected && <span style={{color:'var(--silver)',fontSize:12}}>✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Palette panel */}
            <div style={{position:'sticky',top:80,display:'flex',flexDirection:'column',gap:16}}>
              {/* Selected gems */}
              <div className="card" style={{padding:24}}>
                <h3 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:400,color:'var(--cream)',marginBottom:14}}>
                  Your Palette {selected.length>0&&<span className="mono" style={{fontSize:12,color:'var(--muted)',fontFamily:'var(--font-mono)'}}>({selected.length}/5)</span>}
                </h3>
                {selected.length === 0 ? (
                  <p style={{color:'var(--muted)',fontSize:15,fontStyle:'italic'}}>Select gemstones to build your palette</p>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {selectedGems.map(g => (
                      <div key={g.n} style={{display:'flex',alignItems:'center',gap:10}}>
                        <div style={{width:28,height:28,borderRadius:'50%',background:g.h,border:'1px solid rgba(255,255,255,0.1)',flexShrink:0,position:'relative'}}>
                          <div style={{position:'absolute',top:4,left:5,width:5,height:5,background:'rgba(255,255,255,0.35)',borderRadius:'50%',filter:'blur(1px)'}}/>
                        </div>
                        <span style={{fontFamily:'var(--font-body)',fontSize:15,color:'var(--cream)',flex:1}}>{g.n}</span>
                        <span className="mono" style={{fontSize:10,color:'var(--muted)'}}>{g.h}</span>
                        <button onClick={()=>toggle(g.n)} style={{background:'none',border:'none',color:'var(--muted2)',cursor:'pointer',fontSize:14,padding:'0 4px'}}
                          onMouseEnter={e=>e.currentTarget.style.color='var(--rose)'}
                          onMouseLeave={e=>e.currentTarget.style.color='var(--muted2)'}>×</button>
                      </div>
                    ))}
                    {/* Palette strip */}
                    <div style={{display:'flex',height:12,marginTop:8,overflow:'hidden',borderRadius:2}}>
                      {selectedGems.map(g => (
                        <div key={g.n} style={{flex:1,background:g.h}}/>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Metal picker */}
              <div className="card" style={{padding:24}}>
                <h3 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:400,color:'var(--cream)',marginBottom:14}}>Metal Tone</h3>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {metalTones.map(m => (
                    <button key={m.name} onClick={()=>setMetal(m)} style={{
                      display:'flex',alignItems:'center',gap:10,padding:'9px 12px',textAlign:'left',
                      background:metal.name===m.name?'var(--surface2)':'transparent',
                      border:`1px solid ${metal.name===m.name?'var(--silver)':'transparent'}`,
                      cursor:'pointer',transition:'all 0.15s',width:'100%'
                    }}>
                      <div style={{width:20,height:20,borderRadius:'50%',background:m.hex,border:'1px solid rgba(255,255,255,0.1)',flexShrink:0}}/>
                      <div>
                        <p style={{fontFamily:'var(--font-body)',fontSize:14,color:'var(--cream)'}}>{m.name}</p>
                        <p style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted)',marginTop:1}}>{m.note}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Harmony */}
              {selected.length >= 2 && (
                <div style={{background:'var(--surface)',border:'1px solid var(--border)',padding:20}}>
                  <span className="mono" style={{fontSize:10,letterSpacing:'0.12em',color:'var(--moonstone)'}}>HARMONY RATING</span>
                  <p style={{fontFamily:'var(--font-display)',fontSize:24,color:'var(--cream)',margin:'6px 0 6px'}}>{harmony.score}</p>
                  <p style={{fontSize:14,color:'var(--text2)',lineHeight:1.5}}>{harmony.note}</p>
                  <div style={{marginTop:12,paddingTop:12,borderTop:'1px solid var(--border)'}}>
                    <p className="mono" style={{fontSize:10,color:'var(--muted)',letterSpacing:'0.1em'}}>WITH {metal.name.toUpperCase()}</p>
                    <p style={{fontSize:13,color:'var(--text2)',marginTop:6}}>{metal.note}</p>
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
