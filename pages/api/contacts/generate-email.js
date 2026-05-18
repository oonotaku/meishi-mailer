import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const { contact_id, situation, memo } = req.body
  if (!contact_id || !situation) return res.status(400).json({ error: 'contact_id and situation required' })

  const [{ data: contact, error: contErr }, { data: encounters }, { data: profile }, { data: affiliations }] =
    await Promise.all([
      supabaseAdmin.from('contacts').select('name, company, title, email, owner_id').eq('id', contact_id).single(),
      supabaseAdmin.from('encounters').select('met_at, event_name, memo').eq('contact_id', contact_id).order('met_at', { ascending: false }).limit(5),
      supabaseAdmin.from('profiles').select('name').eq('id', user.id).single(),
      supabaseAdmin.from('profile_affiliations').select('company_name').eq('user_id', user.id).order('order_index', { ascending: true }).limit(1),
    ])

  if (contErr || !contact) return res.status(404).json({ error: 'Contact not found' })
  if (contact.owner_id !== user.id) return res.status(403).json({ error: 'Forbidden' })

  const senderName = profile?.name || ''
  const senderCompany = affiliations?.[0]?.company_name || ''
  const contactName = contact.name || '相手'
  const contactCompany = contact.company || ''
  const contactTitle = contact.title || ''

  const encounterHistory = (encounters || [])
    .map(e => {
      const date = e.met_at ? new Date(e.met_at).toLocaleDateString('ja-JP') : ''
      return `- ${[date, e.event_name, e.memo].filter(Boolean).join(' / ')}`
    })
    .join('\n') || 'なし'

  const prompt = `以下の情報をもとに、日本語のビジネスメールを生成してください。

送信者: ${senderName}（${senderCompany}）
宛先: ${contactName}様（${contactCompany} ${contactTitle}）
シチュエーション: ${situation}
メモ: ${memo || 'なし'}
過去の交流履歴:
${encounterHistory}

要件:
- 件名と本文を生成
- 100〜150文字程度の簡潔な本文
- 署名は含めない
- JSON形式で返す: { "subject": "...", "body": "..." }`

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const result = JSON.parse(jsonMatch[0])
    res.json({ subject: result.subject || '', body: result.body || '' })
  } catch (e) {
    console.error('[generate-email]', e)
    res.status(500).json({ error: e.message })
  }
}
