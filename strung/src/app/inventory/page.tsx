'use client'
import { useState, useEffect, useCallback } from 'react'
import Nav from '@/components/Nav'
import type { BeadItem, FindingItem } from '@/lib/supabase'

const beadTypes = ['gemstone','crystal','glass','seed','metal','pearl','other']
const findingTypes = ['ear_wire','head_pin','eye_pin','jump_ring','clasp','chain','wire','crimp','connector','other']
const metals = ['silver','gold_filled','gold','copper','brass','oxidised','other']
const shapes = ['round','rondelle','briolette','teardrop','faceted','chip','tube','oval','square','other']

const typeColours: Record<string, string> = {
  gemstone:'var(--moonstone)',crystal:'var(--amethyst)',glass:'var(--sage)',
  seed:'var(--silver)',metal:'var(--steel2)',pearl:'#c8b8a8',other:'var(--muted)'
}

export default function InventoryPage() {
  const [tab, setTab] = useState<'beads'|'findings'>('beads')
  const [beads, setBeads] = useState<BeadItem[]>([])
  const [findings, setFindings] = useState<FindingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string|null>(null)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')

  const beadSizes = ['seed','small','medium','big','statement']
  const [beadForm, setBeadForm] = useState<Partial<BeadItem>>({ type:'gemstone', size:'small', quantity:1, hex:'#7a9ab8' })
  const [findingForm, setFindingForm] = useState<Partial<FindingItem>>({ type:'ear_wire', metal:'silver', quantity:2 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory')
      const data = await res.json()
      setBeads(data.beads || [])
      setFindings(data.findings || [])
    } catch { console.error('Failed to load') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function saveItem() {
    setSaving(true)
    try {
      const data = tab === 'beads' ? beadForm : findingForm
      await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: tab, data }),
      })
      await load()
      setShowForm(false)
      setBeadForm({ type:'gemstone', size:'small', quantity:1, hex:'#7a9ab8' })
      setFindingForm({ type:'ear_wire', metal:'silver', quantity:2 })
    } catch { alert('Failed to save') }
    finally { setSaving(false) }
  }

  async function deleteItem(id: string) {
    setDeletingId(id)
    try {
      await fetch(`/api/inventory?table=${tab}&id=${id}`, { method: 'DELETE' })
      await load()
    } catch { alert('Failed to delete') }
    finally { setDeletingId(null) }
  }

  const filteredBeads = beads.filter(b => {
    const matchSearch = !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.colour.toLowerCase().includes(search.toLowerCase())
    const matchType = !filterType || b.type === filterType
    return matchSearch && matchType
  })

  const filteredFindings = findings.filter(f => {
    const matchSearch = !search || f.name.toLowerCase().includes(search.toLowerCase())
    const matchType = !filterType || f.type === filterType
    return matchSearch && matchType
  })

  const arrow = <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',color:'var(--muted)',pointerEvents:'none' as const,fontSize:11}}>▾</span>

  return (
    <>
      <Nav />
      <main style={{paddingTop:60,minHeight:'100vh'}}>
        <div style={{maxWidth:1100,margin:'0 auto',padding:'52px 40px 80px'}}>
          <header style={{marginBottom:40}}>
            <p className="section-eyebrow fade-up">Inventory</p>
            <h1 className="fade-up-1" style={{fontSize:44,color:'var(--cream)',fontFamily:'var(--font-display)',fontWeight:400,margin:'8px 0 10px'}}>My Stash</h1>
            <p className="fade-up-2" style={{color:'var(--text2)',fontSize:17}}>Log your beads and findings. The AI reads this to generate designs from what you actually own.</p>
          </header>

          {/* Stats */}
          <div className="fade-up-2" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:2,marginBottom:32}}>
            {[
              ['Total Beads',beads.length,'◈'],
              ['Total Findings',findings.length,'◉'],
              ['Bead Types',[...new Set(beads.map(b=>b.type))].length,'◇'],
              ['Total Pieces',beads.reduce((a,b)=>a+b.quantity,0)+findings.reduce((a,f)=>a+f.quantity,0),'◎'],
            ].map(([label,val,icon]) => (
              <div key={String(label)} className="card" style={{padding:'20px 24px'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:8}}>{String(icon)} {String(label)}</div>
                <div style={{fontFamily:'var(--font-display)',fontSize:32,color:'var(--silver2)'}}>{String(val)}</div>
              </div>
            ))}
          </div>

          {/* Controls */}
          <div style={{display:'flex',gap:12,marginBottom:24,alignItems:'center',flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:0}}>
              {(['beads','findings'] as const).map(t => (
                <button key={t} onClick={()=>{setTab(t);setFilterType('');setSearch('')}} style={{
                  padding:'9px 20px',fontFamily:'var(--font-mono)',fontSize:11,
                  letterSpacing:'0.12em',textTransform:'uppercase',
                  background:tab===t?'var(--surface2)':'var(--surface)',
                  border:`1px solid ${tab===t?'var(--silver)':'var(--border)'}`,
                  color:tab===t?'var(--silver2)':'var(--muted)',cursor:'pointer',transition:'all 0.15s'
                }}>{t}</button>
              ))}
            </div>
            <input className="input-base" style={{flex:1,maxWidth:260}}
              placeholder={`Search ${tab}…`} value={search} onChange={e=>setSearch(e.target.value)} />
            <div style={{position:'relative',minWidth:160}}>
              <select className="select-base" value={filterType} onChange={e=>setFilterType(e.target.value)}>
                <option value="">All types</option>
                {(tab==='beads'?beadTypes:findingTypes).map(t => <option key={t} value={t}>{t.replace('_',' ')}</option>)}
              </select>
              {arrow}
            </div>
            <button className="btn-silver" onClick={()=>setShowForm(true)}>+ Add {tab==='beads'?'Bead':'Finding'}</button>
          </div>

          {/* Add form */}
          {showForm && (
            <div className="card fade-up" style={{padding:28,marginBottom:24,border:'1px solid var(--silver)',position:'relative'}}>
              <button onClick={()=>setShowForm(false)} style={{position:'absolute',top:16,right:16,background:'none',border:'none',color:'var(--muted)',fontSize:18,cursor:'pointer'}}>×</button>
              <h3 style={{fontFamily:'var(--font-display)',fontSize:20,color:'var(--cream)',marginBottom:20}}>Add {tab==='beads'?'Bead':'Finding'}</h3>
              {tab==='beads' ? (
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
                  <div style={{gridColumn:'1/-1'}}>
                    <label className="label">Name / Description</label>
                    <input className="input-base" placeholder="e.g. Labradorite teardrop briolette"
                      value={beadForm.name||''} onChange={e=>setBeadForm(f=>({...f,name:e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Type</label>
                    <div style={{position:'relative'}}><select className="select-base" value={beadForm.type} onChange={e=>setBeadForm(f=>({...f,type:e.target.value as any}))}>
                      {beadTypes.map(t=><option key={t} value={t}>{t}</option>)}
                    </select>{arrow}</div>
                  </div>
                  <div>
                    <label className="label">Shape</label>
                    <div style={{position:'relative'}}><select className="select-base" value={beadForm.shape||''} onChange={e=>setBeadForm(f=>({...f,shape:e.target.value}))}>
                      <option value="">Select shape</option>
                      {shapes.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>{arrow}</div>
                  </div>
                  <div>
                    <label className="label">Colour Name</label>
                    <input className="input-base" placeholder="e.g. Steel blue"
                      value={beadForm.colour||''} onChange={e=>setBeadForm(f=>({...f,colour:e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Colour (pick)</label>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <input type="color" value={beadForm.hex||'#7a9ab8'} onChange={e=>setBeadForm(f=>({...f,hex:e.target.value}))}
                        style={{width:44,height:36,border:'1px solid var(--border)',background:'none',cursor:'pointer',padding:2}} />
                      <span className="mono" style={{fontSize:11,color:'var(--muted)'}}>{beadForm.hex}</span>
                    </div>
                  </div>
                  <div>
                    <label className="label">Size</label>
                    <div style={{position:'relative'}}><select className="select-base" value={beadForm.size||'small'} onChange={e=>setBeadForm(f=>({...f,size:e.target.value}))}>
                      {beadSizes.map(s=><option key={s} value={s}>{s}</option>)}
                    </select>{arrow}</div>
                  </div>
                  <div>
                    <label className="label">Quantity</label>
                    <input className="input-base" type="number" min={1} value={beadForm.quantity||1}
                      onChange={e=>setBeadForm(f=>({...f,quantity:Number(e.target.value)}))} />
                  </div>
                  <div style={{gridColumn:'1/-1'}}>
                    <label className="label">Notes (optional)</label>
                    <input className="input-base" placeholder="e.g. From Beadistry Supply Co, bought Nov 2024"
                      value={beadForm.notes||''} onChange={e=>setBeadForm(f=>({...f,notes:e.target.value}))} />
                  </div>
                </div>
              ) : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
                  <div style={{gridColumn:'1/-1'}}>
                    <label className="label">Name / Description</label>
                    <input className="input-base" placeholder="e.g. 20mm silver hoop ear wire"
                      value={findingForm.name||''} onChange={e=>setFindingForm(f=>({...f,name:e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Type</label>
                    <div style={{position:'relative'}}><select className="select-base" value={findingForm.type} onChange={e=>setFindingForm(f=>({...f,type:e.target.value as any}))}>
                      {findingTypes.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                    </select>{arrow}</div>
                  </div>
                  <div>
                    <label className="label">Metal</label>
                    <div style={{position:'relative'}}><select className="select-base" value={findingForm.metal} onChange={e=>setFindingForm(f=>({...f,metal:e.target.value as any}))}>
                      {metals.map(m=><option key={m} value={m}>{m.replace('_',' ')}</option>)}
                    </select>{arrow}</div>
                  </div>
                  <div>
                    <label className="label">Size / Gauge</label>
                    <input className="input-base" placeholder="e.g. 21g, 6mm, 0.8mm"
                      value={findingForm.size||''} onChange={e=>setFindingForm(f=>({...f,size:e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Quantity</label>
                    <input className="input-base" type="number" min={1} value={findingForm.quantity||1}
                      onChange={e=>setFindingForm(f=>({...f,quantity:Number(e.target.value)}))} />
                  </div>
                  <div style={{gridColumn:'1/-1'}}>
                    <label className="label">Notes (optional)</label>
                    <input className="input-base" placeholder="e.g. Sterling silver, bought from Etsy"
                      value={findingForm.notes||''} onChange={e=>setFindingForm(f=>({...f,notes:e.target.value}))} />
                  </div>
                </div>
              )}
              <div style={{display:'flex',gap:10,marginTop:20}}>
                <button className="btn-silver" onClick={saveItem} disabled={saving}>
                  {saving?<><span className="spinner"/>Saving…</>:'Save to Stash'}
                </button>
                <button className="btn-outline" onClick={()=>setShowForm(false)}>Cancel</button>
              </div>
            </div>
          )}

          {/* Items list */}
          {loading ? (
            <div style={{display:'flex',justifyContent:'center',padding:60}}>
              <span className="spinner-dark"/>
            </div>
          ) : tab==='beads' ? (
            filteredBeads.length === 0 ? (
              <div style={{textAlign:'center',padding:'60px 20px',border:'1px dashed var(--border)',color:'var(--muted)'}}>
                <div style={{fontSize:40,marginBottom:12,animation:'shimmer 3s ease-in-out infinite'}}>◈</div>
                <p style={{fontFamily:'var(--font-body)',fontSize:16}}>{search||filterType?'No beads match your filter.':'No beads yet. Add your first bead to get started.'}</p>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:2}}>
                {filteredBeads.map(b => (
                  <div key={b.id} className="card" style={{padding:'20px 22px',position:'relative'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:10}}>
                      <div style={{width:32,height:32,borderRadius:'50%',background:b.hex,border:'1px solid rgba(255,255,255,0.1)',flexShrink:0,position:'relative'}}>
                        <div style={{position:'absolute',top:4,left:5,width:6,height:6,background:'rgba(255,255,255,0.3)',borderRadius:'50%',filter:'blur(1px)'}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontFamily:'var(--font-display)',fontSize:16,color:'var(--cream)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.name}</p>
                        <p style={{fontFamily:'var(--font-mono)',fontSize:10,color:typeColours[b.type]||'var(--muted)',letterSpacing:'0.08em'}}>{b.type}{b.shape?` · ${b.shape}`:''}</p>
                      </div>
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                      <span className="tag">{b.colour}</span>
                      <span className="tag">{b.size}</span>
                      <span className="tag">qty: {b.quantity}</span>
                    </div>
                    {b.notes && <p style={{fontSize:13,color:'var(--muted)',marginBottom:10,lineHeight:1.4}}>{b.notes}</p>}
                    <button onClick={()=>deleteItem(b.id!)} disabled={deletingId===b.id} style={{
                      background:'none',border:'none',color:'var(--muted2)',fontSize:12,
                      fontFamily:'var(--font-mono)',cursor:'pointer',letterSpacing:'0.08em',
                      transition:'color 0.15s',padding:0
                    }}
                    onMouseEnter={e=>e.currentTarget.style.color='var(--rose)'}
                    onMouseLeave={e=>e.currentTarget.style.color='var(--muted2)'}>
                      {deletingId===b.id?'removing…':'× remove'}
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredFindings.length === 0 ? (
              <div style={{textAlign:'center',padding:'60px 20px',border:'1px dashed var(--border)',color:'var(--muted)'}}>
                <div style={{fontSize:40,marginBottom:12,animation:'shimmer 3s ease-in-out infinite'}}>◉</div>
                <p style={{fontFamily:'var(--font-body)',fontSize:16}}>{search||filterType?'No findings match your filter.':'No findings yet. Add your clasps, ear wires, and pins.'}</p>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:2}}>
                {filteredFindings.map(f => (
                  <div key={f.id} className="card" style={{padding:'20px 22px'}}>
                    <div style={{marginBottom:10}}>
                      <p style={{fontFamily:'var(--font-display)',fontSize:16,color:'var(--cream)'}}>{f.name}</p>
                      <p style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--steel2)',letterSpacing:'0.08em',marginTop:2}}>{f.type.replace('_',' ')} · {f.metal.replace('_',' ')}</p>
                    </div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                      {f.size && <span className="tag">{f.size}</span>}
                      <span className="tag">qty: {f.quantity}</span>
                    </div>
                    {f.notes && <p style={{fontSize:13,color:'var(--muted)',marginBottom:10,lineHeight:1.4}}>{f.notes}</p>}
                    <button onClick={()=>deleteItem(f.id!)} disabled={deletingId===f.id} style={{
                      background:'none',border:'none',color:'var(--muted2)',fontSize:12,
                      fontFamily:'var(--font-mono)',cursor:'pointer',letterSpacing:'0.08em',
                      transition:'color 0.15s',padding:0
                    }}
                    onMouseEnter={e=>e.currentTarget.style.color='var(--rose)'}
                    onMouseLeave={e=>e.currentTarget.style.color='var(--muted2)'}>
                      {deletingId===f.id?'removing…':'× remove'}
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </main>
    </>
  )
}
