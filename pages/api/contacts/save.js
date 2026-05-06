import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('current_organization_id')
    .eq('id', user.id)
    .single()

  const orgId = profile?.current_organization_id || null

  const {
    name, company, department, title, email, phone, website,
    card_image_urls, subject, body, mail_sent_at,
    location, event_name, met_at, temperature, memo,
    extracted_sns,
  } = req.body

  const { data, error } = await supabaseAdmin
    .from('contacts')
    .insert({
      owner_id: user.id,
      organization_id: orgId,
      name: name || null,
      company: company || null,
      department: department || null,
      title: title || null,
      email: email || null,
      phone: phone || null,
      website: website || null,
      card_image_urls: card_image_urls || [],
      subject: subject || null,
      body: body || null,
      mail_sent_at: mail_sent_at || null,
      location: location || null,
      event_name: event_name || null,
      met_at: met_at || null,
      temperature: temperature || 'normal',
      memo: memo || null,
      visibility: 'private',
      extracted_sns: extracted_sns || null,
    })
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })

  // 初回出会いをencountersにも記録
  let encounterData = null
  if (data?.id) {
    const { data: encData } = await supabaseAdmin.from('encounters').insert({
      contact_id: data.id,
      met_at: met_at || null,
      event_name: event_name || null,
      location: location || null,
      memo: memo || null,
      temperature: temperature || 'normal',
    }).select().single()
    encounterData = encData
  }

  res.json({ data: { ...data, encounter_id: encounterData?.id || null } })
}
