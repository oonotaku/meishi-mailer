import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  // ユーザーの全所属組織IDを取得
  const { data: memberships } = await supabaseAdmin
    .from('user_organizations')
    .select('organization_id')
    .eq('user_id', user.id)

  const orgIds = (memberships || []).map(m => m.organization_id)

  let query = supabaseAdmin
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (orgIds.length > 0) {
    query = query.or(`owner_id.eq.${user.id},and(organization_id.in.(${orgIds.join(',')}),visibility.eq.team)`)
  } else {
    query = query.eq('owner_id', user.id)
  }

  const { data: rawContacts, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // 各 contact の organization_name を org テーブルから取得
  const uniqueOrgIds = [...new Set((rawContacts || []).map(c => c.organization_id).filter(Boolean))]
  let orgNameMap = {}
  if (uniqueOrgIds.length > 0) {
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .in('id', uniqueOrgIds)
    orgNameMap = Object.fromEntries((orgs || []).map(o => [o.id, o.name]))
  }

  const contacts = (rawContacts || []).map(c => ({
    ...c,
    organization_name: orgNameMap[c.organization_id] || null,
  }))

  res.json({ data: contacts })
}
