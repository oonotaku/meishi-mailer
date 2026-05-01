import { supabaseAdmin } from '../../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  const { code, state: token, error } = req.query
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL

  if (error || !code || !token) {
    return res.redirect(`${siteUrl}/settings/profile?gmail=error`)
  }

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return res.redirect(`${siteUrl}/settings/profile?gmail=error`)
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/gmail/callback`

  // authorization code → access_token / refresh_token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenData.refresh_token || !tokenData.access_token) {
    return res.redirect(`${siteUrl}/settings/profile?gmail=error`)
  }

  // Gmailアドレスを取得
  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  const userInfo = await userInfoRes.json()

  if (!userInfo.email) {
    return res.redirect(`${siteUrl}/settings/profile?gmail=error`)
  }

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({
      smtp_provider: 'gmail',
      gmail_refresh_token: tokenData.refresh_token,
      gmail_email: userInfo.email,
      sender_email: userInfo.email,
    })
    .eq('id', user.id)

  if (updateError) {
    return res.redirect(`${siteUrl}/settings/profile?gmail=error`)
  }

  res.redirect(`${siteUrl}/settings/profile?gmail=connected`)
}
