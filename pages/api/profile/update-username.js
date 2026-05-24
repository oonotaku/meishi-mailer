import { supabaseAdmin } from '../../../lib/supabaseAdmin'

const RESERVED = ['admin','api','p','settings','login','auth','billing',
                  'contacts','scan','profile','koryu','support','help','about']

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { username } = req.body
  if (!username) return res.status(400).json({ error: 'usernameは必須です' })

  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
    return res.status(400).json({ error: '3〜30文字の英数字・ハイフン・アンダースコアのみ使用できます' })
  }
  if (RESERVED.includes(username.toLowerCase())) {
    return res.status(400).json({ error: 'このユーザー名は使用できません' })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('username, plan')
    .eq('id', user.id)
    .single()

  if (profile?.username && profile?.plan !== 'pro') {
    return res.status(403).json({ error: 'ユーザー名の変更はProプランのみ可能です' })
  }

  const { data: existing } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .neq('id', user.id)
    .single()

  if (existing) {
    return res.status(409).json({ error: 'このユーザー名はすでに使用されています' })
  }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ username: username.toLowerCase() })
    .eq('id', user.id)

  if (error) return res.status(500).json({ error: error.message })

  res.json({ username: username.toLowerCase() })
}
