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

  const { data: rawContacts, error } = await supabaseAdmin
    .from('contacts')
    .select('*, encounters(count)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const contacts = rawContacts || []

  // Generate signed URLs for all card images in one batch call
  const allPaths = [...new Set(
    contacts.flatMap(c => (c.card_image_urls || []).map(extractStoragePath).filter(Boolean))
  )]
  const signedUrlMap = new Map()
  if (allPaths.length > 0) {
    const { data: signed } = await supabaseAdmin.storage
      .from('cards')
      .createSignedUrls(allPaths, 3600)
    for (const item of (signed || [])) {
      if (item.signedUrl) signedUrlMap.set(item.path, item.signedUrl)
    }
  }

  const result = contacts.map(c => ({
    ...c,
    encounter_count: c.encounters?.[0]?.count ?? 0,
    card_signed_urls: (c.card_image_urls || []).map(url => {
      const path = extractStoragePath(url)
      return path && signedUrlMap.has(path) ? signedUrlMap.get(path) : url
    }),
  }))

  res.json({ data: result })
}
