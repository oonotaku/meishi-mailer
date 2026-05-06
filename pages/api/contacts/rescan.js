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

  const { contactId, image, mediaType = 'image/jpeg', card_index = 0, image_url, preview_only = false } = req.body
  if (!image) return res.status(400).json({ error: 'image required' })
  if (!preview_only && !contactId) return res.status(400).json({ error: 'contactId required' })

  // preview_only モードはOCRのみ実行してDBは更新しない
  let contact = null
  if (!preview_only) {
    const { data: c, error: fetchError } = await supabaseAdmin
      .from('contacts')
      .select('owner_id, extracted_sns, cards, card_image_urls')
      .eq('id', contactId)
      .single()
    if (fetchError || !c) return res.status(404).json({ error: '見つかりません' })
    if (c.owner_id !== user.id) return res.status(403).json({ error: '権限がありません' })
    contact = c
  }

  try {
    const ocrPrompt = 'Extract business card info and return JSON only. No other text.\n{"name":"full name","company":"company name","department":"dept or empty","title":"title or empty","email":"email or empty","phone":"phone or empty","website":"website URL or empty","sns":{"line":null,"whatsapp":null,"instagram":null,"x":null,"facebook":null,"linkedin":null,"github":null,"youtube":null,"wantedly":null,"note":null,"sansan":null,"eight":null,"mybridge":null}}\nExtract all SNS accounts, URLs, and QR code links visible on the card. Set null if not found.'

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
    const cards = [parsed]

    const newExtractedSns = {}
    for (const [platform, value] of Object.entries(parsed.sns || {})) {
      if (value) newExtractedSns[platform] = value
    }

    // preview_only: OCR結果だけ返してDBは更新しない
    if (preview_only) {
      return res.json({ success: true, card: parsed })
    }

    // Merge with existing extracted_sns so single-side scans don't erase the other side's SNS
    const mergedExtractedSns = { ...(contact.extracted_sns || {}), ...newExtractedSns }

    // Update specific card in cards array
    const existingCards = Array.isArray(contact.cards) ? [...contact.cards] : []
    const idx = typeof card_index === 'number' ? card_index : 0
    existingCards[idx] = parsed

    // Append new image_url to card_image_urls if provided
    const existingImageUrls = Array.isArray(contact.card_image_urls) ? contact.card_image_urls : []
    const updatedImageUrls = image_url ? [...existingImageUrls, image_url] : existingImageUrls

    // Only update main contact fields if updating the primary card (index 0)
    const updateFields = { extracted_sns: mergedExtractedSns, cards: existingCards }
    if (updatedImageUrls.length > 0) updateFields.card_image_urls = updatedImageUrls
    if (idx === 0) {
      if (parsed.name) updateFields.name = parsed.name
      if (parsed.company) updateFields.company = parsed.company
      if (parsed.department !== undefined) updateFields.department = parsed.department || null
      if (parsed.title !== undefined) updateFields.title = parsed.title || null
      if (parsed.email) updateFields.email = parsed.email
      if (parsed.phone) updateFields.phone = parsed.phone
      if (parsed.website) updateFields.website = parsed.website
    }

    const { error: updateError } = await supabaseAdmin
      .from('contacts')
      .update(updateFields)
      .eq('id', contactId)

    if (updateError) return res.status(500).json({ error: updateError.message })

    res.json({ success: true, extracted_sns: mergedExtractedSns, cards: existingCards, updated: updateFields })
  } catch (e) {
    console.error('[rescan] error:', e)
    res.status(500).json({ error: e.message })
  }
}
