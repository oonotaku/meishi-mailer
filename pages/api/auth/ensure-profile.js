import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  // 既存プロファイル確認（admin = RLSバイパス）
  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id, email, name, role, organization_id, organizations(id, name)')
    .eq('id', user.id)
    .single()

  if (existing) return res.status(200).json({ profile: existing })

  // 招待経由：既存組織にメンバーとして参加
  const orgId = user.user_metadata?.organization_id
  if (orgId) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert({ id: user.id, email: user.email, name: user.email.split('@')[0], organization_id: orgId, role: 'member' })
      .select('id, email, name, role, organization_id, organizations(id, name)')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ profile: data })
  }

  // 初回サインアップ：組織を作成してオーナーになる
  const { data: org, error: orgErr } = await supabaseAdmin
    .from('organizations')
    .insert({ name: 'マイチーム' })
    .select()
    .single()
  if (orgErr) return res.status(500).json({ error: orgErr.message })

  const { data, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .insert({ id: user.id, email: user.email, name: user.email.split('@')[0], organization_id: org.id, role: 'owner' })
    .select('id, email, name, role, organization_id, organizations(id, name)')
    .single()
  if (profileErr) return res.status(500).json({ error: profileErr.message })

  return res.status(200).json({ profile: data })
}
