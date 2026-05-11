import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { image } = req.body

  if (image === null) {
    const path = `${user.id}/profile_bg.jpg`
    await supabaseAdmin.storage.from('avatars').remove([path])
    await supabaseAdmin.from('profiles').update({ profile_bg_image_url: null }).eq('id', user.id)
    return res.json({ url: null })
  }

  if (!image) return res.status(400).json({ error: '画像データが必要です' })

  const buffer = Buffer.from(image, 'base64')
  const path = `${user.id}/profile_bg.jpg`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('avatars')
    .upload(path, buffer, { upsert: true, contentType: 'image/jpeg' })
  if (uploadError) return res.status(500).json({ error: uploadError.message })

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('avatars')
    .getPublicUrl(path)

  const bgUrl = `${publicUrl}?t=${Date.now()}`

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ profile_bg_image_url: bgUrl })
    .eq('id', user.id)
  if (updateError) return res.status(500).json({ error: updateError.message })

  return res.json({ url: bgUrl })
}
