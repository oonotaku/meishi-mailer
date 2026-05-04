import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '../../../lib/supabaseAdmin'

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PROMPT = `この名刺画像から以下の情報をJSON形式で抽出してください。他のテキストは一切出力せずJSONのみ返してください。
{"name":"氏名","company":"会社名","title":"肩書き・役職","email":"メールアドレス","phones":["電話番号1","電話番号2"],"website":"WebサイトURL","sns":{"line":"URLまたはQRコード検出の旨","whatsapp":"電話番号またはURL","instagram":"@アカウント名またはURL","x":"@アカウント名またはURL","facebook":"URL","linkedin":"URL","github":"アカウント名またはURL","youtube":"URL","tiktok":"@アカウント名またはURL","note":"アカウント名またはURL","wantedly":"URL"}}
・値が見つからない場合はnullにしてください
・SNSはアイコン・@マーク・known URLパターン・QRコードの存在も含めて検出してください
・phonesは複数ある場合は全て配列で返してください`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

  const { imageBase64, mediaType = 'image/jpeg' } = req.body
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' })

  try {
    const ocrRes = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: PROMPT },
        ]
      }]
    })

    const raw = ocrRes.content[0].text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(raw)
    res.json(result)
  } catch (e) {
    console.error('[scan-card]', e)
    res.status(500).json({ error: e.message })
  }
}
