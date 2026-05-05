import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { supabase } from '../../lib/supabase'
import { useRequireAuth } from '../../lib/useRequireAuth'
import { SNS_CONFIG } from '../../lib/snsConfig'
import i18nConfig from '../../next-i18next.config'

// Locale files are bundled at build time via require() to avoid Vercel serverless cwd issues
// (process.cwd() differs between build time and runtime in serverless functions)
const jaCommon = require('../../public/locales/ja/common.json')
const enCommon = require('../../public/locales/en/common.json')

// Build a clickable URL from an extracted SNS value
function buildSnsUrl(platform, value) {
  if (!value) return null
  if (value.startsWith('http')) return value
  const cleaned = value.replace(/^@/, '')
  const bases = {
    instagram: 'https://instagram.com/',
    x: 'https://x.com/',
    github: 'https://github.com/',
    youtube: 'https://youtube.com/@',
    linkedin: 'https://linkedin.com/in/',
    note: 'https://note.com/',
    telegram: 'https://t.me/',
    bluesky: 'https://bsky.app/profile/',
    tiktok: 'https://tiktok.com/@',
    threads: 'https://threads.net/@',
    pinterest: 'https://pinterest.com/',
    vercel: 'https://vercel.com/',
  }
  return bases[platform] ? bases[platform] + cleaned : value
}

// Merge extracted_sns and manual_sns into a unified list.
// isMatch=true when user's own profile has the same platform (show "繋がった" button).
// isManual=true for manually added entries (show delete button).
function computeAllSns(extractedSns, manualSns, profile) {
  const merged = { ...(extractedSns || {}), ...(manualSns || {}) }
  if (Object.keys(merged).length === 0 || !profile) return []

  const results = []
  const snsMap = {}
  SNS_CONFIG.forEach(s => { snsMap[s.key.replace('sns_', '')] = s })

  for (const [platform, cardValue] of Object.entries(merged)) {
    if (!cardValue) continue
    const cfg = snsMap[platform]
    if (!cfg) continue
    results.push({
      platform,
      label: cfg.label,
      color: cfg.color,
      icon: cfg.icon || null,
      card_url: buildSnsUrl(platform, cardValue),
      card_value: cardValue,
      isMatch: !!profile[`sns_${platform}`],
      isManual: !!(manualSns?.[platform]),
    })
  }
  return results
}

