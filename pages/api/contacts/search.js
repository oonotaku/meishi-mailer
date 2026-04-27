import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const q = (req.query.q || '').trim()
  if (!q) return res.json({ data: [] })

  // list.js と同じアクセス制御条件を構築
  const { data: memberships } = await supabaseAdmin
    .from('user_organizations')
    .select('organization_id')
    .eq('user_id', user.id)

  const orgIds = (memberships || []).map(m => m.organization_id)
  const accessFilter = orgIds.length > 0
    ? `owner_id.eq.${user.id},and(organization_id.in.(${orgIds.join(',')}),visibility.eq.team)`
    : `owner_id.eq.${user.id}`

  const pattern = `%${q}%`

  // contacts を name / email / company で横断検索
  const { data: directMatches } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .or(accessFilter)
    .or(`name.ilike.${pattern},email.ilike.${pattern},company.ilike.${pattern}`)
    .order('created_at', { ascending: false })

  // encounters の event_name で検索 → 該当 contact_id を取得
  const { data: encounterRows } = await supabaseAdmin
    .from('encounters')
    .select('contact_id')
    .ilike('event_name', pattern)

  const encounterContactIds = [...new Set((encounterRows || []).map(e => e.contact_id))]

  let encounterContacts = []
  if (encounterContactIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .or(accessFilter)
      .in('id', encounterContactIds)
    encounterContacts = data || []
  }

  // id で重複除去してマージ
  const seen = new Set()
  const merged = []
  for (const c of [...(directMatches || []), ...encounterContacts]) {
    if (!seen.has(c.id)) {
      seen.add(c.id)
      merged.push(c)
    }
  }

  // organization_name を付与（list.js と同じ処理）
  const uniqueOrgIds = [...new Set(merged.map(c => c.organization_id).filter(Boolean))]
  let orgNameMap = {}
  if (uniqueOrgIds.length > 0) {
    const { data: orgs } = await supabaseAdmin
      .from('organizations')
      .select('id, name')
      .in('id', uniqueOrgIds)
    orgNameMap = Object.fromEntries((orgs || []).map(o => [o.id, o.name]))
  }

  const contacts = merged.map(c => ({
    ...c,
    organization_name: orgNameMap[c.organization_id] || null,
  }))

  res.json({ data: contacts })
}
