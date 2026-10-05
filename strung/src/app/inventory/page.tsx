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
import { beadColours } from '@/lib/stash-colours'
import Bead from '@/components/Bead'
import { beadFormFor, colourFamily, COLOUR_FAMILIES, nominalPx, safeHex, type ColourFamily } from '@/lib/bead'

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

const HEX_RE = /^#[0-9a-fA-F]{6}$/

const beadTypes: BeadItem['type'][] = ['gemstone','crystal','glass','seed','metal','pearl','resin','other']
const findingTypes: FindingItem['type'][] = ['statement_component','ear_wire','head_pin','eye_pin','jump_ring','clasp','chain','wire','crimp','connector','other']
const metals: FindingItem['metal'][] = ['silver','gold_filled','gold','copper','brass','oxidised','other']
const shapes = ['round','rondelle','briolette','teardrop','faceted','chip','tube','oval','square','other']

export default function InventoryPage() {
  const [tab, setTab] = useState<'beads'|'findings'>('beads')
  // Delete/edit failures used to fire a native alert(): it blocks the whole
  // page, is not styled, cannot be dismissed with the keyboard on some mobile
  // browsers, and is announced out of context. An inline role="alert" banner
  // lets a screen reader announce it in place and leaves the page usable.
  const [listError, setListError] = useState('')
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
  // Ledger selection, spectrum filter and the quantity stepper (2026-10 redesign).
  const [selId, setSelId] = useState<string|null>(null)
  const [fam, setFam] = useState<ColourFamily|null>(null)
  const [qtyBusy, setQtyBusy] = useState(false)

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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not load your stash')
      setBeads(data.beads || [])
      setFindings(data.findings || [])
    } catch (e: unknown) {
      // Never fall through to an empty list: it reads as "you own nothing" and
      // invites re-adding everything as duplicates once the outage clears.
      setListError(`${getErrorMessage(e, 'Could not load your stash')} — refresh to try again.`)
    }
    finally { setLoading(false) }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function saveItem() {
    const form = tab === 'beads' ? beadForm : findingForm
    if (!form.name?.trim()) { setSaveError('Name is required.'); return }
    if (tab === 'beads' && !HEX_RE.test(beadForm.hex || '')) { setSaveError('Colour hex must look like #7a9ab8.'); return }
    setSaving(true); setSaveError('')
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ table: tab, data: form }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result.error) throw new Error(result.error || `Save failed (${res.status})`)
      await load()
      setShowForm(false)
      setBeadForm({ type:'gemstone', size:'small', quantity:1, hex:'#7a9ab8' })
      setFindingForm({ type:'ear_wire', metal:'silver', quantity:2 })
    } catch (e: unknown) { setSaveError(getErrorMessage(e, 'Save failed')) }
    finally { setSaving(false) }
  }

  async function deleteItem(id: string) {
    setConfirmingId(null)
    setDeletingId(id)
    setListError('')
    try {
      const res = await fetch(`/api/inventory?table=${tab}&id=${encodeURIComponent(id)}`, { method: 'DELETE', headers: await getAuthHeaders() })
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Delete failed') }
      await load()
    } catch (e: unknown) { setListError(getErrorMessage(e, 'Failed to delete')) }
    finally { setDeletingId(null) }
  }

  async function editItem(id: string) {
    setListError('')
    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ table: tab, id, data: editForm }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result.error) throw new Error(result.error || 'Update failed')
      await load()
      setEditingId(null)
      setEditForm({})
    } catch (e: unknown) { setListError(getErrorMessage(e, 'Failed to update')) }
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
      const data = await res.json().catch(() => ({}))
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
      // The two requests succeed or fail independently. Any table that saved is
      // cleared from the review list straight away — it used to stay there when
      // the other table failed, so "Save all" again inserted it a second time.
      let failure = ''
      for (const [i, res] of responses.entries()) {
        const result = await res.json().catch(() => null)
        if (!res.ok || result?.error) {
          failure ||= result?.error || `Save failed (${res.status})`
        } else if (jobs[i].table === 'beads') {
          setReviewBeads([])
        } else {
          setReviewFindings([])
        }
      }
      await load()
      if (failure) {
        throw new Error(
          responses.some(r => r.ok)
            ? `${failure} — the rest were saved and removed from this list.`
            : failure
        )
      }
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

  const LOW = 10
  const famOf = (b: BeadItem) => colourFamily(safeHex(b.hex))
  const famCounts = COLOUR_FAMILIES.map(f => ({ ...f, count: beads.filter(b => famOf(b) === f.key).length }))
  const shownBeads = fam ? filteredBeads.filter(b => famOf(b) === fam) : filteredBeads
  const famLabel = fam ? COLOUR_FAMILIES.find(f => f.key === fam)!.label.toLowerCase() : ''
  const totalBeads = beads.reduce((a, b) => a + (Number(b.quantity) || 0), 0)
  const lowCount = beads.filter(b => (Number(b.quantity) || 0) < LOW).length
  const sel = tab === 'beads' ? beads.find(b => b.id === selId) ?? null : null
  const maxLog = Math.log10(1000)

  // ± on the detail panel: one PATCH per tap, then reload so the ledger and
  // every count agree with what the server stored.
  async function stepQty(b: BeadItem, delta: number) {
    if (!b.id || qtyBusy) return
    const next = Math.max(0, (Number(b.quantity) || 0) + delta)
    if (next === b.quantity) return
    setQtyBusy(true); setListError('')
    try {
      const res = await fetch('/api/inventory', {
        method: 'PATCH',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ table: 'beads', id: b.id, data: { quantity: next } }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok || result.error) throw new Error(result.error || 'Update failed')
      setBeads(bs => bs.map(x => x.id === b.id ? { ...x, quantity: next } : x))
    } catch (e: unknown) { setListError(getErrorMessage(e, 'Failed to update')) }
    finally { setQtyBusy(false) }
  }

  const confirmRow = (id: string) => confirmingId === id ? (
    <span style={{display:'inline-flex',alignItems:'center',gap:12}}>
      <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text2)',letterSpacing:'0.06em'}}>Delete?</span>
      <button className="link-quiet" style={{color:'var(--madder-text)'}} onClick={()=>deleteItem(id)} disabled={deletingId===id}>{deletingId===id?'removing…':'yes'}</button>
      <button className="link-quiet" onClick={()=>setConfirmingId(null)} disabled={deletingId===id}>cancel</button>
    </span>
  ) : (
    <button className="link-quiet link-quiet--danger" onClick={()=>setConfirmingId(id)}>× remove</button>
  )


  return (
    <>
      <Nav />
      <main id="main" className="page-main">
        <div className="wrap screen ss-up">
          <header style={{display:'flex',justifyContent:'space-between',alignItems:'flex-end',gap:24,flexWrap:'wrap'}}>
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <p className="eyebrow eyebrow--lit">Stash</p>
              <h1 className="display d-1">{loading ? 'Your stash.' : `${totalBeads.toLocaleString('en-AU')} bead${totalBeads===1?'':'s'}.`}</h1>
              {!loading && !signedOut && (
                <p className="eyebrow" style={{letterSpacing:'.14em'}}>
                  {beads.length} type{beads.length===1?'':'s'} · {findings.length} finding{findings.length===1?'':'s'}
                  {lowCount > 0 && <> · <span style={{color:'var(--ochre)'}}>{lowCount} running low</span></>}
                </p>
              )}
            </div>
            <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
              <button className="btn-primary btn-md" onClick={()=>multiFileInputRef.current?.click()} disabled={identifyingMulti || signedOut}>
                {identifyingMulti ? <><span className="spinner"/>Reading photo…</> : 'Photograph beads'}
              </button>
              <button className="btn-outline btn-md" disabled={signedOut} onClick={()=>{setShowQuickAdd(true);setParseError('');setQuickAddSource('text')}}>Paste a list</button>
              <button className="btn-outline btn-md" disabled={signedOut} onClick={()=>{setShowForm(true);setSaveError('')}}>+ Add {tab==='beads'?'bead':'finding'}</button>
              <input
                ref={multiFileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{display:'none'}}
                onChange={e => { const f = e.target.files?.[0]; if (f) identifyMulti(f); e.target.value = '' }}
              />
            </div>
          </header>

          {listError && (
            <div role="alert" className="well" style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 18px',borderColor:'var(--rose)'}}>
              <span style={{flex:1,fontSize:14,color:'var(--text2)'}}>{listError}</span>
              <button onClick={() => setListError('')} aria-label="Dismiss error" className="btn-ghost" style={{padding:'2px 8px'}}>Dismiss</button>
            </div>
          )}

          {signedOut && (
            <div className="well" style={{padding:'12px 18px'}}>
              <span style={{fontSize:15,color:'var(--text2)'}}>
                <Link href="/account" className="link-under" style={{fontSize:11}}>Sign in</Link>&nbsp; to load your stash.
              </span>
            </div>
          )}
          {identifyMultiError && <p role="alert" style={{color:'var(--madder-text)',fontFamily:'var(--font-mono)',fontSize:12,letterSpacing:'0.06em'}}>{identifyMultiError}</p>}

          {/* Add form */}
          {showForm && (
            <div className="card fade-up stash-modal">
              <button onClick={()=>setShowForm(false)} style={{position:'absolute',top:16,right:16,background:'none',border:'none',color:'var(--muted)',fontSize:17,cursor:'pointer'}}>×</button>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                <h3 style={{fontFamily:'var(--font-display)',fontSize:20,color:'var(--cream)'}}>Add {tab==='beads'?'Bead':'Finding'}</h3>
              </div>
              {tab==='beads' ? (
                <div className="form-grid-3" style={{gap:16}}>
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
                    <input className="input-base" type="number" min={1} value={beadForm.quantity ?? 1}
                      onChange={e=>setBeadForm(f=>({...f,quantity:Number(e.target.value)}))} />
                  </div>
                  <div style={{gridColumn:'1/-1'}}>
                    <label className="label">Notes (optional)</label>
                    <input className="input-base" placeholder="e.g. From Beadistry Supply Co, bought Nov 2024"
                      value={beadForm.notes||''} onChange={e=>setBeadForm(f=>({...f,notes:e.target.value}))} />
                  </div>
                </div>
              ) : (
                <div className="form-grid-3" style={{gap:16}}>
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
                      {metals.map(m=><option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}
                    </select>{arrow}</div>
                  </div>
                  <div>
                    <label className="label">Size / Gauge</label>
                    <input className="input-base" placeholder="e.g. 21g, 6mm, 0.8mm"
                      value={findingForm.size||''} onChange={e=>setFindingForm(f=>({...f,size:e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Quantity</label>
                    <input className="input-base" type="number" min={1} value={findingForm.quantity ?? 1}
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
                <button className="btn-primary" onClick={saveItem} disabled={saving}>
                  {saving?<><span className="spinner"/>Saving…</>:'Save to Stash'}
                </button>
                <button className="btn-outline" onClick={()=>{setShowForm(false);setSaveError('')}}>Cancel</button>
              </div>
            </div>
          )}

          {/* Quick add */}
          {showQuickAdd && (
            <div className="card fade-up stash-modal">
              <button onClick={closeQuickAdd} style={{position:'absolute',top:16,right:16,background:'none',border:'none',color:'var(--muted)',fontSize:17,cursor:'pointer'}}>×</button>
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
                    <button className="btn-primary" onClick={parseStash} disabled={parsing}>
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
                            <span style={{flex:1,minWidth:120,fontSize:15,color:'var(--cream)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.name}</span>
                            {b.confidence && b.confidence!=='certain' && (
                              <span className="tag" style={b.confidence==='unsure'?{color:'var(--rose)',borderColor:'var(--rose)'}:undefined}>
                                {b.confidence==='unsure'?'? unsure':'~ likely'}
                              </span>
                            )}
                            <input className="input-base" style={{width:130,padding:'6px 10px',fontSize:13}} placeholder="Colour"
                              value={b.colour||''} onChange={e=>updateReviewBead(i,{colour:e.target.value})}/>
                            <input className="input-base" type="number" min={1} style={{width:70,padding:'6px 10px',fontSize:13}}
                              value={b.quantity ?? 1} onChange={e=>updateReviewBead(i,{quantity:Number(e.target.value)})}/>
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
                            <span style={{flex:1,minWidth:120,fontSize:15,color:'var(--cream)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</span>
                            {f.type && <span className="tag">{f.type.replace(/_/g,' ')}</span>}
                            {f.metal && <span className="tag">{f.metal.replace(/_/g,' ')}</span>}
                            {f.confidence && f.confidence!=='certain' && (
                              <span className="tag" style={f.confidence==='unsure'?{color:'var(--rose)',borderColor:'var(--rose)'}:undefined}>
                                {f.confidence==='unsure'?'? unsure':'~ likely'}
                              </span>
                            )}
                            <input className="input-base" type="number" min={1} style={{width:70,padding:'6px 10px',fontSize:13}}
                              value={f.quantity ?? 1} onChange={e=>updateReviewFinding(i,{quantity:Number(e.target.value)})}/>
                            <button onClick={()=>removeReviewFinding(i)} style={{background:'none',border:'none',color:'var(--muted2)',fontFamily:'var(--font-mono)',fontSize:12,cursor:'pointer',letterSpacing:'0.08em'}}
                              onMouseEnter={e=>e.currentTarget.style.color='var(--rose)'} onMouseLeave={e=>e.currentTarget.style.color='var(--muted2)'}>× remove</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button className="btn-primary" onClick={saveAll} disabled={savingAll}>
                    {savingAll?<><span className="spinner"/>Saving…</>:`Save all (${reviewBeads.length+reviewFindings.length})`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Colour spectrum — one band per hue family, sized by how many bead types fall in it. */}
          {tab==='beads' && beads.length > 0 && (
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              <div role="group" aria-label="Filter by colour" style={{display:'flex',height:44,gap:2}}>
                {famCounts.filter(f => f.count > 0).map(f => (
                  <button key={f.key} type="button" title={`${f.label} · ${f.count}`} aria-label={`${f.label}, ${f.count} type${f.count===1?'':'s'}`} aria-pressed={fam===f.key}
                    onClick={()=>setFam(cur => cur===f.key ? null : f.key)}
                    style={{flex:`${f.count} 1 0`,minWidth:18,border:'none',cursor:'pointer',borderRadius:0,
                      background:`linear-gradient(180deg, rgba(255,255,255,.12), rgba(0,0,0,.2)), ${f.swatch}`,
                      opacity: fam && fam!==f.key ? 0.25 : 1, outline: fam===f.key ? '1px solid var(--cream)' : 'none', outlineOffset:2, transition:'opacity .2s'}} />
                ))}
              </div>
              <div className="eyebrow" style={{display:'flex',justifyContent:'space-between',gap:12,flexWrap:'wrap',letterSpacing:'.14em'}}>
                <span>{fam ? `${shownBeads.length} ${famLabel} bead type${shownBeads.length===1?'':'s'}` : 'Colour spectrum of your stash · tap a band to filter'}</span>
                {fam && <button type="button" className="link-quiet" style={{color:'var(--cream)'}} onClick={()=>setFam(null)}>Show all ×</button>}
              </div>
            </div>
          )}

          {/* Controls */}
          <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
            <div className="chip-row" role="tablist" aria-label="Stash section">
              {(['beads','findings'] as const).map(t => (
                <button key={t} role="tab" aria-selected={tab===t} className="chip" style={{padding:'11px 18px'}}
                  onClick={()=>{setTab(t);setFilterType('');setSearch('');setSelId(null);setEditingId(null)}}>{t}</button>
              ))}
            </div>
            <input className="input-base" style={{flex:1,maxWidth:260}} aria-label={`Search ${tab}`}
              placeholder={`Search ${tab}…`} value={search} onChange={e=>setSearch(e.target.value)} />
            <div style={{position:'relative',minWidth:160}}>
              <select className="select-base" aria-label="Filter by type" value={filterType} onChange={e=>setFilterType(e.target.value)}>
                <option value="">All types</option>
                {(tab==='beads'?beadTypes:findingTypes).map(t => <option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
              </select>
              {arrow}
            </div>
          </div>

          {/* Items */}
          {loading ? (
            <div style={{display:'flex',justifyContent:'center',padding:60}}><StrandLoader/></div>
          ) : tab==='beads' ? (
            shownBeads.length === 0 ? (
              <StrandEmpty line={search||filterType||fam?'No beads match your filter.':'No beads yet. Add your first bead to get started.'} />
            ) : (
              <div style={{display:'flex',gap:2,flexWrap:'wrap',alignItems:'flex-start'}}>
                <ul className="panel" style={{flex:'1 1 520px',listStyle:'none'}}>
                  {shownBeads.map(b => {
                    const q = Number(b.quantity) || 0, low = q < LOW, on = selId === b.id
                    const form = beadFormFor(b)
                    return (
                      <li key={b.id}>
                        <button type="button" className={`ledger-row${on?' is-on':''}`} aria-pressed={on}
                          onClick={()=>{ setSelId(on ? null : b.id ?? null); setEditingId(null); setConfirmingId(null) }}>
                          <span style={{width:40,display:'flex',justifyContent:'center',flex:'none'}}><Bead hex={safeHex(b.hex)} shape={form} size={Math.min(nominalPx(form) * 2.4, 26)} /></span>
                          <span style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',textAlign:'left'}}>
                            <span style={{color:'var(--cream)',fontSize:16,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.name}</span>
                            <span className="eyebrow eyebrow--sm" style={{letterSpacing:'.12em'}}>{b.type}{b.size?` · ${b.size}`:''}{b.colour?` · ${b.colour}`:''}</span>
                          </span>
                          <span className="ledger-bar" aria-hidden="true"><span style={{width:`${Math.min(100, Math.log10(q + 1) / maxLog * 100)}%`,background: low ? 'var(--ochre)' : safeHex(b.hex)}} /></span>
                          <span style={{fontFamily:'var(--font-mono)',fontSize:11,letterSpacing:'.1em',textTransform:'uppercase',minWidth:70,textAlign:'right',color: low ? 'var(--ochre)' : 'var(--cream)'}}>
                            {low ? `${q} · low` : q.toLocaleString('en-AU')}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                {sel && (
                  <aside aria-label={`${sel.name} details`} className="stash-aside ss-up">
                    <div className="well" style={{height:180,display:'flex',alignItems:'center',justifyContent:'center',position:'relative',border:'none',borderBottom:'1px solid var(--seam)'}}>
                      <div aria-hidden="true" style={{position:'absolute',left:0,right:0,top:'50%',height:1,background:'var(--saddle)'}} />
                      <Bead hex={safeHex(sel.hex)} shape={beadFormFor(sel)} size={Math.min(70, 8 * nominalPx(beadFormFor(sel)))} />
                      <button type="button" onClick={()=>{setSelId(null);setEditingId(null)}} aria-label="Close details" style={{position:'absolute',top:10,right:12,background:'none',border:'none',color:'var(--meta)',fontSize:20,cursor:'pointer'}}>×</button>
                    </div>
                    <div style={{padding:22,display:'flex',flexDirection:'column',gap:18}}>
                      {editingId === sel.id ? (
                      <div>
                        <div className="blueprint-grid" style={{gap:10,marginBottom:12}}>
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
                            <input className="input-base" type="number" min={1} value={(editForm as Partial<BeadItem>).quantity ?? 0} onChange={e=>setEditForm(f=>({...f,quantity:Number(e.target.value)}))} />
                          </div>
                          <div style={{gridColumn:'1/-1'}}>
                            <label className="label">Notes</label>
                            <input className="input-base" value={(editForm as Partial<BeadItem>).notes||''} onChange={e=>setEditForm(f=>({...f,notes:e.target.value}))} />
                          </div>
                        </div>
                        <div style={{display:'flex',gap:8}}>
                          <button className="btn-primary" style={{fontSize:12,padding:'6px 14px'}} onClick={()=>editItem(sel.id!)}>Save</button>
                          <button className="btn-outline" style={{fontSize:12,padding:'6px 14px'}} onClick={()=>{setEditingId(null);setEditForm({})}}>Cancel</button>
                        </div>
                        </div>
                      ) : (
                        <>
                          <h2 className="display" style={{fontSize:28,lineHeight:1,letterSpacing:'-.02em'}}>{sel.name}</h2>
                          <dl className="spec-grid">
                            <dt>Type</dt><dd>{sel.type}</dd>
                            {sel.size && <><dt>Size</dt><dd>{sel.size}</dd></>}
                            {sel.shape && <><dt>Shape</dt><dd>{sel.shape}</dd></>}
                            {sel.colour && <><dt>Colour</dt><dd>{sel.colour}</dd></>}
                            <dt>Hex</dt><dd>{safeHex(sel.hex).toUpperCase()}</dd>
                          </dl>
                          <div className="well" style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px'}}>
                            <button type="button" className="qty-btn" aria-label="One fewer" onClick={()=>stepQty(sel,-1)} disabled={qtyBusy || sel.quantity <= 0}>−</button>
                            <div style={{display:'flex',flexDirection:'column',alignItems:'center'}} aria-live="polite">
                              <span className="display" style={{fontSize:28,lineHeight:1}}>{sel.quantity}</span>
                              <span className="eyebrow eyebrow--sm">In stash</span>
                            </div>
                            <button type="button" className="qty-btn" aria-label="One more" onClick={()=>stepQty(sel,1)} disabled={qtyBusy}>+</button>
                          </div>
                          {sel.notes && <p className="aside-line">{sel.notes}</p>}
                          <div style={{display:'flex',flexDirection:'column',gap:8}}>
                            <Link href="/make" className="btn-primary btn-md">Design from your stash →</Link>
                            <Link href="/sequence" className="btn-outline btn-md">Build a palette</Link>
                          </div>
                          <div style={{display:'flex',alignItems:'center',gap:16,paddingTop:12,borderTop:'1px solid var(--seam)'}}>
                            <button className="link-quiet" onClick={() => { setEditingId(sel.id!); setEditForm(sel) }}>✎ edit</button>
                            {confirmRow(sel.id!)}
                          </div>
                        </>
                      )}
                    </div>
                  </aside>
                )}
              </div>
            )
          ) : (
            filteredFindings.length === 0 ? (
              <StrandEmpty line={search||filterType?'No findings match your filter.':'No findings yet. Add your clasps, ear wires, and pins.'} />
            ) : (
              <div className="tray-grid tray-grid--fill" style={{['--min' as string]:'240px'}}>
                {filteredFindings.map(f => (
                  <div key={f.id} style={{padding:'14px 16px',background:'var(--mocha)',border:'1px solid var(--seam)',display:'flex',flexDirection:'column',gap:10}}>
                    {editingId === f.id ? (
                      <div>
                        <div className="blueprint-grid" style={{gap:10,marginBottom:12}}>
                          <div style={{gridColumn:'1/-1'}}>
                            <label className="label">Name</label>
                            <input className="input-base" value={(editForm as Partial<FindingItem>).name||''} onChange={e=>setEditForm(fm=>({...fm,name:e.target.value}))} />
                          </div>
                          <div>
                            <label className="label">Type</label>
                            <div style={{position:'relative'}}>
                              <select className="select-base" value={(editForm as Partial<FindingItem>).type||''} onChange={e=>setEditForm(fm=>({...fm,type:e.target.value as FindingItem['type']}))}>
                                {findingTypes.map(t=><option key={t} value={t}>{t.replace(/_/g,' ')}</option>)}
                              </select>
                              {arrow}
                            </div>
                          </div>
                          <div>
                            <label className="label">Metal</label>
                            <div style={{position:'relative'}}>
                              <select className="select-base" value={(editForm as Partial<FindingItem>).metal||''} onChange={e=>setEditForm(fm=>({...fm,metal:e.target.value as FindingItem['metal']}))}>
                                {metals.map(m=><option key={m} value={m}>{m.replace(/_/g,' ')}</option>)}
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
                            <input className="input-base" type="number" min={1} value={(editForm as Partial<FindingItem>).quantity ?? 0} onChange={e=>setEditForm(fm=>({...fm,quantity:Number(e.target.value)}))} />
                          </div>
                          <div style={{gridColumn:'1/-1'}}>
                            <label className="label">Notes</label>
                            <input className="input-base" value={(editForm as Partial<FindingItem>).notes||''} onChange={e=>setEditForm(fm=>({...fm,notes:e.target.value}))} />
                          </div>
                        </div>
                        <div style={{display:'flex',gap:8}}>
                          <button className="btn-primary" style={{fontSize:12,padding:'6px 14px'}} onClick={()=>editItem(f.id!)}>Save</button>
                          <button className="btn-outline" style={{fontSize:12,padding:'6px 14px'}} onClick={()=>{setEditingId(null);setEditForm({})}}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                          <div style={{display:'flex',flexDirection:'column',minWidth:0}}>
                            <span style={{color:'var(--cream)',fontSize:15}}>{f.name}</span>
                            <span className="eyebrow eyebrow--sm" style={{letterSpacing:'.12em'}}>{f.type.replace(/_/g,' ')} · {f.metal.replace(/_/g,' ')}{f.size?` · ${f.size}`:''}</span>
                          </div>
                          <span style={{fontFamily:'var(--font-mono)',fontSize:11,letterSpacing:'.1em',color: f.quantity < LOW ? 'var(--ochre)' : 'var(--cream)'}}>{f.quantity}</span>
                        </div>
                        {f.notes && <p className="aside-line" style={{fontSize:14}}>{f.notes}</p>}
                        <div style={{display:'flex',alignItems:'center',gap:16}}>
                          <button className="link-quiet" onClick={() => { setEditingId(f.id!); setEditForm(f) }}>✎ edit</button>
                          {confirmRow(f.id!)}
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
