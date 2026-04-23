import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single()

  if (!profile?.current_organization_id) return res.status(200).json({ members: [] })

  const { data, error } = await supabaseAdmin
    .from('user_organizations')
    .select('role, created_at, profiles(id, name, email)')
    .eq('organization_id', profile.current_organization_id)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  res.json({ members: data || [] })
}
