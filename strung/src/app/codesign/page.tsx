'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Nav from '@/components/Nav'
import Schematic from '@/components/Schematic'
import BeadIcon from '@/components/BeadIcon'
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
  const [view, setView] = useState<'visual' | 'schematic'>('visual')
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

  const diffColor = (d: string) => d === 'Beginner' ? 'var(--sage)' : d === 'Advanced' ? 'var(--rose)' : 'var(--moonstone)'

  return (
    <>
      <Nav />
      <main id="main" className="page-main">
        <div className="page-pad" style={{ maxWidth: 1300, margin: '0 auto', paddingTop: 52, paddingBottom: 80 }}>
          <header style={{ marginBottom: 32 }}>
            <p className="section-eyebrow fade-up">AI Co-Designer</p>
            <h1 className="fade-up-1" style={{ fontSize: 44, color: 'var(--cream)', fontFamily: 'var(--font-display)', fontWeight: 400, margin: '8px 0 10px' }}>Design Studio</h1>
            <p className="fade-up-2" style={{ color: 'var(--text2)', fontSize: 17 }}>Chat with your AI co-designer. Describe what you&apos;re imagining and build a blueprint together.</p>
          </header>

          {signedOut && (
            <div style={{ padding: '12px 18px', background: 'var(--surface)', border: '1px solid var(--border)', marginBottom: 24 }}>
              <span style={{ fontSize: 14, color: 'var(--text2)', fontFamily: 'var(--font-body)' }}>
                <Link href="/account" style={{ color: 'var(--moonstone)', textDecoration: 'underline' }}>Sign in</Link> to chat with the co-designer — it designs from your stash.
              </span>
            </div>
          )}

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
                            flexShrink: 0, marginTop: 4,
                          }}><BeadIcon shape="round" size={13} stroke="var(--tan)" /></div>
                        )}
                        <div style={{
                          maxWidth: '82%', padding: '12px 16px',
                          background: msg.role === 'user' ? 'var(--surface2)' : 'var(--surface)',
                          border: `1px solid ${msg.role === 'user' ? 'var(--silver)' : 'var(--border)'}`,
                          color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.7,
                        }}>
                          {msg.imageDataUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={msg.imageDataUrl}
                              alt="uploaded reference"
                              style={{ display: 'block', maxWidth: '100%', maxHeight: 240, objectFit: 'contain', marginBottom: msg.display ? 10 : 0, border: '1px solid var(--border)' }}
                            />
                          )}
                          {msg.role === 'assistant'
                            ? msg.display
                              ? <div dangerouslySetInnerHTML={{ __html: formatRichText(msg.display, CHAT_MESSAGE) }} />
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

                {/* Pending image preview */}
                {pendingImage && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={pendingImage.dataUrl} alt="attachment preview" style={{ height: 60, maxWidth: 100, objectFit: 'cover', border: '1px solid var(--border)' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--moonstone)', letterSpacing: '0.1em', marginBottom: 4 }}>IMAGE ATTACHED</p>
                      <p style={{ fontSize: 12, color: 'var(--muted)' }}>Add a message or send as-is</p>
                    </div>
                    <button onClick={() => setPendingImage(null)} aria-label="Remove attached photo" style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', paddingTop: 12 }}>
                  {/* Image attach button */}
                  <button
                    onClick={pickImage}
                    title="Attach a photo"
                    aria-label="Attach a photo"
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      color: pendingImage ? 'var(--madder)' : 'var(--muted)',
                      width: 44, height: 44, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: 22, transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--madder)'; e.currentTarget.style.color = 'var(--madder)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = pendingImage ? 'var(--madder)' : 'var(--muted)' }}
                  >
                    +
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

                  <textarea
                    ref={inputRef}
                    className="input-base"
                    style={{ flex: 1, resize: 'none', minHeight: 52, maxHeight: 140 }}
                    placeholder="Describe what you're imagining…"
                    value={input}
                    rows={2}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() } }}
                  />
                  <button className="btn-silver" onClick={() => send()} disabled={loading || (!input.trim() && !pendingImage)} style={{ padding: '14px 20px', flexShrink: 0, fontSize: 18 }}>
                    {loading ? <span className="spinner" /> : '↑'}
                  </button>
                </div>
                {attachError && (
                  <p role="alert" style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--rose)', marginTop: 6, letterSpacing: '0.06em' }}>{attachError}</p>
                )}
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--muted2)', marginTop: 6, letterSpacing: '0.08em' }}>⌘/Ctrl + Enter to send · + to attach a photo</p>
              </div>
            </div>

            {/* Blueprint panel */}
            <div style={{ position: 'sticky', top: 80 }}>
              {!blueprint ? (
                <StrandEmpty line="Your blueprint will build up here as you chat. The AI will generate it once the design has enough shape." />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 'calc(100dvh - 120px)', overflowY: 'auto' }}>
                  {/* Header */}
                  <div className="card" style={{ padding: 24, borderTop: '2px solid var(--silver)' }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {blueprint.pieceType && <span className="tag">{blueprint.pieceType}</span>}
                      {blueprint.difficulty && <span className="tag" style={{ borderColor: diffColor(blueprint.difficulty), color: diffColor(blueprint.difficulty) }}>{blueprint.difficulty}</span>}
                      {blueprint.estimatedTime && <span className="tag">{blueprint.estimatedTime}</span>}
                      {blueprint.materialsCheck && !blueprint.materialsCheck.allAvailable && (
                        <span className="tag" style={{ borderColor: 'var(--rose)', color: 'var(--rose)' }}>⚠ Check materials</span>
                      )}
                    </div>
                    <h2 style={{ fontSize: 26, color: 'var(--cream)', fontFamily: 'var(--font-display)', fontWeight: 400, marginBottom: 6 }}>{blueprint.title}</h2>
                    {blueprint.description && <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.7, marginBottom: 10 }}>{blueprint.description}</p>}
                    {blueprint.colourStory && (
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', padding: '10px 12px' }}>
                        <span className="mono" style={{ fontSize: 9, letterSpacing: '0.12em', color: 'var(--moonstone)' }}>COLOUR STORY</span>
                        <p style={{ color: 'var(--text)', fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>{blueprint.colourStory}</p>
                      </div>
                    )}
                    <button
                      className={saved ? 'btn-outline' : 'btn-silver'}
                      onClick={saveToJournal}
                      disabled={saved || saving}
                      style={{ width: '100%', justifyContent: 'center', marginTop: 14, fontSize: 11 }}
                    >
                      {saved ? '✓ Saved to Journal' : saving ? 'Saving…' : 'Save to Journal'}
                    </button>
                    {saveError && (
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--rose)', marginTop: 8, letterSpacing: '0.06em' }}>{saveError}</p>
                    )}
                  </div>

                  {/* Visual (AI render) + Schematic (buildable diagram) */}
                  <div className="card" style={{ padding: 20 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                      {([['visual', 'Visual'], ['schematic', 'Schematic']] as const).map(([v, label]) => (
                        <button key={v} onClick={() => setView(v)} style={{
                          padding: '5px 12px', fontFamily: 'var(--font-mono)', fontSize: 9,
                          letterSpacing: '0.1em', textTransform: 'uppercase',
                          background: view === v ? 'var(--surface2)' : 'var(--bg2)',
                          border: `1px solid ${view === v ? 'var(--silver)' : 'var(--border)'}`,
                          color: view === v ? 'var(--silver2)' : 'var(--muted)',
                          cursor: 'pointer', transition: 'all 0.15s'
                        }}>{label}</button>
                      ))}
                    </div>
                    {view === 'schematic' ? (
                      <Schematic blueprint={blueprint} beads={beads} findings={findings} />
                    ) : imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={imageUrl}
                        alt={blueprint.title}
                        style={{ width: '100%', display: 'block', border: '1px solid var(--border)', aspectRatio: '1 / 1', objectFit: 'cover', background: 'var(--bg2)' }}
                      />
                    ) : imageLoading ? (
                      <div style={{
                        aspectRatio: '1 / 1', background: 'var(--roast)', border: '1px solid var(--seam)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
                      }}>
                        <StrandLoader />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--meta)', letterSpacing: '0.1em' }}>
                          RENDERING DESIGN…
                        </span>
                      </div>
                    ) : (
                      <div style={{
                        padding: '28px 16px', border: '1px dashed var(--border)', textAlign: 'center',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                      }}>
                        {imageError && (
                          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text2)' }}>{imageError}</span>
                        )}
                        <button className="btn-outline" onClick={renderPreview}>
                          {imageError ? 'Retry preview' : 'Render preview'}
                        </button>
                      </div>
                    )}
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--muted2)', letterSpacing: '0.1em', marginTop: 6 }}>
                      {view === 'schematic' ? 'BUILDABLE DIAGRAM · MATCHED TO YOUR STASH' : 'AI RENDER · FOR REFERENCE ONLY'}
                    </p>
                  </div>

                  {/* Materials note */}
                  {blueprint.materialsCheck?.notes && (
                    <div style={{ background: 'rgba(200,112,112,0.05)', border: '1px solid rgba(200,112,112,0.2)', padding: '12px 16px' }}>
                      <span className="mono" style={{ fontSize: 10, letterSpacing: '0.12em', color: 'var(--rose)' }}>MATERIALS NOTE</span>
                      <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 6 }}>{blueprint.materialsCheck.notes}</p>
                    </div>
                  )}

                  {/* Components */}
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, color: 'var(--cream)', marginBottom: 12 }}>Components</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {(blueprint.components ?? []).map((c, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--silver)', minWidth: 20, marginTop: 2 }}>×{c.quantity}</span>
                          <div>
                            <p style={{ color: 'var(--cream)', fontSize: 13 }}>{c.item}</p>
                            {c.note && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{c.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Steps */}
                  <div className="card" style={{ padding: 20 }}>
                    <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, color: 'var(--cream)', marginBottom: 12 }}>Build Steps</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {(blueprint.steps ?? []).map((s, i) => (
                        <div key={s.id ?? i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ width: 20, height: 20, background: 'var(--surface2)', border: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--silver)', flexShrink: 0, marginTop: 1 }}>{s.id ?? i + 1}</div>
                          <div>
                            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{s.instruction}</p>
                            {s.technique && (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', color: 'var(--moonstone)', textTransform: 'uppercase', marginTop: 3, display: 'block' }}>{s.technique}</span>
                            )}
                            {s.tip && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, fontStyle: 'italic' }}>{s.tip}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
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
