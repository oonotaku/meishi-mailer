import { supabaseAdmin } from '../../../lib/supabaseAdmin'

const SNS_KEYS = ['sns_line','sns_whatsapp','sns_instagram','sns_x','sns_facebook','sns_tiktok','sns_threads','sns_telegram','sns_wechat','sns_linkedin','sns_github','sns_vercel','sns_note','sns_wantedly','sns_youtube','sns_discord','sns_bluesky','sns_pinterest','sns_sansan','sns_eight','sns_mybridge']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const [profileRes, affiliationsRes, blocksRes] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select(`id, name, bio, avatar_url, profile_theme, ${SNS_KEYS.join(', ')}`)
      .eq('id', userId)
      .single(),
    supabaseAdmin
      .from('profile_affiliations')
      .select('company_name, title, contact_email, show_email, phone, show_phone')
      .eq('user_id', userId)
      .order('order_index', { ascending: true })
      .limit(1),
    supabaseAdmin
      .from('profile_blocks')
      .select('id, type, size, content, order_index')
      .eq('user_id', userId)
      .order('order_index', { ascending: true }),
  ])

  if (!profileRes.data) return res.status(404).json({ error: 'not found' })

  const profile = profileRes.data
  const aff = affiliationsRes.data?.[0]

  const extracted_sns = {}
  for (const key of SNS_KEYS) {
    if (profile[key]) extracted_sns[key.replace('sns_', '')] = profile[key]
  }

  res.json({
    id: profile.id,
    name: profile.name,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    company: aff?.company_name || '',
    title: aff?.title || '',
    email: aff?.show_email ? aff.contact_email : null,
    phone: aff?.show_phone ? aff.phone : null,
    profile_url: `https://koryu.app/p/${profile.id}`,
    profile_theme: profile.profile_theme || 'dark',
    blocks: blocksRes.data || [],
    extracted_sns,
  })
}
