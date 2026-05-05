import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import i18nConfig from '../../next-i18next.config'
import { supabase } from '../../lib/supabase'
import { useRequireAuth } from '../../lib/useRequireAuth'
import { SNS_CONFIG } from '../../lib/snsConfig'

function buildSnsUrl(platform, value) {
  if (!value) return null
  if (value.startsWith('http')) return value
  const cleaned = value.replace(/^@/, '')
  const fallback = {
    instagram: `https://instagram.com/${cleaned}`,
    x: `https://x.com/${cleaned}`,
    github: `https://github.com/${cleaned}`,
    youtube: `https://youtube.com/@${cleaned}`,
    linkedin: `https://linkedin.com/in/${cleaned}`,
    note: `https://note.com/${cleaned}`,
    telegram: `https://t.me/${cleaned}`,
    tiktok: `https://tiktok.com/@${cleaned}`,
    threads: `https://threads.net/@${cleaned}`,
    bluesky: `https://bsky.app/profile/${cleaned}`,
    pinterest: `https://pinterest.com/${cleaned}`,
  }
  return fallback[platform] || value
}

export default function ContactDetail() {
  const { t, i18n } = useTranslation('common')
  const { user, loading: authLoading } = useRequireAuth()
  const router = useRouter()
  const { id } = router.query

  const [contact, setContact] = useState(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentAt, setSentAt] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [resendMode, setResendMode] = useState(false)
  const [visibility, setVisibility] = useState('private')
  const [visSaving, setVisSaving] = useState(false)
  const [encounters, setEncounters] = useState([])
  const [encLoading, setEncLoading] = useState(true)
  const [matchedSns, setMatchedSns] = useState([])
  const [connectedSns, setConnectedSns] = useState({})
  const [expandedMail, setExpandedMail] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState(null)

  const TEMP_OPTIONS = [
    { value: 'hot',    label: t('temp.hot'),    emoji: '🔥' },
    { value: 'normal', label: t('temp.normal'), emoji: '🤝' },
    { value: 'watch',  label: t('temp.watch'),  emoji: '👀' },
  ]

  useEffect(() => {
    if (!id) return
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoading(false); return }

      const [contactRes, encRes, profileRes] = await Promise.all([
        fetch(`/api/contacts/${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch(`/api/encounters/list?contact_id=${id}`, { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch('/api/auth/ensure-profile', { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ])

      const contactJson = await contactRes.json()
      const encJson = await encRes.json()
      const profileJson = await profileRes.json()

      const data = contactJson.data
      if (data) {
        setContact(data)
        setSubject(data.subject || '')
        setBody(data.body || '')
        setSent(!!data.mail_sent_at)
        setSentAt(data.mail_sent_at || null)
        setVisibility(data.visibility || 'private')
        setConnectedSns(data.connected_sns || {})

        // SNSマッチング
        const extractedSns = data.extracted_sns || {}
        const profile = profileJson?.profile || {}
        const matched = SNS_CONFIG.filter(cfg => {
          const platform = cfg.key.replace('sns_', '')
          return extractedSns[platform] && profile[cfg.key]
        }).map(cfg => {
          const platform = cfg.key.replace('sns_', '')
          return {
            platform,
            label: cfg.label,
            color: cfg.color,
            icon: cfg.icon || null,
            card_url: buildSnsUrl(platform, extractedSns[platform]),
          }
        })
        setMatchedSns(matched)
      }

      setEncounters(encJson.data || [])
      setLoading(false)
      setEncLoading(false)
    })
  }, [id])

  function switchLocale() {
    const next = i18n.language === 'ja' ? 'en' : 'ja'
    router.push(router.pathname, router.asPath, { locale: next })
  }

  async function handleToggleVisibility() {
    const next = visibility === 'private' ? 'team' : 'private'
    setVisSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/update-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contactId: id, visibility: next }),
      })
      if (!r.ok) throw new Error()
      setVisibility(next)
    } catch {}
    setVisSaving(false)
  }

  async function markConnected(platform, val) {
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/contacts/update-connected-sns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ contactId: id, platform, connected: val }),
    })
    const json = await r.json()
    if (r.ok) setConnectedSns(json.connected_sns)
  }

  const cardImages = (c) => {
    if (c?.card_signed_urls?.length) return c.card_signed_urls
    if (c?.card_image_urls?.length) return c.card_image_urls
    return []
  }

  async function onSend() {
    if (!contact?.email) { alert(t('contact.no_email_alert')); return }
    setSending(true)
    setErrorMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ to: contact.email, subject, body })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      const now = new Date().toISOString()
      await supabase.from('contacts').update({ subject, body, mail_sent_at: now }).eq('id', id)
      setSent(true)
      setSentAt(now)
      setResendMode(false)
    } catch (err) {
      setErrorMsg(err.message)
    }
    setSending(false)
  }

  const isOwner = user?.id === contact?.owner_id

  const initials = (name) => {
    if (!name) return '?'
    return name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?'
  }

  const fmtDate = (iso, opts) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : 'en-US', opts)
  }
  const fmtDatetime = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleString(i18n.language === 'ja' ? 'ja-JP' : 'en-US',
      { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  if (authLoading || loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #1e1e2a', borderTopColor: '#7b9e87', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!contact) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f', color: '#5a5650', gap: 16 }}>
      <p>{t('contact.not_found')}</p>
      <button onClick={() => router.push('/contacts')} style={{ background: 'none', border: '1px solid #1e1e2a', color: '#7b9e87', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>{t('contact.list_back')}</button>
    </div>
  )

  return (
    <>
      <Head>
        <title>{contact.name || t('contact.page_title_fallback')} — {t('app.name')}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      {/* ライトボックス */}
      {lightboxUrl && (
        <div className="lightbox" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} className="lightbox-img" alt="" />
        </div>
      )}

      <div className="shell">

        {/* ── トップバー ── */}
        <div className="topbar">
          <button className="back-btn" onClick={() => router.push('/contacts')}>{t('contact.back')}</button>
          <button className="lang-btn" onClick={switchLocale}>{t('lang.switch')}</button>
        </div>

        {/* ── ① ヘッダー ── */}
        <div className="contact-header">
          <div className="ch-main">
            <div className="ch-avatar">{initials(contact.name)}</div>
            <div className="ch-info">
              <div className="ch-name">{contact.name || t('contact.no_name')}</div>
              {(contact.company || contact.title) && (
                <div className="ch-org">{[contact.company, contact.title].filter(Boolean).join(' · ')}</div>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="ch-contact-link">
                  <span className="ch-contact-icon">✉</span>{contact.email}
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="ch-contact-link">
                  <span className="ch-contact-icon">☎</span>{contact.phone}
                </a>
              )}
              <div className="ch-badges">
                {isOwner ? (
                  <button className={`vis-toggle ${visibility}`} onClick={handleToggleVisibility} disabled={visSaving}>
                    {visSaving ? '…' : visibility === 'team' ? t('contact.team_share') : t('contact.private')}
                  </button>
                ) : (
                  <span className={`vis-badge ${visibility}`}>
                    {visibility === 'team' ? t('contact.team_share') : t('contact.private')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 名刺サムネイル */}
          {cardImages(contact).length > 0 && (
            <div className="card-thumbs">
              {cardImages(contact).map((url, i) => (
                <img key={i} src={url} className="card-thumb" alt="" onClick={() => setLightboxUrl(url)} />
              ))}
            </div>
          )}
        </div>

        <div className="divider" />

        {/* ── ② 今すぐ繋がる ── */}
        {(matchedSns.length > 0 || contact.email) && (
          <div className="section">
            <div className="section-label">
              {i18n.language === 'en' ? 'CONNECT NOW' : '今すぐ繋がる'}
            </div>

            {matchedSns.map(s => (
              <div key={s.platform} className="sns-connect-row">
                <button
                  className={`sns-connect-btn${connectedSns[s.platform] ? ' connected' : ''}`}
                  style={{ borderColor: s.color, color: connectedSns[s.platform] ? '#7b9e87' : s.color }}
                  onClick={() => window.open(s.card_url, '_blank')}
                >
                  <span className="sns-btn-icon">
                    {s.icon ? (
                      <img
                        src={`https://cdn.simpleicons.org/${s.icon}/${connectedSns[s.platform] ? '7b9e87' : s.color.replace('#','')}`}
                        width="16" height="16" alt={s.label}
                        style={{ display: 'block' }}
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700 }}>{s.label[0]}</span>
                    )}
                  </span>
                  <span className="sns-btn-label">{s.label}</span>
                  {connectedSns[s.platform]
                    ? <span className="sns-btn-sub">✓ {i18n.language === 'en' ? 'Connected' : '繋がり済み'}</span>
                    : <span className="sns-btn-sub">→ {i18n.language === 'en' ? 'Open' : 'タップして開く'}</span>
                  }
                </button>
                {isOwner && (
                  connectedSns[s.platform] ? (
                    <button className="connected-undo-btn" onClick={() => markConnected(s.platform, false)}>
                      {i18n.language === 'en' ? 'Undo' : '取消'}
                    </button>
                  ) : (
                    <button className="connected-mark-btn" onClick={() => markConnected(s.platform, true)}>
                      ✓ {i18n.language === 'en' ? 'Connected' : '繋がった'}
                    </button>
                  )
                )}
              </div>
            ))}

            {/* メール送信ボタン */}
            {isOwner && contact.email && (
              sent && !resendMode ? (
                <button className="mail-action-btn" onClick={() => setResendMode(true)}>
                  ✉ {t('contact.resend')}
                </button>
              ) : (
                <button className="mail-action-btn primary" onClick={() => document.getElementById('mail-section')?.scrollIntoView({ behavior: 'smooth' })}>
                  ✉ {t('contact.send')}
                </button>
              )
            )}
          </div>
        )}

        <div className="divider" />

        {/* ── ③ 出会いの記録 ── */}
        <div className="section">
          <div className="section-label-row">
            <div className="section-label">{t('encounter.section_label')}</div>
          </div>
          {encLoading ? (
            <div style={{ color: '#5a5650', fontSize: 13 }}>...</div>
          ) : encounters.length === 0 ? (
            <div className="empty-hint">{t('encounter.empty')}</div>
          ) : (
            <div className="enc-list">
              {encounters.map((enc, i) => (
                <div key={enc.id} className="enc-card">
                  <div className="enc-date-row">
                    <span className="enc-date">
                      {enc.met_at
                        ? fmtDate(enc.met_at, { year: 'numeric', month: 'long', day: 'numeric' })
                        : fmtDate(enc.created_at, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                    {i === 0 && <span className="enc-latest">{t('encounter.latest')}</span>}
                  </div>
                  {(enc.event_name || enc.location) && (
                    <div className="enc-meta">
                      {enc.event_name && <span>📍 {enc.event_name}</span>}
                      {enc.location && <span>📍 {enc.location}</span>}
                    </div>
                  )}
                  {enc.temperature && (
                    <div className="enc-temp">
                      {TEMP_OPTIONS.find(o => o.value === enc.temperature)?.emoji}{' '}
                      {t(`temp.${enc.temperature}`)}
                    </div>
                  )}
                  {enc.memo && <div className="enc-memo">{enc.memo}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="divider" />

        {/* ── ④ 送信済みメール / メール送信フォーム ── */}
        <div className="section" id="mail-section">
          {sent && !resendMode ? (
            <>
              <button
                className="mail-collapse-btn"
                onClick={() => setExpandedMail(v => !v)}
              >
                <div className="section-label" style={{ margin: 0 }}>
                  {i18n.language === 'en' ? 'SENT EMAIL' : '送信済みメール'}
                </div>
                <div className="mail-collapse-meta">
                  <span className="mail-collapse-date">{fmtDatetime(sentAt)}</span>
                  <span className="mail-collapse-arrow">{expandedMail ? '▲' : '▼'}</span>
                </div>
              </button>
              {expandedMail && (
                <div className="mail-preview">
                  <div className="preview-label">{t('contact.subject')}</div>
                  <div className="preview-subject">{subject}</div>
                  <div className="preview-label" style={{ marginTop: 12 }}>{t('contact.body')}</div>
                  <div className="preview-body">{body}</div>
                </div>
              )}
              {isOwner && (
                <button className="ghost-btn" style={{ marginTop: 12 }} onClick={() => setResendMode(true)}>
                  {t('contact.resend')}
                </button>
              )}
            </>
          ) : (
            <>
              <div className="section-label">
                {resendMode
                  ? (i18n.language === 'en' ? 'RESEND EMAIL' : 'メール再送信')
                  : (i18n.language === 'en' ? 'SEND EMAIL' : 'メール送信')}
              </div>
              {resendMode && (
                <div className="resend-notice">{t('contact.resend_notice')}</div>
              )}
              <label className="field-label">{t('contact.subject')}</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="text-input" />
              <label className="field-label" style={{ marginTop: 12 }}>{t('contact.body')}</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} className="textarea" rows={7} />
              {errorMsg && (
                <div className="error-box"><p className="error-msg">{errorMsg}</p></div>
              )}
              {isOwner && (
                <>
                  <button className="send-btn" onClick={onSend} disabled={sending || !contact.email}>
                    {sending ? t('contact.sending') : t('contact.send')}
                  </button>
                  {resendMode && (
                    <button className="ghost-btn" onClick={() => setResendMode(false)}>{t('contact.cancel')}</button>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div style={{ height: '2rem' }} />
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

        /* トップバー */
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #1e1e2a;
        }
        .back-btn {
          background: none; border: none; color: #7b9e87;
          font-size: 14px; font-family: 'Noto Sans JP', sans-serif; cursor: pointer; padding: 0;
        }
        .lang-btn {
          background: none; border: 1px solid #2a2a3a; border-radius: 4px;
          color: #5a5650; font-size: 10px; font-family: 'DM Mono', monospace;
          cursor: pointer; padding: 2px 6px; letter-spacing: .06em;
        }

        /* ① ヘッダー */
        .contact-header {
          padding: 1.25rem 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .ch-main {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }
        .ch-avatar {
          width: 64px; height: 64px;
          border-radius: 50%;
          background: #1a2e22;
          color: #7b9e87;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; font-weight: 700; font-family: 'DM Mono', monospace;
          flex-shrink: 0;
        }
        .ch-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .ch-name {
          font-size: 20px; font-weight: 700; color: #f0ede8; line-height: 1.2;
        }
        .ch-org {
          font-size: 13px; color: #7a7470; line-height: 1.4;
        }
        .ch-contact-link {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; color: #7b9e87; font-family: 'DM Mono', monospace;
          text-decoration: none; word-break: break-all;
        }
        .ch-contact-icon { font-size: 12px; flex-shrink: 0; }
        .ch-badges { margin-top: 6px; }

        /* 名刺サムネイル */
        .card-thumbs {
          display: flex; gap: 8px;
        }
        .card-thumb {
          height: 64px; width: auto;
          border-radius: 6px; border: 1px solid #1e1e2a;
          object-fit: contain; background: #12121a;
          cursor: pointer; transition: opacity .15s;
        }
        .card-thumb:active { opacity: .7; }

        /* ライトボックス */
        .lightbox {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,.85);
          display: flex; align-items: center; justify-content: center;
          padding: 1.5rem;
        }
        .lightbox-img {
          max-width: 100%; max-height: 90vh;
          object-fit: contain; border-radius: 10px;
        }

        /* バッジ */
        .vis-toggle {
          display: inline-flex; align-items: center;
          padding: 4px 12px; border-radius: 999px;
          font-size: 11px; font-family: 'DM Mono', monospace;
          cursor: pointer; border: 1px solid; transition: opacity .15s;
        }
        .vis-toggle.private { background: #12121a; color: #5a5650; border-color: #1e1e2a; }
        .vis-toggle.team    { background: #0d1f15; color: #7b9e87;  border-color: #1a3525; }
        .vis-toggle:disabled { opacity: .6; cursor: not-allowed; }
        .vis-badge {
          display: inline-block; padding: 4px 12px; border-radius: 999px;
          font-size: 11px; font-family: 'DM Mono', monospace; border: 1px solid;
        }
        .vis-badge.private { background: #12121a; color: #5a5650; border-color: #1e1e2a; }
        .vis-badge.team    { background: #0d1f15; color: #7b9e87;  border-color: #1a3525; }

        /* 共通 */
        .divider { height: 1px; background: #1e1e2a; margin: 0 1.5rem; }
        .section { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 10px; }
        .section-label {
          font-family: 'DM Mono', monospace; font-size: 10px;
          letter-spacing: .1em; color: #5a5650; text-transform: uppercase;
          margin-bottom: 2px;
        }
        .section-label-row {
          display: flex; align-items: center; justify-content: space-between;
        }
        .empty-hint { font-size: 12px; color: #3a3a4a; font-family: 'DM Mono', monospace; }

        /* ② SNS繋がる */
        .sns-connect-row {
          display: flex; gap: 8px; align-items: stretch;
        }
        .sns-connect-btn {
          flex: 1;
          display: flex; align-items: center; gap: 10px;
          height: 48px; background: transparent;
          border: 1.5px solid #5a5650; border-radius: 10px;
          color: #5a5650; cursor: pointer; padding: 0 12px;
          transition: opacity .15s;
          min-width: 0;
        }
        .sns-connect-btn.connected {
          background: #0d1f15; border-color: #1a3525; color: #7b9e87;
        }
        .sns-connect-btn:active { opacity: .65; }
        .sns-btn-icon {
          display: flex; align-items: center; justify-content: center;
          width: 20px; flex-shrink: 0;
        }
        .sns-btn-label {
          flex: 1; font-size: 13px; font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif; text-align: left;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .sns-btn-sub {
          font-size: 10px; opacity: .6; font-family: 'DM Mono', monospace; flex-shrink: 0;
        }
        .connected-mark-btn {
          padding: 0 12px; height: 48px;
          background: transparent; border: 1px solid #1a3525;
          border-radius: 10px; color: #7b9e87;
          font-size: 12px; font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer; white-space: nowrap; flex-shrink: 0;
          transition: background .15s;
        }
        .connected-mark-btn:active { background: #0d1f15; }
        .connected-undo-btn {
          padding: 0 12px; height: 48px;
          background: transparent; border: 1px solid #2a2a3a;
          border-radius: 10px; color: #5a5650;
          font-size: 12px; font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer; white-space: nowrap; flex-shrink: 0;
        }
        .mail-action-btn {
          width: 100%; padding: 13px;
          background: transparent; border: 1px solid #1a3525;
          border-radius: 12px; color: #7b9e87;
          font-size: 14px; font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer; transition: background .15s;
        }
        .mail-action-btn.primary { background: #0d1f15; }
        .mail-action-btn:active { background: #0d1f15; }

        /* ③ 出会い履歴 */
        .enc-list { display: flex; flex-direction: column; gap: 10px; }
        .enc-card {
          background: #0d0d14; border: 1px solid #1e1e2a;
          border-radius: 12px; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .enc-date-row { display: flex; align-items: center; gap: 8px; }
        .enc-date { font-size: 13px; font-weight: 700; color: #f0ede8; }
        .enc-latest {
          font-size: 10px; font-family: 'DM Mono', monospace;
          color: #7b9e87; background: #0d1f15;
          border: 1px solid #1a3525; border-radius: 999px; padding: 1px 8px;
        }
        .enc-meta { font-size: 12px; color: #5a5650; display: flex; flex-direction: column; gap: 2px; }
        .enc-temp { font-size: 12px; color: #8a8680; }
        .enc-memo { font-size: 13px; color: #c0bdb8; line-height: 1.6; white-space: pre-wrap; }

        /* ④ メールセクション */
        .mail-collapse-btn {
          width: 100%; background: none; border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0; text-align: left;
        }
        .mail-collapse-meta {
          display: flex; align-items: center; gap: 10px;
        }
        .mail-collapse-date {
          font-size: 11px; font-family: 'DM Mono', monospace; color: #5a5650;
        }
        .mail-collapse-arrow { font-size: 10px; color: #5a5650; }
        .mail-preview {
          background: #0d0d14; border: 1px solid #1e1e2a;
          border-radius: 12px; padding: 1rem;
        }
        .preview-label {
          font-size: 10px; font-family: 'DM Mono', monospace;
          color: #5a5650; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 4px;
        }
        .preview-subject { font-size: 14px; color: #f0ede8; }
        .preview-body {
          font-size: 13px; color: #8a8680; line-height: 1.75; white-space: pre-wrap;
        }
        .resend-notice {
          font-size: 12px; color: #8a6a30;
          background: #1a1408; border: 1px solid #2a2010;
          border-radius: 8px; padding: 8px 12px;
        }
        .field-label {
          display: block; font-size: 11px; color: #5a5650;
          letter-spacing: .06em; text-transform: uppercase;
          margin-bottom: 5px; font-family: 'DM Mono', monospace;
        }
        .text-input {
          width: 100%; padding: 10px 12px;
          background: #12121a; border: 1px solid #1e1e2a;
          border-radius: 8px; color: #f0ede8;
          font-size: 14px; font-family: 'Noto Sans JP', sans-serif;
          outline: none; margin-bottom: 4px;
        }
        .text-input:focus { border-color: #7b9e87; }
        .textarea {
          width: 100%; padding: 10px 12px;
          background: #12121a; border: 1px solid #1e1e2a;
          border-radius: 8px; color: #f0ede8;
          font-size: 13px; font-family: 'Noto Sans JP', sans-serif;
          line-height: 1.7; resize: vertical; outline: none; margin-bottom: 4px;
        }
        .textarea:focus { border-color: #7b9e87; }
        .error-box {
          background: #1a0a0a; border: 1px solid #2a1010;
          border-radius: 10px; padding: 12px;
        }
        .error-msg { font-size: 13px; color: #c08080; }
        .send-btn {
          width: 100%; padding: 16px;
          background: #7b9e87; color: #0a0a0f;
          border: none; border-radius: 12px;
          font-size: 16px; font-weight: 700; font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer; transition: opacity .15s;
        }
        .send-btn:disabled { opacity: .5; cursor: not-allowed; }
        .send-btn:not(:disabled):active { opacity: .8; }
        .ghost-btn {
          width: 100%; padding: 13px;
          background: transparent; color: #5a5650;
          border: 1px solid #1e1e2a; border-radius: 12px;
          font-size: 14px; font-family: 'Noto Sans JP', sans-serif; cursor: pointer;
        }
      `}</style>
    </>
  )
}

export const getServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale, ['common'], i18nConfig)),
  },
})
