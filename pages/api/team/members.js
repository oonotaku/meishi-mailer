import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  // ユーザーの全所属組織を取得
  const { data: memberships } = await supabaseAdmin
    .from('user_organizations')
    .select('organization_id, role, organizations(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  const ownerMembership = (memberships || []).find(m => m.role === 'owner')
  const memberMemberships = (memberships || []).filter(m => m.role !== 'owner')

  // 自チームのメンバー一覧を取得
  let ownTeamMembers = []
  if (ownerMembership) {
    const { data } = await supabaseAdmin
      .from('user_organizations')
      .select('role, created_at, profiles(id, name, email)')
      .eq('organization_id', ownerMembership.organization_id)
      .order('created_at', { ascending: true })
    ownTeamMembers = data || []
  }

  res.json({
    ownTeam: ownerMembership ? {
      organization: ownerMembership.organizations,
      members: ownTeamMembers,
    } : null,
    memberTeams: memberMemberships.map(m => ({
      organization: m.organizations,
    })),
  })
}
