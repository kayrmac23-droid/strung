'use client'
import { useState } from 'react'
import Nav from '@/components/Nav'

const colourFamilies = [
  {
    name: 'Reds & Pinks',
    subcategories: [
      { name: 'Crimsons & Scarlets', colours: [{n:'Crimson',h:'#9b1b30'},{n:'Scarlet',h:'#c0392b'},{n:'Ruby Red',h:'#9b111e'},{n:'Vermillion',h:'#d9381e'},{n:'Cherry',h:'#de3163'}] },
      { name: 'Roses & Blushes', colours: [{n:'Rose',h:'#c9475b'},{n:'Blush',h:'#e8a0a8'},{n:'Dusty Rose',h:'#c9848a'},{n:'Bubblegum',h:'#f4a7b9'},{n:'Coral Pink',h:'#f08080'}] },
      { name: 'Pinks', colours: [{n:'Hot Pink',h:'#e91e8c'},{n:'Magenta',h:'#c2185b'},{n:'Candy Pink',h:'#f48fb1'},{n:'Powder Pink',h:'#f8c8d4'},{n:'Salmon',h:'#fa8072'}] },
    ]
  },
  {
    name: 'Oranges & Corals',
    subcategories: [
      { name: 'Corals & Peaches', colours: [{n:'Coral',h:'#e8604c'},{n:'Peach',h:'#ffcba4'},{n:'Apricot',h:'#fbceb1'},{n:'Melon',h:'#f9a875'},{n:'Terracotta',h:'#c0714a'}] },
      { name: 'Oranges', colours: [{n:'Burnt Orange',h:'#cc5500'},{n:'Tangerine',h:'#f28500'},{n:'Amber',h:'#ffbf00'},{n:'Rust',h:'#b7410e'},{n:'Pumpkin',h:'#e87722'}] },
    ]
  },
  {
    name: 'Yellows & Golds',
    subcategories: [
      { name: 'Yellows', colours: [{n:'Sunflower',h:'#ffc512'},{n:'Lemon',h:'#fff44f'},{n:'Butter',h:'#f5e642'},{n:'Mustard',h:'#e1ad01'},{n:'Canary',h:'#ffff99'}] },
      { name: 'Golds & Ochres', colours: [{n:'Gold',h:'#c9a84c'},{n:'Ochre',h:'#c8860a'},{n:'Antique Gold',h:'#b8860b'},{n:'Honey',h:'#d4a017'},{n:'Bronze',h:'#a97142'}] },
    ]
  },
  {
    name: 'Greens',
    subcategories: [
      { name: 'Sage & Mint', colours: [{n:'Sage',h:'#8aaa80'},{n:'Mint',h:'#98e8c1'},{n:'Seafoam',h:'#9fe2bf'},{n:'Pistachio',h:'#93c572'},{n:'Pale Green',h:'#b8e0b0'}] },
      { name: 'Emeralds & Jades', colours: [{n:'Emerald',h:'#2e8b57'},{n:'Jade',h:'#4a9068'},{n:'Forest',h:'#355e3b'},{n:'Hunter Green',h:'#355e3b'},{n:'Bottle Green',h:'#006a4e'}] },
      { name: 'Olive & Earthy', colours: [{n:'Olive',h:'#808000'},{n:'Moss',h:'#7a9060'},{n:'Khaki',h:'#8b864e'},{n:'Fern',h:'#4f7942'},{n:'Chartreuse',h:'#7fff00'}] },
    ]
  },
  {
    name: 'Blues',
    subcategories: [
      { name: 'Sky & Powder', colours: [{n:'Sky Blue',h:'#87ceeb'},{n:'Powder Blue',h:'#b0c4de'},{n:'Baby Blue',h:'#89cff0'},{n:'Periwinkle',h:'#ccccff'},{n:'Ice Blue',h:'#d5e8f0'}] },
      { name: 'Ocean & Teal', colours: [{n:'Teal',h:'#008080'},{n:'Turquoise',h:'#40e0d0'},{n:'Aqua',h:'#00ffff'},{n:'Cyan',h:'#00b7eb'},{n:'Ocean Blue',h:'#4f8da6'}] },
      { name: 'Cobalt & Navy', colours: [{n:'Cobalt',h:'#0047ab'},{n:'Royal Blue',h:'#4169e1'},{n:'Navy',h:'#001f5b'},{n:'Sapphire',h:'#0f52ba'},{n:'Indigo',h:'#4b0082'}] },
      { name: 'Muted Blues', colours: [{n:'Steel Blue',h:'#4682b4'},{n:'Slate Blue',h:'#6a7fa8'},{n:'Denim',h:'#1560bd'},{n:'Storm',h:'#4f6a8a'},{n:'Dusty Blue',h:'#7a9ab8'}] },
    ]
  },
  {
    name: 'Purples & Violets',
    subcategories: [
      { name: 'Lavenders', colours: [{n:'Lavender',h:'#c8a0c0'},{n:'Lilac',h:'#b39eb5'},{n:'Wisteria',h:'#c9a0dc'},{n:'Periwinkle',h:'#8c93cf'},{n:'Soft Violet',h:'#a899c0'}] },
      { name: 'Purples', colours: [{n:'Amethyst',h:'#8a6aaa'},{n:'Violet',h:'#7f00ff'},{n:'Grape',h:'#6f2da8'},{n:'Orchid',h:'#da70d6'},{n:'Plum',h:'#8e4585'}] },
      { name: 'Deep Purples', colours: [{n:'Deep Purple',h:'#4a0082'},{n:'Aubergine',h:'#614051'},{n:'Mulberry',h:'#c54b8c'},{n:'Berry',h:'#7c1c52'},{n:'Byzantium',h:'#702963'}] },
    ]
  },
  {
    name: 'Neutrals & Browns',
    subcategories: [
      { name: 'Whites & Creams', colours: [{n:'White',h:'#f8f8f8'},{n:'Cream',h:'#fffdd0'},{n:'Ivory',h:'#fffff0'},{n:'Pearl',h:'#eae0c8'},{n:'Linen',h:'#faf0e6'}] },
      { name: 'Beiges & Taupes', colours: [{n:'Beige',h:'#f5f5dc'},{n:'Taupe',h:'#b2a494'},{n:'Sand',h:'#c2b280'},{n:'Champagne',h:'#f7e7ce'},{n:'Nude',h:'#e3bc9a'}] },
      { name: 'Browns', colours: [{n:'Caramel',h:'#c68642'},{n:'Chocolate',h:'#7b3f00'},{n:'Mocha',h:'#967969'},{n:'Walnut',h:'#773f1a'},{n:'Sienna',h:'#a0522d'}] },
      { name: 'Greys', colours: [{n:'Silver',h:'#c0c0c0'},{n:'Light Grey',h:'#d3d3d3'},{n:'Ash',h:'#b2beb5'},{n:'Slate',h:'#708090'},{n:'Charcoal',h:'#36454f'}] },
      { name: 'Blacks', colours: [{n:'Jet Black',h:'#343434'},{n:'Onyx',h:'#353839'},{n:'Matte Black',h:'#28282b'},{n:'Gunmetal',h:'#2c3539'},{n:'Midnight',h:'#191970'}] },
    ]
  },
  {
    name: 'Metallics & Sheens',
    subcategories: [
      { name: 'Silvers', colours: [{n:'Chrome',h:'#dde5ed'},{n:'Pewter',h:'#96a8a1'},{n:'Platinum',h:'#e5e4e2'},{n:'Antique Silver',h:'#9e9e9e'},{n:'Hematite',h:'#585860'}] },
      { name: 'Golds', colours: [{n:'Bright Gold',h:'#d4af37'},{n:'Rose Gold',h:'#b76e79'},{n:'Pale Gold',h:'#e6c76a'},{n:'Antique Gold',h:'#b8860b'},{n:'Copper',h:'#b87333'}] },
      { name: 'Special Finishes', colours: [{n:'Iridescent',h:'#a8c8e8'},{n:'Aurora',h:'#b0a0d0'},{n:'Oil Slick',h:'#4a4060'},{n:'Holographic',h:'#c0b8e0'},{n:'Galactic',h:'#6a5a8a'}] },
    ]
  },
]

