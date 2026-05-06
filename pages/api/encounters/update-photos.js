import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { encounter_id, photo_urls } = req.body
  if (!encounter_id || !photo_urls?.length) return res.status(400).json({ error: 'encounter_id and photo_urls required' })

  const { data: enc } = await supabaseAdmin
    .from('encounters')
    .select('contact_id, contacts(owner_id)')
    .eq('id', encounter_id)
    .single()

  if (!enc || enc.contacts?.owner_id !== user.id) return res.status(403).json({ error: 'Forbidden' })

  const { error } = await supabaseAdmin
    .from('encounters')
    .update({ photo_urls })
    .eq('id', encounter_id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}
