import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

    const { contact_id, card_index } = req.body
    if (!contact_id || card_index === undefined || card_index === null) {
      return res.status(400).json({ error: 'contact_id and card_index required' })
    }

    const idx = parseInt(card_index, 10)
    if (isNaN(idx) || idx < 0) {
      return res.status(400).json({ error: 'card_index must be a non-negative integer' })
    }

    const { data: contact, error: fetchErr } = await supabaseAdmin
      .from('contacts')
      .select('owner_id, cards, card_image_urls')
      .eq('id', contact_id)
      .single()

    if (fetchErr || !contact) return res.status(404).json({ error: 'Not found' })
    if (contact.owner_id !== user.id) return res.status(403).json({ error: 'Forbidden' })

    const cards = Array.isArray(contact.cards) ? contact.cards : []
    if (cards.length <= 1) {
      return res.status(400).json({ error: '最後のカードは削除できません' })
    }
    if (idx >= cards.length) {
      return res.status(400).json({ error: 'card_index out of range' })
    }

    const newCards = cards.filter((_, i) => i !== idx)

    // card_image_urls と cards は長さが一致しない場合があるため idx 範囲チェック
    const imageUrls = Array.isArray(contact.card_image_urls) ? contact.card_image_urls : []
    const newImageUrls = idx < imageUrls.length
      ? imageUrls.filter((_, i) => i !== idx)
      : imageUrls

    const updateFields = { cards: newCards, card_image_urls: newImageUrls }

    // メインカード（index 0）削除時は新しい cards[0] でトップレベルフィールドを更新
    if (idx === 0 && newCards.length > 0) {
      const newMain = newCards[0]
      updateFields.name       = newMain.name       || null
      updateFields.company    = newMain.company    || null
      updateFields.department = newMain.department || null
      updateFields.title      = newMain.title      || null
      updateFields.email      = newMain.email      || null
      updateFields.phone      = newMain.phone      || null
      updateFields.website    = newMain.website    || null
    }

    const { error: updateErr } = await supabaseAdmin
      .from('contacts')
      .update(updateFields)
      .eq('id', contact_id)

    if (updateErr) return res.status(500).json({ error: updateErr.message })
    res.json({ success: true })
  } catch (e) {
    console.error('[delete-card]', e)
    res.status(500).json({ error: e.message || 'Internal server error' })
  }
}
