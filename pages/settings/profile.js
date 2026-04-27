import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { supabase } from '../../lib/supabase'
import { useRequireAuth } from '../../lib/useRequireAuth'

export default function ProfileSettings() {
  const { t, i18n } = useTranslation('common')
  const { user, profile, loading: authLoading } = useRequireAuth()
  const [provider, setProvider] = useState(null)
  const [senderEmail, setSenderEmail] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [gmailUser, setGmailUser] = useState('')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [localName, setLocalName] = useState(null)
  const [nameEdit, setNameEdit] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMsg, setNameMsg] = useState(null)
  const [gmailEmail, setGmailEmail] = useState(null)
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false)
  const [billingLoading, setBillingLoading] = useState(false)
  const [upgradeMsg, setUpgradeMsg] = useState(null)
  const router = useRouter()

  useEffect(() => {
    if (profile !== null && localName === null) {
      setLocalName(profile?.name || '')
    }
    if (profile !== null && provider === null) {
      setProvider(profile?.smtp_provider || 'sendgrid')
      setSenderEmail(profile?.sender_email || '')
      setGmailEmail(profile?.gmail_email || null)

      const isCustom = profile?.smtp_provider === 'custom' || profile?.smtp_provider === 'other'
      const isGmail = profile?.smtp_provider === 'gmail'

      setGmailUser(isGmail ? (profile?.smtp_user || '') : '')
      setSmtpHost(isCustom ? (profile?.smtp_host || '') : '')
      setSmtpPort(isCustom && profile?.smtp_port ? String(profile.smtp_port) : '587')
      setSmtpUser(isCustom ? (profile?.smtp_user || '') : '')
    }
  }, [profile])

  useEffect(() => {
    if (profile && profile.smtp_provider) {
      setProvider(profile.smtp_provider)
    }
  }, [profile])

  useEffect(() => {
    if (router.query.upgrade === 'success') {
      setUpgradeMsg(t('billing.upgrade_success'))
      router.replace('/settings/profile', undefined, { shallow: true })
    }
    if (router.query.gmail === 'connected') {
      setMsg({ ok: true, text: t('profile.gmail_connect_success') })
      router.replace('/settings/profile', undefined, { shallow: true })
    }
    if (router.query.gmail === 'error') {
      setMsg({ ok: false, text: t('profile.gmail_connect_error') })
      router.replace('/settings/profile', undefined, { shallow: true })
    }
  }, [router.query])

  function startNameEdit() {
    setNameValue(localName ?? profile?.name ?? '')
    setNameMsg(null)
    setNameEdit(true)
  }

  async function handleNameSave(e) {
    e.preventDefault()
    const trimmed = nameValue.trim()
    setNameSaving(true)
    setNameMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/profile/update-name', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setLocalName(trimmed)
      setNameEdit(false)
      setNameMsg({ ok: true, text: t('profile.name_saved') })
      setTimeout(() => setNameMsg(null), 2500)
    } catch (err) {
      setNameMsg({ ok: false, text: err.message })
    } finally {
      setNameSaving(false)
    }
  }

  async function handleCheckout() {
    setBillingLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      setMsg({ ok: false, text: err.message })
      setBillingLoading(false)
    }
  }

  async function handlePortal() {
    setBillingLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      window.location.href = data.url
    } catch (err) {
      setMsg({ ok: false, text: err.message })
      setBillingLoading(false)
    }
  }

  function switchLocale() {
    const next = i18n.language === 'ja' ? 'en' : 'ja'
    router.push(router.pathname, router.asPath, { locale: next })
  }

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

  const activeProvider = provider ?? profile?.smtp_provider ?? 'sendgrid'
  const normalizedProvider = activeProvider === 'other' ? 'custom' : activeProvider

  const currentProvider = profile?.smtp_provider || 'sendgrid'
  const isConfigured = currentProvider === 'gmail'
    ? !!profile?.gmail_email
    : (currentProvider === 'sendgrid'
      ? !!profile?.sender_email
      : !!profile?.sender_email && !!profile?.smtp_host)

  async function handleGmailConnect() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    window.location.href = `/api/auth/gmail/connect?token=${encodeURIComponent(session.access_token)}`
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
      setMsg({ ok: true, text: t('profile.gmail_disconnect_done') })
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
      } else if (normalizedProvider === 'gmail') {
        payload.smtp_user = gmailUser
        payload.smtp_password = smtpPassword
      } else {
        payload.smtp_host = smtpHost
        payload.smtp_port = smtpPort
        payload.smtp_user = smtpUser
        payload.smtp_password = smtpPassword
      }

      const r = await fetch('/api/profile/update-email-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setMsg({ ok: true, text: t('profile.saved') })
      setApiKey('')
      setSmtpPassword('')
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Head>
        <title>{t('profile.page_title')}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <div className="header">
          <button className="back-btn" onClick={() => router.push('/')}>{t('nav.back')}</button>
          <div className="header-title">{t('profile.header')}</div>
          <button className="lang-btn" onClick={switchLocale}>{t('lang.switch')}</button>
        </div>

        <div className="page">

          <div className="profile-hero">
            <div className="hero-avatar">
              {initials(nameEdit ? nameValue : (localName ?? profile?.name))}
            </div>

            {nameEdit ? (
              <form onSubmit={handleNameSave} className="name-edit-form">
                <input
                  autoFocus
                  type="text"
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  placeholder={t('profile.name_placeholder')}
                  maxLength={50}
                  className="name-input"
                />
                <div className="name-edit-actions">
                  <button type="submit" className="name-save-btn" disabled={nameSaving}>
                    {nameSaving ? t('profile.name_saving') : t('profile.name_save')}
                  </button>
                  <button
                    type="button"
                    className="name-cancel-btn"
                    onClick={() => { setNameEdit(false); setNameMsg(null) }}
                    disabled={nameSaving}
                  >
                    {t('profile.name_cancel')}
                  </button>
                </div>
                {nameMsg && (
                  <div className={`name-msg ${nameMsg.ok ? 'success' : 'error'}`}>{nameMsg.text}</div>
                )}
              </form>
            ) : (
              <>
                <div className="hero-name-row">
                  <div className="hero-name">{(localName ?? profile?.name) || '—'}</div>
                  <button className="name-edit-btn" onClick={startNameEdit}>{t('profile.name_edit')}</button>
                </div>
                {nameMsg && (
                  <div className={`name-msg ${nameMsg.ok ? 'success' : 'error'}`}>{nameMsg.text}</div>
                )}
              </>
            )}

            <div className="hero-email">{user?.email}</div>
          </div>

          <div className="divider" />

          {/* ── プランセクション ── */}
          {(() => {
            const isPro = profile?.plan === 'pro'
            const scanUsed = profile?.scan_count_month || 0
            const scanLimit = isPro ? 100 : 10
            const pct = Math.min(100, (scanUsed / scanLimit) * 100)
            return (
              <div className="section">
                <div className="section-header">
                  <div className="section-label">{t('billing.section_label')}</div>
                  <span className={`plan-badge ${isPro ? 'pro' : 'free'}`}>
                    {isPro ? t('billing.plan_pro') : t('billing.plan_free')}
                  </span>
                </div>

                {upgradeMsg && (
                  <div className="msg success" style={{ marginBottom: 12 }}>{upgradeMsg}</div>
                )}

                <div className="scan-bar-wrap">
                  <div className="scan-bar">
                    <div className="scan-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="scan-label">
                    {t('billing.scan_count', { used: scanUsed, limit: scanLimit })}
                  </span>
                </div>

                <p className="desc" style={{ marginBottom: 14 }}>
                  {isPro ? t('billing.limit_note_pro') : t('billing.limit_note_free')}
                </p>

                {isPro ? (
                  <button className="manage-btn" onClick={handlePortal} disabled={billingLoading}>
                    {billingLoading ? t('billing.redirecting') : t('billing.manage_btn')}
                  </button>
                ) : (
                  <button className="upgrade-btn" onClick={handleCheckout} disabled={billingLoading}>
                    {billingLoading ? t('billing.redirecting') : t('billing.upgrade_btn')}
                  </button>
                )}
              </div>
            )
          })()}

          <div className="divider" />

          <div className="section">
            <div className="section-header">
              <div className="section-label">{t('profile.email_settings_label')}</div>
              <span className={`config-badge ${isConfigured ? 'configured' : 'unconfigured'}`}>
                {isConfigured ? t('profile.configured') : t('profile.unconfigured')}
              </span>
            </div>

            {isConfigured && (
              <div className="current-email">
                {t('profile.current')}
                <span className="mono">
                  {currentProvider === 'gmail' ? profile?.gmail_email : profile?.sender_email}
                </span>
              </div>
            )}

            {/* プロバイダー選択タブ */}
            <div className="provider-tabs">
              {['sendgrid', 'gmail', 'custom'].map(p => {
                const isCurrentProvider =
                  profile?.smtp_provider === p ||
                  (profile?.smtp_provider === 'other' && p === 'custom') ||
                  (!profile?.smtp_provider && p === 'sendgrid')
                return (
                  <button
                    key={p}
                    type="button"
                    className={`provider-tab ${normalizedProvider === p ? 'active' : ''}`}
                    onClick={() => { setProvider(p); setMsg(null) }}
                  >
                    {t(`profile.provider_${p}`)}
                    {isCurrentProvider && (
                      <span className="in-use-badge">使用中</span>
                    )}
                  </button>
                )
              })}
            </div>

            <form onSubmit={handleSave} className="email-form">
              {/* Gmail以外: 送信元メール共通入力 */}
              {normalizedProvider !== 'gmail' && (
                <>
                  <label className="field-label">{t('profile.sender_email_label')}</label>
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

              {/* SendGrid */}
              {normalizedProvider === 'sendgrid' && (
                <>
                  <label className="field-label" style={{ marginTop: 12 }}>{t('profile.api_key_label')}</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={t('profile.api_key_placeholder')}
                    required
                    className="text-input"
                    autoComplete="new-password"
                  />
                  <p className="caution">{t('profile.caution')}</p>
                  <div className="link-row" style={{ marginTop: 10 }}>
                    <a href="https://sendgrid.com" target="_blank" rel="noopener noreferrer" className="ext-link">
                      {t('profile.create_account')}
                    </a>
                    <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noopener noreferrer" className="ext-link">
                      {t('profile.create_api_key')}
                    </a>
                  </div>
                </>
              )}

              {/* Gmail — OAuth 2.0 */}
              {normalizedProvider === 'gmail' && (
                <div className="gmail-oauth-box">
                  <p className="desc">{t('profile.gmail_connect_desc')}</p>
                  {gmailEmail ? (
                    <>
                      <div className="gmail-oauth-connected">
                        <span className="gmail-oauth-check">✓</span>
                        <span className="mono">{gmailEmail}</span>
                      </div>
                      <button
                        type="button"
                        className="gmail-disconnect-btn"
                        onClick={handleGmailDisconnect}
                        disabled={gmailDisconnecting}
                      >
                        {gmailDisconnecting ? '解除中...' : t('profile.gmail_disconnect_btn')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="gmail-connect-btn"
                      onClick={handleGmailConnect}
                    >
                      <span className="google-g">G</span>
                      {t('profile.gmail_connect_btn')}
                    </button>
                  )}
                </div>
              )}

              {/* カスタムSMTP */}
              {normalizedProvider === 'custom' && (
                <>
                  <label className="field-label" style={{ marginTop: 12 }}>{t('profile.smtp_host_label')}</label>
                  <input
                    type="text"
                    value={smtpHost}
                    onChange={e => setSmtpHost(e.target.value)}
                    placeholder={t('profile.smtp_host_placeholder')}
                    required
                    className="text-input"
                  />
                  <label className="field-label" style={{ marginTop: 12 }}>{t('profile.smtp_port_label')}</label>
                  <input
                    type="number"
                    value={smtpPort}
                    onChange={e => setSmtpPort(e.target.value)}
                    placeholder="587"
                    required
                    className="text-input"
                  />
                  <label className="field-label" style={{ marginTop: 12 }}>{t('profile.smtp_user_label')}</label>
                  <input
                    type="text"
                    value={smtpUser}
                    onChange={e => setSmtpUser(e.target.value)}
                    placeholder="user@example.com"
                    required
                    className="text-input"
                  />
                  <label className="field-label" style={{ marginTop: 12 }}>{t('profile.smtp_password_label')}</label>
                  <input
                    type="password"
                    value={smtpPassword}
                    onChange={e => setSmtpPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="text-input"
                    autoComplete="new-password"
                  />
                </>
              )}

              {msg && (
                <div className={`msg ${msg.ok ? 'success' : 'error'}`}>{msg.text}</div>
              )}

              {normalizedProvider !== 'gmail' && (
                <button type="submit" className="save-btn" disabled={saving}>
                  {saving ? t('profile.saving') : t('profile.save')}
                </button>
              )}
            </form>
          </div>
        </div>

        <div className="page-footer">
          <a href="/privacy" className="privacy-link">
            {i18n.language === 'en' ? 'Privacy Policy' : 'プライバシーポリシー'}
          </a>
          <span className="footer-sep">·</span>
          <a href="/terms" className="privacy-link">
            {i18n.language === 'en' ? 'Terms of Service' : '利用規約'}
          </a>
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
          flex: 1;
        }
        .lang-btn {
          background: none;
          border: 1px solid #2a2a3a;
          border-radius: 4px;
          color: #5a5650;
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          padding: 2px 6px;
          letter-spacing: .06em;
          flex-shrink: 0;
        }
        .lang-btn:hover { color: #7b9e87; border-color: #7b9e87; }
        .page {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding-bottom: 2rem;
        }

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
        .hero-name-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .hero-name {
          font-size: 20px;
          font-weight: 700;
          color: #f0ede8;
        }
        .name-edit-btn {
          background: none;
          border: 1px solid #2a2a3a;
          border-radius: 6px;
          color: #5a5650;
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          padding: 3px 9px;
          cursor: pointer;
          transition: color .15s, border-color .15s;
          flex-shrink: 0;
        }
        .name-edit-btn:hover { color: #7b9e87; border-color: #7b9e87; }
        .name-edit-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          padding: 0 .5rem;
        }
        .name-input {
          width: 100%;
          padding: 9px 12px;
          background: #0a0a0f;
          border: 1px solid #7b9e87;
          border-radius: 10px;
          color: #f0ede8;
          font-size: 18px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          outline: none;
          text-align: center;
        }
        .name-input::placeholder { color: #3a3a4a; font-weight: 400; font-size: 14px; }
        .name-edit-actions {
          display: flex;
          gap: 8px;
        }
        .name-save-btn {
          flex: 1;
          padding: 11px;
          background: #7b9e87;
          color: #0a0a0f;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: opacity .15s;
        }
        .name-save-btn:disabled { opacity: .6; cursor: not-allowed; }
        .name-cancel-btn {
          flex: 1;
          padding: 11px;
          background: none;
          color: #5a5650;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: color .15s, border-color .15s;
        }
        .name-cancel-btn:hover:not(:disabled) { color: #f0ede8; border-color: #3a3a4a; }
        .name-msg {
          font-size: 12px;
          padding: 6px 10px;
          border-radius: 8px;
          text-align: center;
        }
        .name-msg.success { background: #0d1f15; border: 1px solid #1a3525; color: #7b9e87; }
        .name-msg.error { background: #1a0a0a; border: 1px solid #2a1010; color: #c08080; }
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
        .plan-badge {
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          padding: 2px 8px;
          border-radius: 999px;
          border: 1px solid;
        }
        .plan-badge.pro {
          background: #0d1f15;
          color: #7b9e87;
          border-color: #1a3525;
        }
        .plan-badge.free {
          background: #1a1408;
          color: #8a6a30;
          border-color: #2a2010;
        }
        .scan-bar-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }
        .scan-bar {
          flex: 1;
          height: 4px;
          background: #1e1e2a;
          border-radius: 2px;
          overflow: hidden;
        }
        .scan-fill {
          height: 100%;
          background: #7b9e87;
          border-radius: 2px;
          transition: width .3s ease;
        }
        .scan-label {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: #5a5650;
          flex-shrink: 0;
        }
        .upgrade-btn {
          width: 100%;
          padding: 14px;
          background: #7b9e87;
          color: #0a0a0f;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: opacity .15s;
        }
        .upgrade-btn:disabled { opacity: .6; cursor: not-allowed; }
        .upgrade-btn:not(:disabled):active { opacity: .8; }
        .manage-btn {
          width: 100%;
          padding: 14px;
          background: transparent;
          color: #7b9e87;
          border: 1px solid #1a3525;
          border-radius: 12px;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: background .15s;
        }
        .manage-btn:disabled { opacity: .6; cursor: not-allowed; }
        .manage-btn:not(:disabled):active { background: #0d1f15; }
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

        .provider-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 1.25rem;
        }
        .provider-tab {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          background: none;
          border: 1px solid #1e1e2a;
          border-radius: 8px;
          color: #5a5650;
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          transition: color .15s, border-color .15s;
        }
        .provider-tab.active {
          border-color: #7b9e87;
          color: #f0ede8;
        }
        .provider-tab:hover:not(.active) { color: #f0ede8; }
        .in-use-badge {
          font-size: 9px;
          padding: 1px 5px;
          border-radius: 999px;
          background: #0d1f15;
          color: #7b9e87;
          border: 1px solid #1a3525;
          font-family: 'DM Mono', monospace;
        }

        .gmail-oauth-box {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 4px;
        }
        .gmail-oauth-connected {
          display: flex;
          align-items: center;
          gap: 10px;
          background: #0d1f15;
          border: 1px solid #1a3525;
          border-radius: 10px;
          padding: 12px 14px;
        }
        .gmail-oauth-check {
          color: #7b9e87;
          font-size: 15px;
          flex-shrink: 0;
        }
        .gmail-connect-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 14px;
          background: #12121a;
          border: 1px solid #2a2a3a;
          color: #f0ede8;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: border-color .15s;
        }
        .gmail-connect-btn:hover { border-color: #4285F4; }
        .gmail-connect-btn:active { opacity: .8; }
        .google-g {
          font-family: 'DM Mono', monospace;
          font-weight: 700;
          font-size: 17px;
          color: #4285F4;
          line-height: 1;
        }
        .gmail-disconnect-btn {
          width: 100%;
          padding: 13px;
          background: transparent;
          color: #8a4040;
          border: 1px solid #3a1010;
          border-radius: 12px;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: background .15s;
        }
        .gmail-disconnect-btn:hover:not(:disabled) { background: #1a0808; }
        .gmail-disconnect-btn:disabled { opacity: .5; cursor: not-allowed; }

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
        .page-footer {
          padding: 1rem 1.5rem 2rem;
          text-align: center;
        }
        .privacy-link {
          font-size: 11px;
          color: #3a3a4a;
          font-family: 'DM Mono', monospace;
          text-decoration: none;
          letter-spacing: .04em;
        }
        .privacy-link:hover { color: #5a5650; }
        .footer-sep {
          font-size: 11px;
          color: #2a2a3a;
          font-family: 'DM Mono', monospace;
        }
      `}</style>
    </>
  )
}

export const getStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale, ['common'])),
  },
})
