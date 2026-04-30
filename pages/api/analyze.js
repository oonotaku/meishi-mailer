import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '../../lib/supabaseAdmin'

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { image, mediaType = 'image/jpeg', capturedAt, locale = 'ja', memo } = req.body
  if (!image) return res.status(400).json({ error: 'image required' })

  // Auth
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  // プランチェック＋スキャン数管理
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select(`plan, scan_count_month, scan_count_reset_at, name,
      sns_line, sns_whatsapp, sns_x, sns_instagram, sns_facebook,
      sns_linkedin, sns_tiktok, sns_youtube, sns_threads, sns_telegram,
      sns_wechat, sns_discord, sns_github, sns_bluesky, sns_pinterest`)
    .eq('id', user.id)
    .single()

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const needsReset = !profile?.scan_count_reset_at ||
    new Date(profile.scan_count_reset_at) < startOfMonth

  let currentCount = profile?.scan_count_month || 0
  if (needsReset) {
    currentCount = 0
    await supabaseAdmin.from('profiles')
      .update({ scan_count_month: 0, scan_count_reset_at: now.toISOString() })
      .eq('id', user.id)
  }

  const plan = profile?.plan || 'free'
  const limit = plan === 'pro' ? 100 : 10
  if (currentCount >= limit) {
    const msg = locale === 'en'
      ? (plan === 'pro'
          ? 'Monthly scan limit (100) reached.'
          : 'Monthly scan limit reached. Please upgrade to Pro.')
      : (plan === 'pro'
          ? '月のスキャン上限（100回）に達しました。'
          : '月のスキャン上限に達しました。Proプランにアップグレードしてください。')
    return res.status(403).json({ error: msg })
  }

  const captured = capturedAt ? new Date(capturedAt) : now
  const sameDay = now.toDateString() === captured.toDateString()

  try {
    // Step 1: OCR
    const ocrRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: 'Extract information from this business card image and return JSON only. No other text.\n{"name":"full name","company":"company name","department":"department or empty","title":"title or empty","email":"email or empty","phone":"phone or empty"}' }
        ]
      }]
    })

    const raw = ocrRes.content[0].text.replace(/```json|```/g, '').trim()
    const contact = JSON.parse(raw)

    // 重複チェック
    let duplicates = []
    if (contact.email) {
      const { data: existing } = await supabaseAdmin
        .from('contacts')
        .select('id, name, company, met_at, event_name, location, created_at')
        .eq('owner_id', user.id)
        .ilike('email', contact.email)
        .order('met_at', { ascending: false, nullsFirst: false })
      if (existing && existing.length > 0) {
        duplicates = existing
      }
    }

    // Step 2: メール生成（ロケール別プロンプト）
    let mailPrompt
    if (locale === 'en') {
      const greeting = sameDay
        ? 'Thank you for meeting with me earlier today'
        : 'Thank you for meeting with me recently'
      mailPrompt = `Create a professional, warm English business thank-you email for the following person.
Name: ${contact.name || 'Unknown'} / Company: ${contact.company || ''} / Title: ${contact.title || ''}

Rules:
- First line: subject line only (no "Subject:" prefix)
- Second line onwards: email body
- Start the body with "${greeting}"
- Professional, warm business English
- 80–120 words
- Include anticipation of future connection`
      if (memo) mailPrompt += `\n- Conversation notes: "${memo}"\n- Naturally weave these notes into the email body without being pushy`
    } else {
      const greetingStart = sameDay ? '先ほどは' : '先日は'
      mailPrompt = `以下の方への名刺交換お礼メールを作成してください。
氏名: ${contact.name || '不明'} / 会社: ${contact.company || ''} / 役職: ${contact.title || ''}

条件:
- 1行目: 件名（「件名:」なしで件名のみ）
- 2行目以降: 本文
- 冒頭の挨拶は「${greetingStart}」で始める
- 「。」の後は必ず改行する
- 丁寧でビジネス的、温かみのある日本語
- 本文100〜150字
- 今後のお付き合いへの期待を含める`
      if (memo) mailPrompt += `\n- 会話メモ：「${memo}」\n- このメモの内容を自然な形でメール本文に盛り込んでください。ただし押しつけがましくならないよう注意してください。`
    }

    const mailRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [{ role: 'user', content: mailPrompt }]
    })

    const mailText = mailRes.content[0].text.trim()
    const lines = mailText.split('\n')
    const subject = lines[0].replace(/^(件名|subject)[:：]\s*/i, '').trim()
    const body = lines.slice(1).join('\n').trim()

    // スキャン数をインクリメント
    await supabaseAdmin.from('profiles')
      .update({ scan_count_month: currentCount + 1 })
      .eq('id', user.id)

    res.json({ contact, subject, body, duplicates })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}
