import { supabaseAdmin } from '../../../lib/supabaseAdmin'

const SNS_KEYS = ['sns_line','sns_whatsapp','sns_instagram','sns_x','sns_facebook','sns_tiktok','sns_threads','sns_telegram','sns_wechat','sns_linkedin','sns_github','sns_vercel','sns_note','sns_wantedly','sns_youtube','sns_discord','sns_bluesky','sns_pinterest','sns_sansan','sns_eight','sns_mybridge']

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { userId } = req.query
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select(`id, name, bio, avatar_url, ${SNS_KEYS.join(', ')}`)
    .eq('id', userId)
    .single()

  if (!profile) return res.status(404).json({ error: 'not found' })

  const { data: affiliations } = await supabaseAdmin
    .from('profile_affiliations')
    .select('company_name, title, contact_email, show_email, phone, show_phone')
    .eq('user_id', userId)
    .order('order_index', { ascending: true })
    .limit(1)

  const aff = affiliations?.[0]

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
    profile_url: `https://www.meishi-mailer.com/p/${profile.id}`,
    extracted_sns,
  })
}
