import { supabaseAdmin } from '../../../lib/supabaseAdmin'

const SNS_KEYS = [
  'sns_line', 'sns_whatsapp', 'sns_x', 'sns_instagram', 'sns_facebook',
  'sns_linkedin', 'sns_tiktok', 'sns_youtube', 'sns_threads', 'sns_telegram',
  'sns_wechat', 'sns_discord', 'sns_github', 'sns_bluesky', 'sns_pinterest',
  'sns_sansan', 'sns_eight', 'sns_mybridge', 'sns_vercel', 'sns_wantedly', 'sns_note',
]

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const updates = {}
  for (const key of SNS_KEYS) {
    const val = req.body[key]
    updates[key] = (val && val.trim()) ? val.trim() : null
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return res.status(500).json({ error: error.message })

  res.json({ ok: true })
}
