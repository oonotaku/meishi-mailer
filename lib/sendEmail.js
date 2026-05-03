import sgMail from '@sendgrid/mail'
import nodemailer from 'nodemailer'
import { google } from 'googleapis'

async function sendWithGmail(gmailRefreshToken, gmailEmail, { to, subject, text, html }) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/gmail-callback`
  )
  oauth2Client.setCredentials({ refresh_token: gmailRefreshToken })
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })
  const boundary = 'boundary_' + Date.now()
  const mimeMessage = [
    `To: ${to}`,
    `From: ${gmailEmail}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(text || '').toString('base64'),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(html || text || '').toString('base64'),
    '',
    `--${boundary}--`,
  ].join('\r\n')
  const encodedMessage = Buffer.from(mimeMessage)
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } })
}

/**
 * profile: { smtp_provider, sender_email, sendgrid_api_key,
 *            gmail_refresh_token, gmail_email,
 *            smtp_host, smtp_port, smtp_user, smtp_password }
 */
export async function sendEmail(profile, { to, subject, text, html }) {
  const provider = profile?.smtp_provider || 'sendgrid'

  if (provider === 'gmail') {
    if (!profile?.gmail_refresh_token || !profile?.gmail_email) {
      throw new Error('Gmailの連携が未設定です')
    }
    await sendWithGmail(profile.gmail_refresh_token, profile.gmail_email, { to, subject, text, html })

  } else if (provider === 'sendgrid') {
    if (!profile?.sender_email || !profile?.sendgrid_api_key) {
      throw new Error('SendGridの設定が未完了です')
    }
    sgMail.setApiKey(profile.sendgrid_api_key)
    await sgMail.send({ to, from: profile.sender_email, subject, text, html })

  } else {
    if (!profile?.sender_email || !profile?.smtp_host) {
      throw new Error('SMTPの設定が未完了です')
    }
    const transporter = nodemailer.createTransport({
      host: profile.smtp_host,
      port: profile.smtp_port,
      secure: profile.smtp_port === 465,
      auth: { user: profile.smtp_user, pass: profile.smtp_password },
    })
    await transporter.sendMail({ from: profile.sender_email, to, subject, text, html })
  }
}
