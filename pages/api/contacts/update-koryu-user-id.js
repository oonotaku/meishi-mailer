import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const { contact_id, koryu_user_id } = req.body
  if (!contact_id) return res.status(400).json({ error: 'contact_id required' })

  const { data: contact, error: fetchErr } = await supabaseAdmin
    .from('contacts')
    .select('owner_id')
    .eq('id', contact_id)
    .single()

  if (fetchErr || !contact) return res.status(404).json({ error: 'Contact not found' })
  if (contact.owner_id !== user.id) return res.status(403).json({ error: 'Forbidden' })

  const { error: updateErr } = await supabaseAdmin
    .from('contacts')
    .update({ koryu_user_id: koryu_user_id || null })
    .eq('id', contact_id)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  res.json({ success: true })
}
