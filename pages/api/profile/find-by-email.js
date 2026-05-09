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

  const [blocksRes, affiliationsRes] = await Promise.all([
    supabaseAdmin
      .from('profile_blocks')
      .select('id, type, size, content, order_index')
      .eq('user_id', data.id)
      .order('order_index', { ascending: true }),
    supabaseAdmin
      .from('profile_affiliations')
      .select('company_name, title, contact_email, show_email, phone, show_phone, website, show_website')
      .eq('user_id', data.id)
      .order('order_index', { ascending: true })
      .limit(1),
  ])

  const aff = affiliationsRes.data?.[0]

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
    blocks: blocksRes.data || [],
    profile_url: `https://koryu.app/p/${data.id}`,
    company: aff?.company_name || '',
    title: aff?.title || '',
    email: aff?.show_email ? aff.contact_email : null,
    phone: aff?.show_phone ? aff.phone : null,
    website: aff?.show_website ? aff.website : null,
  })
}
