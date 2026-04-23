import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { contactId, visibility } = req.body
  if (!contactId || !['private', 'team'].includes(visibility)) {
    return res.status(400).json({ error: '不正なリクエストです' })
  }

  const { data: contact } = await supabaseAdmin
    .from('contacts')
    .select('owner_id')
    .eq('id', contactId)
    .single()

  if (!contact) return res.status(404).json({ error: '名刺が見つかりません' })
  if (contact.owner_id !== user.id) return res.status(403).json({ error: '編集権限がありません' })

  const { error } = await supabaseAdmin
    .from('contacts')
    .update({ visibility })
    .eq('id', contactId)

  if (error) return res.status(500).json({ error: error.message })

  res.json({ ok: true })
}
