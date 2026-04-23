import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  // 1. user_organizations を先に確認（招待済みメンバーの判定）
  const { data: membership } = await supabaseAdmin
    .from('user_organizations')
    .select('organization_id, role, organizations(id, name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (membership) {
    // 2. 既存メンバーシップあり → current_organization_id をセット（upsert）
    const orgId = membership.organization_id

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
        current_organization_id: orgId,
      }, { onConflict: 'id' })
      .select('id, email, name, current_organization_id')
      .single()

    if (profileErr) return res.status(500).json({ error: profileErr.message })

    return res.status(200).json({
      profile: {
        ...profile,
        organization_id: orgId,
        role: membership.role,
        organizations: membership.organizations,
      },
    })
  }

  // 3. user_organizations にレコードなし
  //    招待経由（初回）: user_metadata に organization_id が入っている
  const orgIdFromMeta = user.user_metadata?.organization_id
  if (orgIdFromMeta) {
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
        current_organization_id: orgIdFromMeta,
      }, { onConflict: 'id' })
      .select('id, email, name, current_organization_id')
      .single()

    if (profileErr) return res.status(500).json({ error: profileErr.message })

    const { error: memErr } = await supabaseAdmin
      .from('user_organizations')
      .insert({ user_id: user.id, organization_id: orgIdFromMeta, role: 'member' })
    if (memErr) return res.status(500).json({ error: memErr.message })

    const { data: mem } = await supabaseAdmin
      .from('user_organizations')
      .select('role, organizations(id, name)')
      .eq('user_id', user.id)
      .eq('organization_id', orgIdFromMeta)
      .single()

    return res.status(200).json({
      profile: {
        ...profile,
        organization_id: orgIdFromMeta,
        role: mem?.role ?? 'member',
        organizations: mem?.organizations ?? null,
      },
    })
  }

  // 4. 新規スタンドアロンユーザー（招待なし）→ 新しい organization を作成
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, email, name, current_organization_id')
    .eq('id', user.id)
    .maybeSingle()

  // 既にセットアップ済み（念のため）
  if (existingProfile?.current_organization_id) {
    return res.status(200).json({
      profile: {
        ...existingProfile,
        organization_id: existingProfile.current_organization_id,
        role: null,
        organizations: null,
      },
    })
  }

  const { data: org, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .insert({ name: 'マイチーム' })
    .select()
    .single()
  if (orgErr) return res.status(500).json({ error: orgErr.message })

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      name: existingProfile?.name || user.email.split('@')[0],
      current_organization_id: org.id,
    }, { onConflict: 'id' })
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
