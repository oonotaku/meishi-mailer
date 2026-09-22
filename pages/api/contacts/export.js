import { supabaseAdmin } from '../../../lib/supabaseAdmin'
import ExcelJS from 'exceljs'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: '認証が必要です' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: '認証が必要です' })

  const { data: contacts, error } = await supabaseAdmin
    .from('contacts')
    .select('name, company, department, title, email, phone, website, event_name, met_at, location, temperature, memo, tags, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('つながり一覧')
  sheet.columns = [
    { header: '氏名', key: 'name', width: 16 },
    { header: '会社', key: 'company', width: 22 },
    { header: '部署', key: 'department', width: 16 },
    { header: '役職', key: 'title', width: 16 },
    { header: 'メール', key: 'email', width: 28 },
    { header: '電話', key: 'phone', width: 16 },
    { header: 'ウェブサイト', key: 'website', width: 24 },
    { header: 'イベント名', key: 'event_name', width: 18 },
    { header: '出会った日', key: 'met_at', width: 14 },
    { header: '場所/日付メモ', key: 'location', width: 16 },
    { header: '温度感', key: 'temperature', width: 10 },
    { header: 'メモ', key: 'memo', width: 34 },
    { header: 'タグ', key: 'tags_str', width: 22 },
    { header: '登録日時', key: 'created_at', width: 18 },
  ]
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).alignment = { vertical: 'middle' }

  for (const c of (contacts || [])) {
    sheet.addRow({
      ...c,
      tags_str: (c.tags || []).join(', '),
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="koryu_contacts_${new Date().toISOString().slice(0, 10)}.xlsx"`)
  res.send(Buffer.from(buffer))
}
