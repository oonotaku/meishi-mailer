import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { sendEmail } from '../../lib/sendEmail'

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

  const { to, subject, body, selected_preset = 'business', contact_id } = req.body
  if (!to || !subject || !body) return res.status(400).json({ error: 'missing fields' })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select(`name, sender_email, sendgrid_api_key, smtp_provider, smtp_host, smtp_port, smtp_user, smtp_password, gmail_refresh_token, gmail_email,
      sns_line, sns_whatsapp, sns_x, sns_instagram, sns_facebook,
      sns_linkedin, sns_tiktok, sns_youtube, sns_threads, sns_telegram,
      sns_wechat, sns_discord, sns_github, sns_bluesky, sns_pinterest,
      sns_sansan, sns_eight, sns_mybridge, sns_vercel, sns_wantedly, sns_note`)
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

  try {
    await sendEmail(profile, {
      to,
      subject,
      text: body,
      html: buildHtmlEmail(body, profile.name || '', primaryAffil?.company_name || '', primaryAffil?.title || '', qrUrl, profileUrl),
    })
    if (contact_id) {
      supabaseAdmin.from('encounters').insert({
        contact_id,
        met_at: new Date().toISOString(),
        event_name: 'メール送信',
        memo: subject || null,
      }).then().catch(e => console.error('[send] encounter insert:', e))
    }
    return res.json({ ok: true })
  } catch (e) {
    console.error(e)
    const msg = e.response?.body?.errors?.[0]?.message || e.message
    const isSetupError = e.message.includes('未設定') || e.message.includes('未完了')
    return res.status(isSetupError ? 400 : 500).json({ error: msg })
  }
}
