import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { imageBase64 } = req.body
  if (!imageBase64) return res.status(400).json({ error: '画像データが必要です' })

  const buffer = Buffer.from(imageBase64, 'base64')
  const path = `${user.id}/block_${Date.now()}.jpg`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('avatars')
    .upload(path, buffer, { upsert: false, contentType: 'image/jpeg' })
  if (uploadError) return res.status(500).json({ error: uploadError.message })

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('avatars')
    .getPublicUrl(path)

  return res.json({ image_url: publicUrl })
}
