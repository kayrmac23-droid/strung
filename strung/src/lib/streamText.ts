// Reads a text/plain streaming response (/api/advice, /api/codesign) chunk by
// chunk, calling `onText` with the full text so far.
//
// Both pages used to call `decoder.decode(value)` on each chunk. Without
// `{ stream: true }` the decoder treats every chunk as complete, so a
// multi-byte character split across two network chunks — and the models emit
// a lot of em dashes, curly quotes and "×" — came out as two U+FFFD
// replacement characters. Streaming mode carries the partial bytes over to the
// next chunk; the final decode() flushes whatever is left.

export async function readTextStream(
  body: ReadableStream<Uint8Array> | null,
  onText: (full: string) => void,
): Promise<string> {
  if (!body) return ''
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    if (!chunk) continue
    full += chunk
    onText(full)
  }
  const tail = decoder.decode()
  if (tail) {
    full += tail
    onText(full)
  }
  return full
}
