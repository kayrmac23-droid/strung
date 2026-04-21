import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { mood, style, occasion, metalPreference } = await req.json()
  const prompt = `Generate a jewellery colour palette. Mood: ${mood||'open'}. Style: ${style||'open'}. Occasion: ${occasion||'open'}. Metal preference: ${metalPreference||'open'}.

Return ONLY valid JSON (no markdown, no backticks):
{"name":"palette name","description":"2-3 sentence mood overview","metals":[{"name":"metal name","hex":"#hexcode","note":"usage note"}],"gems":[{"name":"gem name","hex":"#hexcode","note":"why it works","hardness":"mohs rating"}],"finishes":["finish1","finish2","finish3"],"accent":"#hexcode","pairings":["suggestion1","suggestion2","suggestion3"],"avoid":"what to avoid and why"}

Use realistic gem colours. Include 2-3 metals and 4-5 gems.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    return NextResponse.json(JSON.parse(clean))
  } catch {
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 })
  }
}
