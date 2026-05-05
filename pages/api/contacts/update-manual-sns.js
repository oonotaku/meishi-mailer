import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { contactId, platform, value, remove } = req.body
  if (!contactId || !platform) return res.status(400).json({ error: 'contactId and platform required' })

  const { data: contact, error: fetchError } = await supabaseAdmin
    .from('contacts')
    .select('owner_id, manual_sns')
    .eq('id', contactId)
    .single()

  if (fetchError || !contact) return res.status(404).json({ error: '見つかりません' })
  if (contact.owner_id !== user.id) return res.status(403).json({ error: '権限がありません' })

  const current = contact.manual_sns || {}
  const updated = { ...current }

  if (remove) {
    delete updated[platform]
  } else {
    if (!value) return res.status(400).json({ error: 'value required' })
    updated[platform] = value
  }

  const { error: updateError } = await supabaseAdmin
    .from('contacts')
    .update({ manual_sns: updated })
    .eq('id', contactId)

  if (updateError) return res.status(500).json({ error: updateError.message })

  res.json({ manual_sns: updated })
}
