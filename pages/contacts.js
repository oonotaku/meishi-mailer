import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { useRequireAuth } from '../lib/useRequireAuth'

export default function Contacts() {
  const { user, profile, loading: authLoading } = useRequireAuth()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    // 自分のcontact + 同じ組織のメンバーのcontactを取得
    const filter = profile?.organization_id
      ? `owner_id.eq.${user.id},organization_id.eq.${profile.organization_id}`
      : `owner_id.eq.${user.id}`
    supabase
      .from('contacts')
      .select('*')
      .or(filter)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setContacts(data || [])
        setLoading(false)
      })
  }, [user, profile])

  const initials = (name) => {
    if (!name) return '?'
    return name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?'
  }

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #1e1e2a', borderTopColor: '#7b9e87', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <>
      <Head>
        <title>保存済み名刺 — 名刺メーラー</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <div className="header">
          <button className="back-btn" onClick={() => router.push('/')}>← 戻る</button>
          <div className="header-title">保存済み名刺</div>
        </div>

        {loading && (
          <div className="center">
            <div className="spinner" />
          </div>
        )}

        {!loading && contacts.length === 0 && (
          <div className="empty">
            <p>保存された名刺はありません</p>
            <button className="upload-btn" onClick={() => router.push('/')}>名刺を撮影する</button>
          </div>
        )}

        {!loading && contacts.length > 0 && (
          <div className="list">
            {contacts.map(c => (
              <button key={c.id} className="card" onClick={() => router.push(`/contacts/${c.id}`)}>
                <div className="avatar">{initials(c.name)}</div>
                <div className="info">
                  <div className="name">{c.name || '（名前なし）'}</div>
                  <div className="meta">{c.company || '—'}</div>
                </div>
                <div className={`badge ${c.mail_sent_at ? 'sent' : 'unsent'}`}>
                  {c.mail_sent_at ? '送信済み' : '未送信'}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0a0a0f; color: #f0ede8; font-family: 'Noto Sans JP', sans-serif; }
      `}</style>

      <style jsx>{`
        .shell {
          min-height: 100svh;
          max-width: 430px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
        }
        .header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #1e1e2a;
        }
        .back-btn {
          background: none;
          border: none;
          color: #7b9e87;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          padding: 0;
        }
        .header-title {
          font-size: 16px;
          font-weight: 700;
          color: #f0ede8;
        }
        .center {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .spinner {
          width: 32px; height: 32px;
          border: 2px solid #1e1e2a;
          border-top-color: #7b9e87;
          border-radius: 50%;
          animation: spin .7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 2rem;
          color: #5a5650;
          font-size: 14px;
        }
        .upload-btn {
          padding: 14px 28px;
          background: #7b9e87;
          color: #0a0a0f;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
        }
        .list {
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 14px;
          padding: 1rem;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: border-color .15s;
        }
        .card:active { border-color: #7b9e87; }
        .avatar {
          width: 42px; height: 42px;
          border-radius: 50%;
          background: #1a2e22;
          color: #7b9e87;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700;
          flex-shrink: 0;
          font-family: 'DM Mono', monospace;
        }
        .info { flex: 1; min-width: 0; }
        .name { font-size: 15px; font-weight: 700; color: #f0ede8; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .meta { font-size: 12px; color: #5a5650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .badge {
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          padding: 3px 8px;
          border-radius: 999px;
          flex-shrink: 0;
        }
        .badge.sent { background: #0d1f15; color: #7b9e87; border: 1px solid #1a3525; }
        .badge.unsent { background: #1a1408; color: #8a6a30; border: 1px solid #2a2010; }
      `}</style>
    </>
  )
}