export default function ContactDetail() {
  const { t, i18n } = useTranslation('common')
  const { user, profile, loading: authLoading } = useRequireAuth()
  const router = useRouter()
  const { id } = router.query

  const [contact, setContact] = useState(null)
  const [loading, setLoading] = useState(true)
  const [encounters, setEncounters] = useState([])
  const [encLoading, setEncLoading] = useState(true)

  // SNS connection state
  const [connectedSns, setConnectedSns] = useState({})
  const [connectingPlatform, setConnectingPlatform] = useState(null)
  const [manualSns, setManualSns] = useState({})

  // SNS manual add form
  const [showAddSnsForm, setShowAddSnsForm] = useState(false)
  const [addSnsPlatform, setAddSnsPlatform] = useState('')
  const [addSnsValue, setAddSnsValue] = useState('')
  const [addSnsSaving, setAddSnsSaving] = useState(false)

  // Card rescan
  const [rescanning, setRescanning] = useState(false)
  const [rescanDone, setRescanDone] = useState(false)

  // Email section
  const [emailOpen, setEmailOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const [sentAt, setSentAt] = useState(null)
  const [resendMode, setResendMode] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')

  // Visibility
  const [visibility, setVisibility] = useState('private')
  const [visSaving, setVisSaving] = useState(false)

  // Add encounter form
  const [showEncForm, setShowEncForm] = useState(false)
  const [encForm, setEncForm] = useState({ event_name: '', location: '', met_at: '', temperature: 'normal', memo: '' })
  const [encSaving, setEncSaving] = useState(false)

  // Expanded card image
  const [expandedImg, setExpandedImg] = useState(null)

  const TEMP_OPTIONS = [
    { value: 'hot', label: t('temp.hot'), emoji: '🔥' },
    { value: 'normal', label: t('temp.normal'), emoji: '🤝' },
    { value: 'watch', label: t('temp.watch'), emoji: '👀' },
  ]

  useEffect(() => {
    if (!id) return

    async function loadContact() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setLoading(false); return }
        const r = await fetch(`/api/contacts/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await r.json()
        const data = json.data
        if (data) {
          setContact(data)
          setSubject(data.subject || '')
          setBody(data.body || '')
          setSent(!!data.mail_sent_at)
          setSentAt(data.mail_sent_at || null)
          setVisibility(data.visibility || 'private')
          setConnectedSns(data.connected_sns || {})
          setManualSns(data.manual_sns || {})
        }
      } catch (e) {
        console.error('[ContactDetail] load error:', e)
      } finally {
        setLoading(false)
      }
    }

    async function loadEncounters() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { setEncLoading(false); return }
        const r = await fetch(`/api/encounters/list?contact_id=${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await r.json()
        setEncounters(json.data || [])
      } catch (e) {
        console.error('[ContactDetail] encounters load error:', e)
      } finally {
        setEncLoading(false)
      }
    }

    loadContact()
    loadEncounters()
  }, [id])

  function switchLocale() {
    const next = i18n.language === 'ja' ? 'en' : 'ja'
    router.push(router.pathname, router.asPath, { locale: next })
  }

  async function toggleConnected(platform, currentlyConnected) {
    setConnectingPlatform(platform)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/update-connected-sns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contactId: id, platform, connected: !currentlyConnected }),
      })
      const json = await r.json()
      if (r.ok) setConnectedSns(json.connected_sns || {})
    } catch (e) {
      console.error(e)
    } finally {
      setConnectingPlatform(null)
    }
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
      if (r.ok) {
        setVisibility(next)
        setContact(prev => ({ ...prev, visibility: next }))
      }
    } catch (e) { console.error(e) }
    finally { setVisSaving(false) }
  }

  async function handleAddEncounter(e) {
    e.preventDefault()
    setEncSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/encounters/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          contact_id: id,
          event_name: encForm.event_name.trim() || null,
          location: encForm.location.trim() || null,
          met_at: encForm.met_at || new Date().toISOString().slice(0, 10),
          temperature: encForm.temperature || 'normal',
          memo: encForm.memo.trim() || null,
        }),
      })
      if (r.ok) {
        const json = await r.json()
        if (json.data) setEncounters(prev => [json.data, ...prev])
        setEncForm({ event_name: '', location: '', met_at: '', temperature: 'normal', memo: '' })
        setShowEncForm(false)
      }
    } catch (e) { console.error(e) }
    finally { setEncSaving(false) }
  }

  async function handleAddSns(e) {
    e.preventDefault()
    if (!addSnsPlatform || !addSnsValue.trim()) return
    setAddSnsSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/update-manual-sns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contactId: id, platform: addSnsPlatform, value: addSnsValue.trim() }),
      })
      const json = await r.json()
      if (r.ok) {
        setManualSns(json.manual_sns || {})
        setContact(prev => ({ ...prev, manual_sns: json.manual_sns }))
        setShowAddSnsForm(false)
        setAddSnsPlatform('')
        setAddSnsValue('')
      }
    } catch (e) { console.error(e) }
    finally { setAddSnsSaving(false) }
  }

  async function handleRemoveManualSns(platform) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/update-manual-sns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contactId: id, platform, remove: true }),
      })
      const json = await r.json()
      if (r.ok) {
        setManualSns(json.manual_sns || {})
        setContact(prev => ({ ...prev, manual_sns: json.manual_sns }))
      }
    } catch (e) { console.error(e) }
  }

  async function handleRescan(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setRescanning(true)
    setRescanDone(false)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contactId: id, image: base64, mediaType: file.type || 'image/jpeg' }),
      })
      const json = await r.json()
      if (r.ok) {
        // Update extracted_sns and basic fields; manual_sns is untouched
        setContact(prev => ({ ...prev, ...json.updated }))
        setRescanDone(true)
        setTimeout(() => setRescanDone(false), 3000)
      }
    } catch (e) { console.error(e) }
    finally { setRescanning(false) }
  }

  async function onSend() {
    const toEmail = contact?.email
    if (!toEmail) { alert(t('contact.no_email_alert')); return }
    setSending(true)
    setSendError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ to: toEmail, subject, body }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      const now = new Date().toISOString()
      await supabase.from('contacts').update({ subject, body, mail_sent_at: now }).eq('id', id)
      setSent(true)
      setSentAt(now)
      setResendMode(false)
    } catch (err) {
      setSendError(err.message)
    } finally {
      setSending(false)
    }
  }

  const cardImages = (c) => {
    if (c?.card_signed_urls?.length) return c.card_signed_urls
    if (c?.card_image_urls?.length) return c.card_image_urls
    if (c?.card_image_url) return [c.card_image_url]
    return []
  }

  const isOwner = user?.id === contact?.owner_id
  const allContactSns = computeAllSns(contact?.extracted_sns, manualSns, profile)

  const formatDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleString(i18n.language === 'ja' ? 'ja-JP' : 'en-US', {
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }

  if (authLoading || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #1e1e2a', borderTopColor: '#7b9e87', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!contact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f', color: '#5a5650', gap: 16 }}>
        <p>{t('contact.not_found')}</p>
        <button onClick={() => router.push('/contacts')} style={{ background: 'none', border: '1px solid #1e1e2a', color: '#7b9e87', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>{t('contact.list_back')}</button>
      </div>
    )
  }

  const imgs = cardImages(contact)

  return (
    <>
      <Head>
        <title>{contact.name || t('contact.page_title_fallback')} — meishi-mailer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      {/* Expanded image overlay */}
      {expandedImg && (
        <div className="img-overlay" onClick={() => setExpandedImg(null)}>
          <img src={expandedImg} className="img-overlay-img" alt="" />
        </div>
      )}

      <div className="shell">
        {/* ── HEADER ── */}
        <div className="header">
          <button className="back-btn" onClick={() => router.push('/contacts')}>{t('contact.back')}</button>
          <div className="header-center">
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
          <button className="lang-btn" onClick={switchLocale}>{i18n.language === 'ja' ? 'EN' : 'JA'}</button>
        </div>

        <div className="page">

          {/* ── CARD IMAGES ── */}
          {imgs.length > 0 ? (
            <div className="thumbs-row">
              {imgs.map((url, i) => (
                <div key={i} className="thumb-wrap" onClick={() => setExpandedImg(url)}>
                  <img src={url} className="thumb-img" alt={`card${i + 1}`} />
                  <div className="thumb-expand">⤢</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-img-bar">{t('contact.no_image')}</div>
          )}

          {/* ── 名刺再スキャンボタン ── */}
          {isOwner && (
            <div className="rescan-row">
              <label className="rescan-btn" style={{ opacity: rescanning ? 0.6 : 1 }}>
                {rescanning ? t('contact.rescanning') : rescanDone ? `✓ ${t('contact.rescan_done')}` : `🔄 ${t('contact.rescan_card')}`}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleRescan}
                  disabled={rescanning}
                />
              </label>
            </div>
          )}

          {/* ── CONTACT INFO ── */}
          <div className="info-block">
            <div className="info-name">{contact.name || t('contact.no_name')}</div>
            {contact.company && <div className="info-company">{contact.company}</div>}
            {(contact.department || contact.title) && (
              <div className="info-sub">{[contact.department, contact.title].filter(Boolean).join(' · ')}</div>
            )}
            <div className="info-contacts">
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="info-row">
                  <span className="info-icon">✉</span>
                  <span className="info-val mono">{contact.email}</span>
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="info-row">
                  <span className="info-icon">☎</span>
                  <span className="info-val mono">{contact.phone}</span>
                </a>
              )}
            </div>
          </div>

          {/* ── 今すぐ繋がる ── */}
          <div className="section">
            <div className="section-hd">
              <span className="section-label">{t('contact.connect_section')}</span>
              {isOwner && !showAddSnsForm && (
                <button className="add-sns-btn" onClick={() => setShowAddSnsForm(true)}>
                  + {t('contact.add_sns')}
                </button>
              )}
            </div>

            {/* SNS手動追加フォーム */}
            {showAddSnsForm && (
              <form onSubmit={handleAddSns} className="add-sns-form">
                <select
                  className="sns-select"
                  value={addSnsPlatform}
                  onChange={e => { setAddSnsPlatform(e.target.value); setAddSnsValue('') }}
                  required
                >
                  <option value="">{t('contact.select_platform')}</option>
                  {SNS_CONFIG.map(s => (
                    <option key={s.key} value={s.key.replace('sns_', '')}>{s.label}</option>
                  ))}
                </select>
                {addSnsPlatform && (
                  <input
                    type="url"
                    className="text-input"
                    style={{ marginTop: 8 }}
                    placeholder={t('contact.sns_url_placeholder')}
                    value={addSnsValue}
                    onChange={e => setAddSnsValue(e.target.value)}
                    required
                  />
                )}
                <div className="form-actions" style={{ marginTop: 8 }}>
                  <button type="submit" className="ctx-save-btn" disabled={addSnsSaving || !addSnsPlatform || !addSnsValue.trim()}>
                    {addSnsSaving ? t('contact.saving') : t('contact.save')}
                  </button>
                  <button type="button" className="ghost-btn" style={{ marginTop: 0 }}
                    onClick={() => { setShowAddSnsForm(false); setAddSnsPlatform(''); setAddSnsValue('') }}>
                    {t('contact.cancel')}
                  </button>
                </div>
              </form>
            )}

            {allContactSns.length > 0 ? (
              <div className="sns-list">
                {allContactSns.map(s => {
                  const isConnected = !!connectedSns[s.platform]
                  const isConnecting = connectingPlatform === s.platform
                  return (
                    <div key={s.platform} className="sns-row-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <a
                          href={s.card_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="sns-link-btn"
                          style={{ borderColor: s.color, '--sns-color': s.color, flex: 1 }}
                        >
                          {s.icon ? (
                            <img
                              src={`https://cdn.simpleicons.org/${s.icon}/ffffff`}
                              alt={s.label}
                              className="sns-icon-img"
                              onError={e => { e.target.style.display = 'none' }}
                            />
                          ) : (
                            <span className="sns-icon-letter" style={{ background: s.color }}>{s.label[0]}</span>
                          )}
                          <div className="sns-link-text">
                            <span className="sns-link-label">
                              {s.label}
                              {s.isManual && <span className="manual-badge">{t('contact.manual_added')}</span>}
                            </span>
                            <span className="sns-link-sub">{s.card_value?.replace(/^https?:\/\//, '').slice(0, 32)}</span>
                          </div>
                          <span className="sns-link-arrow">→</span>
                        </a>
                        {isOwner && s.isManual && (
                          <button
                            className="remove-sns-btn"
                            onClick={() => handleRemoveManualSns(s.platform)}
                            title={t('contact.remove_sns')}
                          >×</button>
                        )}
                      </div>
                      {isOwner && s.isMatch && (
                        <button
                          className={`connected-btn ${isConnected ? 'done' : ''}`}
                          onClick={() => toggleConnected(s.platform, isConnected)}
                          disabled={isConnecting}
                        >
                          {isConnecting ? '…' : isConnected ? `✓ ${t('contact.connected_done')}` : t('contact.connect_mark')}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="sns-empty">
                <div className="sns-empty-icon">🔍</div>
                <div className="sns-empty-text">{t('contact.no_sns_match')}</div>
                <div className="sns-empty-hint">{t('contact.no_sns_match_hint')}</div>
              </div>
            )}

            {/* Email buttons */}
            {contact.email && isOwner && (
              <div className="email-btn-row">
                <button className="email-new-btn" onClick={() => { setEmailOpen(true); setResendMode(true) }}>
                  ✉ {t('contact.email_connect')}
                </button>
                {sent && (
                  <button className="email-hist-btn" onClick={() => { setEmailOpen(o => !o); setResendMode(false) }}>
                    {emailOpen && !resendMode ? t('contact.email_history_close') : t('contact.email_history_open')}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── EMAIL SECTION (collapsible) ── */}
          {emailOpen && (
            <div className="section email-section">
              {sent && !resendMode ? (
                <>
                  <div className="sent-meta">
                    <span className="sent-badge">{t('contact.sent')}</span>
                    <span className="sent-date mono">{formatDate(sentAt)}</span>
                  </div>
                  <div className="mail-preview">
                    <div className="preview-label">{t('contact.subject')}</div>
                    <div className="preview-val">{subject}</div>
                    <div className="preview-label" style={{ marginTop: 10 }}>{t('contact.body')}</div>
                    <div className="preview-body">{body}</div>
                  </div>
                  {isOwner && (
                    <button className="ghost-btn" onClick={() => setResendMode(true)}>{t('contact.resend')}</button>
                  )}
                </>
              ) : (
                <>
                  {resendMode && <div className="resend-notice">{t('contact.resend_notice')}</div>}
                  <label className="field-label">{t('contact.subject')}</label>
                  <input type="text" className="text-input" value={subject} onChange={e => setSubject(e.target.value)} />
                  <label className="field-label" style={{ marginTop: 12 }}>{t('contact.body')}</label>
                  <textarea className="textarea" rows={7} value={body} onChange={e => setBody(e.target.value)} />
                  {sendError && <div className="error-box">{sendError}</div>}
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
          )}

          {/* ── 出会いの記録 ── */}
          <div className="section">
            <div className="section-hd">
              <span className="section-label">{t('encounter.section_label')}</span>
              {isOwner && !showEncForm && (
                <button className="add-enc-btn" onClick={() => setShowEncForm(true)}>+ {t('contact.add_encounter')}</button>
              )}
            </div>

            {showEncForm && (
              <form onSubmit={handleAddEncounter} className="enc-form">
                <label className="field-label">{t('contact.met_label')}</label>
                <input type="date" className="text-input"
                  value={encForm.met_at}
                  onChange={e => setEncForm(f => ({ ...f, met_at: e.target.value }))} />

                <label className="field-label" style={{ marginTop: 10 }}>{t('contact.event_label')}</label>
                <input type="text" className="text-input" maxLength={100} placeholder={t('contact.event_placeholder')}
                  value={encForm.event_name}
                  onChange={e => setEncForm(f => ({ ...f, event_name: e.target.value }))} />

                <label className="field-label" style={{ marginTop: 10 }}>{t('contact.location_label')}</label>
                <input type="text" className="text-input" maxLength={100} placeholder={t('contact.location_placeholder')}
                  value={encForm.location}
                  onChange={e => setEncForm(f => ({ ...f, location: e.target.value }))} />

                <label className="field-label" style={{ marginTop: 10 }}>{t('contact.temp_label')}</label>
                <div className="temp-row">
                  {TEMP_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      className={`temp-btn ${encForm.temperature === opt.value ? 'active' : ''}`}
                      onClick={() => setEncForm(f => ({ ...f, temperature: opt.value }))}>
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>

                <label className="field-label" style={{ marginTop: 10 }}>{t('contact.memo_label')}</label>
                <textarea className="textarea" rows={3} maxLength={500} placeholder={t('contact.memo_placeholder')}
                  value={encForm.memo}
                  onChange={e => setEncForm(f => ({ ...f, memo: e.target.value }))} />

                <div className="form-actions">
                  <button type="submit" className="ctx-save-btn" disabled={encSaving}>
                    {encSaving ? t('contact.saving') : t('contact.save')}
                  </button>
                  <button type="button" className="ghost-btn" style={{ marginTop: 0 }}
                    onClick={() => setShowEncForm(false)} disabled={encSaving}>
                    {t('contact.cancel')}
                  </button>
                </div>
              </form>
            )}

            {encLoading ? (
              <div className="enc-loading">…</div>
            ) : encounters.length === 0 ? (
              <div className="ctx-empty">{t('encounter.empty')}</div>
            ) : (
              <div className="enc-list">
                {encounters.map((enc, i) => (
                  <div key={enc.id} className="enc-item">
                    <div className="enc-date">
                      {enc.met_at
                        ? new Date(enc.met_at).toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                        : new Date(enc.created_at).toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      {i === 0 && <span className="enc-badge">{t('encounter.latest')}</span>}
                    </div>
                    {(enc.event_name || enc.location) && (
                      <div className="enc-meta">{[enc.event_name, enc.location].filter(Boolean).join(' · ')}</div>
                    )}
                    {enc.temperature && (
                      <span className="enc-temp">
                        {TEMP_OPTIONS.find(o => o.value === enc.temperature)?.emoji}
                      </span>
                    )}
                    {enc.memo && <div className="enc-memo">{enc.memo}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0a0a0f; color: #f0ede8; font-family: 'Noto Sans JP', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
        a { text-decoration: none; color: inherit; }
      `}</style>

      <style jsx>{`
        .shell {
          min-height: 100svh;
          max-width: 430px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
        }

        /* Header */
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #1e1e2a;
          position: sticky;
          top: 0;
          background: #0a0a0f;
          z-index: 10;
        }
        .back-btn {
          background: none; border: none; color: #7b9e87;
          font-size: 14px; font-family: 'Noto Sans JP', sans-serif; cursor: pointer; padding: 0;
        }
        .header-center { flex: 1; display: flex; justify-content: center; }
        .lang-btn {
          background: none; border: 1px solid #2a2a3a; border-radius: 4px;
          color: #5a5650; font-size: 10px; font-family: 'DM Mono', monospace;
          cursor: pointer; padding: 3px 8px; letter-spacing: .06em;
        }
        .vis-toggle {
          border: 1px solid; border-radius: 999px; font-size: 12px;
          font-family: 'DM Mono', monospace; padding: 4px 14px; cursor: pointer; transition: opacity .15s;
        }
        .vis-toggle.private { background: #12121a; color: #5a5650; border-color: #1e1e2a; }
        .vis-toggle.team { background: #0d1f15; color: #7b9e87; border-color: #1a3525; }
        .vis-toggle:disabled { opacity: .6; cursor: not-allowed; }
        .vis-badge {
          border: 1px solid; border-radius: 999px; font-size: 12px;
          font-family: 'DM Mono', monospace; padding: 4px 14px;
        }
        .vis-badge.private { background: #12121a; color: #5a5650; border-color: #1e1e2a; }
        .vis-badge.team { background: #0d1f15; color: #7b9e87; border-color: #1a3525; }

        .page { flex: 1; display: flex; flex-direction: column; }

        /* Card thumbnails */
        .thumbs-row {
          display: flex; gap: 8px; padding: 10px 14px;
          background: #0d0d14; border-bottom: 1px solid #1e1e2a;
          overflow-x: auto; -webkit-overflow-scrolling: touch;
        }
        .thumbs-row::-webkit-scrollbar { display: none; }
        .thumb-wrap {
          position: relative; flex-shrink: 0; cursor: pointer;
          border-radius: 8px; overflow: hidden; border: 1px solid #1e1e2a;
        }
        .thumb-img { height: 110px; width: auto; display: block; background: #12121a; object-fit: contain; }
        .thumb-expand {
          position: absolute; bottom: 4px; right: 6px;
          color: #fff; font-size: 14px; text-shadow: 0 1px 3px rgba(0,0,0,.8);
          opacity: .6;
        }
        .no-img-bar {
          padding: 12px 14px; background: #0d0d14; border-bottom: 1px solid #1e1e2a;
          font-size: 12px; color: #3a3a4a;
        }

        /* 名刺再スキャン */
        .rescan-row {
          padding: 8px 14px;
          background: #0d0d14;
          border-bottom: 1px solid #1e1e2a;
          display: flex;
          justify-content: flex-end;
        }
        .rescan-btn {
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          color: #5a5650;
          border: 1px solid #2a2a3a;
          border-radius: 6px;
          padding: 5px 12px;
          cursor: pointer;
          transition: color .15s, border-color .15s;
          display: inline-block;
        }
        .rescan-btn:hover { color: #7b9e87; border-color: #7b9e87; }

        /* Image overlay */
        .img-overlay {
          position: fixed; inset: 0; z-index: 100;
          background: rgba(0,0,0,.92); display: flex; align-items: center; justify-content: center;
        }
        .img-overlay-img { max-width: 96vw; max-height: 90vh; border-radius: 8px; object-fit: contain; }

        /* Contact info */
        .info-block { padding: 1.25rem 1.25rem 1rem; }
        .info-name { font-size: 24px; font-weight: 700; color: #f0ede8; margin-bottom: 4px; }
        .info-company { font-size: 14px; color: #8a8680; margin-bottom: 2px; }
        .info-sub { font-size: 12px; color: #5a5650; margin-bottom: 8px; }
        .info-contacts { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
        .info-row { display: flex; align-items: center; gap: 8px; }
        .info-icon { font-size: 13px; color: #5a5650; width: 16px; flex-shrink: 0; }
        .info-val { font-size: 13px; color: #7b9e87; word-break: break-all; }
        .mono { font-family: 'DM Mono', monospace; }

        /* Sections */
        .section {
          border-top: 1px solid #1e1e2a;
          padding: 1rem 1.25rem 1.25rem;
        }
        .section-hd {
          display: flex; align-items: center; justify-content: space-between; margin-bottom: .875rem;
        }
        .section-label {
          font-family: 'DM Mono', monospace; font-size: 10px; letter-spacing: .1em;
          color: #5a5650; text-transform: uppercase;
        }

        /* SNS手動追加 */
        .add-sns-btn {
          background: none; border: 1px solid #2a2a3a; border-radius: 6px;
          color: #5a5650; font-size: 11px; font-family: 'DM Mono', monospace;
          padding: 4px 10px; cursor: pointer; transition: color .15s, border-color .15s;
        }
        .add-sns-btn:hover { color: #7b9e87; border-color: #7b9e87; }

        .add-sns-form {
          background: #0d0d14; border: 1px solid #1e1e2a;
          border-radius: 10px; padding: 12px; margin-bottom: 12px;
          display: flex; flex-direction: column;
        }
        .sns-select {
          width: 100%; padding: 10px 12px; background: #12121a;
          border: 1px solid #1e1e2a; border-radius: 8px;
          color: #f0ede8; font-size: 14px; font-family: 'Noto Sans JP', sans-serif;
          outline: none; appearance: none;
        }
        .sns-select:focus { border-color: #7b9e87; }

        .manual-badge {
          font-size: 9px; font-family: 'DM Mono', monospace;
          background: #1a1408; border: 1px solid #2a2010;
          color: #8a6a30; border-radius: 4px; padding: 1px 5px;
          margin-left: 6px; vertical-align: middle;
        }

        .remove-sns-btn {
          background: none; border: 1px solid #2a2a3a; border-radius: 6px;
          color: #5a5650; font-size: 14px; width: 32px; height: 32px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; flex-shrink: 0; transition: color .15s, border-color .15s;
        }
        .remove-sns-btn:hover { color: #c08080; border-color: #c08080; }

        /* SNS list */
        .sns-list { display: flex; flex-direction: column; gap: 8px; }
        .sns-row-item { display: flex; flex-direction: column; gap: 6px; }
        .sns-link-btn {
          display: flex; align-items: center; gap: 12px;
          padding: 13px 16px; border-radius: 12px;
          border: 1.5px solid var(--sns-color, #3a3a4a);
          background: #12121a; transition: opacity .15s; cursor: pointer;
        }
        .sns-link-btn:active { opacity: .75; }
        .sns-icon-img { width: 22px; height: 22px; object-fit: contain; flex-shrink: 0; }
        .sns-icon-letter {
          width: 22px; height: 22px; border-radius: 5px;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 700; color: white; flex-shrink: 0;
        }
        .sns-link-text { flex: 1; min-width: 0; }
        .sns-link-label { display: block; font-size: 14px; font-weight: 500; color: #f0ede8; }
        .sns-link-sub {
          display: block; font-size: 11px; font-family: 'DM Mono', monospace;
          color: #5a5650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;
        }
        .sns-link-arrow { font-size: 16px; color: #5a5650; flex-shrink: 0; }

        .connected-btn {
          align-self: flex-end; background: none; border: 1px solid #1e1e2a;
          border-radius: 999px; padding: 5px 14px; font-size: 12px; font-family: 'DM Mono', monospace;
          color: #5a5650; cursor: pointer; transition: all .15s;
        }
        .connected-btn.done { border-color: #1a3525; color: #7b9e87; background: #0d1f15; }
        .connected-btn:disabled { opacity: .6; cursor: not-allowed; }

        .sns-empty {
          text-align: center; padding: 1.5rem 1rem; display: flex;
          flex-direction: column; align-items: center; gap: 6px;
        }
        .sns-empty-icon { font-size: 28px; }
        .sns-empty-text { font-size: 13px; color: #5a5650; }
        .sns-empty-hint { font-size: 11px; color: #3a3a4a; line-height: 1.5; }

        .email-btn-row {
          margin-top: 14px; display: flex; gap: 8px;
        }
        .email-new-btn {
          flex: 1; padding: 13px; background: #0d1f15;
          border: 1px solid #1a3525; border-radius: 12px;
          color: #7b9e87; font-size: 14px; font-family: 'Noto Sans JP', sans-serif; cursor: pointer;
          transition: opacity .15s;
        }
        .email-new-btn:active { opacity: .75; }
        .email-hist-btn {
          padding: 13px 16px; background: transparent;
          border: 1px solid #2a2a3a; border-radius: 12px;
          color: #5a5650; font-size: 13px; font-family: 'Noto Sans JP', sans-serif; cursor: pointer;
          white-space: nowrap; transition: border-color .15s, color .15s;
        }
        .email-hist-btn:hover { border-color: #3a3a4a; color: #8a8680; }

        /* Email section */
        .email-section { background: #0d0d14; }
        .sent-meta {
          display: flex; align-items: center; gap: 10px; margin-bottom: 10px;
        }
        .sent-badge {
          font-size: 11px; font-family: 'DM Mono', monospace;
          background: #0d1f15; border: 1px solid #1a3525; color: #7b9e87;
          padding: 2px 10px; border-radius: 999px;
        }
        .sent-date { font-size: 12px; font-family: 'DM Mono', monospace; color: #5a5650; }
        .mail-preview {
          background: #12121a; border: 1px solid #1e1e2a; border-radius: 10px;
          padding: 12px; margin-bottom: 10px;
        }
        .preview-label {
          font-size: 10px; font-family: 'DM Mono', monospace; color: #5a5650;
          letter-spacing: .08em; text-transform: uppercase; margin-bottom: 4px;
        }
        .preview-val { font-size: 14px; color: #f0ede8; }
        .preview-body { font-size: 13px; color: #8a8680; line-height: 1.75; white-space: pre-wrap; margin-top: 4px; }
        .resend-notice {
          font-size: 12px; color: #8a6a30; background: #1a1408;
          border: 1px solid #2a2010; border-radius: 8px; padding: 8px 12px; margin-bottom: 10px;
        }

        /* Encounter section */
        .add-enc-btn {
          background: none; border: 1px solid #2a2a3a; border-radius: 6px;
          color: #5a5650; font-size: 11px; font-family: 'DM Mono', monospace;
          padding: 4px 10px; cursor: pointer; transition: color .15s, border-color .15s;
        }
        .add-enc-btn:hover { color: #7b9e87; border-color: #7b9e87; }
        .enc-form { display: flex; flex-direction: column; margin-bottom: 14px; }
        .form-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
        .enc-loading { font-size: 12px; color: #3a3a4a; }
        .enc-list { display: flex; flex-direction: column; gap: 8px; }
        .enc-item {
          background: #12121a; border: 1px solid #1e1e2a;
          border-radius: 10px; padding: 12px 14px;
        }
        .enc-date {
          font-size: 13px; font-weight: 700; color: #f0ede8;
          display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
        }
        .enc-badge {
          font-size: 10px; font-family: 'DM Mono', monospace; color: #7b9e87;
          background: #0d1f15; border: 1px solid #1a3525; border-radius: 999px; padding: 1px 7px;
        }
        .enc-meta { font-size: 12px; color: #5a5650; margin-bottom: 4px; }
        .enc-temp { font-size: 14px; }
        .enc-memo { font-size: 13px; color: #8a8680; line-height: 1.5; margin-top: 6px; }
        .ctx-empty { font-size: 12px; color: #3a3a4a; font-family: 'DM Mono', monospace; }

        /* Shared form elements */
        .field-label {
          display: block; font-size: 11px; color: #5a5650; letter-spacing: .06em;
          text-transform: uppercase; margin-bottom: 5px; font-family: 'DM Mono', monospace;
        }
        .text-input {
          width: 100%; padding: 10px 12px; background: #12121a; border: 1px solid #1e1e2a;
          border-radius: 8px; color: #f0ede8; font-size: 14px; font-family: 'Noto Sans JP', sans-serif;
          outline: none; margin-bottom: 4px;
        }
        .text-input:focus { border-color: #7b9e87; }
        .textarea {
          width: 100%; padding: 10px 12px; background: #12121a; border: 1px solid #1e1e2a;
          border-radius: 8px; color: #f0ede8; font-size: 13px; font-family: 'Noto Sans JP', sans-serif;
          line-height: 1.7; resize: vertical; outline: none; margin-bottom: 8px;
        }
        .textarea:focus { border-color: #7b9e87; }
        .temp-row { display: flex; gap: 8px; margin-bottom: 4px; }
        .temp-btn {
          flex: 1; padding: 9px 4px; background: #12121a; border: 1px solid #1e1e2a;
          border-radius: 8px; color: #5a5650; font-size: 13px; font-family: 'Noto Sans JP', sans-serif; cursor: pointer;
        }
        .temp-btn.active { border-color: #7b9e87; color: #f0ede8; background: #0d1f15; }
        .ctx-save-btn {
          width: 100%; padding: 14px; background: #7b9e87; color: #0a0a0f;
          border: none; border-radius: 12px; font-size: 15px; font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif; cursor: pointer;
        }
        .ctx-save-btn:disabled { opacity: .6; cursor: not-allowed; }
        .send-btn {
          width: 100%; padding: 15px; background: #7b9e87; color: #0a0a0f;
          border: none; border-radius: 12px; font-size: 15px; font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif; cursor: pointer; margin-bottom: 8px;
        }
        .send-btn:disabled { opacity: .5; cursor: not-allowed; }
        .ghost-btn {
          width: 100%; padding: 12px; background: transparent; color: #5a5650;
          border: 1px solid #1e1e2a; border-radius: 12px; font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif; cursor: pointer;
        }
        .error-box {
          background: #1a0a0a; border: 1px solid #2a1010; border-radius: 8px;
          padding: 10px 12px; font-size: 13px; color: #c08080; margin-bottom: 8px;
        }
      `}</style>
    </>
  )
}

export const getServerSideProps = async ({ locale }) => ({
  props: {
    _nextI18Next: {
      initialI18nStore: {
        ja: { common: jaCommon },
        en: { common: enCommon },
      },
      initialLocale: locale || 'ja',
      ns: ['common'],
      userConfig: i18nConfig,
    },
  },
})
