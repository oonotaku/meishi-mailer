import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { paths } = req.body
  if (!Array.isArray(paths) || paths.length === 0) {
    return res.json({ signedUrls: [] })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('cards')
    .createSignedUrls(paths, 3600)

  if (error) return res.status(500).json({ error: error.message })

  res.json({
    signedUrls: (data || []).map(item => ({
      path: item.path,
      signedUrl: item.signedUrl,
    })),
  })
}
