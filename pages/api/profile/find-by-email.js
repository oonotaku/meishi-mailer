import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { email } = req.query
  if (!email) return res.status(400).json({ error: 'email required' })

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, avatar_url, bio')
    .ilike('email', email)
    .maybeSingle()

  if (!data) return res.status(404).json({ error: 'not found' })

  res.json({
    user_id: data.id,
    name: data.name,
    avatar_url: data.avatar_url,
    bio: data.bio,
    profile_url: `https://www.meishi-mailer.com/p/${data.id}`,
  })
}
