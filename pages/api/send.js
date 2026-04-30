import { supabaseAdmin } from '../../lib/supabaseAdmin'
import sgMail from '@sendgrid/mail'
import nodemailer from 'nodemailer'
import { google } from 'googleapis'

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function buildHtmlEmail(body, senderName, company, title, qrUrl, profileUrl) {
  const htmlBody = body
    .split('\n')
    .map(line => `<p style="margin:0 0 8px 0">${escapeHtml(line)}</p>`)
    .join('')

  const nameHtml = senderName ? `<strong style="font-size:14px">${escapeHtml(senderName)}</strong>` : ''
  const companyHtml = company ? `<div style="color:#555;font-size:12px">${escapeHtml(company)}</div>` : ''
  const titleHtml = title ? `<div style="color:#777;font-size:12px">${escapeHtml(title)}</div>` : ''

  return `
<div style="font-family:sans-serif;font-size:13px;line-height:1.7;color:#333;max-width:600px">
  <div>${htmlBody}</div>
  <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0">
  <table cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td style="padding-right:16px;vertical-align:top">
        <a href="${profileUrl}" target="_blank">
          <img src="${qrUrl}" width="100" height="100" alt="Profile QR" style="display:block;border:0">
        </a>
        <div style="font-size:10px;color:#999;text-align:center;margin-top:4px">プロフィールを開く</div>
      </td>
      <td style="vertical-align:middle">
        ${nameHtml}
        ${companyHtml}
        ${titleHtml}
        <div style="margin-top:6px;font-size:11px;color:#aaa">
          <a href="${profileUrl}" style="color:#aaa;text-decoration:none">${escapeHtml(profileUrl)}</a>
        </div>
      </td>
    </tr>
  </table>
</div>`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { to, subject, body } = req.body
  if (!to || !subject || !body) return res.status(400).json({ error: 'missing fields' })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('name, sender_email, sendgrid_api_key, smtp_provider, smtp_host, smtp_port, smtp_user, smtp_password, gmail_refresh_token, gmail_email')
    .eq('id', user.id)
    .single()

  const { data: affiliations } = await supabaseAdmin
    .from('profile_affiliations')
    .select('company_name, title')
    .eq('user_id', user.id)
    .order('order_index', { ascending: true })
    .limit(1)
  const primaryAffil = affiliations?.[0]

  const profileUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/p/${user.id}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(profileUrl)}&bgcolor=ffffff&color=000000&margin=2`

  const provider = profile?.smtp_provider || 'sendgrid'

  if (provider === 'sendgrid') {
    if (!profile?.sender_email || !profile?.sendgrid_api_key) {
      return res.status(400).json({
        error: 'メール送信設定が未完了です。プロフィール設定からSendGridのAPIキーを設定してください。',
      })
    }

    sgMail.setApiKey(profile.sendgrid_api_key)

    try {
      await sgMail.send({
        to,
        from: profile.sender_email,
        subject,
        text: body,
        html: buildHtmlEmail(body, profile.name || '', primaryAffil?.company_name || '', primaryAffil?.title || '', qrUrl, profileUrl),
      })
      return res.json({ ok: true })
    } catch (e) {
      console.error(e)
      const msg = e.response?.body?.errors?.[0]?.message || e.message
      return res.status(500).json({ error: msg })
    }
  } else if (provider === 'gmail') {
    if (!profile?.gmail_refresh_token || !profile?.gmail_email) {
      return res.status(400).json({
        error: 'Gmailの連携が未設定です。プロフィール設定からGoogleアカウントを連携してください。',
      })
    }

    try {
      console.log('[Gmail] refreshToken exists:', !!profile.gmail_refresh_token)
      console.log('[Gmail] clientId exists:', !!process.env.GOOGLE_CLIENT_ID)
      console.log('[Gmail] clientSecret exists:', !!process.env.GOOGLE_CLIENT_SECRET)

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/gmail-callback`
      )
      oauth2Client.setCredentials({ refresh_token: profile.gmail_refresh_token })

      let accessToken
      try {
        const { token } = await oauth2Client.getAccessToken()
        accessToken = token
        console.log('[Gmail] accessToken obtained:', !!accessToken, accessToken?.substring(0, 10))
      } catch (tokenErr) {
        console.error('[Gmail] getAccessToken failed:', tokenErr.message)
        throw tokenErr
      }

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: profile.gmail_email,
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          refreshToken: profile.gmail_refresh_token,
          accessToken,
        },
      })
      await transporter.sendMail({
        from: profile.gmail_email,
        to,
        subject,
        text: body,
        html: buildHtmlEmail(body, profile.name || '', primaryAffil?.company_name || '', primaryAffil?.title || '', qrUrl, profileUrl),
      })
      return res.json({ ok: true })
    } catch (e) {
      console.error(e)
      return res.status(500).json({ error: e.message })
    }
  } else {
    if (!profile?.sender_email || !profile?.smtp_host) {
      return res.status(400).json({
        error: 'メール送信設定が未完了です。プロフィール設定からSMTP情報を設定してください。',
      })
    }

    try {
      const transporter = nodemailer.createTransport({
        host: profile.smtp_host,
        port: profile.smtp_port,
        secure: profile.smtp_port === 465,
        auth: {
          user: profile.smtp_user,
          pass: profile.smtp_password,
        },
      })
      await transporter.sendMail({
        from: profile.sender_email,
        to,
        subject,
        text: body,
        html: buildHtmlEmail(body, profile.name || '', primaryAffil?.company_name || '', primaryAffil?.title || '', qrUrl, profileUrl),
      })
      return res.json({ ok: true })
    } catch (e) {
      console.error(e)
      return res.status(500).json({ error: e.message })
    }
  }
}
