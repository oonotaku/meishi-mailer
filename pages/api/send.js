import { supabaseAdmin } from '../../lib/supabaseAdmin'
import sgMail from '@sendgrid/mail'
import nodemailer from 'nodemailer'

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
    .select('name, sender_email, sendgrid_api_key, smtp_provider, smtp_host, smtp_port, smtp_user, smtp_password')
    .eq('id', user.id)
    .single()

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
      })
      return res.json({ ok: true })
    } catch (e) {
      console.error(e)
      const msg = e.response?.body?.errors?.[0]?.message || e.message
      return res.status(500).json({ error: msg })
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
      })
      return res.json({ ok: true })
    } catch (e) {
      console.error(e)
      return res.status(500).json({ error: e.message })
    }
  }
}
