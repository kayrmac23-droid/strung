'use client'
import { useState, useRef } from 'react'
import Nav from '@/components/Nav'

const suggestions = [
  "What's the best setting for a fragile opal?",
  "How do I solder fine silver without melting it?",
  "Which gemstones work well with rose gold?",
  "What's the difference between fine and sterling silver?",
  "How do I achieve a matte finish on brass?",
  "What tools do I need to start wire wrapping?",
  "How do I prevent fire scale on silver?",
  "Can I combine copper and sterling silver in one piece?",
]

export default function AdvisorPage() {
  const [question, setQuestion] = useState('')
  const [context, setContext] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<{q:string;a:string}[]>([])
  const ref = useRef<HTMLDivElement>(null)

  async function ask(q?: string) {
    const finalQ = q || question
    if (!finalQ.trim() || loading) return
    setLoading(true); setResponse('')
    try {
      const res = await fetch('/api/advice', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ question: finalQ, context }),
      })
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value)
        setResponse(full)
        ref.current?.scrollIntoView({ behavior:'smooth', block:'end' })
      }
      setHistory(h => [{q:finalQ,a:full},...h].slice(0,5))
      if (!q) setQuestion('')
    } catch { setResponse('Error — check your ANTHROPIC_API_KEY environment variable.') }
    finally { setLoading(false) }
  }

  function fmt(text: string) {
    return text
      .replace(/###\s(.+)/g,'<h3 style="font-family:var(--font-display);font-size:19px;color:var(--gold2);margin:20px 0 8px">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g,'<strong style="color:var(--gold3)">$1</strong>')
      .replace(/^[-•]\s(.+)/gm,'<li style="margin-bottom:6px;padding-left:4px">$1</li>')
      .replace(/(<li[^>]*>.*<\/li>)/gs,'<ul style="margin:10px 0 14px 16px">$1</ul>')
      .split('\n\n').map(p => p.startsWith('<') ? p : `<p style="margin-bottom:12px">${p}</p>`).join('')
  }

  return (
    <>
      <Nav />
      <main style={{paddingTop:64,minHeight:'100vh'}}>
        <div style={{maxWidth:1200,margin:'0 auto',padding:'60px 40px 80px'}}>
          <header style={{marginBottom:48}}>
            <span className="tag fade-up">AI Design Advisor</span>
            <h1 className="fade-up-1" style={{fontSize:48,color:'var(--cream)',margin:'12px 0 12px',fontFamily:'var(--font-display)',fontWeight:400}}>Ask the Advisor</h1>
            <p className="fade-up-2" style={{color:'var(--text2)',fontSize:18}}>Expert guidance on materials, techniques, tools, and design decisions.</p>
          </header>

          <div style={{display:'grid',gridTemplateColumns:'360px 1fr',gap:32,alignItems:'start'}}>
            {/* Input pane */}
            <div>
              <div className="card fade-up-2" style={{padding:32}}>
                <label className="label">Your skill level</label>
                <div style={{position:'relative',marginBottom:20}}>
                  <select className="select-base" value={context} onChange={e=>setContext(e.target.value)}>
                    <option value="">No context</option>
                    <option value="complete beginner with basic tools">Complete beginner</option>
                    <option value="hobbyist with 1-2 years experience">Hobbyist (1-2 years)</option>
                    <option value="intermediate maker with a home studio">Intermediate — home studio</option>
                    <option value="advanced maker or semi-professional">Advanced / semi-pro</option>
                  </select>
                  <span style={{position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',color:'var(--muted)',pointerEvents:'none'}}>▾</span>
                </div>
                <label className="label">Your question</label>
                <textarea className="input-base" placeholder="Ask about metals, gemstones, techniques, tools, finishing…"
                  value={question} onChange={e=>setQuestion(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&e.metaKey&&ask()} rows={4} />
                <p style={{fontFamily:'var(--font-mono)',fontSize:10,color:'var(--muted2)',marginTop:6,letterSpacing:'0.08em'}}>⌘ + Enter to submit</p>
                <button className="btn-gold" style={{width:'100%',justifyContent:'center',marginTop:12}}
                  onClick={()=>ask()} disabled={loading}>
                  {loading ? <><span className="spinner"/>Thinking…</> : '◈ Ask Advisor'}
                </button>
              </div>

              <div className="fade-up-3" style={{marginTop:24}}>
                <p className="label" style={{marginBottom:12}}>Try asking…</p>
                <div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {suggestions.map(s => (
                    <button key={s} onClick={()=>{setQuestion(s);ask(s)}} style={{
                      background:'var(--surface)',border:'1px solid var(--border)',
                      color:'var(--text2)',fontFamily:'var(--font-body)',fontSize:14,
                      padding:'10px 14px',textAlign:'left',transition:'all 0.15s',lineHeight:1.4,
                      cursor:'pointer'
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--gold)';e.currentTarget.style.color='var(--gold2)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text2)'}}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Response pane */}
            <div>
              {response ? (
                <div className="card" style={{padding:32}} ref={ref}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:20,paddingBottom:16,borderBottom:'1px solid var(--border)'}}>
                    <span style={{color:'var(--gold)'}}>◈</span>
                    <span className="mono" style={{fontSize:11,letterSpacing:'0.1em',color:'var(--muted)'}}>ADVISOR RESPONSE</span>
                  </div>
                  <div style={{color:'var(--text)',fontFamily:'var(--font-body)',fontSize:17,lineHeight:1.8}}
                    dangerouslySetInnerHTML={{__html:fmt(response)}} />
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                  minHeight:300,border:'1px dashed var(--border)',color:'var(--muted2)',gap:16,fontSize:16}}>
                  <span style={{fontSize:48,color:'var(--border2)',animation:'shimmer 3s ease-in-out infinite'}}>◈</span>
                  <p>Your answer will appear here</p>
                </div>
              )}

              {history.length > 1 && (
                <div style={{marginTop:20}}>
                  <p className="label" style={{marginBottom:10}}>Previous questions</p>
                  {history.slice(1).map((h,i) => (
                    <button key={i} onClick={()=>{setResponse(h.a);setQuestion(h.q)}} style={{
                      display:'flex',alignItems:'flex-start',gap:8,width:'100%',
                      background:'var(--surface)',border:'1px solid var(--border)',
                      color:'var(--muted)',fontFamily:'var(--font-body)',fontSize:14,
                      padding:'10px 14px',textAlign:'left',marginBottom:4,cursor:'pointer',transition:'all 0.15s'
                    }}
                    onMouseEnter={e=>{e.currentTarget.style.color='var(--text2)'}}
                    onMouseLeave={e=>{e.currentTarget.style.color='var(--muted)'}}>
                      <span style={{color:'var(--gold)'}}>◂</span> {h.q}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
