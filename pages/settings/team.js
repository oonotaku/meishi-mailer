import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { useRequireAuth } from '../../lib/useRequireAuth'

export default function TeamSettings() {
  const { user, profile, loading: authLoading } = useRequireAuth()
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState(null) // { ok: bool, text: string }
  const router = useRouter()

  useEffect(() => {
    if (!profile?.organization_id) return
    supabase
      .from('profiles')
      .select('id, name, email, role, created_at')
      .eq('organization_id', profile.organization_id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMembers(data || [])
        setMembersLoading(false)
      })
  }, [profile])

  async function handleInvite(e) {
    e.preventDefault()
    setInviting(true)
    setInviteMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/team/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email: inviteEmail }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setInviteMsg({ ok: true, text: `${inviteEmail} に招待メールを送りました` })
      setInviteEmail('')
    } catch (err) {
      setInviteMsg({ ok: false, text: err.message })
    } finally {
      setInviting(false)
    }
  }

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

  const orgName = profile?.organizations?.name || 'マイチーム'
  const isOwner = profile?.role === 'owner'

  return (
    <>
      <Head>
        <title>チーム管理 — 名刺メーラー</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <div className="header">
          <button className="back-btn" onClick={() => router.push('/')}>← 戻る</button>
          <div className="header-title">チーム管理</div>
        </div>

        <div className="page">

          {/* 組織名 */}
          <div className="section">
            <div className="section-label">TEAM</div>
            <div className="org-name">{orgName}</div>
            <div className="org-role-badge">
              {isOwner ? 'オーナー' : 'メンバー'}
            </div>
          </div>

          <div className="divider" />

          {/* メンバー一覧 */}
          <div className="section">
            <div className="section-label">
              MEMBERS
              {!membersLoading && <span className="section-count"> · {members.length}人</span>}
            </div>

            {membersLoading ? (
              <div className="spinner-wrap"><div className="spinner" /></div>
            ) : (
              <div className="member-list">
                {members.map(m => (
                  <div key={m.id} className="member-row">
                    <div className="member-avatar">{initials(m.name)}</div>
                    <div className="member-info">
                      <div className="member-name">
                        {m.name || m.email?.split('@')[0] || '—'}
                        {m.id === user?.id && <span className="you-badge"> (you)</span>}
                      </div>
                      <div className="member-email">{m.email || '—'}</div>
                    </div>
                    <div className={`role-badge ${m.role}`}>
                      {m.role === 'owner' ? 'オーナー' : 'メンバー'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 招待フォーム（オーナーのみ） */}
          {isOwner && (
            <>
              <div className="divider" />
              <div className="section">
                <div className="section-label">招待</div>
                <p className="invite-desc">
                  メールアドレスを入力してチームメンバーを招待します。
                  招待されたメンバーには参加用のリンクが届きます。
                </p>
                <form onSubmit={handleInvite} className="invite-form">
                  <input
                    type="email"
                    placeholder="colleague@example.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    required
                    className="text-input"
                  />
                  <button type="submit" className="invite-btn" disabled={inviting}>
                    {inviting ? '送信中...' : '招待メールを送る'}
                  </button>
                </form>

                {inviteMsg && (
                  <div className={`invite-msg ${inviteMsg.ok ? 'success' : 'error'}`}>
                    {inviteMsg.text}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0a0a0f; color: #f0ede8; font-family: 'Noto Sans JP', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
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

        .page {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding-bottom: 2rem;
        }
        .section {
          padding: 1.25rem 1.5rem;
        }
        .section-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: .1em;
          color: #5a5650;
          text-transform: uppercase;
          margin-bottom: .75rem;
        }
        .section-count {
          color: #3a3a4a;
        }
        .divider {
          height: 1px;
          background: #1e1e2a;
          margin: 0 1.5rem;
        }

        /* 組織 */
        .org-name {
          font-size: 22px;
          font-weight: 700;
          color: #f0ede8;
          margin-bottom: 8px;
        }
        .org-role-badge {
          display: inline-block;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          padding: 3px 10px;
          border-radius: 999px;
          background: #1a2e22;
          color: #7b9e87;
          border: 1px solid #1a3525;
        }

        /* メンバー */
        .spinner-wrap {
          display: flex;
          justify-content: center;
          padding: 1rem 0;
        }
        .spinner {
          width: 24px; height: 24px;
          border: 2px solid #1e1e2a;
          border-top-color: #7b9e87;
          border-radius: 50%;
          animation: spin .7s linear infinite;
        }
        .member-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .member-row {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 12px;
          padding: .875rem 1rem;
        }
        .member-avatar {
          width: 38px; height: 38px;
          border-radius: 50%;
          background: #1a2e22;
          color: #7b9e87;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700;
          flex-shrink: 0;
          font-family: 'DM Mono', monospace;
        }
        .member-info { flex: 1; min-width: 0; }
        .member-name {
          font-size: 14px;
          font-weight: 700;
          color: #f0ede8;
          margin-bottom: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .you-badge {
          font-size: 11px;
          font-weight: 400;
          color: #5a5650;
          font-family: 'DM Mono', monospace;
        }
        .member-email {
          font-size: 11px;
          color: #5a5650;
          font-family: 'DM Mono', monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .role-badge {
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          padding: 3px 8px;
          border-radius: 999px;
          flex-shrink: 0;
        }
        .role-badge.owner {
          background: #1a2e22;
          color: #7b9e87;
          border: 1px solid #1a3525;
        }
        .role-badge.member {
          background: #12121a;
          color: #5a5650;
          border: 1px solid #1e1e2a;
        }

        /* 招待フォーム */
        .invite-desc {
          font-size: 13px;
          color: #5a5650;
          line-height: 1.7;
          margin-bottom: 1rem;
        }
        .invite-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .text-input {
          width: 100%;
          padding: 11px 14px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          color: #f0ede8;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          outline: none;
        }
        .text-input:focus { border-color: #7b9e87; }
        .text-input::placeholder { color: #3a3a4a; }
        .invite-btn {
          width: 100%;
          padding: 14px;
          background: #7b9e87;
          color: #0a0a0f;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: opacity .15s;
        }
        .invite-btn:disabled { opacity: .6; cursor: not-allowed; }
        .invite-btn:not(:disabled):active { opacity: .8; }
        .invite-msg {
          margin-top: 10px;
          padding: 11px 14px;
          border-radius: 10px;
          font-size: 13px;
          line-height: 1.6;
        }
        .invite-msg.success {
          background: #0d1f15;
          border: 1px solid #1a3525;
          color: #7b9e87;
        }
        .invite-msg.error {
          background: #1a0a0a;
          border: 1px solid #2a1010;
          color: #c08080;
        }
      `}</style>
    </>
  )
}
