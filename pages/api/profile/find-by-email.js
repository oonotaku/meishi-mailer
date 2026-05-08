import { supabaseAdmin } from '../../../lib/supabaseAdmin'

const SNS_KEYS = ['sns_line','sns_whatsapp','sns_instagram','sns_x','sns_facebook','sns_tiktok','sns_threads','sns_telegram','sns_wechat','sns_linkedin','sns_github','sns_vercel','sns_note','sns_wantedly','sns_youtube','sns_discord','sns_bluesky','sns_pinterest','sns_sansan','sns_eight','sns_mybridge']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { email } = req.query
  if (!email) return res.status(400).json({ error: 'email required' })

  const { data } = await supabaseAdmin
    .from('profiles')
    .select(`id, name, avatar_url, bio, profile_theme, ${SNS_KEYS.join(', ')}`)
    .ilike('email', email)
    .maybeSingle()

  if (!data) return res.status(404).json({ error: 'not found' })

  const { data: blocks } = await supabaseAdmin
    .from('profile_blocks')
    .select('id, type, size, content, order_index')
    .eq('user_id', data.id)
    .order('order_index', { ascending: true })

  const extracted_sns = {}
  for (const key of SNS_KEYS) {
    if (data[key]) extracted_sns[key.replace('sns_', '')] = data[key]
  }

  res.json({
    user_id: data.id,
    name: data.name,
    avatar_url: data.avatar_url,
    bio: data.bio,
    profile_theme: data.profile_theme || 'dark',
    extracted_sns,
    blocks: blocks || [],
    profile_url: `https://www.meishi-mailer.com/p/${data.id}`,
  })
}
