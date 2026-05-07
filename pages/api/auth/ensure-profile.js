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
    // profilesを先に作成してFK制約を満たす
    const { data: existingProfileEarly } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', user.id)
      .maybeSingle()

    await supabaseAdmin
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        name: existingProfileEarly?.name || user.email.split('@')[0],
      }, { onConflict: 'id' })

    // 招待経由: metadata の organization_id を member として登録（未登録なら）
    const orgIdFromMeta = user.user_metadata?.organization_id
      || user.app_metadata?.organization_id
    console.error('ensure-profile invite debug:', {
      user_id: user.id,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
      orgIdFromMeta,
    })
    if (orgIdFromMeta && !memberships.some(m => m.organization_id === orgIdFromMeta)) {
      const { error: insertErr } = await supabaseAdmin
        .from('user_organizations')
        .insert({ user_id: user.id, organization_id: orgIdFromMeta, role: 'member' })
      if (insertErr) console.error('ensure-profile member insert error:', insertErr)
    }

    // 自分のチームを新規作成して owner になる
    const acceptLang = req.headers['accept-language'] || 'ja'
    const defaultOrgName = acceptLang.startsWith('en') ? 'My Team' : 'マイチーム'
    const { data: org, error: orgErr } = await supabaseAdmin
      .from('organizations')
      .insert({ name: defaultOrgName })
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

  // plan / scan_count_month / smtp 設定を別 SELECT で取得（カラム追加前の環境でも upsert が壊れないよう分離）
  const { data: billingData } = await supabaseAdmin
    .from('profiles')
    .select(`plan, scan_count_month, smtp_provider, smtp_host, smtp_port, smtp_user, gmail_email,
      sns_line, sns_whatsapp, sns_x, sns_instagram, sns_facebook,
      sns_linkedin, sns_tiktok, sns_youtube, sns_threads, sns_telegram,
      sns_wechat, sns_discord, sns_github, sns_bluesky, sns_pinterest,
      sns_sansan, sns_eight, sns_mybridge, sns_vercel, sns_wantedly, sns_note,
      phone, website, contact_email, show_phone, show_website, show_email,
      avatar_url, bio, profile_theme`)
    .eq('id', user.id)
    .single()

  const organizations = memberships.map(m => ({
    organization_id: m.organization_id,
    name: m.organizations?.name,
    role: m.role,
  }))

  const responseObject = {
    profile: {
      ...profile,
      plan: billingData?.plan ?? 'free',
      scan_count_month: billingData?.scan_count_month ?? 0,
      smtp_provider: billingData?.smtp_provider ?? null,
      smtp_host: billingData?.smtp_host ?? null,
      smtp_port: billingData?.smtp_port ?? null,
      smtp_user: billingData?.smtp_user ?? null,
      gmail_email: billingData?.gmail_email ?? null,
      sns_line: billingData?.sns_line ?? null,
      sns_whatsapp: billingData?.sns_whatsapp ?? null,
      sns_x: billingData?.sns_x ?? null,
      sns_instagram: billingData?.sns_instagram ?? null,
      sns_facebook: billingData?.sns_facebook ?? null,
      sns_linkedin: billingData?.sns_linkedin ?? null,
      sns_tiktok: billingData?.sns_tiktok ?? null,
      sns_youtube: billingData?.sns_youtube ?? null,
      sns_threads: billingData?.sns_threads ?? null,
      sns_telegram: billingData?.sns_telegram ?? null,
      sns_wechat: billingData?.sns_wechat ?? null,
      sns_discord: billingData?.sns_discord ?? null,
      sns_github: billingData?.sns_github ?? null,
      sns_bluesky: billingData?.sns_bluesky ?? null,
      sns_pinterest: billingData?.sns_pinterest ?? null,
      sns_sansan: billingData?.sns_sansan ?? null,
      sns_eight: billingData?.sns_eight ?? null,
      sns_mybridge: billingData?.sns_mybridge ?? null,
      sns_vercel: billingData?.sns_vercel ?? null,
      sns_wantedly: billingData?.sns_wantedly ?? null,
      sns_note: billingData?.sns_note ?? null,
      phone: billingData?.phone ?? null,
      website: billingData?.website ?? null,
      contact_email: billingData?.contact_email ?? null,
      show_phone: billingData?.show_phone ?? false,
      show_website: billingData?.show_website ?? true,
      show_email: billingData?.show_email ?? false,
      avatar_url: billingData?.avatar_url ?? null,
      bio: billingData?.bio ?? null,
      profile_theme: billingData?.profile_theme ?? 'dark',
      organization_id: ownerOrgId,
      role: 'owner',
      organizations,
    },
  }

  console.error('ensure-profile response:', JSON.stringify(responseObject))

  return res.status(200).json(responseObject)
}
