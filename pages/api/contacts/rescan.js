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

  const { contactId, image, mediaType = 'image/jpeg' } = req.body
  if (!contactId || !image) return res.status(400).json({ error: 'contactId and image required' })

  const { data: contact, error: fetchError } = await supabaseAdmin
    .from('contacts')
    .select('owner_id')
    .eq('id', contactId)
    .single()

  if (fetchError || !contact) return res.status(404).json({ error: '見つかりません' })
  if (contact.owner_id !== user.id) return res.status(403).json({ error: '権限がありません' })

  try {
    const ocrPrompt = 'Extract business card info and return JSON only. No other text.\n{"name":"full name","company":"company name","department":"dept or empty","title":"title or empty","email":"email or empty","phone":"phone or empty","sns":{"line":"URL or null","whatsapp":"phone or URL or null","instagram":"@user or URL or null","x":"@user or URL or null","facebook":"URL or null","linkedin":"URL or null","github":"user or URL or null","youtube":"URL or null","wantedly":"URL or null","note":"URL or null","sansan":"URL or null","eight":"URL or null","mybridge":"URL or null"}}\nExtract all SNS accounts, URLs, and QR code links visible on the card. Set null if not found.'

    const ocrRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: ocrPrompt }
        ]
      }]
    })

    const raw = ocrRes.content[0].text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(raw)

    const extracted_sns = {}
    for (const [platform, value] of Object.entries(parsed.sns || {})) {
      if (value) extracted_sns[platform] = value
    }

    // Only update extracted_sns and basic fields — never touch manual_sns
    const updateFields = { extracted_sns }
    if (parsed.name) updateFields.name = parsed.name
    if (parsed.company) updateFields.company = parsed.company
    if (parsed.department !== undefined) updateFields.department = parsed.department || null
    if (parsed.title !== undefined) updateFields.title = parsed.title || null
    if (parsed.email) updateFields.email = parsed.email
    if (parsed.phone) updateFields.phone = parsed.phone

    const { error: updateError } = await supabaseAdmin
      .from('contacts')
      .update(updateFields)
      .eq('id', contactId)

    if (updateError) return res.status(500).json({ error: updateError.message })

    res.json({ success: true, extracted_sns, updated: updateFields })
  } catch (e) {
    console.error('[rescan] error:', e)
    res.status(500).json({ error: e.message })
  }
}
