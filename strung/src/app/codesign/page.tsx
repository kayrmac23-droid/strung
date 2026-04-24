'use client'
import { useState, useEffect, useRef } from 'react'
import Nav from '@/components/Nav'

interface Message {
  role: 'user' | 'assistant'
  content: string
  display: string
}

interface Blueprint {
  title: string
  tagline: string
  type: string
  difficulty: string
  time: string
  overview: string
  components: { part: string; material: string; dimensions: string; note: string }[]
  steps: string[]
  techniques: string[]
  tools: string[]
  variations?: string[]
  tips?: string[]
}

function parseMessage(text: string): { display: string; blueprint: Blueprint | null } {
  const match = text.match(/<blueprint>([\s\S]*?)<\/blueprint>/)
  if (!match) return { display: text, blueprint: null }
  try {
    const display = text.replace(/<blueprint>[\s\S]*?<\/blueprint>/g, '').replace(/\n{3,}/g, '\n\n').trim()
    return { display, blueprint: JSON.parse(match[1].trim()) }
  } catch {
    return { display: text.replace(/<blueprint>[\s\S]*?<\/blueprint>/g, '').trim(), blueprint: null }
  }
}

function fmt(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--cream)">$1</strong>')
    .replace(/^[-•]\s(.+)/gm, '<li style="margin-bottom:4px;padding-left:4px">$1</li>')
    .replace(/(<li[^>]*>[\s\S]*?<\/li>)/g, '<ul style="margin:8px 0 10px 16px">$1</ul>')
    .split('\n\n').map(p => p.startsWith('<') ? p : `<p style="margin-bottom:10px">${p}</p>`).join('')
}

const starters = [
  "I want to make something for my sister's birthday — she loves the ocean",
  "I have a lot of labradorite and I'm not sure what to make with it",
  "I want earrings that feel celestial and a bit dark and moody",
  "Help me design a statement necklace for a wedding guest outfit",
]

