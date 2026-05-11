import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('profile_affiliations')
      .select('id, company_name, title, order_index, phone, website, contact_email, show_phone, show_website, show_email')
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
        phone: a.phone || null,
        website: a.website || null,
        contact_email: a.contact_email || null,
        show_phone: a.show_phone ?? false,
        show_website: a.show_website ?? true,
        show_email: a.show_email ?? false,
      }))
      const { error: insertError } = await supabaseAdmin
        .from('profile_affiliations')
        .insert(rows)
      if (insertError) return res.status(500).json({ error: insertError.message })
    }

    // profile_blocks の affiliation ブロックを同期
    await supabaseAdmin.from('profile_blocks').delete().eq('user_id', user.id).eq('type', 'affiliation')
    const validAffiliations = affiliations.filter(a => a.company_name?.trim())
    if (validAffiliations.length > 0) {
      const blockRows = validAffiliations.map((a, i) => ({
        user_id: user.id,
        type: 'affiliation',
        size: 'M',
        order_index: 100 + i,
        content: {
          company_name: a.company_name,
          title: a.title || null,
          website: a.show_website ? (a.website || null) : null,
          contact_email: a.show_email ? (a.contact_email || null) : null,
          phone: a.show_phone ? (a.phone || null) : null,
        },
      }))
      await supabaseAdmin.from('profile_blocks').insert(blockRows)
    }

    return res.json({ ok: true })
  }

  return res.status(405).end()
}
