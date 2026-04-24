import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  // 現在の全メンバーシップを取得
  let { data: memberships } = await supabaseAdmin
    .from('user_organizations')
    .select('organization_id, role, organizations(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
  memberships = memberships || []

  let ownerMembership = memberships.find(m => m.role === 'owner')

  if (!ownerMembership) {
    // 招待経由: metadata の organization_id を member として登録（未登録なら）
    const orgIdFromMeta = user.user_metadata?.organization_id
    if (orgIdFromMeta && !memberships.some(m => m.organization_id === orgIdFromMeta)) {
      await supabaseAdmin
        .from('user_organizations')
        .insert({ user_id: user.id, organization_id: orgIdFromMeta, role: 'member' })
    }

    // 自分のチームを新規作成して owner になる
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .insert({ name: 'マイチーム' })
      .select('id, name')
      .single()
    if (orgErr) return res.status(500).json({ error: orgErr.message })

    const { error: memErr } = await supabaseAdmin
      .from('user_organizations')
      .insert({ user_id: user.id, organization_id: org.id, role: 'owner' })
    if (memErr) return res.status(500).json({ error: memErr.message })

    // 最新のメンバーシップを再取得
    const { data: refreshed } = await supabaseAdmin
      .from('user_organizations')
      .select('organization_id, role, organizations(id, name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    memberships = refreshed || []
    ownerMembership = memberships.find(m => m.role === 'owner')
  }

  const ownerOrgId = ownerMembership.organization_id

  // プロフィールを upsert（current_organization_id は常に owner のチームを指す）
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .maybeSingle()

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      name: existingProfile?.name || user.email.split('@')[0],
      current_organization_id: ownerOrgId,
    }, { onConflict: 'id' })
    .select('id, email, name, current_organization_id, sender_email')
    .single()

  if (profileErr) return res.status(500).json({ error: profileErr.message })

  const organizations = memberships.map(m => ({
    organization_id: m.organization_id,
    name: m.organizations?.name,
    role: m.role,
  }))

  return res.status(200).json({
    profile: {
      ...profile,
      organization_id: ownerOrgId,
      role: 'owner',
      organizations,
    },
  })
}
