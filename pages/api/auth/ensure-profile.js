import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id, email, name, current_organization_id')
    .eq('id', user.id)
    .single()

  if (existing) {
    if (!existing.current_organization_id) {
      return res.status(200).json({ profile: { ...existing, organization_id: null, role: null, organizations: null } })
    }
    const { data: mem } = await supabaseAdmin
      .from('user_organizations')
      .select('role, organizations(id, name)')
      .eq('user_id', user.id)
      .eq('organization_id', existing.current_organization_id)
      .single()
    return res.status(200).json({
      profile: {
        ...existing,
        organization_id: existing.current_organization_id,
        role: mem?.role ?? null,
        organizations: mem?.organizations ?? null,
      },
    })
  }

  // 招待経由：既存組織にメンバーとして参加
  const orgId = user.user_metadata?.organization_id
  if (orgId) {
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .insert({ id: user.id, email: user.email, name: user.email.split('@')[0], current_organization_id: orgId })
      .select('id, email, name, current_organization_id')
      .single()
    if (profileErr) return res.status(500).json({ error: profileErr.message })

    const { error: memErr } = await supabaseAdmin
      .from('user_organizations')
      .insert({ user_id: user.id, organization_id: orgId, role: 'member' })
    if (memErr) return res.status(500).json({ error: memErr.message })

    const { data: mem } = await supabaseAdmin
      .from('user_organizations')
      .select('role, organizations(id, name)')
      .eq('user_id', user.id)
      .eq('organization_id', orgId)
      .single()

    return res.status(200).json({
      profile: {
        ...profile,
        organization_id: orgId,
        role: mem?.role ?? 'member',
        organizations: mem?.organizations ?? null,
      },
    })
  }

  // 初回サインアップ：組織を作成してオーナーになる
  const { data: org, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .insert({ name: 'マイチーム' })
    .select()
    .single()
  if (orgErr) return res.status(500).json({ error: orgErr.message })

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .insert({ id: user.id, email: user.email, name: user.email.split('@')[0], current_organization_id: org.id })
    .select('id, email, name, current_organization_id')
    .single()
  if (profileErr) return res.status(500).json({ error: profileErr.message })

  const { error: memErr } = await supabaseAdmin
    .from('user_organizations')
    .insert({ user_id: user.id, organization_id: org.id, role: 'owner' })
  if (memErr) return res.status(500).json({ error: memErr.message })

  return res.status(200).json({
    profile: {
      ...profile,
      organization_id: org.id,
      role: 'owner',
      organizations: { id: org.id, name: org.name },
    },
  })
}
