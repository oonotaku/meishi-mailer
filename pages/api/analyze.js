import Anthropic from '@anthropic-ai/sdk'

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { image, mediaType = 'image/jpeg', capturedAt } = req.body
  if (!image) return res.status(400).json({ error: 'image required' })
  const now = new Date()
  const captured = capturedAt ? new Date(capturedAt) : now
  const sameDay = now.toDateString() === captured.toDateString()
  const greetingStart = sameDay ? '先ほどは' : '先日は'

  try {
    // Step 1: OCR
    const ocrRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: 'この名刺画像から情報を抽出し、JSON形式のみで返してください。他の文字は一切不要です。\n{"name":"氏名","company":"会社名","department":"部署(なければ空)","title":"役職(なければ空)","email":"メール(なければ空)","phone":"電話(なければ空)"}' }
        ]
      }]
    })

    const raw = ocrRes.content[0].text.replace(/```json|```/g, '').trim()
    const contact = JSON.parse(raw)

    // Step 2: メール生成
    const mailRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `以下の方への名刺交換お礼メールを作成してください。
氏名: ${contact.name || '不明'} / 会社: ${contact.company || ''} / 役職: ${contact.title || ''}

条件:
- 1行目: 件名（「件名:」なしで件名のみ）
- 2行目以降: 本文
- 冒頭の挨拶は「${greetingStart}」で始める
- 「。」の後は必ず改行する
- 丁寧でビジネス的、温かみのある日本語
- 本文100〜150字
- 今後のお付き合いへの期待を含める
- 署名: 大野 拓（node-bee合同会社）`
      }]
    })

    const mailText = mailRes.content[0].text.trim()
    const lines = mailText.split('\n')
    const subject = lines[0].replace(/^件名[:：]\s*/, '').trim()
    const body = lines.slice(1).join('\n').trim()

    res.json({ contact, subject, body })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: e.message })
  }
}