export default function CoDesignPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null)
  const [beads, setBeads] = useState<any[]>([])
  const [findings, setFindings] = useState<any[]>([])
  const [saved, setSaved] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/inventory').then(r => r.json()).then(d => {
      setBeads(d.beads || [])
      setFindings(d.findings || [])
    }).catch(() => {})
  }, [])

  async function send(override?: string) {
    const text = (override ?? input).trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text, display: text }
    const next = [...messages, userMsg]
    setMessages([...next, { role: 'assistant', content: '', display: '' }])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/codesign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
          beads,
          findings,
        }),
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value)
        const liveDisplay = full.replace(/<blueprint>[\s\S]*?(<\/blueprint>)?/g, '').trim()
        setMessages(m => {
          const updated = [...m]
          updated[updated.length - 1] = { role: 'assistant', content: full, display: liveDisplay }
          return updated
        })
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      }

      const { display, blueprint: bp } = parseMessage(full)
      setMessages(m => {
        const updated = [...m]
        updated[updated.length - 1] = { role: 'assistant', content: full, display }
        return updated
      })
      if (bp) setBlueprint(bp)
    } catch {
      setMessages(m => {
        const updated = [...m]
        updated[updated.length - 1] = { role: 'assistant', content: 'Something went wrong.', display: 'Something went wrong. Check your API key.' }
        return updated
      })
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  async function saveToJournal() {
    if (!blueprint) return
    try {
      await fetch('/api/designs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: blueprint.title, type: blueprint.type, difficulty: blueprint.difficulty, source: 'codesign', blueprint, status: 'saved' }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {}
  }

  const diffColor = (d: string) => d === 'Beginner' ? 'var(--sage)' : d === 'Advanced' ? 'var(--rose)' : 'var(--moonstone)'

  return (
    <>
      <Nav />
      <main style={{ paddingTop: 60, minHeight: '100vh' }}>
        <div className="page-pad" style={{ maxWidth: 1300, margin: '0 auto', paddingTop: 52, paddingBottom: 80 }}>
          <header style={{ marginBottom: 32 }}>
            <p className="section-eyebrow fade-up">AI Co-Designer</p>
            <h1 className="fade-up-1" style={{ fontSize: 44, color: 'var(--cream)', fontFamily: 'var(--font-display)', fontWeight: 400, margin: '8px 0 10px' }}>Design Studio</h1>
            <p className="fade-up-2" style={{ color: 'var(--text2)', fontSize: 17 }}>Chat with your AI co-designer. Describe what you&apos;re imagining and build a blueprint together.</p>
          </header>

          <div className="codesign-grid">

            {/* Chat column */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: 16, minHeight: 320 }}>
                {messages.length === 0 ? (
                  <div style={{ padding: '32px 0' }}>
                    <p style={{ color: 'var(--text2)', fontSize: 16, marginBottom: 16, fontFamily: 'var(--font-body)' }}>
                      Start by describing what you have in mind — or pick a prompt:
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {starters.map(s => (
                        <button key={s} onClick={() => send(s)} style={{
                          background: 'var(--surface)', border: '1px solid var(--border)',
                          color: 'var(--text2)', fontFamily: 'var(--font-body)', fontSize: 14,
                          padding: '11px 16px', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--silver)'; e.currentTarget.style.color = 'var(--cream)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)' }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {messages.map((msg, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 10 }}>
                        {msg.role === 'assistant' && (
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: 'var(--surface2)', border: '1px solid var(--border2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, color: 'var(--silver)', flexShrink: 0, marginTop: 4,
                          }}>◈</div>
                        )}
                        <div style={{
                          maxWidth: '82%', padding: '12px 16px',
                          background: msg.role === 'user' ? 'var(--surface2)' : 'var(--surface)',
                          border: `1px solid ${msg.role === 'user' ? 'var(--silver)' : 'var(--border)'}`,
                          color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.7,
                        }}>
                          {msg.role === 'assistant'
                            ? msg.display
                              ? <div dangerouslySetInnerHTML={{ __html: fmt(msg.display) }} />
                              : <span className="spinner-dark" />
                            : msg.display}
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{ position: 'sticky', bottom: 20, background: 'var(--bg)', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingTop: 12 }}>
                  <textarea
                    ref={inputRef}
                    className="input-base"
                    style={{ flex: 1, resize: 'none', minHeight: 52, maxHeight: 140 }}
                    placeholder="Describe what you're imagining…"
                    value={input}
                    rows={2}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) send() }}
                  />
                  <button className="btn-silver" onClick={() => send()} disabled={loading || !input.trim()} style={{ padding: '14px 20px', flexShrink: 0, fontSize: 18 }}>
                    {loading ? <span className="spinner" /> : '↑'}
                  </button>
                </div>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted2)', marginTop: 6, letterSpacing: '0.08em' }}>⌘ + Enter to send</p>
              </div>
            </div>

            {/* Blueprint panel */}
            <div style={{ position: 'sticky', top: 80 }}>
              {!blueprint ? (
                <div style={{ border: '1px dashed var(--border)', padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 40, color: 'var(--border2)', marginBottom: 16, animation: 'shimmer 3s ease-in-out infinite' }}>◈</div>
                  <p style={{ color: 'var(--muted)', fontSize: 14, fontFamily: 'var(--font-body)', lineHeight: 1.7 }}>
                    Your blueprint will build up here as you chat. The AI will generate it once the design has enough shape.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
                  {/* Header */}
                  <div className="card" style={{ padding: 24, borderTop: '2px solid var(--silver)' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      <span className="tag">{blueprint.type}</span>
                      <span className="tag" style={{ borderColor: diffColor(blueprint.difficulty), color: diffColor(blueprint.difficulty) }}>{blueprint.difficulty}</span>
                      <span className="tag">{blueprint.time}</span>
                    </div>
                    <h2 style={{ fontSize: 26, color: 'var(--cream)', fontFamily: 'var(--font-display)', fontWeight: 400, marginBottom: 6 }}>{blueprint.title}</h2>
                    <p style={{ fontStyle: 'italic', color: 'var(--silver2)', fontSize: 14, marginBottom: 10 }}>{blueprint.tagline}</p>
                    <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.7 }}>{blueprint.overview}</p>
                    <button
                      className={saved ? 'btn-outline' : 'btn-silver'}
                      onClick={saveToJournal}
                      disabled={saved}
                      style={{ width: '100%', justifyContent: 'center', marginTop: 14, fontSize: 11 }}
                    >
                      {saved ? '✓ Saved to Journal' : '⊡ Save to Journal'}
                    </button>
                  </div>

                  {/* Components */}
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, color: 'var(--cream)', marginBottom: 12 }}>◈ Components</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {blueprint.components.map((c, i) => (
                        <div key={i} style={{ borderLeft: '2px solid var(--border2)', paddingLeft: 10 }}>
                          <p style={{ color: 'var(--cream)', fontSize: 13, fontFamily: 'var(--font-display)' }}>{c.part}</p>
                          <p className="mono" style={{ fontSize: 10, color: 'var(--moonstone)', marginTop: 2 }}>{c.material} · {c.dimensions}</p>
                          {c.note && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, fontStyle: 'italic' }}>{c.note}</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, color: 'var(--cream)', marginBottom: 12 }}>◇ Build Steps</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {blueprint.steps.map((s, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ width: 20, height: 20, background: 'var(--surface2)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--silver)', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                          <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5, marginTop: 2 }}>{s}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Techniques + Tools */}
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, color: 'var(--cream)', marginBottom: 8 }}>◉ Techniques</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                      {blueprint.techniques.map(t => <span key={t} className="tag">{t}</span>)}
                    </div>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, color: 'var(--cream)', marginBottom: 8 }}>◎ Tools Needed</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                      {blueprint.tools.map(t => <span key={t} className="tag">{t}</span>)}
                    </div>
                  </div>

                  {/* Variations */}
                  {blueprint.variations && blueprint.variations.length > 0 && (
                    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: '14px 18px' }}>
                      <span className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--moonstone)' }}>VARIATIONS</span>
                      <ul style={{ listStyle: 'none', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {blueprint.variations.map((v, i) => <li key={i} style={{ fontSize: 13, color: 'var(--text2)', paddingLeft: 10, borderLeft: '2px solid var(--border2)' }}>{v}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* Tips */}
                  {blueprint.tips && blueprint.tips.length > 0 && (
                    <div style={{ background: 'rgba(168,180,200,0.05)', border: '1px solid var(--border)', padding: '14px 18px' }}>
                      <span className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--silver)' }}>TIPS</span>
                      <ul style={{ listStyle: 'none', marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {blueprint.tips.map((t, i) => <li key={i} style={{ fontSize: 13, color: 'var(--text2)', paddingLeft: 10, borderLeft: '2px solid var(--border2)' }}>{t}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}
