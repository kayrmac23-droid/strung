'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Nav, { MakeTabs } from '@/components/Nav'
import Schematic from '@/components/Schematic'
import StrandEmpty from '@/components/StrandEmpty'
import type { BeadItem, FindingItem } from '@/lib/supabase'
import StrandLoader from '@/components/StrandLoader'
import { formatRichText, CHAT_MESSAGE } from '@/lib/richText'
import { validateAssembly, type Assembly } from '@/lib/assembly'
import { getAuthHeaders, getSession } from '@/lib/authClient'
import { prepareImageForIdentify } from '@/lib/imagePrep'
import { readTextStream } from '@/lib/streamText'
import { trimChatHistory } from '@/lib/chatMessages'
import { STREAM_ERROR_MARKER } from '@/lib/apiRequest'

type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
type TextBlock = { type: 'text'; text: string }
type ContentBlock = ImageBlock | TextBlock

interface Message {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
  display: string
  imageDataUrl?: string
}

interface BlueprintStep {
  id: number
  instruction: string
  material: string | null
  technique: string | null
  tip: string | null
}

// Mirrors the /api/make design schema so a blueprint is already build-compatible.
interface Blueprint {
  title: string
  description: string
  colourStory: string
  difficulty: string
  estimatedTime: string
  pieceType: string
  materialsCheck?: { allAvailable: boolean; notes: string }
  components: { item: string; quantity: number; note: string }[]
  assembly?: Assembly
  steps: BlueprintStep[]
}

