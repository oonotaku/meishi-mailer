import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import { sendEmail } from '../../../lib/sendEmail'

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

    // 招待者プロフィールとチーム名を取得して通知メール送信
    try {
      const [{ data: inviterProfile }, { data: org }] = await Promise.all([
        supabaseAdmin
          .from('profiles')
          .select('name, sender_email, sendgrid_api_key, smtp_provider, smtp_host, smtp_port, smtp_user, smtp_password, gmail_refresh_token, gmail_email')
          .eq('id', user.id)
          .single(),
        supabaseAdmin
          .from('organizations')
          .select('name')
          .eq('id', organizationId)
          .single(),
      ])

      const inviterName = inviterProfile?.name || user.email?.split('@')[0] || '招待者'
      const teamName = org?.name || 'チーム'
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').trim()
      const subject = `こんな人を知っています — ${inviterName} さんからチームへの招待`
      const text = `こんな人を知っています——${inviterName} さんがあなたを「${teamName}」チームに招待しました。\n\nログインして確かめてみてください。\n${siteUrl}`
      const html = `<p>こんな人を知っています——</p><p><strong>${inviterName}</strong> さんがあなたを「<strong>${teamName}</strong>」チームに招待しました。</p><p>ログインして確かめてみてください。</p><p><a href="${siteUrl}">${siteUrl}</a></p>`

      await sendEmail(inviterProfile, { to: email, subject, text, html })
    } catch (e) {
      console.error('招待通知メール送信失敗:', e.message)
    }

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
