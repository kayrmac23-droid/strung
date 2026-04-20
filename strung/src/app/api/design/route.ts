import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { description, type, skill, budget } = await req.json()
  const prompt = `Generate a complete jewellery design brief. Description: ${description}. Type: ${type||'any'}. Skill level: ${skill||'intermediate'}. Budget: ${budget||'not specified'}.

Return ONLY valid JSON (no markdown, no backticks):
{"title":"design name","tagline":"one evocative sentence","overview":"2-3 sentence concept","components":[{"part":"name","material":"material","dimensions":"approx size","note":"construction note"}],"techniques":["technique1","technique2"],"tools":["tool1","tool2"],"difficulty":"Beginner/Intermediate/Advanced","estimatedTime":"e.g. 4-6 hours","costEstimate":"e.g. $20-40 AUD","steps":["step 1","step 2","step 3","step 4","step 5"],"variations":["variation1","variation2","variation3"],"tips":["tip1","tip2"],"warnings":["warning1"]}`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1400,
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
