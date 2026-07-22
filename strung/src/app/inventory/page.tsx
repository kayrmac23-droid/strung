'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import StrandLoader from '@/components/StrandLoader'
import StrandEmpty from '@/components/StrandEmpty'
import type { BeadItem, FindingItem } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/authClient'
import { prepareImageForIdentify } from '@/lib/imagePrep'
import type { Confidence } from '@/lib/stashItems'
import { beadColours, typeColours } from '@/lib/stash-colours'

type ReviewBead = BeadItem & { confidence?: Confidence }
type ReviewFinding = FindingItem & { confidence?: Confidence }

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1,3),16)/255
  const g = parseInt(hex.slice(3,5),16)/255
  const b = parseInt(hex.slice(5,7),16)/255
  const max = Math.max(r,g,b), min = Math.min(r,g,b)
  let h = 0, s = 0
  const l = (max+min)/2
  if (max !== min) {
    const d = max-min
    s = l > 0.5 ? d/(2-max-min) : d/(max+min)
    switch(max) {
      case r: h = ((g-b)/d + (g<b?6:0))/6; break
      case g: h = ((b-r)/d + 2)/6; break
      case b: h = ((r-g)/d + 4)/6; break
    }
  }
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)]
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1-l)
  const f = (n: number) => {
    const k = (n + h/30) % 12
    const c = l - a * Math.max(Math.min(k-3, 9-k, 1), -1)
    return Math.round(255*c).toString(16).padStart(2,'0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const beadTypes: BeadItem['type'][] = ['gemstone','crystal','glass','seed','metal','pearl','resin','other']
const findingTypes: FindingItem['type'][] = ['statement_component','ear_wire','head_pin','eye_pin','jump_ring','clasp','chain','wire','crimp','connector','other']
const metals: FindingItem['metal'][] = ['silver','gold_filled','gold','copper','brass','oxidised','other']
const shapes = ['round','rondelle','briolette','teardrop','faceted','chip','tube','oval','square','other']

export default function InventoryPage() {
  const [tab, setTab] = useState<'beads'|'findings'>('beads')
  const [beads, setBeads] = useState<BeadItem[]>([])
  const [findings, setFindings] = useState<FindingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string|null>(null)
  const [confirmingId, setConfirmingId] = useState<string|null>(null)
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editForm, setEditForm] = useState<Partial<BeadItem|FindingItem>>({})
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [saveError, setSaveError] = useState('')
  const [aiPrefilled, setAiPrefilled] = useState(false)
  const multiFileInputRef = useRef<HTMLInputElement>(null)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickAddSource, setQuickAddSource] = useState<'text' | 'photo'>('text')
  const [quickText, setQuickText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [identifyingMulti, setIdentifyingMulti] = useState(false)
  const [identifyMultiError, setIdentifyMultiError] = useState('')
  const [reviewBeads, setReviewBeads] = useState<ReviewBead[]>([])
  const [reviewFindings, setReviewFindings] = useState<ReviewFinding[]>([])
  const [savingAll, setSavingAll] = useState(false)
  const [signedOut, setSignedOut] = useState(false)

  const beadSizes = ['seed','small','medium','large','statement']
  const [beadForm, setBeadForm] = useState<Partial<BeadItem>>({ type:'gemstone', size:'small', quantity:1, hex:'#7a9ab8' })
  const [findingForm, setFindingForm] = useState<Partial<FindingItem>>({ type:'ear_wire', metal:'silver', quantity:2 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory', { headers: await getAuthHeaders() })
      if (res.status === 401) {
        setSignedOut(true)
        setBeads([])
        setFindings([])
        return
      }
      setSignedOut(false)
      const data = await res.json()
      setBeads(data.beads || [])
      setFindings(data.findings || [])
    } catch { console.error('Failed to load') }
    finally { setLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function saveItem() {
    const form = tab === 'beads' ? beadForm : findingForm
    if (!form.name?.trim()) { setSaveError('Name is required.'); return }
    setSaving(true); setSaveError('')
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ table: tab, data: form }),
      })
      const result = await res.json()
      if (!res.ok || result.error) throw new Error(result.error || `Save failed (${res.status})`)
      await load()
      setShowForm(false)
      setAiPrefilled(false)
      setBeadForm({ type:'gemstone', size:'small', quantity:1, hex:'#7a9ab8' })
      setFindingForm({ type:'ear_wire', metal:'silver', quantity:2 })
    } catch (e: unknown) { setSaveError(getErrorMessage(e, 'Save failed')) }
    finally { setSaving(false) }
  }

  async function deleteItem(id: string) {
    setConfirmingId(null)
    setDeletingId(id)
    try {
      const res = await fetch(`/api/inventory?table=${tab}&id=${id}`, { method: 'DELETE', headers: await getAuthHeaders() })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Delete failed') }
      await load()
    } catch (e: unknown) { alert(getErrorMessage(e, 'Failed to delete')) }
    finally { setDeletingId(null) }
  }

  async function editItem(id: string) {
    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ table: tab, id, data: editForm }),
      })
      const result = await res.json()
      if (!res.ok || result.error) throw new Error(result.error || 'Update failed')
      await load()
      setEditingId(null)
      setEditForm({})
    } catch (e: unknown) { alert(getErrorMessage(e, 'Failed to update')) }
  }

  async function identifyMulti(file: File) {
    setIdentifyingMulti(true)
    setIdentifyMultiError('')
    try {
      const prepared = await prepareImageForIdentify(file)
      const res = await fetch('/api/identify', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ ...prepared, mode: 'multi' }),
      })
      const raw = await res.text()
      let data: { error?: string; beads?: ReviewBead[]; findings?: ReviewFinding[] } = {}
      try { data = JSON.parse(raw) } catch { data = {} }
      if (!res.ok || data.error) throw new Error(data.error || `Identification failed (${res.status})`)
      const foundBeads = data.beads || []
      const foundFindings = data.findings || []
      if (foundBeads.length === 0 && foundFindings.length === 0) {
        throw new Error('No beads or findings recognised — try spreading groups apart on a plain background.')
      }
      setReviewBeads(foundBeads)
      setReviewFindings(foundFindings)
      setParseError('')
      setQuickAddSource('photo')
      setShowQuickAdd(true)
    } catch (e: unknown) {
      setIdentifyMultiError(getErrorMessage(e, 'Could not identify from photo'))
    } finally {
      setIdentifyingMulti(false)
    }
  }

  function closeQuickAdd() {
    setShowQuickAdd(false); setQuickText(''); setReviewBeads([]); setReviewFindings([]); setParseError(''); setQuickAddSource('text')
  }

  const updateReviewBead = (i: number, patch: Partial<BeadItem>) =>
    setReviewBeads(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const removeReviewBead = (i: number) => setReviewBeads(rs => rs.filter((_, idx) => idx !== i))
  const updateReviewFinding = (i: number, patch: Partial<FindingItem>) =>
    setReviewFindings(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const removeReviewFinding = (i: number) => setReviewFindings(rs => rs.filter((_, idx) => idx !== i))

  async function parseStash() {
    if (!quickText.trim()) { setParseError('Describe your stash first.'); return }
    setParsing(true); setParseError('')
    try {
      const res = await fetch('/api/parse-stash', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ text: quickText }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || `Parse failed (${res.status})`)
      const parsedBeads: BeadItem[] = data.beads || []
      const parsedFindings: FindingItem[] = data.findings || []
      setReviewBeads(parsedBeads)
      setReviewFindings(parsedFindings)
      if (parsedBeads.length === 0 && parsedFindings.length === 0) {
        setParseError('No beads or findings found in that description.')
      }
    } catch (e: unknown) { setParseError(getErrorMessage(e, 'Parse failed')) }
    finally { setParsing(false) }
  }

  async function saveAll() {
    setSavingAll(true); setParseError('')
    try {
      const headers = await getAuthHeaders({ 'Content-Type': 'application/json' })
      // One bulk request per table — two at most — instead of a POST per row.
      const jobs: Array<{ table: 'beads' | 'findings'; rows: Array<BeadItem | FindingItem> }> = []
      if (reviewBeads.length > 0) jobs.push({ table: 'beads', rows: reviewBeads })
      if (reviewFindings.length > 0) jobs.push({ table: 'findings', rows: reviewFindings })
      if (jobs.length === 0) { closeQuickAdd(); return }

      const responses = await Promise.all(
        jobs.map(({ table, rows }) =>
          fetch('/api/inventory', {
            method: 'POST',
            headers,
            body: JSON.stringify({ table, data: rows }),
          })
        )
      )
      for (const res of responses) {
        const result = await res.json().catch(() => null)
        if (!res.ok || result?.error) throw new Error(result?.error || `Save failed (${res.status})`)
      }
      await load()
      closeQuickAdd()
    } catch (e: unknown) { setParseError(getErrorMessage(e, 'Save failed')) }
    finally { setSavingAll(false) }
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

          {signedOut && (
            <div style={{padding:'12px 18px',background:'var(--surface)',border:'1px solid var(--border)',marginBottom:24}}>
              <span style={{fontSize:14,color:'var(--text2)',fontFamily:'var(--font-body)'}}>
                <Link href="/account" style={{color:'var(--moonstone)',textDecoration:'underline'}}>Sign in</Link> to load your stash.
              </span>
            </div>
          )}

          {/* Stats */}
          <div className="fade-up-2 stats-grid-4" style={{marginBottom:32}}>
            {[
              ['Total Beads',beads.length],
              ['Total Findings',findings.length],
              ['Bead Types',[...new Set(beads.map(b=>b.type))].length],
              ['Total Pieces',beads.reduce((a,b)=>a+b.quantity,0)+findings.reduce((a,f)=>a+f.quantity,0)],
            ].map(([label,val]) => (
              <div key={String(label)} className="card" style={{padding:'20px 24px'}}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--meta)',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:8}}>{String(label)}</div>
                <div style={{fontFamily:'var(--font-display)',fontSize:32,color:'var(--cream)'}}>{String(val)}</div>
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
            <button className="btn-silver" onClick={()=>{setShowForm(true);setSaveError('')}}>+ Add {tab==='beads'?'Bead':'Finding'}</button>
            <button className="btn-outline" onClick={()=>{setShowQuickAdd(true);setParseError('');setQuickAddSource('text')}}>✎ Quick add</button>
            <button className="btn-outline" onClick={()=>multiFileInputRef.current?.click()} disabled={identifyingMulti} style={{gap:6}}>
              {identifyingMulti ? <><span className="spinner-dark"/>Reading photo…</> : 'Add from photo'}
            </button>
            <input
              ref={multiFileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{display:'none'}}
              onChange={e => { const f = e.target.files?.[0]; if (f) identifyMulti(f); e.target.value = '' }}
            />
          </div>
          {identifyMultiError && <p style={{color:'var(--rose)',fontFamily:'var(--font-mono)',fontSize:12,marginBottom:16,letterSpacing:'0.06em'}}>{identifyMultiError}</p>}

          {/* Add form */}
          {showForm && (
            <div className="card fade-up stash-modal">
              <button onClick={()=>setShowForm(false)} style={{position:'absolute',top:16,right:16,background:'none',border:'none',color:'var(--muted)',fontSize:18,cursor:'pointer'}}>×</button>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                <h3 style={{fontFamily:'var(--font-display)',fontSize:20,color:'var(--cream)'}}>Add {tab==='beads'?'Bead':'Finding'}</h3>
                {aiPrefilled && (
                  <span className="mono" style={{fontSize:10,letterSpacing:'0.12em',color:'var(--madder)'}}>AI pre-filled — review &amp; adjust</span>
                )}
              </div>
              {tab==='beads' ? (
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16}}>
                  <div style={{gridColumn:'1/-1'}}>
                    <label className="label">Name / Description</label>
                    <input className="input-base" placeholder="e.g. Labradorite teardrop briolette"
                      value={beadForm.name||''} onChange={e=>setBeadForm(f=>({...f,name:e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Type</label>
                    <div style={{position:'relative'}}><select className="select-base" value={beadForm.type} onChange={e=>setBeadForm(f=>({...f,type:e.target.value as BeadItem['type']}))}>
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
                  <div style={{gridColumn:'2/-1'}}>
                    <label className="label">Hex</label>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <div style={{width:36,height:36,borderRadius:3,background:beadForm.hex||'#7a9ab8',border:'1px solid var(--border)',flexShrink:0}}/>
                      <input className="input-base" style={{fontFamily:'var(--font-mono)',fontSize:12,padding:'6px 10px'}}
                        value={beadForm.hex||''} placeholder="#000000"
                        onChange={e=>setBeadForm(f=>({...f,hex:e.target.value}))} />
                    </div>
                  </div>
                  <div style={{gridColumn:'1/-1'}}>
                    <label className="label" style={{marginBottom:10}}>Colour</label>
                    {(()=>{
                      const hex = /^#[0-9a-fA-F]{6}$/.test(beadForm.hex||'') ? beadForm.hex! : '#7a9ab8'
                      const [h,s,l] = hexToHsl(hex)
                      const sliders: Array<{label:string,value:number,min:number,max:number,unit:string,bg:string,onChange:(v:number)=>void}> = [
                        {
                          label:'Hue',value:h,min:0,max:360,unit:'°',
                          bg:'linear-gradient(to right,hsl(0,100%,50%),hsl(60,100%,50%),hsl(120,100%,50%),hsl(180,100%,50%),hsl(240,100%,50%),hsl(300,100%,50%),hsl(360,100%,50%))',
                          onChange:(v)=>setBeadForm(f=>({...f,hex:hslToHex(v,s,l)}))
                        },
                        {
                          label:'Saturation',value:s,min:0,max:100,unit:'%',
                          bg:`linear-gradient(to right,hsl(${h},0%,${l}%),hsl(${h},100%,${l}%))`,
                          onChange:(v)=>setBeadForm(f=>({...f,hex:hslToHex(h,v,l)}))
                        },
                        {
                          label:'Lightness',value:l,min:0,max:100,unit:'%',
                          bg:`linear-gradient(to right,hsl(${h},${s}%,0%),hsl(${h},${s}%,50%),hsl(${h},${s}%,100%))`,
                          onChange:(v)=>setBeadForm(f=>({...f,hex:hslToHex(h,s,v)}))
                        },
                      ]
                      return (
                        <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:16}}>
                          {sliders.map(sl=>(
                            <div key={sl.label}>
                              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                                <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted)',letterSpacing:'0.12em',textTransform:'uppercase'}}>{sl.label}</span>
                                <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--muted2)'}}>{sl.value}{sl.unit}</span>
                              </div>
                              <div style={{position:'relative',height:18}}>
                                <div style={{position:'absolute',top:7,left:0,right:0,height:4,borderRadius:2,background:sl.bg}}/>
                                <input type="range" className="colour-slider" min={sl.min} max={sl.max} value={sl.value}
                                  onChange={e=>sl.onChange(+e.target.value)}/>
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })()}
                    <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:6}}>
                      {beadColours.map(c=>(
                        <button key={c.hex} type="button" title={c.name}
                          onClick={()=>setBeadForm(f=>({...f,hex:c.hex,colour:f.colour||c.name}))}
                          style={{
                            width:26,height:26,borderRadius:'50%',background:c.hex,
                            border:beadForm.hex===c.hex?'2px solid var(--silver)':'1px solid rgba(255,255,255,0.12)',
                            cursor:'pointer',flexShrink:0,transition:'border 0.15s',padding:0
                          }}
                        />
                      ))}
                    </div>
                    <p style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted2)',letterSpacing:'0.06em',minHeight:14}}>
                      {beadColours.find(c=>c.hex===beadForm.hex)?.name||''}
                    </p>
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
                    <div style={{position:'relative'}}><select className="select-base" value={findingForm.type} onChange={e=>setFindingForm(f=>({...f,type:e.target.value as FindingItem['type']}))}>
                      {findingTypes.map(t=><option key={t} value={t}>{t === 'statement_component' ? '★ Statement / Chandelier piece' : t.replace(/_/g,' ')}</option>)}
                    </select>{arrow}</div>
                    {findingForm.type === 'statement_component' && (
                      <div style={{marginTop:8,padding:'10px 14px',background:'var(--roast)',border:'1px solid var(--seam)'}}>
                        <p style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--madder)',letterSpacing:'0.1em',marginBottom:4}}>FOCAL PIECE</p>
                        <p style={{fontSize:13,color:'var(--text2)',lineHeight:1.5}}>Chandelier frames, earring hoops, pendant bails, large connectors — the AI will build designs around these.</p>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="label">Metal</label>
                    <div style={{position:'relative'}}><select className="select-base" value={findingForm.metal} onChange={e=>setFindingForm(f=>({...f,metal:e.target.value as FindingItem['metal']}))}>
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
              {saveError && <p style={{color:'var(--rose)',fontFamily:'var(--font-mono)',fontSize:12,marginTop:16,letterSpacing:'0.06em'}}>{saveError}</p>}
              <div style={{display:'flex',gap:10,marginTop:12}}>
                <button className="btn-silver" onClick={saveItem} disabled={saving}>
                  {saving?<><span className="spinner"/>Saving…</>:'Save to Stash'}
                </button>
                <button className="btn-outline" onClick={()=>{setShowForm(false);setAiPrefilled(false);setSaveError('')}}>Cancel</button>
              </div>
            </div>
          )}

          {/* Quick add */}
          {showQuickAdd && (
            <div className="card fade-up stash-modal">
              <button onClick={closeQuickAdd} style={{position:'absolute',top:16,right:16,background:'none',border:'none',color:'var(--muted)',fontSize:18,cursor:'pointer'}}>×</button>
              <h3 style={{fontFamily:'var(--font-display)',fontSize:20,color:'var(--cream)',marginBottom:6}}>{quickAddSource==='photo'?'Identify from photo':'Quick add'}</h3>
              {quickAddSource==='photo' ? (
                <p style={{color:'var(--text2)',fontSize:15,marginBottom:16,lineHeight:1.5}}>Read from your photo — check each item, adjust quantities, and save. Distinct groups spread on a plain background identify best.</p>
              ) : (
                <>
                  <p style={{color:'var(--text2)',fontSize:15,marginBottom:16,lineHeight:1.5}}>Describe your stash in plain words — the AI turns it into beads and findings for you to review before saving.</p>
                  <textarea
                    className="input-base"
                    rows={4}
                    style={{width:'100%',resize:'vertical',fontFamily:'var(--font-body)',lineHeight:1.5}}
                    placeholder="e.g. About 20 blue labradorite teardrops, a dozen silver head pins, two gold lobster clasps, and a handful of 6mm rose quartz rounds…"
                    value={quickText}
                    onChange={e=>setQuickText(e.target.value)}
                  />
                  <div style={{display:'flex',gap:10,marginTop:12}}>
                    <button className="btn-silver" onClick={parseStash} disabled={parsing}>
                      {parsing?<><span className="spinner"/>Parsing…</>:'Parse'}
                    </button>
                    <button className="btn-outline" onClick={closeQuickAdd}>Cancel</button>
                  </div>
                </>
              )}
              {parseError && <p style={{color:'var(--rose)',fontFamily:'var(--font-mono)',fontSize:12,marginTop:14,letterSpacing:'0.06em'}}>{parseError}</p>}

              {(reviewBeads.length>0 || reviewFindings.length>0) && (
                <div style={{marginTop:24,borderTop:'1px solid var(--border)',paddingTop:20}}>
                  <p className="mono" style={{fontSize:10,letterSpacing:'0.12em',color:'var(--madder)',textTransform:'uppercase',marginBottom:16}}>
                    Review — {reviewBeads.length} bead{reviewBeads.length===1?'':'s'}, {reviewFindings.length} finding{reviewFindings.length===1?'':'s'}
                  </p>
                  {reviewBeads.length>0 && (
                    <div style={{marginBottom:18}}>
                      <label className="label" style={{marginBottom:8}}>Beads</label>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {reviewBeads.map((b,i)=>(
                          <div key={i} className="stash-row">
                            <div style={{width:22,height:22,borderRadius:'50%',background:b.hex||'#7a9ab8',border:'1px solid rgba(255,255,255,0.12)',flexShrink:0}}/>
                            <span style={{flex:1,minWidth:120,fontFamily:'var(--font-display)',fontSize:15,color:'var(--cream)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.name}</span>
                            {b.confidence && b.confidence!=='certain' && (
                              <span className="tag" style={b.confidence==='unsure'?{color:'var(--rose)',borderColor:'var(--rose)'}:undefined}>
                                {b.confidence==='unsure'?'? unsure':'~ likely'}
                              </span>
                            )}
                            <input className="input-base" style={{width:130,padding:'6px 10px',fontSize:13}} placeholder="Colour"
                              value={b.colour||''} onChange={e=>updateReviewBead(i,{colour:e.target.value})}/>
                            <input className="input-base" type="number" min={1} style={{width:70,padding:'6px 10px',fontSize:13}}
                              value={b.quantity||1} onChange={e=>updateReviewBead(i,{quantity:Number(e.target.value)})}/>
                            <button onClick={()=>removeReviewBead(i)} style={{background:'none',border:'none',color:'var(--muted2)',fontFamily:'var(--font-mono)',fontSize:12,cursor:'pointer',letterSpacing:'0.08em'}}
                              onMouseEnter={e=>e.currentTarget.style.color='var(--rose)'} onMouseLeave={e=>e.currentTarget.style.color='var(--muted2)'}>× remove</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {reviewFindings.length>0 && (
                    <div style={{marginBottom:18}}>
                      <label className="label" style={{marginBottom:8}}>Findings</label>
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {reviewFindings.map((f,i)=>(
                          <div key={i} className="stash-row">
                            <span style={{flex:1,minWidth:120,fontFamily:'var(--font-display)',fontSize:15,color:'var(--cream)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</span>
                            {f.type && <span className="tag">{f.type.replace(/_/g,' ')}</span>}
                            {f.metal && <span className="tag">{f.metal.replace(/_/g,' ')}</span>}
                            {f.confidence && f.confidence!=='certain' && (
                              <span className="tag" style={f.confidence==='unsure'?{color:'var(--rose)',borderColor:'var(--rose)'}:undefined}>
                                {f.confidence==='unsure'?'? unsure':'~ likely'}
                              </span>
                            )}
                            <input className="input-base" type="number" min={1} style={{width:70,padding:'6px 10px',fontSize:13}}
                              value={f.quantity||1} onChange={e=>updateReviewFinding(i,{quantity:Number(e.target.value)})}/>
                            <button onClick={()=>removeReviewFinding(i)} style={{background:'none',border:'none',color:'var(--muted2)',fontFamily:'var(--font-mono)',fontSize:12,cursor:'pointer',letterSpacing:'0.08em'}}
                              onMouseEnter={e=>e.currentTarget.style.color='var(--rose)'} onMouseLeave={e=>e.currentTarget.style.color='var(--muted2)'}>× remove</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button className="btn-silver" onClick={saveAll} disabled={savingAll}>
                    {savingAll?<><span className="spinner"/>Saving…</>:`Save all (${reviewBeads.length+reviewFindings.length})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Items list */}
          {loading ? (
            <div style={{display:'flex',justifyContent:'center',padding:60}}>
              <StrandLoader/>
            </div>
          ) : tab==='beads' ? (
            filteredBeads.length === 0 ? (
              <StrandEmpty line={search||filterType?'No beads match your filter.':'No beads yet. Add your first bead to get started.'} />
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:2}}>
                {filteredBeads.map(b => (
                  <div key={b.id} className="card stash-card" style={{position:'relative'}}>
                    {editingId === b.id ? (
                      <div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                          <div style={{gridColumn:'1/-1'}}>
                            <label className="label">Name</label>
                            <input className="input-base" value={(editForm as Partial<BeadItem>).name||''} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} />
                          </div>
                          <div>
                            <label className="label">Colour</label>
                            <input className="input-base" value={(editForm as Partial<BeadItem>).colour||''} onChange={e=>setEditForm(f=>({...f,colour:e.target.value}))} />
                          </div>
                          <div>
                            <label className="label">Hex</label>
                            <div style={{display:'flex',gap:6,alignItems:'center'}}>
                              <input type="color" value={(editForm as Partial<BeadItem>).hex||'#7a9ab8'} onChange={e=>setEditForm(f=>({...f,hex:e.target.value}))}
                                style={{width:38,height:32,border:'1px solid var(--border)',background:'none',cursor:'pointer',padding:2}} />
                              <span className="mono" style={{fontSize:10,color:'var(--muted)'}}>{(editForm as Partial<BeadItem>).hex}</span>
                            </div>
                          </div>
                          <div>
                            <label className="label">Size</label>
                            <div style={{position:'relative'}}>
                              <select className="select-base" value={(editForm as Partial<BeadItem>).size||''} onChange={e=>setEditForm(f=>({...f,size:e.target.value}))}>
                                {beadSizes.map(s=><option key={s} value={s}>{s}</option>)}
                              </select>
                              {arrow}
                            </div>
                          </div>
                          <div>
                            <label className="label">Quantity</label>
                            <input className="input-base" type="number" min={1} value={(editForm as Partial<BeadItem>).quantity||1} onChange={e=>setEditForm(f=>({...f,quantity:Number(e.target.value)}))} />
                          </div>
                          <div style={{gridColumn:'1/-1'}}>
                            <label className="label">Notes</label>
                            <input className="input-base" value={(editForm as Partial<BeadItem>).notes||''} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} />
                          </div>
                        </div>
                        <div style={{display:'flex',gap:8}}>
                          <button className="btn-silver" style={{fontSize:12,padding:'6px 14px'}} onClick={()=>editItem(b.id!)}>Save</button>
                          <button className="btn-outline" style={{fontSize:12,padding:'6px 14px'}} onClick={()=>{setEditingId(null);setEditForm({})}}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
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
                        <div style={{display:'flex',alignItems:'center'}}>
                          <button onClick={() => { setEditingId(b.id!); setEditForm(b) }} style={{
                            background:'none',border:'none',color:'var(--muted2)',fontSize:12,
                            fontFamily:'var(--font-mono)',cursor:'pointer',letterSpacing:'0.08em',
                            transition:'color 0.15s',padding:0,marginRight:12
                          }}
                          onMouseEnter={e=>e.currentTarget.style.color='var(--moonstone)'}
                          onMouseLeave={e=>e.currentTarget.style.color='var(--muted2)'}>
                            ✎ edit
                          </button>
                          {confirmingId===b.id ? (
                            <span style={{display:'inline-flex',alignItems:'center',gap:10}}>
                              <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text2)',letterSpacing:'0.06em'}}>Delete?</span>
                              <button onClick={()=>deleteItem(b.id!)} disabled={deletingId===b.id} style={{
                                background:'none',border:'none',color:'var(--rose)',fontSize:12,
                                fontFamily:'var(--font-mono)',cursor:'pointer',letterSpacing:'0.08em',padding:0
                              }}>{deletingId===b.id?'removing…':'yes'}</button>
                              <button onClick={()=>setConfirmingId(null)} disabled={deletingId===b.id} style={{
                                background:'none',border:'none',color:'var(--muted2)',fontSize:12,
                                fontFamily:'var(--font-mono)',cursor:'pointer',letterSpacing:'0.08em',padding:0
                              }}>cancel</button>
                            </span>
                          ) : (
                            <button onClick={()=>setConfirmingId(b.id!)} style={{
                              background:'none',border:'none',color:'var(--muted2)',fontSize:12,
                              fontFamily:'var(--font-mono)',cursor:'pointer',letterSpacing:'0.08em',
                              transition:'color 0.15s',padding:0
                            }}
                            onMouseEnter={e=>e.currentTarget.style.color='var(--rose)'}
                            onMouseLeave={e=>e.currentTarget.style.color='var(--muted2)'}>
                              × remove
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            filteredFindings.length === 0 ? (
              <StrandEmpty line={search||filterType?'No findings match your filter.':'No findings yet. Add your clasps, ear wires, and pins.'} />
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:2}}>
                {filteredFindings.map(f => (
                  <div key={f.id} className="card stash-card">
                    {editingId === f.id ? (
                      <div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
                          <div style={{gridColumn:'1/-1'}}>
                            <label className="label">Name</label>
                            <input className="input-base" value={(editForm as Partial<FindingItem>).name||''} onChange={e=>setEditForm(fm=>({...fm,name:e.target.value}))} />
                          </div>
                          <div>
                            <label className="label">Type</label>
                            <div style={{position:'relative'}}>
                              <select className="select-base" value={(editForm as Partial<FindingItem>).type||''} onChange={e=>setEditForm(fm=>({...fm,type:e.target.value as FindingItem['type']}))}>
                                {findingTypes.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                              </select>
                              {arrow}
                            </div>
                          </div>
                          <div>
                            <label className="label">Metal</label>
                            <div style={{position:'relative'}}>
                              <select className="select-base" value={(editForm as Partial<FindingItem>).metal||''} onChange={e=>setEditForm(fm=>({...fm,metal:e.target.value as FindingItem['metal']}))}>
                                {metals.map(m=><option key={m} value={m}>{m.replace('_',' ')}</option>)}
                              </select>
                              {arrow}
                            </div>
                          </div>
                          <div>
                            <label className="label">Size / Gauge</label>
                            <input className="input-base" value={(editForm as Partial<FindingItem>).size||''} onChange={e=>setEditForm(fm=>({...fm,size:e.target.value}))} />
                          </div>
                          <div>
                            <label className="label">Quantity</label>
                            <input className="input-base" type="number" min={1} value={(editForm as Partial<FindingItem>).quantity||1} onChange={e=>setEditForm(fm=>({...fm,quantity:Number(e.target.value)}))} />
                          </div>
                          <div style={{gridColumn:'1/-1'}}>
                            <label className="label">Notes</label>
                            <input className="input-base" value={(editForm as Partial<FindingItem>).notes||''} onChange={e=>setEditForm(fm=>({...fm,notes:e.target.value}))} />
                          </div>
                        </div>
                        <div style={{display:'flex',gap:8}}>
                          <button className="btn-silver" style={{fontSize:12,padding:'6px 14px'}} onClick={()=>editItem(f.id!)}>Save</button>
                          <button className="btn-outline" style={{fontSize:12,padding:'6px 14px'}} onClick={()=>{setEditingId(null);setEditForm({})}}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{marginBottom:10}}>
                          <p style={{fontFamily:'var(--font-display)',fontSize:16,color:'var(--cream)'}}>{f.name}</p>
                          <p style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--steel2)',letterSpacing:'0.08em',marginTop:2}}>{f.type.replace('_',' ')} · {f.metal.replace('_',' ')}</p>
                        </div>
                        <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:12}}>
                          {f.size && <span className="tag">{f.size}</span>}
                          <span className="tag">qty: {f.quantity}</span>
                        </div>
                        {f.notes && <p style={{fontSize:13,color:'var(--muted)',marginBottom:10,lineHeight:1.4}}>{f.notes}</p>}
                        <div style={{display:'flex',alignItems:'center'}}>
                          <button onClick={() => { setEditingId(f.id!); setEditForm(f) }} style={{
                            background:'none',border:'none',color:'var(--muted2)',fontSize:12,
                            fontFamily:'var(--font-mono)',cursor:'pointer',letterSpacing:'0.08em',
                            transition:'color 0.15s',padding:0,marginRight:12
                          }}
                          onMouseEnter={e=>e.currentTarget.style.color='var(--moonstone)'}
                          onMouseLeave={e=>e.currentTarget.style.color='var(--muted2)'}>
                            ✎ edit
                          </button>
                          {confirmingId===f.id ? (
                            <span style={{display:'inline-flex',alignItems:'center',gap:10}}>
                              <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text2)',letterSpacing:'0.06em'}}>Delete?</span>
                              <button onClick={()=>deleteItem(f.id!)} disabled={deletingId===f.id} style={{
                                background:'none',border:'none',color:'var(--rose)',fontSize:12,
                                fontFamily:'var(--font-mono)',cursor:'pointer',letterSpacing:'0.08em',padding:0
                              }}>{deletingId===f.id?'removing…':'yes'}</button>
                              <button onClick={()=>setConfirmingId(null)} disabled={deletingId===f.id} style={{
                                background:'none',border:'none',color:'var(--muted2)',fontSize:12,
                                fontFamily:'var(--font-mono)',cursor:'pointer',letterSpacing:'0.08em',padding:0
                              }}>cancel</button>
                            </span>
                          ) : (
                            <button onClick={()=>setConfirmingId(f.id!)} style={{
                              background:'none',border:'none',color:'var(--muted2)',fontSize:12,
                              fontFamily:'var(--font-mono)',cursor:'pointer',letterSpacing:'0.08em',
                              transition:'color 0.15s',padding:0
                            }}
                            onMouseEnter={e=>e.currentTarget.style.color='var(--rose)'}
                            onMouseLeave={e=>e.currentTarget.style.color='var(--muted2)'}>
                              × remove
                            </button>
                          )}
                        </div>
                      </>
                    )}
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
