import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { contact_id } = req.body
  if (!contact_id) return res.status(400).json({ error: 'contact_id required' })

  const { data: contact, error: fetchErr } = await supabaseAdmin
    .from('contacts')
    .select('owner_id')
    .eq('id', contact_id)
    .single()

  if (fetchErr || !contact) return res.status(404).json({ error: 'Not found' })
  if (contact.owner_id !== user.id) return res.status(403).json({ error: 'Forbidden' })

  const { error: deleteErr } = await supabaseAdmin
    .from('contacts')
    .delete()
    .eq('id', contact_id)

  if (deleteErr) return res.status(500).json({ error: deleteErr.message })
  res.json({ success: true })
}
