import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const { image, mediaType = 'image/jpeg' } = req.body
  if (!image) return res.status(400).json({ error: 'image required' })

  try {
    const prompt = `Look at this screenshot and identify the social media profile shown.

Return JSON only, no other text:
{"platform": "platform_key", "value": "full_profile_url"}

platform_key must be one of: x, instagram, facebook, linkedin, github, youtube, tiktok, threads, line, whatsapp, telegram, discord, bluesky, wantedly, note, pinterest, sansan, eight, mybridge, vercel, wechat

Rules:
- value must be the full profile URL (e.g. "https://x.com/username", "https://instagram.com/username")
- For LINE/WhatsApp, value is the profile URL or phone number found
- If you can identify the platform but not the exact URL, construct it from the visible username
- If you cannot identify the platform or user with confidence, return {"platform": null, "value": null}`

    const result = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: prompt }
        ]
      }]
    })

    const raw = result.content[0].text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(raw)

    res.json({ platform: parsed.platform || null, value: parsed.value || null })
  } catch (e) {
    console.error('[detect-sns-screenshot] error:', e)
    res.status(500).json({ error: e.message })
  }
}
