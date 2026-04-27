import { supabaseAdmin } from '../../../lib/supabaseAdmin'

function extractStoragePath(url) {
  const marker = '/object/public/cards/'
  const idx = url.indexOf(marker)
  return idx === -1 ? null : url.slice(idx + marker.length)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { id } = req.query

  const { data: contact, error } = await supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !contact) return res.status(404).json({ error: '見つかりません' })

  // Access check: owner or team member with visibility=team
  const { data: memberships } = await supabaseAdmin
    .from('user_organizations')
    .select('organization_id')
    .eq('user_id', user.id)
  const orgIds = (memberships || []).map(m => m.organization_id)

  const isOwner = contact.owner_id === user.id
  const isTeamMember = contact.visibility === 'team' && orgIds.includes(contact.organization_id)
  if (!isOwner && !isTeamMember) return res.status(403).json({ error: 'アクセス権限がありません' })

  // Generate signed URLs for card images
  const paths = (contact.card_image_urls || []).map(extractStoragePath).filter(Boolean)
  let signedUrls = []
  if (paths.length > 0) {
    const { data: signed } = await supabaseAdmin.storage
      .from('cards')
      .createSignedUrls(paths, 3600)
    signedUrls = (signed || []).map(item => item.signedUrl).filter(Boolean)
  }

  res.json({
    data: {
      ...contact,
      card_signed_urls: signedUrls,
    },
  })
}
