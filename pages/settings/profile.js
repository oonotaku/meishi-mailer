import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { useRequireAuth } from '../../lib/useRequireAuth'

export default function ProfileSettings() {
  const { user, profile, loading: authLoading } = useRequireAuth()
  const [senderEmail, setSenderEmail] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const router = useRouter()

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #1e1e2a', borderTopColor: '#7b9e87', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const initials = (name) => {
    if (!name) return '?'
    return name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?'
  }

  const isConfigured = !!profile?.sender_email

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/profile/update-email-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sender_email: senderEmail,
          sendgrid_api_key: apiKey,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setMsg({ ok: true, text: '設定を保存しました' })
      setApiKey('')
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Head>
        <title>プロフィール設定 — 名刺メーラー</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <div className="header">
          <button className="back-btn" onClick={() => router.push('/')}>← 戻る</button>
          <div className="header-title">プロフィール設定</div>
        </div>

        <div className="page">

          {/* ユーザー情報 */}
          <div className="profile-hero">
            <div className="hero-avatar">{initials(profile?.name)}</div>
            <div className="hero-name">{profile?.name || '—'}</div>
            <div className="hero-email">{user?.email}</div>
          </div>

          <div className="divider" />

          {/* メール送信設定 */}
          <div className="section">
            <div className="section-header">
              <div className="section-label">メール送信設定</div>
              <span className={`config-badge ${isConfigured ? 'configured' : 'unconfigured'}`}>
                {isConfigured ? '設定済み' : '未設定'}
              </span>
            </div>

            {isConfigured && (
              <div className="current-email">
                現在: <span className="mono">{profile.sender_email}</span>
              </div>
            )}

            <p className="desc">
              SendGridのAPIキーを設定すると、あなたのアドレスからお礼メールを送信できます。
              SendGridは無料で使えます（1日100通まで）。
            </p>

            <div className="link-row">
              <a
                href="https://sendgrid.com"
                target="_blank"
                rel="noopener noreferrer"
                className="ext-link"
              >
                ↗ SendGridで無料アカウントを作成
              </a>
              <a
                href="https://app.sendgrid.com/settings/api_keys"
                target="_blank"
                rel="noopener noreferrer"
                className="ext-link"
              >
                ↗ APIキーを発行する
              </a>
            </div>

            <form onSubmit={handleSave} className="email-form">
              <label className="field-label">送信元メールアドレス</label>
              <input
                type="email"
                value={senderEmail}
                onChange={e => setSenderEmail(e.target.value)}
                placeholder={profile?.sender_email || 'you@example.com'}
                required
                className="text-input"
              />

              <label className="field-label" style={{ marginTop: 12 }}>SendGrid APIキー</label>
              <input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="SG.xxxxxxxxxxxx をペーストしてください"
                required
                className="text-input"
                autoComplete="new-password"
              />

              <p className="caution">
                ※ 送信元アドレスはSendGridのダッシュボードでSender認証が必要です。
                登録後、そのアドレスに届く確認メールをクリックしてください。
              </p>

              {msg && (
                <div className={`msg ${msg.ok ? 'success' : 'error'}`}>{msg.text}</div>
              )}

              <button type="submit" className="save-btn" disabled={saving}>
                {saving ? '保存中...' : '保存する'}
              </button>
            </form>
          </div>
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

        /* ユーザー情報 */
        .profile-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem 1.5rem 1.5rem;
          gap: 8px;
        }
        .hero-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: #1a2e22;
          color: #7b9e87;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 22px;
          font-weight: 700;
          font-family: 'DM Mono', monospace;
          margin-bottom: 4px;
        }
        .hero-name {
          font-size: 20px;
          font-weight: 700;
          color: #f0ede8;
        }
        .hero-email {
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          color: #5a5650;
        }

        .divider {
          height: 1px;
          background: #1e1e2a;
          margin: 0 1.5rem;
        }

        /* メール送信設定 */
        .section {
          padding: 1.25rem 1.5rem;
        }
        .section-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 1rem;
        }
        .section-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: .1em;
          color: #5a5650;
          text-transform: uppercase;
        }
        .config-badge {
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid;
        }
        .config-badge.configured {
          background: #0d1f15;
          color: #7b9e87;
          border-color: #1a3525;
        }
        .config-badge.unconfigured {
          background: #1a1408;
          color: #8a6a30;
          border-color: #2a2010;
        }
        .current-email {
          font-size: 12px;
          color: #5a5650;
          margin-bottom: .75rem;
        }
        .mono {
          font-family: 'DM Mono', monospace;
          color: #7b9e87;
        }
        .desc {
          font-size: 13px;
          color: #5a5650;
          line-height: 1.75;
          margin-bottom: 1rem;
        }
        .link-row {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 1.5rem;
        }
        .ext-link {
          display: inline-block;
          font-size: 13px;
          font-family: 'DM Mono', monospace;
          color: #7b9e87;
          border: 1px solid #1a3525;
          background: #0d1f15;
          border-radius: 8px;
          padding: 8px 14px;
          text-decoration: none;
          transition: opacity .15s;
        }
        .ext-link:active { opacity: .7; }

        .email-form {
          display: flex;
          flex-direction: column;
        }
        .field-label {
          display: block;
          font-size: 11px;
          color: #5a5650;
          letter-spacing: .06em;
          text-transform: uppercase;
          margin-bottom: 5px;
          font-family: 'DM Mono', monospace;
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
        .caution {
          margin-top: 10px;
          font-size: 11px;
          color: #4a4a5a;
          line-height: 1.7;
        }
        .msg {
          margin-top: 12px;
          padding: 11px 14px;
          border-radius: 10px;
          font-size: 13px;
        }
        .msg.success {
          background: #0d1f15;
          border: 1px solid #1a3525;
          color: #7b9e87;
        }
        .msg.error {
          background: #1a0a0a;
          border: 1px solid #2a1010;
          color: #c08080;
        }
        .save-btn {
          width: 100%;
          margin-top: 14px;
          padding: 15px;
          background: #7b9e87;
          color: #0a0a0f;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: opacity .15s;
        }
        .save-btn:disabled { opacity: .6; cursor: not-allowed; }
        .save-btn:not(:disabled):active { opacity: .8; }
      `}</style>
    </>
  )
}
