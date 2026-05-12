import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { useRequireAuth } from '../../lib/useRequireAuth'

export default function EmailSettings() {
  const { user, profile, loading: authLoading } = useRequireAuth()
  const router = useRouter()

  const [provider, setProvider] = useState(null)
  const [savedProvider, setSavedProvider] = useState(null)
  const [senderEmail, setSenderEmail] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [gmailEmail, setGmailEmail] = useState(null)
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false)
  const [msg, setMsg] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile !== null && provider === null) {
      setProvider(profile?.smtp_provider || 'sendgrid')
      setSavedProvider(profile?.smtp_provider || 'sendgrid')
      setSenderEmail(profile?.sender_email || '')
      setGmailEmail(profile?.gmail_email || null)
      const isCustom = profile?.smtp_provider === 'custom' || profile?.smtp_provider === 'other'
      if (isCustom) {
        setSmtpHost(profile?.smtp_host || '')
        setSmtpPort(profile?.smtp_port || '587')
        setSmtpUser(profile?.smtp_user || '')
      }
    }
  }, [profile])

  useEffect(() => {
    if (router.query.gmail === 'connected') {
      setMsg({ ok: true, text: 'Gmailを接続しました' })
    }
    if (router.query.gmail === 'error') {
      setMsg({ ok: false, text: 'Gmail接続に失敗しました' })
    }
  }, [router.query.gmail])

  const activeProvider = provider ?? profile?.smtp_provider ?? 'sendgrid'
  const normalizedProvider = activeProvider === 'other' ? 'custom' : activeProvider

  const currentProvider = savedProvider || profile?.smtp_provider || 'sendgrid'
  const isConfigured = currentProvider === 'gmail'
    ? !!profile?.gmail_email
    : currentProvider === 'sendgrid'
      ? !!profile?.sender_email
      : !!profile?.sender_email && !!profile?.smtp_host

  async function handleGmailConnect() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const oauthUrl = `/api/auth/gmail/connect?token=${encodeURIComponent(session.access_token)}`
    const w = 600, h = 700
    const left = Math.round(window.screenX + (window.outerWidth - w) / 2)
    const top = Math.round(window.screenY + (window.outerHeight - h) / 2)
    const popup = window.open(oauthUrl, 'gmail-oauth', `width=${w},height=${h},left=${left},top=${top}`)
    if (!popup) { window.location.href = oauthUrl; return }

    const pollTimer = setInterval(() => {
      if (popup.closed) { clearInterval(pollTimer); window.removeEventListener('message', handler) }
    }, 1000)

    function handler(event) {
      if (event.data?.type !== 'gmail-oauth') return
      window.removeEventListener('message', handler)
      clearInterval(pollTimer)
      if (event.data.status === 'connected') {
        setGmailEmail(event.data.email)
        setProvider('gmail')
        setSavedProvider('gmail')
        setMsg({ ok: true, text: 'Gmailを接続しました' })
      } else {
        setMsg({ ok: false, text: 'Gmail接続に失敗しました' })
      }
    }
    window.addEventListener('message', handler)
  }

  async function handleGmailDisconnect() {
    setGmailDisconnecting(true)
    setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/auth/gmail/disconnect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setGmailEmail(null)
      setProvider('sendgrid')
      setSavedProvider('sendgrid')
      setMsg({ ok: true, text: 'Gmail接続を解除しました' })
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setGmailDisconnecting(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    if (normalizedProvider === 'gmail') return
    setSaving(true)
    setMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const payload = { smtp_provider: normalizedProvider, sender_email: senderEmail }
      if (normalizedProvider === 'sendgrid') {
        payload.sendgrid_api_key = apiKey
      } else {
        payload.smtp_host = smtpHost
        payload.smtp_port = smtpPort
        payload.smtp_user = smtpUser
        payload.smtp_password = smtpPassword
      }
      const r = await fetch('/api/profile/update-email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setSavedProvider(normalizedProvider)
      setMsg({ ok: true, text: '保存しました' })
      setApiKey('')
      setSmtpPassword('')
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setSaving(false)
    }
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
        <title>メール設定 — Koryu</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <div className="header">
          <button className="back-btn" onClick={() => router.push('/settings/profile')}>← 戻る</button>
          <div className="header-title">メール設定</div>
          <span className={`config-badge ${isConfigured ? 'configured' : 'unconfigured'}`}>
            {isConfigured ? '設定済み' : '未設定'}
          </span>
        </div>

        <div className="page">
          {isConfigured && (
            <div className="current-email">
              送信元：<span className="mono">
                {currentProvider === 'gmail' ? gmailEmail : profile?.sender_email}
              </span>
            </div>
          )}

          <div className="provider-tabs">
            {['sendgrid', 'gmail', 'custom'].map(p => {
              const labels = { sendgrid: 'SendGrid', gmail: 'Gmail', custom: 'カスタムSMTP' }
              const isCurrentProvider = (savedProvider || profile?.smtp_provider || 'sendgrid') === p ||
                ((savedProvider || profile?.smtp_provider) === 'other' && p === 'custom')
              return (
                <button
                  key={p}
                  type="button"
                  className={`provider-tab ${normalizedProvider === p ? 'active' : ''}`}
                  onClick={() => { setProvider(p); setMsg(null) }}
                >
                  {labels[p]}
                  {isCurrentProvider && <span className="in-use-badge">使用中</span>}
                </button>
              )
            })}
          </div>

          <form onSubmit={handleSave} className="email-form">
            {normalizedProvider !== 'gmail' && (
              <>
                <label className="field-label">送信元メールアドレス</label>
                <input
                  type="email"
                  value={senderEmail}
                  onChange={e => setSenderEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="text-input"
                />
              </>
            )}

            {normalizedProvider === 'sendgrid' && (
              <>
                <label className="field-label" style={{ marginTop: 12 }}>SendGrid APIキー</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="SG.xxxxxxxxxx"
                  required
                  className="text-input"
                  autoComplete="new-password"
                />
                <p className="caution">APIキーはサーバー側で暗号化して保存されます。</p>
                <div className="link-row">
                  <a href="https://sendgrid.com" target="_blank" rel="noopener noreferrer" className="ext-link">SendGridアカウント作成 ↗</a>
                  <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="ext-link">APIキーを発行 ↗</a>
                </div>
              </>
            )}

            {normalizedProvider === 'gmail' && (
              <div className="gmail-oauth-box">
                <p className="desc">Gmailアカウントと連携してお礼メールを送信できます。</p>
                {gmailEmail ? (
                  <>
                    <div className="gmail-oauth-connected">
                      <span className="gmail-oauth-check">✓</span>
                      <span className="mono">{gmailEmail}</span>
                    </div>
                    <button type="button" className="gmail-disconnect-btn" onClick={handleGmailDisconnect} disabled={gmailDisconnecting}>
                      {gmailDisconnecting ? '解除中...' : 'Gmailの接続を解除'}
                    </button>
                  </>
                ) : (
                  <button type="button" className="gmail-connect-btn" onClick={handleGmailConnect}>
                    <span className="google-g">G</span>
                    Gmailと接続する
                  </button>
                )}
              </div>
            )}

            {normalizedProvider === 'custom' && (
              <>
                <label className="field-label" style={{ marginTop: 12 }}>SMTPホスト</label>
                <input type="text" value={smtpHost} onChange={e => setSmtpHost(e.target.value)} placeholder="smtp.example.com" required className="text-input" />
                <label className="field-label" style={{ marginTop: 12 }}>ポート</label>
                <input type="number" value={smtpPort} onChange={e => setSmtpPort(e.target.value)} placeholder="587" required className="text-input" />
                <label className="field-label" style={{ marginTop: 12 }}>ユーザー名</label>
                <input type="text" value={smtpUser} onChange={e => setSmtpUser(e.target.value)} placeholder="user@example.com" required className="text-input" />
                <label className="field-label" style={{ marginTop: 12 }}>パスワード</label>
                <input type="password" value={smtpPassword} onChange={e => setSmtpPassword(e.target.value)} placeholder="••••••••" required className="text-input" autoComplete="new-password" />
              </>
            )}

            {msg && <div className={`msg ${msg.ok ? 'success' : 'error'}`}>{msg.text}</div>}

            {normalizedProvider !== 'gmail' && (
              <button type="submit" className="save-btn" disabled={saving}>
                {saving ? '保存中...' : '保存する'}
              </button>
            )}
          </form>
        </div>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0a0a0f; color: #f0ede8; font-family: 'Noto Sans JP', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <style jsx>{`
        .shell { min-height: 100svh; max-width: 430px; margin: 0 auto; display: flex; flex-direction: column; }
        .header {
          display: flex; align-items: center; gap: 12px;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #1e1e2a;
        }
        .back-btn {
          background: none; border: none; color: #7b9e87;
          font-size: 14px; font-family: 'Noto Sans JP', sans-serif; cursor: pointer; padding: 0;
        }
        .header-title { font-size: 16px; font-weight: 700; color: #f0ede8; flex: 1; }
        .config-badge {
          font-family: 'DM Mono', monospace; font-size: 10px;
          padding: 3px 8px; border-radius: 999px; flex-shrink: 0;
        }
        .config-badge.configured { background: #0d1f15; color: #7b9e87; border: 1px solid #1a3525; }
        .config-badge.unconfigured { background: #1a1408; color: #8a6a30; border: 1px solid #2a2010; }

        .page { flex: 1; padding: 1.5rem; display: flex; flex-direction: column; gap: 0; }

        .current-email {
          font-size: 13px; color: #5a5650; margin-bottom: 1.25rem;
          padding: 10px 14px; background: #12121a; border: 1px solid #1e1e2a; border-radius: 10px;
        }
        .mono { font-family: 'DM Mono', monospace; color: #f0ede8; margin-left: 6px; }

        .provider-tabs { display: flex; gap: 6px; margin-bottom: 1.25rem; }
        .provider-tab {
          flex: 1; padding: 9px 6px; background: #12121a; border: 1px solid #1e1e2a;
          border-radius: 8px; color: #5a5650; font-size: 12px;
          font-family: 'Noto Sans JP', sans-serif; cursor: pointer;
          transition: color .15s, border-color .15s; position: relative;
        }
        .provider-tab.active { color: #f0ede8; border-color: #7b9e87; }
        .provider-tab:hover:not(.active) { color: #f0ede8; }
        .in-use-badge {
          display: block; font-size: 9px; font-family: 'DM Mono', monospace;
          color: #7b9e87; margin-top: 2px;
        }

        .email-form { display: flex; flex-direction: column; gap: 6px; }
        .field-label { font-size: 12px; color: #5a5650; font-family: 'DM Mono', monospace; letter-spacing: .04em; }
        .text-input {
          width: 100%; padding: 11px 14px;
          background: #12121a; border: 1px solid #1e1e2a; border-radius: 10px;
          color: #f0ede8; font-size: 14px; font-family: 'Noto Sans JP', sans-serif; outline: none;
        }
        .text-input:focus { border-color: #7b9e87; }
        .text-input::placeholder { color: #3a3a4a; }
        .caution { font-size: 11px; color: #3a3a4a; line-height: 1.6; margin-top: 4px; }
        .link-row { display: flex; gap: 12px; margin-top: 6px; flex-wrap: wrap; }
        .ext-link { font-size: 12px; color: #7b9e87; text-decoration: none; }
        .ext-link:hover { text-decoration: underline; }

        .gmail-oauth-box {
          background: #12121a; border: 1px solid #1e1e2a; border-radius: 12px;
          padding: 1.25rem; display: flex; flex-direction: column; gap: 12px; margin-top: 4px;
        }
        .desc { font-size: 13px; color: #5a5650; line-height: 1.7; }
        .gmail-connect-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          padding: 13px; background: #ffffff; border: none; border-radius: 10px;
          color: #333; font-size: 14px; font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif; cursor: pointer; transition: opacity .15s;
        }
        .gmail-connect-btn:hover { opacity: .9; }
        .google-g {
          width: 22px; height: 22px; border-radius: 50%;
          background: #4285F4; color: white;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; flex-shrink: 0;
        }
        .gmail-oauth-connected {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; background: #0d1f15; border: 1px solid #1a3525; border-radius: 8px;
        }
        .gmail-oauth-check { color: #7b9e87; font-size: 16px; }
        .gmail-disconnect-btn {
          padding: 10px; background: none; border: 1px solid #2a1010;
          border-radius: 8px; color: #c08080; font-size: 13px;
          font-family: 'Noto Sans JP', sans-serif; cursor: pointer; transition: opacity .15s;
        }
        .gmail-disconnect-btn:hover:not(:disabled) { opacity: .8; }

        .msg {
          margin-top: 8px; padding: 11px 14px; border-radius: 10px;
          font-size: 13px; line-height: 1.6;
        }
        .msg.success { background: #0d1f15; border: 1px solid #1a3525; color: #7b9e87; }
        .msg.error { background: #1a0a0a; border: 1px solid #2a1010; color: #c08080; }

        .save-btn {
          margin-top: 8px; width: 100%; padding: 14px;
          background: #7b9e87; color: #0a0a0f; border: none; border-radius: 10px;
          font-size: 15px; font-weight: 700; font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer; transition: opacity .15s;
        }
        .save-btn:disabled { opacity: .6; cursor: not-allowed; }
        .save-btn:not(:disabled):active { opacity: .8; }
      `}</style>
    </>
  )
}

export async function getStaticProps() {
  return { props: {} }
}