const metalTones = [
  {name:'Sterling Silver',hex:'#a8b8c8',note:'Cool, versatile, suits blues and purples'},
  {name:'Fine Silver',hex:'#c0ccd8',note:'Brightest silver, good for delicate work'},
  {name:'Gold Filled',hex:'#c8a858',note:'Warm, lifts earthy and warm-toned beads'},
  {name:'Rose Gold Filled',hex:'#c89080',note:'Romantic, pairs with pinks and neutrals'},
  {name:'Oxidised Silver',hex:'#606870',note:'Dark, moody — makes colours pop dramatically'},
  {name:'Antique Brass',hex:'#907840',note:'Earthy, pairs with browns, oranges, greens'},
  {name:'Copper',hex:'#b06840',note:'Warm rustic feel, patinas beautifully over time'},
  {name:'Gunmetal',hex:'#2c3539',note:'Edgy, modern — suits dark and jewel tones'},
]

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

  function harmonyScore(): { score: string; note: string } {
    if (selected.length < 2) return { score:'—', note:'Select 2+ colours to see harmony rating' }
    const families = colourFamilies.filter(f=>
      f.subcategories.some(s=>s.colours.some(c=>selected.find(x=>x.n===c.n)))
    ).length
    if (families === 1) return { score:'Tonal', note:'Same family — cohesive and polished. Safe bet for elegant pieces.' }
    if (families === 2) return { score:'Complementary', note:'Two families — natural contrast without clashing.' }
    if (families === 3) return { score:'Triad', note:'Three families — works best with one dominant colour and two accents.' }
    return { score:'Complex', note:'Many families — bold choice. Anchor with one hero colour used most.' }
  }

  const harmony = harmonyScore()

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

          <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:24,alignItems:'start'}}>
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
