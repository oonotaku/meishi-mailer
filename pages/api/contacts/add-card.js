import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { contact_id, card, image_url } = req.body
  if (!contact_id || !card) return res.status(400).json({ error: 'contact_id and card required' })

  const { data: existing, error: fetchErr } = await supabaseAdmin
    .from('contacts')
    .select('owner_id, cards, card_image_urls')
    .eq('id', contact_id)
    .single()

  if (fetchErr || !existing) return res.status(404).json({ error: 'Not found' })
  if (existing.owner_id !== user.id) return res.status(403).json({ error: 'Forbidden' })

  const updatedCards = [...(existing.cards || []), card]
  const updatedImageUrls = image_url
    ? [...(existing.card_image_urls || []), image_url]
    : (existing.card_image_urls || [])

  const { error } = await supabaseAdmin
    .from('contacts')
    .update({ cards: updatedCards, card_image_urls: updatedImageUrls })
    .eq('id', contact_id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true, cards: updatedCards, card_image_urls: updatedImageUrls })
}
