import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.current_organization_id) return res.status(403).json({ error: 'チームに所属していません' })

  const { data: mem } = await supabaseAdmin
    .from('user_organizations')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', profile.current_organization_id)
    .single()

  if (mem?.role !== 'owner') return res.status(403).json({ error: 'オーナーのみ招待できます' })

  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'メールアドレスが必要です' })

  const organizationId = profile.current_organization_id

  // 既存ユーザーか確認
  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (existingProfile) {
    // 既存ユーザー：すでにチームメンバーか確認
    const { data: existingMem } = await supabaseAdmin
      .from('user_organizations')
      .select('user_id')
      .eq('user_id', existingProfile.id)
      .eq('organization_id', organizationId)
      .single()

    if (existingMem) {
      return res.status(400).json({ error: 'このユーザーはすでにチームのメンバーです' })
    }

    // 未参加 → 直接 user_organizations に追加
    const { error: insertError } = await supabaseAdmin
      .from('user_organizations')
      .insert({ user_id: existingProfile.id, organization_id: organizationId, role: 'member' })

    if (insertError) return res.status(400).json({ error: insertError.message })

    return res.json({ ok: true, existing: true })
  }

  // 新規ユーザー → inviteUserByEmail
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').trim()
  const { error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { organization_id: organizationId },
    redirectTo: `${siteUrl}/auth/confirm`,
  })

  if (error) return res.status(400).json({ error: error.message })

  res.json({ ok: true, existing: false })
}
