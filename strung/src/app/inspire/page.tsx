'use client'
import { useState, useEffect } from 'react'
import Nav from '@/components/Nav'

const moods = ['Dark & moody','Ethereal & dreamy','Earthy & rustic','Bold & dramatic','Delicate & feminine','Celestial & mystical','Coastal & breezy','Rich & opulent']
const pieceTypes = ['Any','Earrings','Necklace','Bracelet','Anklet','Set']

interface LayoutStep { step: number; component: string; material: string; technique: string; note?: string }
interface Blueprint {
  title: string; type: string; difficulty: string; time: string; vibe: string;
  description: string; colourStory: string; layout: LayoutStep[];
  findingsNeeded: string[]; techniques: string[]; warnings?: string
}

function visualiseUrl(bp: Blueprint): string {
  const prompt = [bp.title, bp.type, 'beaded jewellery', bp.colourStory, bp.vibe, 'professional jewellery photography, studio lighting, white background, elegant, detailed macro'].join(', ')
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true`
}

export default function InspirePage() {
  const [freeMode, setFreeMode] = useState(false)
  const [beads, setBeads] = useState<any[]>([])
  const [findings, setFindings] = useState<any[]>([])
  const [stashLoaded, setStashLoaded] = useState(false)
  const [mood, setMood] = useState('')
  const [pieceType, setPieceType] = useState('')
  const [notes, setNotes] = useState('')
  const [blueprints, setBlueprints] = useState<Blueprint[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const [error, setError] = useState('')
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set())
  const [bpImages, setBpImages] = useState<Record<number,string>>({})
  const [loadingImageIdx, setLoadingImageIdx] = useState<number|null>(null)

  useEffect(() => {
    fetch('/api/inventory').then(r=>r.json()).then(d=>{
      setBeads(d.beads||[])
      setFindings(d.findings||[])
      setStashLoaded(true)
    }).catch(() => setStashLoaded(true))
  }, [])

  async function generate() {
    if (loading) return
    setLoading(true); setError(''); setBlueprints([]); setBpImages({})
    try {
      const res = await fetch('/api/blueprints', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ beads, findings, mood, pieceType: pieceType==='Any'?'':pieceType, notes, freeMode }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBlueprints(data.blueprints || [])
      setActive(0)
    } catch(e:any) { setError(e.message||'Generation failed') }
    finally { setLoading(false) }
  }

  function visualise(idx: number) {
    if (bpImages[idx]) return
    const url = visualiseUrl(blueprints[idx])
    setLoadingImageIdx(idx)
    setBpImages(prev => ({ ...prev, [idx]: url }))
  }

  async function saveToJournal(bp: Blueprint, idx: number) {
    try {
      const res = await fetch('/api/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: bp.title, type: bp.type, difficulty: bp.difficulty, source: 'inspire', blueprint: bp, status: 'saved' }),
      })
      if (res.ok) setSavedSet(s => new Set([...s, idx]))
    } catch {}
  }

  const diffColor = (d:string) => d==='Beginner'?'var(--sage)':d==='Advanced'?'var(--rose)':'var(--moonstone)'
  const arrow = <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'var(--muted)',pointerEvents:'none' as const,fontSize:11}}>▾</span>

  return (
    <>
      <Nav />
      <main style={{paddingTop:60,minHeight:'100vh'}}>
        <div style={{maxWidth:1100,margin:'0 auto',padding:'52px 40px 80px'}}>
          <header style={{marginBottom:40}}>
            <p className="section-eyebrow fade-up">Blueprint Generator</p>
            <h1 className="fade-up-1" style={{fontSize:44,color:'var(--cream)',fontFamily:'var(--font-display)',fontWeight:400,margin:'8px 0 10px'}}>Inspire Me</h1>
            <p className="fade-up-2" style={{color:'var(--text2)',fontSize:17}}>Tell the AI what you&apos;re feeling. Get three distinct jewellery blueprints — from your stash or dreamed up fresh.</p>
          </header>

          {/* Mode toggle */}
          <div className="fade-up-2" style={{display:'flex',gap:0,marginBottom:20}}>
            {([['◈ From my stash', false],['◇ Any materials', true]] as const).map(([label, mode]) => (
              <button key={String(mode)} onClick={()=>setFreeMode(mode)} style={{
                padding:'10px 22px',fontFamily:'var(--font-mono)',fontSize:11,
                letterSpacing:'0.12em',textTransform:'uppercase',
                background:freeMode===mode?'var(--surface2)':'var(--surface)',
                border:`1px solid ${freeMode===mode?'var(--silver)':'var(--border)'}`,
                color:freeMode===mode?'var(--silver2)':'var(--muted)',
                cursor:'pointer',transition:'all 0.15s'
              }}>{label}</button>
            ))}
          </div>

          {/* Stash status — only shown in stash mode */}
          {!freeMode && stashLoaded && (
            <div className="fade-up-2" style={{
              display:'flex',gap:20,padding:'14px 20px',
              background:'var(--surface)',border:'1px solid var(--border)',
              marginBottom:24,alignItems:'center',flexWrap:'wrap'
            }}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:beads.length>0?'var(--sage)':'var(--rose)'}}/>
                <span className="mono" style={{fontSize:11,color:'var(--text2)',letterSpacing:'0.08em'}}>{beads.length} beads in stash</span>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:findings.length>0?'var(--sage)':'var(--rose)'}}/>
                <span className="mono" style={{fontSize:11,color:'var(--text2)',letterSpacing:'0.08em'}}>{findings.length} findings in stash</span>
              </div>
              {(beads.length===0||findings.length===0) && (
                <span style={{fontSize:14,color:'var(--muted)',fontFamily:'var(--font-body)'}}>
                  {beads.length===0&&findings.length===0?'Add beads and findings to your stash for personalised blueprints. AI will still generate ideas based on your preferences.':
                   beads.length===0?'Add beads to your stash for bead-specific blueprints.':
                   'Add findings (ear wires, pins, clasps) for complete blueprints.'}
                </span>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="card fade-up-2" style={{padding:28,marginBottom:32}}>
            <div className="form-grid-3" style={{marginBottom:20}}>
              <div>
                <label className="label">Mood / Vibe</label>
                <div style={{position:'relative'}}>
                  <select className="select-base" value={mood} onChange={e=>setMood(e.target.value)}>
                    <option value="">Any mood</option>
                    {moods.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>{arrow}
                </div>
              </div>
              <div>
                <label className="label">Piece Type</label>
                <div style={{position:'relative'}}>
                  <select className="select-base" value={pieceType} onChange={e=>setPieceType(e.target.value)}>
                    {pieceTypes.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>{arrow}
                </div>
              </div>
              <div>
                <label className="label">Anything else?</label>
                <input className="input-base" placeholder="e.g. 'something I can wear daily' or 'for a gift'"
                  value={notes} onChange={e=>setNotes(e.target.value)} />
              </div>
            </div>
            <button className="btn-silver" onClick={generate} disabled={loading} style={{width:'100%',justifyContent:'center',padding:'14px'}}>
              {loading
                ? <><span className="spinner"/>{freeMode ? 'Dreaming up blueprints…' : 'Reading your stash & generating blueprints…'}</>
                : '◉ Generate 3 Blueprints'}
            </button>
          </div>

          {error && <p style={{color:'var(--rose)',fontFamily:'var(--font-mono)',fontSize:13,marginBottom:20}}>{error}</p>}

          {blueprints.length > 0 && (
            <div className="fade-up">
              {/* Blueprint tabs */}
              <div style={{display:'flex',gap:2,marginBottom:20}}>
                {blueprints.map((b,i) => (
                  <button key={i} onClick={()=>setActive(i)} style={{
                    flex:1,padding:'14px 16px',textAlign:'left',
                    background:active===i?'var(--surface2)':'var(--surface)',
                    border:`1px solid ${active===i?'var(--silver)':'var(--border)'}`,
                    cursor:'pointer',transition:'all 0.15s'
                  }}>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:9,letterSpacing:'0.16em',textTransform:'uppercase',color:'var(--muted)',marginBottom:4}}>Blueprint {i+1}</div>
                    <div style={{fontFamily:'var(--font-display)',fontSize:17,color:'var(--cream)'}}>{b.title}</div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text2)',marginTop:4}}>{b.type} · {b.vibe}</div>
                  </button>
                ))}
              </div>

              {/* Active blueprint */}
              {blueprints[active] && (() => {
                const bp = blueprints[active]
                const imgUrl = bpImages[active]
                const imgLoading = loadingImageIdx === active
                return (
                  <div>
                    {/* Header */}
                    <div className="card" style={{padding:32,marginBottom:16,borderTop:`2px solid var(--silver)`}}>
                      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
                        <span className="tag">{bp.type}</span>
                        <span className="tag" style={{borderColor:diffColor(bp.difficulty),color:diffColor(bp.difficulty)}}>{bp.difficulty}</span>
                        <span className="tag">{bp.time}</span>
                      </div>
                      <h2 style={{fontSize:34,color:'var(--cream)',fontFamily:'var(--font-display)',fontWeight:400,marginBottom:8}}>{bp.title}</h2>
                      <p style={{fontStyle:'italic',color:'var(--silver2)',fontSize:18,marginBottom:14}}>{bp.vibe}</p>
                      <p style={{color:'var(--text2)',fontSize:16,lineHeight:1.7,marginBottom:14}}>{bp.description}</p>
                      <div style={{background:'var(--bg2)',border:'1px solid var(--border)',padding:'14px 18px',marginBottom:20}}>
                        <span className="mono" style={{fontSize:10,letterSpacing:'0.12em',color:'var(--moonstone)'}}>COLOUR STORY</span>
                        <p style={{color:'var(--text)',fontSize:15,marginTop:6,lineHeight:1.6}}>{bp.colourStory}</p>
                      </div>

                      {/* Image visualisation */}
                      {imgUrl && (
                        <div style={{marginBottom:20,position:'relative'}}>
                          {imgLoading && (
                            <div style={{
                              position:'absolute',inset:0,display:'flex',flexDirection:'column',
                              alignItems:'center',justifyContent:'center',gap:12,
                              background:'var(--surface)',border:'1px solid var(--border)',minHeight:200
                            }}>
                              <span className="spinner-dark"/>
                              <span className="mono" style={{fontSize:10,color:'var(--muted)',letterSpacing:'0.1em'}}>Generating image…</span>
                            </div>
                          )}
                          <img
                            src={imgUrl}
                            alt={bp.title}
                            onLoad={() => setLoadingImageIdx(null)}
                            style={{
                              width:'100%',maxHeight:480,objectFit:'cover',
                              display:imgLoading?'none':'block',
                              border:'1px solid var(--border)'
                            }}
                          />
                        </div>
                      )}

                      <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
                        <button
                          className={savedSet.has(active) ? 'btn-outline' : 'btn-silver'}
                          onClick={() => saveToJournal(bp, active)}
                          disabled={savedSet.has(active)}
                        >
                          {savedSet.has(active) ? '✓ Saved to Journal' : '⊡ Save to Journal'}
                        </button>
                        <button
                          className="btn-outline"
                          onClick={() => visualise(active)}
                          disabled={!!imgUrl}
                        >
                          {imgLoading ? <><span className="spinner-dark"/>Generating…</> : imgUrl ? '◎ Image ready' : '◎ Visualise'}
                        </button>
                      </div>
                    </div>

                    <div className="blueprint-grid" style={{marginBottom:16}}>
                      {/* Build steps */}
                      <div className="card" style={{padding:28}}>
                        <h3 style={{fontFamily:'var(--font-display)',fontSize:22,fontWeight:400,color:'var(--cream)',marginBottom:18}}>◈ Build Steps</h3>
                        <div style={{display:'flex',flexDirection:'column',gap:14}}>
                          {bp.layout.map((step,i) => (
                            <div key={i} style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                              <div style={{
                                width:26,height:26,background:'var(--surface2)',
                                border:'1px solid var(--border2)',
                                display:'flex',alignItems:'center',justifyContent:'center',
                                fontFamily:'var(--font-mono)',fontSize:11,
                                color:'var(--silver)',flexShrink:0
                              }}>{step.step}</div>
                              <div>
                                <p style={{color:'var(--cream)',fontFamily:'var(--font-display)',fontSize:15}}>{step.component}</p>
                                <p className="mono" style={{fontSize:10,color:'var(--moonstone)',letterSpacing:'0.06em',marginTop:2}}>{step.material}</p>
                                <p style={{fontSize:13,color:'var(--text2)',marginTop:3,lineHeight:1.4}}>{step.technique}</p>
                                {step.note && <p style={{fontSize:12,color:'var(--muted)',marginTop:3,fontStyle:'italic'}}>{step.note}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div style={{display:'flex',flexDirection:'column',gap:16}}>
                        {/* Findings needed */}
                        <div className="card" style={{padding:24}}>
                          <h3 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:400,color:'var(--cream)',marginBottom:12}}>◉ Findings Needed</h3>
                          <ul style={{listStyle:'none'}}>
                            {bp.findingsNeeded.map((f,i) => (
                              <li key={i} style={{fontSize:14,color:'var(--text2)',paddingLeft:14,borderLeft:'2px solid var(--steel2)',marginBottom:8}}>{f}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Techniques */}
                        <div className="card" style={{padding:24}}>
                          <h3 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:400,color:'var(--cream)',marginBottom:12}}>◇ Techniques</h3>
                          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                            {bp.techniques.map(t => <span key={t} className="tag">{t}</span>)}
                          </div>
                        </div>

                        {/* Warning */}
                        {bp.warnings && (
                          <div style={{background:'rgba(196,112,112,0.06)',border:'1px solid rgba(196,112,112,0.2)',padding:'16px 20px'}}>
                            <span className="mono" style={{fontSize:10,letterSpacing:'0.12em',color:'var(--rose)'}}>WATCH OUT</span>
                            <p style={{fontSize:14,color:'var(--text2)',marginTop:8}}>{bp.warnings}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
