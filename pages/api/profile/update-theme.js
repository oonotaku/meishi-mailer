import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { theme, profile_theme } = req.body
  const themeId = theme || profile_theme
  if (typeof themeId !== 'string') return res.status(400).json({ error: 'theme が必要です' })

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ profile_theme: themeId })
    .eq('id', user.id)

  if (error) return res.status(500).json({ error: error.message })

  res.json({ ok: true })
}
