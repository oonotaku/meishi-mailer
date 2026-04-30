import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('profile_affiliations')
      .select('id, company_name, title, order_index')
      .eq('user_id', user.id)
      .order('order_index')
    if (error) return res.status(500).json({ error: error.message })
    return res.json({ affiliations: data || [] })
  }

  if (req.method === 'POST') {
    const { affiliations } = req.body
    if (!Array.isArray(affiliations)) return res.status(400).json({ error: '無効なデータです' })
    if (affiliations.length > 5) return res.status(400).json({ error: '所属は最大5件までです' })

    const { error: deleteError } = await supabaseAdmin
      .from('profile_affiliations')
      .delete()
      .eq('user_id', user.id)
    if (deleteError) return res.status(500).json({ error: deleteError.message })

    if (affiliations.length > 0) {
      const rows = affiliations.map((a, i) => ({
        user_id: user.id,
        company_name: a.company_name,
        title: a.title || null,
        order_index: i,
      }))
      const { error: insertError } = await supabaseAdmin
        .from('profile_affiliations')
        .insert(rows)
      if (insertError) return res.status(500).json({ error: insertError.message })
    }

    return res.json({ ok: true })
  }

  return res.status(405).end()
}