// The codesign route streams, so it has no one-shot repair retry like /api/make.
// The same check runs here instead, on the parsed blueprint: an assembly that
// names materials outside components[] describes an arrangement the design does
// not contain, so it is dropped rather than drawn or saved. The rest of the
// blueprint is untouched and falls back to the single-strand diagram.
function checkedBlueprint(parsed: Blueprint, beads: BeadItem[], findings: FindingItem[]): Blueprint {
  if (!parsed?.assembly) return parsed
  const violations = validateAssembly(parsed, beads, findings)
  if (violations.length === 0) return parsed
  console.warn('Dropping invalid blueprint assembly:', violations)
  const stripped = { ...parsed }
  delete stripped.assembly
  return stripped
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function parseMessage(raw: string, beads: BeadItem[], findings: FindingItem[]): { display: string; blueprint: Blueprint | null } {
  // A cut-short reply ends with the marker, which would sit inside an unclosed
  // blueprint and be stripped with it. Take it off first, put it back after.
  const cut = raw.endsWith(STREAM_ERROR_MARKER)
  const text = cut ? raw.slice(0, -STREAM_ERROR_MARKER.length) : raw
  // The model may revise the design within one reply; the LAST blueprint is the
  // current one (the first match used to win, showing a superseded design).
  const matches = [...text.matchAll(/<blueprint>([\s\S]*?)<\/blueprint>/g)]
  // An unclosed block (a reply cut off mid-blueprint) is hidden too. Only
  // closed blocks were stripped, so a truncated reply ended up showing its raw
  // half-written JSON in the chat once streaming finished.
  const stripped = text
    .replace(/<blueprint>[\s\S]*?(<\/blueprint>|$)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  const display = cut ? `${stripped}${STREAM_ERROR_MARKER}`.trim() : stripped
  if (matches.length === 0) return { display, blueprint: null }
  try {
    const parsed = JSON.parse(matches[matches.length - 1][1].trim())
    // Anything without a title and steps cannot be saved or built from.
    if (!isRecord(parsed) || typeof parsed.title !== 'string' || !Array.isArray(parsed.steps)) {
      return { display, blueprint: null }
    }
    // The panel reads c.item and s.instruction off every entry, so one null or
    // bare-string entry threw during render and took the whole page down.
    const blueprint = {
      ...parsed,
      components: Array.isArray(parsed.components)
        ? parsed.components.filter((c) => isRecord(c) && typeof c.item === 'string')
        : [],
      steps: parsed.steps.filter((st) => isRecord(st) && typeof st.instruction === 'string'),
    } as unknown as Blueprint
    if (blueprint.steps.length === 0) return { display, blueprint: null }
    return { display, blueprint: checkedBlueprint(blueprint, beads, findings) }
  } catch {
    return { display, blueprint: null }
  }
}

const SIGN_IN_MESSAGE = 'Sign in to chat with the co-designer.'

function errorMessage(status: number): string {
  if (status === 429) return 'You are sending messages quickly — give it a moment and try again.'
  if (status === 401) return SIGN_IN_MESSAGE
  if (status === 400) return 'That message could not be sent — the conversation may be too long or the photo too large. Try starting a new chat.'
  return 'The co-designer is unavailable right now. Please try again in a moment.'
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
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState('')
  const [attachError, setAttachError] = useState('')
  // Bumped when the blueprint changes so an in-flight render for the previous
  // blueprint cannot land on the new one.
  const imageRequest = useRef(0)
  const [saveError, setSaveError] = useState('')
  const [signedOut, setSignedOut] = useState(false)
  const [beads, setBeads] = useState<BeadItem[]>([])
  const [findings, setFindings] = useState<FindingItem[]>([])
  const [view, setView] = useState<'visual' | 'schematic'>('schematic')
  const [pendingImage, setPendingImage] = useState<{ base64: string; mediaType: string; dataUrl: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      setSignedOut(!(await getSession()))
    })().catch(() => {})
  }, [])

  // Load the stash once so the schematic reflects the real palette.
  useEffect(() => {
    ;(async () => {
      const res = await fetch('/api/inventory', { headers: await getAuthHeaders() })
      if (!res.ok) return
      const d = await res.json()
      setBeads(d.beads || [])
      setFindings(d.findings || [])
    })().catch(() => {})
  }, [])

  // A new blueprint invalidates the old render. Rendered on demand rather than
  // automatically: every blueprint revision would otherwise be a GPT Image call,
  // the most expensive request in the app.
  function applyBlueprint(bp: Blueprint) {
    imageRequest.current++
    setBlueprint(bp)
    setImageUrl('')
    setImageError('')
    setImageLoading(false)
    setSaved(false)
  }

  async function renderPreview() {
    if (!blueprint || imageLoading) return
    const request = ++imageRequest.current
    const current = () => request === imageRequest.current
    setImageLoading(true)
    setImageError('')
    try {
      const res = await fetch('/api/make/image', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(blueprint),
      })
      const data = await res.json().catch(() => ({}))
      if (!current()) return
      if (res.ok && data.imageUrl) {
        setImageUrl(data.imageUrl)
        return
      }
      setImageError(
        res.status === 501
          ? 'Preview images aren’t configured on this deployment (missing OPENAI_API_KEY).'
          : res.status === 429
            ? 'Too many previews in a row — wait a moment and try again.'
            : 'Couldn’t render a preview image — the blueprint itself is ready to build.'
      )
    } catch {
      if (current()) setImageError('Couldn’t render a preview image — the blueprint itself is ready to build.')
    } finally {
      if (current()) setImageLoading(false)
    }
  }

  function pickImage() {
    fileInputRef.current?.click()
  }

  // Same downscale-and-reencode as Stash photo identification. The inline copy
  // this replaces had no error path, so a photo the browser could not decode
  // (HEIC on desktop, a corrupt file) silently did nothing.
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAttachError('')
    try {
      const { imageData, mediaType } = await prepareImageForIdentify(file)
      setPendingImage({ base64: imageData, mediaType, dataUrl: `data:${mediaType};base64,${imageData}` })
    } catch (err) {
      setAttachError(err instanceof Error ? err.message : 'Could not read that photo — try a JPEG or PNG')
    }
  }

  async function send(override?: string) {
    const text = (override ?? input).trim()
    if ((!text && !pendingImage) || loading) return
    if (signedOut) {
      setMessages(m => [...m, { role: 'assistant', content: '', display: SIGN_IN_MESSAGE }])
      return
    }

    const content: string | ContentBlock[] = pendingImage
      ? [
          { type: 'image', source: { type: 'base64', media_type: pendingImage.mediaType, data: pendingImage.base64 } },
          { type: 'text', text: text || 'What do you think of this?' },
        ]
      : text

    const userMsg: Message = {
      role: 'user',
      content,
      display: text || 'What do you think of this?',
      imageDataUrl: pendingImage?.dataUrl,
    }

    const next = [...messages, userMsg]
    setMessages([...next, { role: 'assistant', content: '', display: '' }])
    setInput('')
    setPendingImage(null)
    setLoading(true)

    try {
      const res = await fetch('/api/codesign', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          // Error notices are shown in the chat but are not part of the
          // conversation: their content is '' so they never reach the model.
          // Trimmed to the recent turns and photos — see trimChatHistory.
          messages: trimChatHistory(next.filter(m => typeof m.content !== 'string' || m.content.trim())),
        }),
      })

      if (!res.ok) {
        const msg = errorMessage(res.status)
        if (res.status === 401) setSignedOut(true)
        setMessages(m => {
          const updated = [...m]
          updated[updated.length - 1] = { role: 'assistant', content: '', display: msg }
          return updated
        })
        setLoading(false)
        return
      }

      const full = await readTextStream(res.body, currentFull => {
        // Hide a blueprint while it streams, including one not yet closed.
        const liveDisplay = currentFull.replace(/<blueprint>[\s\S]*?(<\/blueprint>|$)/g, '').trim()
        setMessages(m => {
          const updated = [...m]
          updated[updated.length - 1] = { role: 'assistant', content: currentFull, display: liveDisplay }
          return updated
        })
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      })

      const { display, blueprint: bp } = parseMessage(full, beads, findings)
      setMessages(m => {
        const updated = [...m]
        // An empty display renders as the typing spinner, so a reply that was
        // only a blueprint (or nothing at all) used to spin forever.
        updated[updated.length - 1] = {
          role: 'assistant',
          content: full,
          display: display || (bp ? 'Blueprint updated — see the panel.' : 'No reply came back — please try again.'),
        }
        return updated
      })
      if (bp) applyBlueprint(bp)
    } catch {
      setMessages(m => {
        const updated = [...m]
        updated[updated.length - 1] = { role: 'assistant', content: '', display: 'Could not reach the co-designer. Check your connection and try again.' }
        return updated
      })
    }

    setLoading(false)
    inputRef.current?.focus()
  }

  async function saveToJournal() {
    if (!blueprint || saving || saved) return
    setSaveError('')
    if (!await getSession()) { setSaveError('Sign in to save designs.'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: await getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          title: blueprint.title,
          design: blueprint,
          status: 'draft',
          current_step: 0,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      // Stays "saved" until the blueprint changes (applyBlueprint resets it).
      // It used to re-enable after three seconds, inviting a duplicate entry.
      setSaved(true)
    } catch { setSaveError('Failed to save. Try again.') }
    finally { setSaving(false) }
  }

  return (
    <>
      <Nav />
      <main id="main" className="page-main">
        <MakeTabs />
        <div className="wrap ss-up" style={{ paddingTop: 'clamp(28px,4vw,48px)', paddingBottom: 80, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <h1 className="sr-only">Co-design</h1>

          {signedOut && (
            <div className="well" style={{ padding: '12px 18px' }}>
              <span style={{ fontSize: 15 }}>
                <Link href="/account" className="link-under">Sign in</Link>&nbsp; to chat with the co-designer — it designs from your stash.
              </span>
            </div>
          )}

          <div className="split" style={{ ['--min' as string]: '400px', gap: 2, alignItems: 'start' }}>

            {/* Chat */}
            <section className="panel" aria-label="Conversation" style={{ display: 'flex', flexDirection: 'column', minHeight: 620 }}>
              <div className="panel-head"><span>Talking it through</span></div>
              <div style={{ flex: 1, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 22 }}>
                {messages.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <p className="aside-line" style={{ fontSize: 19, color: 'var(--text2)' }}>Describe what you have in mind — or start from one of these.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {starters.map(st => (
                        <button key={st} type="button" className="tray-btn" onClick={() => send(st)} disabled={signedOut}
                          style={{ padding: '12px 16px', fontSize: 15, boxShadow: 'none', background: 'var(--roast)' }}>{st}</button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div role="log" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                    {messages.map((msg, i) => {
                      const me = msg.role === 'user'
                      return (
                        <div key={i} className="ss-up" style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: me ? 'flex-end' : 'flex-start' }}>
                          <span className="eyebrow eyebrow--sm" style={{ color: me ? 'var(--meta)' : 'var(--cream)' }}>{me ? 'You' : 'strung'}</span>
                          <div style={me
                            ? { maxWidth: '80%', padding: '12px 16px', background: 'var(--umber)', border: '1px solid var(--seam)', borderRadius: 2, fontSize: 16, lineHeight: 1.5, color: 'var(--cream)' }
                            : { maxWidth: '92%', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 19, lineHeight: 1.45, color: 'var(--cream)' }}>
                            {msg.imageDataUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={msg.imageDataUrl}
                                alt="uploaded reference"
                                style={{ display: 'block', maxWidth: '100%', maxHeight: 240, objectFit: 'contain', marginBottom: msg.display ? 10 : 0, border: '1px solid var(--seam)' }}
                              />
                            )}
                            {!me
                              ? msg.display
                                ? <div className="chat-answer" dangerouslySetInnerHTML={{ __html: formatRichText(msg.display, CHAT_MESSAGE) }} />
                                : <span className="eyebrow" style={{ fontStyle: 'normal' }}>strung is checking your stash…</span>
                              : msg.display}
                          </div>
                        </div>
                      )
                    })}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {/* Input */}
              <div style={{ padding: 14, borderTop: '1px solid var(--seam)', position: 'sticky', bottom: 0, background: 'var(--mocha)' }}>
                {pendingImage && (
                  <div className="well" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, padding: '10px 12px' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pendingImage.dataUrl} alt="attachment preview" style={{ height: 60, maxWidth: 100, objectFit: 'cover', border: '1px solid var(--seam)' }} />
                    <div style={{ flex: 1 }}>
                      <p className="eyebrow eyebrow--sm" style={{ color: 'var(--tan)', marginBottom: 4 }}>Image attached</p>
                      <p style={{ fontSize: 13, color: 'var(--meta)' }}>Add a message or send as-is</p>
                    </div>
                    <button onClick={() => setPendingImage(null)} aria-label="Remove attached photo" style={{ background: 'none', border: 'none', color: 'var(--meta)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
                  <button type="button" onClick={pickImage} title="Attach a photo" aria-label="Attach a photo" className="qty-btn"
                    style={{ height: 'auto', minHeight: 46, flexShrink: 0, color: pendingImage ? 'var(--madder-text)' : 'var(--cream)' }}>+</button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                  <textarea
                    ref={inputRef}
                    className="input-base"
                    style={{ flex: 1, minWidth: 0, resize: 'none', minHeight: 46, maxHeight: 140 }}
                    aria-label="Message"
                    placeholder="Describe what you're imagining"
                    value={input}
                    rows={1}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() } }}
                  />
                  <button className="btn-primary" onClick={() => send()} disabled={loading || (!input.trim() && !pendingImage)} style={{ padding: '0 18px', flexShrink: 0 }}>
                    {loading ? <span className="spinner" /> : 'Send'}
                  </button>
                </div>
                {attachError && (
                  <p role="alert" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--madder-text)', marginTop: 6, letterSpacing: '0.06em' }}>{attachError}</p>
                )}
                <p className="eyebrow eyebrow--sm" style={{ marginTop: 8, color: 'var(--muted2)', textTransform: 'none', letterSpacing: '.08em' }}>⌘/Ctrl + Enter to send · + to attach a photo</p>
              </div>
            </section>

            {/* Live blueprint */}
            <section className="panel codesign-blueprint" aria-label="Live blueprint">
              <div className="panel-head">
                <span>Live blueprint</span>
                {blueprint && <span style={{ color: 'var(--sage)' }}>● In sync</span>}
              </div>
              {!blueprint ? (
                <StrandEmpty line="Your blueprint builds up here as you talk. It appears once the design has enough shape." />
              ) : (
                <>
                  <div style={{ background: 'var(--roast)', borderBottom: '1px solid var(--seam)' }}>
                    <div role="tablist" aria-label="Blueprint view" className="chip-row" style={{ padding: 10 }}>
                      {([['schematic', 'Diagram'], ['visual', 'Render']] as const).map(([v, label]) => (
                        <button key={v} role="tab" aria-selected={view === v} className="chip" style={{ padding: '6px 12px', fontSize: 10 }} onClick={() => setView(v)}>{label}</button>
                      ))}
                    </div>
                    <div style={{ padding: '0 12px 12px' }}>
                      {view === 'schematic' ? (
                        <Schematic blueprint={blueprint} beads={beads} findings={findings} />
                      ) : imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={imageUrl} alt={blueprint.title} style={{ width: '100%', display: 'block', aspectRatio: '1 / 1', objectFit: 'cover' }} />
                      ) : imageLoading ? (
                        <div className="render-well" style={{ minHeight: 0, aspectRatio: '1 / 1' }}>
                          <StrandLoader label="Rendering design…" />
                        </div>
                      ) : (
                        <div className="render-well" style={{ minHeight: 220, flexDirection: 'column', gap: 12, padding: 20, textAlign: 'center' }}>
                          {imageError && <span style={{ fontSize: 14, color: 'var(--text2)' }}>{imageError}</span>}
                          <button className="btn-outline" onClick={renderPreview}>{imageError ? 'Retry preview' : 'Render preview'}</button>
                        </div>
                      )}
                      <p className="eyebrow eyebrow--sm" style={{ marginTop: 6, letterSpacing: '.12em', color: view === 'schematic' ? 'var(--meta)' : 'var(--tan)' }}>
                        {view === 'schematic' ? 'Buildable diagram · matched to your stash' : 'AI render · for reference only'}
                      </p>
                    </div>
                  </div>

                  <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <h2 className="display" style={{ fontSize: 40, lineHeight: 1, letterSpacing: '-.02em' }}>{blueprint.title}</h2>
                    <span className="eyebrow eyebrow--sm" style={{ color: 'var(--tan)', letterSpacing: '.12em' }}>
                      {[blueprint.pieceType, blueprint.difficulty, blueprint.estimatedTime].filter(Boolean).join(' · ')}
                      {blueprint.materialsCheck && !blueprint.materialsCheck.allAvailable && <span style={{ color: 'var(--ochre)' }}> · Check materials</span>}
                    </span>
                    {blueprint.description && <p className="aside-line" style={{ color: 'var(--text2)' }}>{blueprint.description}</p>}
                    {blueprint.colourStory && (
                      <div className="well" style={{ padding: '12px 14px' }}>
                        <span className="eyebrow eyebrow--sm" style={{ color: 'var(--tan)' }}>Colour story</span>
                        <p style={{ fontSize: 14, marginTop: 4, lineHeight: 1.6 }}>{blueprint.colourStory}</p>
                      </div>
                    )}
                    {blueprint.materialsCheck?.notes && (
                      <div className="well" style={{ padding: '12px 14px' }}>
                        <span className="eyebrow eyebrow--sm" style={{ color: 'var(--ochre)' }}>Materials note</span>
                        <p style={{ fontSize: 14, marginTop: 4 }}>{blueprint.materialsCheck.notes}</p>
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {(blueprint.components ?? []).map((c, i) => (
                        <div key={i} className="row-line" style={{ padding: '9px 0', fontSize: 15, justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ color: 'var(--cream)' }}>{c.item}{c.note && <span style={{ display: 'block', fontSize: 12, color: 'var(--meta)' }}>{c.note}</span>}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--tan)' }}>×{c.quantity}</span>
                        </div>
                      ))}
                    </div>
                    {(blueprint.steps ?? []).length > 0 && (
                      <details className="steps-details">
                        <summary className="eyebrow" style={{ letterSpacing: '.14em' }}>Build steps · {(blueprint.steps ?? []).length}</summary>
                        <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                          {(blueprint.steps ?? []).map((st, i) => (
                            <li key={st.id ?? i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                              <span className="numeral" style={{ fontSize: 22, lineHeight: 1.1, color: 'var(--saddle)', minWidth: 26 }}>{String(i + 1).padStart(2, '0')}</span>
                              <div>
                                <p style={{ fontSize: 14, lineHeight: 1.5 }}>{st.instruction}</p>
                                {st.technique && <span className="eyebrow eyebrow--sm" style={{ color: 'var(--tan)', display: 'block', marginTop: 3 }}>{st.technique}</span>}
                                {st.tip && <p className="aside-line" style={{ fontSize: 14, marginTop: 3 }}>{st.tip}</p>}
                              </div>
                            </li>
                          ))}
                        </ol>
                      </details>
                    )}
                    <button
                      className={saved ? 'btn-outline' : 'btn-primary'}
                      onClick={saveToJournal}
                      disabled={saved || saving}
                      style={{ width: '100%', padding: '14px 20px 13px', marginTop: 6 }}
                    >
                      {saved ? '✓ Saved to journal' : saving ? 'Saving…' : 'Save to journal'}
                    </button>
                    {saveError && (
                      <p role="alert" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--madder-text)', letterSpacing: '0.06em' }}>{saveError}</p>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </main>
    </>
  )
}
