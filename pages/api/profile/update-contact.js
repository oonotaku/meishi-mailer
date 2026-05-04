import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { phone, website, contact_email, show_phone, show_website, show_email } = req.body

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      phone:         phone         ?? null,
      website:       website       ?? null,
      contact_email: contact_email ?? null,
      show_phone:    show_phone    ?? false,
      show_website:  show_website  ?? true,
      show_email:    show_email    ?? false,
    })
    .eq('id', user.id)

  if (error) return res.status(500).json({ error: error.message })
  res.json({ ok: true })
}
