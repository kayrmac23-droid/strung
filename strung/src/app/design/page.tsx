'use client'
import { useState } from 'react'
import Nav from '@/components/Nav'

const types = ['Ring','Necklace / Pendant','Earrings','Bracelet','Brooch','Anklet','Set']
const skills = ['Beginner','Intermediate','Advanced']
const budgets = ['Under $20','$20–$50','$50–$100','$100–$200','No constraint']

interface Component { part:string; material:string; dimensions:string; note:string }
interface Brief { title:string; tagline:string; overview:string; components:Component[]; techniques:string[]; tools:string[]; difficulty:string; estimatedTime:string; costEstimate:string; steps:string[]; variations:string[]; tips:string[]; warnings:string[] }

export default function DesignPage() {
  const [description, setDescription] = useState('')
  const [type, setType] = useState('')
  const [skill, setSkill] = useState('Intermediate')
  const [budget, setBudget] = useState('')
  const [brief, setBrief] = useState<Brief|null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function generate() {
    if (!description.trim()||loading) return
    setLoading(true); setError(''); setBrief(null)
    try {
      const res = await fetch('/api/design', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ description, type, skill, budget }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setBrief(data)
    } catch(e:any) { setError(e.message||'Generation failed') }
    finally { setLoading(false) }
  }

  async function saveToJournal() {
    if (!brief) return
    try {
      await fetch('/api/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: brief.title,
          type: type || 'Piece',
          difficulty: brief.difficulty,
          source: 'design',
          blueprint: brief,
          status: 'saved',
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { alert('Failed to save') }
  }

  const arrow = <span style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)',pointerEvents:'none' as const,fontSize:12}}>▾</span>
  const diffColor = brief?.difficulty==='Beginner'?'var(--sage)':brief?.difficulty==='Advanced'?'var(--rose)':'var(--gold)'

  return (
    <>
      <Nav />
      <main style={{paddingTop:64,minHeight:'100vh'}}>
        <div style={{maxWidth:1100,margin:'0 auto',padding:'60px 40px 80px'}}>
          <header style={{marginBottom:40}}>
            <span className="tag fade-up">Design Lab</span>
            <h1 className="fade-up-1" style={{fontSize:48,color:'var(--cream)',margin:'12px 0 12px',fontFamily:'var(--font-display)',fontWeight:400}}>Design Brief Generator</h1>
            <p className="fade-up-2" style={{color:'var(--text2)',fontSize:18}}>Describe a piece in plain language — get back a full design brief with components, steps, and variations.</p>
          </header>

          <div className="card fade-up-2" style={{padding:32}}>
            <label className="label">Describe your piece</label>
            <textarea className="input-base" rows={3}
              placeholder="e.g. 'A delicate crescent moon pendant in sterling silver with a small moonstone' or 'Bold Art Deco earrings in brass and black onyx'"
              value={description} onChange={e=>setDescription(e.target.value)} />
            <div className="form-grid-3" style={{marginTop:20}}>
              {[['Piece type',type,setType,types,true],['Skill level',skill,setSkill,skills,false],['Budget (AUD)',budget,setBudget,budgets,true]].map(([label,val,setter,opts,hasEmpty]:any) => (
                <div key={label}>
                  <label className="label">{label}</label>
                  <div style={{position:'relative'}}>
                    <select className="select-base" value={val} onChange={e=>setter(e.target.value)}>
                      {hasEmpty && <option value="">Not specified</option>}
                      {opts.map((o:string) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    {arrow}
                  </div>
                </div>
              ))}
            </div>
            <button className="btn-gold" style={{marginTop:20}} onClick={generate} disabled={loading||!description.trim()}>
              {loading ? <><span className="spinner"/>Generating brief…</> : '◇ Generate Design Brief'}
            </button>
          </div>

          {error && <p style={{color:'var(--rose)',marginTop:16,fontFamily:'var(--font-mono)',fontSize:13}}>{error}</p>}

          {brief && (
            <div className="fade-up" style={{marginTop:48}}>
              <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderTop:'3px solid var(--gold)',padding:'36px',marginBottom:20}}>
                <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
                  <span className="tag">{brief.difficulty}</span>
                  <span className="tag">{brief.estimatedTime}</span>
                  <span className="tag">{brief.costEstimate}</span>
                </div>
                <h2 style={{fontSize:36,color:'var(--cream)',marginBottom:8,fontFamily:'var(--font-display)',fontWeight:400}}>{brief.title}</h2>
                <p style={{fontStyle:'italic',color:'var(--gold2)',fontSize:19}}>{brief.tagline}</p>
                <p style={{color:'var(--text2)',marginTop:14,fontSize:16,lineHeight:1.7}}>{brief.overview}</p>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:16,marginBottom:16}}>
                <div className="card" style={{padding:28}}>
                  <h3 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:400,color:'var(--cream)',marginBottom:16}}>◈ Components</h3>
                  {brief.components.map((c,i) => (
                    <div key={i} style={{display:'flex',gap:14,marginBottom:16,alignItems:'flex-start'}}>
                      <div style={{width:28,height:28,background:'var(--surface2)',border:'1px solid var(--border2)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-mono)',fontSize:11,color:'var(--gold)',flexShrink:0}}>{i+1}</div>
                      <div>
                        <p style={{color:'var(--cream)',fontFamily:'var(--font-display)',fontSize:16}}>{c.part}</p>
                        <p className="mono" style={{fontSize:11,color:'var(--gold)',letterSpacing:'0.06em'}}>{c.material} · {c.dimensions}</p>
                        <p style={{fontSize:13,color:'var(--muted)',marginTop:4}}>{c.note}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="card" style={{padding:28}}>
                  <h3 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:400,color:'var(--cream)',marginBottom:16}}>◉ Build Steps</h3>
                  <ol style={{listStyle:'none'}}>
                    {brief.steps.map((s,i) => (
                      <li key={i} style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:12}}>
                        <span style={{width:24,height:24,background:'var(--gold)',color:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-mono)',fontSize:11,flexShrink:0,marginTop:2}}>{i+1}</span>
                        <span style={{color:'var(--text2)',fontSize:15,lineHeight:1.5}}>{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                <div className="card" style={{padding:28}}>
                  <h3 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:400,color:'var(--cream)',marginBottom:12}}>◇ Techniques</h3>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:20}}>
                    {brief.techniques.map(t => <span key={t} className="tag">{t}</span>)}
                  </div>
                  <h3 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:400,color:'var(--cream)',marginBottom:12}}>⊡ Tools Needed</h3>
                  <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                    {brief.tools.map(t => <span key={t} className="tag">{t}</span>)}
                  </div>
                </div>

                <div className="card" style={{padding:28}}>
                  <h3 style={{fontFamily:'var(--font-display)',fontSize:20,fontWeight:400,color:'var(--cream)',marginBottom:12}}>◎ Variations</h3>
                  <ul style={{listStyle:'none'}}>
                    {brief.variations.map((v,i) => (
                      <li key={i} style={{fontSize:15,color:'var(--text2)',paddingLeft:16,borderLeft:'2px solid var(--emerald)',marginBottom:10}}>{v}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                <div style={{background:'rgba(201,168,76,0.05)',border:'1px solid rgba(201,168,76,0.2)',padding:'20px 24px'}}>
                  <span className="mono" style={{fontSize:11,letterSpacing:'0.1em',color:'var(--gold)'}}>PRO TIPS</span>
                  <ul style={{listStyle:'none',marginTop:10}}>
                    {brief.tips.map((t,i) => <li key={i} style={{fontSize:14,color:'var(--text2)',marginBottom:8}}>◂ {t}</li>)}
                  </ul>
                </div>
                <div style={{background:'rgba(200,112,112,0.05)',border:'1px solid rgba(200,112,112,0.2)',padding:'20px 24px'}}>
                  <span className="mono" style={{fontSize:11,letterSpacing:'0.1em',color:'var(--rose)'}}>WATCH OUT</span>
                  <ul style={{listStyle:'none',marginTop:10}}>
                    {brief.warnings.map((w,i) => <li key={i} style={{fontSize:14,color:'var(--text2)',marginBottom:8}}>⚠ {w}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
