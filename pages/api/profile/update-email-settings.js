import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const {
    smtp_provider,
    sender_email,
    sendgrid_api_key,
    smtp_host,
    smtp_port,
    smtp_user,
    smtp_password,
  } = req.body

  const provider = smtp_provider || 'sendgrid'

  if (!sender_email) {
    return res.status(400).json({ error: 'sender_email が必要です' })
  }

  if (provider === 'sendgrid') {
    if (!sendgrid_api_key) {
      return res.status(400).json({ error: 'sendgrid_api_key が必要です' })
    }
  } else if (provider === 'gmail') {
    if (!smtp_user || !smtp_password) {
      return res.status(400).json({ error: 'Gmailアドレスとアプリパスワードが必要です' })
    }
  } else {
    if (!smtp_host || !smtp_port || !smtp_user || !smtp_password) {
      return res.status(400).json({ error: 'SMTPホスト、ポート、ユーザー名、パスワードが必要です' })
    }
  }

  const updates = {
    sender_email: sender_email.trim(),
    smtp_provider: provider,
  }

  if (provider === 'sendgrid') {
    updates.sendgrid_api_key = sendgrid_api_key.trim()
    updates.smtp_host = null
    updates.smtp_port = null
    updates.smtp_user = null
    updates.smtp_password = null
  } else if (provider === 'gmail') {
    updates.smtp_host = 'smtp.gmail.com'
    updates.smtp_port = 587
    updates.smtp_user = smtp_user.trim()
    updates.smtp_password = smtp_password.trim()
    updates.sendgrid_api_key = null
  } else {
    updates.smtp_host = smtp_host.trim()
    updates.smtp_port = parseInt(smtp_port, 10)
    updates.smtp_user = smtp_user.trim()
    updates.smtp_password = smtp_password.trim()
    updates.sendgrid_api_key = null
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return res.status(500).json({ error: error.message })

  res.json({ ok: true })
}
