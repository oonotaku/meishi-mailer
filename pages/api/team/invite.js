import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  if (!profile) return res.status(403).json({ error: 'プロフィールが見つかりません' })
  if (profile.role !== 'owner') return res.status(403).json({ error: 'オーナーのみ招待できます' })

  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'メールアドレスが必要です' })

  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { organization_id: profile.organization_id },
  })

  if (error) return res.status(400).json({ error: error.message })

  res.json({ ok: true })
}
