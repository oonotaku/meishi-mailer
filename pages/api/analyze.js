import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { SNS_CONFIG } from '../../lib/snsConfig'

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildSnsUrl(platform, value, cfg) {
  if (!value) return null
  if (value.startsWith('http')) return value
  const cleaned = value.replace(/^@/, '')
  if (cfg.baseUrl && cfg.inputMode === 'username') return cfg.baseUrl + cleaned
  const fallback = {
    instagram: `https://instagram.com/${cleaned}`,
    x: `https://x.com/${cleaned}`,
    github: `https://github.com/${cleaned}`,
    youtube: `https://youtube.com/@${cleaned}`,
    linkedin: `https://linkedin.com/in/${cleaned}`,
    note: `https://note.com/${cleaned}`,
    telegram: `https://t.me/${cleaned}`,
  }
  return fallback[platform] || value
}

function determinePreset(title, cardSns) {
  if (/CEO|CTO|CFO|COO|代表|社長|Director|President|Manager|マネージャー|取締役/i.test(title)) return 'business'
  const personalHits = ['line', 'whatsapp', 'instagram', 'x', 'tiktok', 'threads'].filter(p => cardSns[p]).length
  const bizHits = ['linkedin', 'github', 'wantedly', 'note', 'sansan', 'eight', 'mybridge'].filter(p => cardSns[p]).length
  return personalHits > bizHits ? 'personal' : 'business'
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { images: rawImages, image, mediaType = 'image/jpeg', capturedAt, locale = 'ja', memo, qr_results = [] } = req.body
  // 複数画像（新形式）or 単一画像（旧形式）を正規化
  const imageList = rawImages?.length > 0
    ? rawImages
    : image ? [{ data: image, media_type: mediaType }] : null
  if (!imageList) return res.status(400).json({ error: 'image required' })

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
      sns_wechat, sns_discord, sns_github, sns_bluesky, sns_pinterest,
      sns_sansan, sns_eight, sns_mybridge, sns_vercel, sns_wantedly, sns_note`)
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
    const qrContext = qr_results.length > 0
      ? `\nDetected QR codes on the card: ${qr_results.join(', ')}`
      : ''
    const ocrPrompt = `You are analyzing ${imageList.length} business card image(s). Extract info and return JSON only. No other text.
If multiple distinct cards are visible (different companies or emails), output a "cards" array.
If it's all the same person/company (front+back), output a single object.

Single card format:
{"name":"full name","company":"company","department":"dept or empty","title":"title or empty","email":"email or empty","phone":"phone or empty","website":"website URL or empty","sns":{"line":null,"whatsapp":null,"instagram":null,"x":null,"facebook":null,"linkedin":null,"github":null,"youtube":null,"wantedly":null,"note":null,"sansan":null,"eight":null,"mybridge":null}}

Multi-card format (when genuinely different people or companies):
{"name":"shared name or primary","cards":[{"company":"Co A","title":"Title A","email":"emailA","phone":"phoneA","website":"","sns":{...}},{"company":"Co B","title":"Title B","email":"emailB","phone":"phoneB","website":"","sns":{...}}]}

Rules:
- name is always the person's name (same across all cards if same person)
- Extract all SNS, URLs, QR links visible. Set null if not found.
- department can be empty string
${qrContext}`
    const ocrRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          ...imageList.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } })),
          { type: 'text', text: ocrPrompt }
        ]
      }]
    })

    const raw = ocrRes.content[0].text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(raw)

    // マルチカード正規化
    let contact, cards
    if (parsed.cards && Array.isArray(parsed.cards)) {
      cards = parsed.cards.map(c => ({ ...c, name: c.name || parsed.name }))
      contact = { name: parsed.name, ...cards[0] }
    } else {
      contact = parsed
      cards = [parsed]
    }

    // emailベース重複チェック（全カードのemail）
    let email_duplicates = []
    const emails = [...new Set(cards.map(c => c.email).filter(Boolean))]
    for (const email of emails) {
      const { data: existing } = await supabaseAdmin
        .from('contacts')
        .select('id, name, company, met_at, event_name, location, created_at')
        .eq('owner_id', user.id)
        .ilike('email', email)
        .order('met_at', { ascending: false, nullsFirst: false })
      if (existing?.length > 0) email_duplicates = [...email_duplicates, ...existing]
    }

    // nameベース重複チェック（emailヒットなし時のみ）
    let name_duplicates = []
    if (email_duplicates.length === 0 && contact.name) {
      const { data: nameExisting } = await supabaseAdmin
        .from('contacts')
        .select('id, name, company, email, met_at, event_name, location, created_at')
        .eq('owner_id', user.id)
        .ilike('name', contact.name)
        .order('met_at', { ascending: false, nullsFirst: false })
      if (nameExisting?.length > 0) name_duplicates = nameExisting
    }

    // meishi-mailerユーザー検出（OCRで取得したemailでprofilesを検索）
    let meishi_user = null
    if (emails.length > 0) {
      const { data: profileMatch } = await supabaseAdmin
        .from('profiles')
        .select('id, name, avatar_url')
        .ilike('email', emails[0])
        .maybeSingle()
      if (profileMatch && profileMatch.id !== user.id) {
        meishi_user = {
          user_id: profileMatch.id,
          name: profileMatch.name,
          avatar_url: profileMatch.avatar_url,
          profile_url: `https://www.meishi-mailer.com/p/${profileMatch.id}`,
        }
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
- Include anticipation of future connection
- Do not include a closing signature or sign-off line (e.g. "Warm regards, [Name]") — a signature block is appended automatically`
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
- 今後のお付き合いへの期待を含める
- 末尾に「敬具」「よろしくお願いいたします」などの締め文や署名は入れない（署名は自動で付与される）`
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

    // SNSマッチング
    const cardSns = contact.sns || {}
    const snsConfigMap = {}
    SNS_CONFIG.forEach(f => { snsConfigMap[f.key.replace('sns_', '')] = f })

    const matched_sns = []
    for (const [platform, cardValue] of Object.entries(cardSns)) {
      if (!cardValue) continue
      const profileKey = `sns_${platform}`
      if (!profile?.[profileKey]) continue
      const cfg = snsConfigMap[platform]
      if (!cfg) continue
      matched_sns.push({
        platform,
        label: cfg.label,
        card_url: buildSnsUrl(platform, cardValue, cfg),
        color: cfg.color,
        icon: cfg.icon || null,
      })
    }

    const recommended_preset = determinePreset(contact.title || '', cardSns)

    res.json({ contact, cards, subject, body, email_duplicates, name_duplicates, matched_sns, recommended_preset, meishi_user })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}
