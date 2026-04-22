import nodemailer from 'nodemailer'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { to, subject, body } = req.body
  if (!to || !subject || !body) return res.status(400).json({ error: 'missing fields' })
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
  try {
    await transporter.sendMail({
      from: `大野 卓 <${process.env.GMAIL_USER}>`,
      to,
      subject,
      text: body,
    })
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}