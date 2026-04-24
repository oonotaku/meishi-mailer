import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { name } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'チーム名が必要です' })

  // owner であることを確認
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.current_organization_id) return res.status(403).json({ error: 'チームが見つかりません' })

  const { data: mem } = await supabaseAdmin
    .from('user_organizations')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', profile.current_organization_id)
    .single()

  if (mem?.role !== 'owner') return res.status(403).json({ error: 'オーナーのみ変更できます' })

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ name: name.trim() })
    .eq('id', profile.current_organization_id)

  if (error) return res.status(500).json({ error: error.message })

  res.json({ ok: true })
}
