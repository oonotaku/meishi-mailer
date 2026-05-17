import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const { keep_id, merge_id } = req.body
  if (!keep_id || !merge_id) return res.status(400).json({ error: 'keep_id and merge_id required' })
  if (keep_id === merge_id) return res.status(400).json({ error: 'keep_id and merge_id must be different' })

  const [{ data: keepContact, error: keepErr }, { data: mergeContact, error: mergeErr }] = await Promise.all([
    supabaseAdmin.from('contacts').select('*').eq('id', keep_id).single(),
    supabaseAdmin.from('contacts').select('*').eq('id', merge_id).single(),
  ])

  if (keepErr || !keepContact) return res.status(404).json({ error: 'keep contact not found' })
  if (mergeErr || !mergeContact) return res.status(404).json({ error: 'merge contact not found' })
  if (keepContact.owner_id !== user.id || mergeContact.owner_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const mergedCards = [
    ...(Array.isArray(keepContact.cards) ? keepContact.cards : []),
    ...(Array.isArray(mergeContact.cards) ? mergeContact.cards : []),
  ]
  const mergedImageUrls = [
    ...(Array.isArray(keepContact.card_image_urls) ? keepContact.card_image_urls : []),
    ...(Array.isArray(mergeContact.card_image_urls) ? mergeContact.card_image_urls : []),
  ]
  const mergedExtractedSns = Object.assign({}, mergeContact.extracted_sns || {}, keepContact.extracted_sns || {})
  const mergedConnectedSns = Object.assign({}, mergeContact.connected_sns || {}, keepContact.connected_sns || {})

  // Reassign encounters before deleting merge contact (CASCADE DELETE guard)
  const { error: encErr } = await supabaseAdmin
    .from('encounters')
    .update({ contact_id: keep_id })
    .eq('contact_id', merge_id)
  if (encErr) return res.status(500).json({ error: encErr.message })

  const { data: updated, error: updateErr } = await supabaseAdmin
    .from('contacts')
    .update({
      cards: mergedCards,
      card_image_urls: mergedImageUrls,
      extracted_sns: mergedExtractedSns,
      connected_sns: mergedConnectedSns,
    })
    .eq('id', keep_id)
    .select()
    .single()
  if (updateErr) return res.status(500).json({ error: updateErr.message })

  const { error: deleteErr } = await supabaseAdmin
    .from('contacts')
    .delete()
    .eq('id', merge_id)
  if (deleteErr) return res.status(500).json({ error: deleteErr.message })

  res.json({ success: true, contact: updated })
}
