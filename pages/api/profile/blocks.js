import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const { userId } = req.query
    if (!userId) return res.status(400).json({ error: 'userId が必要です' })

    const { data, error } = await supabaseAdmin
      .from('profile_blocks')
      .select('id, type, size, content, order_index')
      .eq('user_id', userId)
      .order('order_index')

    if (error) return res.status(500).json({ error: error.message })
    return res.json({ blocks: data || [] })
  }

  if (req.method === 'POST') {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: '認証が必要です' })

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

    const { blocks } = req.body
    if (!Array.isArray(blocks)) return res.status(400).json({ error: 'blocks が必要です' })

    await supabaseAdmin.from('profile_blocks').delete().eq('user_id', user.id)

    if (blocks.length > 0) {
      const rows = blocks.map((b, i) => ({
        user_id: user.id,
        type: b.type,
        size: b.size || 'M',
        content: b.content || {},
        order_index: i,
      }))
      const { error: insertError } = await supabaseAdmin.from('profile_blocks').insert(rows)
      if (insertError) return res.status(500).json({ error: insertError.message })
    }

    return res.json({ ok: true })
  }

  return res.status(405).end()
}
