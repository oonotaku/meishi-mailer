import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { contact_ids, tags } = req.body
  if (!Array.isArray(contact_ids) || contact_ids.length === 0) {
    return res.status(400).json({ error: 'contact_ids required' })
  }
  if (!Array.isArray(tags) || tags.length === 0) {
    return res.status(400).json({ error: 'tags required' })
  }

  const { data: owned, error: fetchError } = await supabaseAdmin
    .from('contacts')
    .select('id, tags')
    .eq('owner_id', user.id)
    .in('id', contact_ids)

  if (fetchError) return res.status(500).json({ error: fetchError.message })
  if (!owned || owned.length === 0) return res.status(403).json({ error: 'Forbidden' })

  await Promise.all(owned.map(c => {
    const merged = Array.from(new Set([...(c.tags || []), ...tags]))
    return supabaseAdmin.from('contacts').update({ tags: merged }).eq('id', c.id)
  }))

  res.json({ ok: true, updated: owned.length })
}
