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

  const orgId = profile?.current_organization_id

  let query = supabaseAdmin
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })

  if (orgId) {
    query = query.or(`owner_id.eq.${user.id},and(organization_id.eq.${orgId},visibility.eq.team)`)
  } else {
    query = query.eq('owner_id', user.id)
  }

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })
  res.json({ data: data || [] })
}
