// One HTML escaper and one markdown-ish formatter for the places that render
// model output through dangerouslySetInnerHTML.
//
// There were three near-identical copies of this (the guide body, the advisor
// answer, the co-design chat bubble), each with its own escape function and its
// own inline-style string. Three copies of an escaper feeding
// dangerouslySetInnerHTML is three chances to get escaping wrong, so both the
// escape and the formatting live here and the call sites pick a preset.
//
// Ordering is the load-bearing detail: escaping runs over the raw text FIRST,
// and only then are the markdown patterns turned into tags. Doing it the other
// way round would escape the tags this function just produced, and — far worse
// — would let text in the source survive as live markup.

/**
 * Escape text for interpolation into HTML.
 *
 * `&` must be replaced first or it would double-escape the entities the later
 * replacements introduce. Quotes are escaped too: nothing here interpolates
 * into an attribute today, but escaping them costs nothing in text content and
 * means a future attribute use is not silently unsafe.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export type RichTextOptions = {
  /** Inline style applied to each generated <p>. */
  paragraphStyle: string
  /** CSS colour for **bold** runs. */
  strongColour: string
  /** Turn leading "- " / "• " lines into grouped <ul><li> blocks. */
  lists?: boolean
  /** Turn single newlines inside a paragraph into <br/>. */
  lineBreaks?: boolean
}

const BULLET = /^\s*[-•]\s+(.*)$/

/**
 * Render a model's plain-text answer as simple HTML.
 *
 * Supports exactly two markdown constructs — **bold** and "- " bullets —
 * because that is all the models actually emit here. Anything else is left as
 * escaped literal text rather than guessed at.
 */
export function formatRichText(text: string, options: RichTextOptions): string {
  const { paragraphStyle, strongColour, lists = false, lineBreaks = false } = options
  if (typeof text !== 'string' || !text.trim()) return ''

  // Escape once, up front, over the whole raw string.
  const escaped = escapeHtml(text)

  const bold = (s: string) =>
    s.replace(/\*\*(.+?)\*\*/g, `<strong style="color:${strongColour}">$1</strong>`)

  const paragraph = (lines: string[]) => {
    const joined = lineBreaks ? lines.join('<br/>') : lines.join(' ')
    return `<p style="${paragraphStyle}">${bold(joined)}</p>`
  }

  const list = (items: string[]) =>
    `<ul style="margin:8px 0 10px 16px">${items
      .map(i => `<li style="margin-bottom:4px;padding-left:4px">${bold(i)}</li>`)
      .join('')}</ul>`

  // Blank lines separate blocks; within a block, consecutive bullet lines form
  // one <ul> rather than one <ul> per item (the previous per-item wrapping left
  // a stray margin between every bullet).
  return escaped
    .split(/\n\s*\n/)
    .map(block => {
      const lines = block.split('\n').filter(l => l.trim())
      if (lines.length === 0) return ''

      if (!lists) return paragraph(lines)

      const out: string[] = []
      let run: string[] = []
      let runIsList = false

      const flush = () => {
        if (run.length === 0) return
        out.push(runIsList ? list(run) : paragraph(run))
        run = []
      }

      for (const line of lines) {
        const bullet = BULLET.exec(line)
        const isList = bullet !== null
        if (isList !== runIsList) {
          flush()
          runIsList = isList
        }
        run.push(bullet ? bullet[1] : line)
      }
      flush()
      return out.join('')
    })
    .filter(Boolean)
    .join('')
}

// ── Presets ──────────────────────────────────────────────────────────────────
// One per render site, so the inline-style strings live beside each other and
// drift is visible rather than buried in three separate components.

/** Guide section body — full prose measure, hard line breaks preserved. */
export const GUIDE_PROSE: RichTextOptions = {
  paragraphStyle: 'margin-bottom:13px;color:var(--text);font-family:var(--font-body);font-size:var(--fs-base);line-height:1.8',
  strongColour: 'var(--silver3)',
  lineBreaks: true,
}

/** Streaming advisor answer under a guide section — tighter, no lists. */
export const ADVISOR_ANSWER: RichTextOptions = {
  paragraphStyle: 'margin-bottom:10px',
  strongColour: 'var(--silver3)',
}

/** Co-designer chat bubble — the one place the model emits bullet lists. */
export const CHAT_MESSAGE: RichTextOptions = {
  paragraphStyle: 'margin-bottom:10px',
  strongColour: 'var(--cream)',
  lists: true,
}
