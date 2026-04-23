import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single()

  const orgId = profile?.current_organization_id
  console.log('[contacts/list] user:', user.id, 'orgId:', orgId)

  let query = supabaseAdmin
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (orgId) {
    const filter = `owner_id.eq.${user.id},and(organization_id.eq.${orgId},visibility.eq.team)`
    console.log('[contacts/list] filter:', filter)
    query = query.or(filter)
  } else {
    console.log('[contacts/list] no orgId, filtering by owner_id only')
    query = query.eq('owner_id', user.id)
  }

  const { data, error } = await query
  console.log('[contacts/list] result count:', data?.length, 'error:', error?.message)
  if (error) return res.status(500).json({ error: error.message })

  // デバッグ用: visibility分布を出力
  const byVisibility = (data || []).reduce((acc, c) => {
    acc[c.visibility || 'null'] = (acc[c.visibility || 'null'] || 0) + 1
    return acc
  }, {})
  console.log('[contacts/list] by visibility:', JSON.stringify(byVisibility))
  console.log('[contacts/list] by owner:', (data || []).map(c => ({ id: c.id, owner: c.owner_id?.slice(0,8), org: c.organization_id?.slice(0,8), vis: c.visibility })))

  res.json({
    data: data || [],
    _debug: { userId: user.id, orgId, count: data?.length, byVisibility },
  })
}
