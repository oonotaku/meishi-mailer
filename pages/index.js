import { useState, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { supabase } from '../lib/supabase'
import { useRequireAuth } from '../lib/useRequireAuth'

const STEPS = { UPLOAD: 0, ANALYZING: 1, CONFIRM: 2, CONTEXT: 3, SENDING: 4, DONE: 5, ERROR: 6, DUPLICATE: 7 }

async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1600
      const scale = Math.min(1, MAX / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      URL.revokeObjectURL(url)
      resolve(dataUrl)
    }
    img.src = url
  })
}

export default function Home() {
  const { t, i18n } = useTranslation('common')
  const { user, profile, loading: authLoading } = useRequireAuth()
  const [step, setStep] = useState(STEPS.UPLOAD)
  const [images, setImages] = useState([])
  const [contact, setContact] = useState(null)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [manualEmail, setManualEmail] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [saveOnly, setSaveOnly] = useState(false)
  const [location, setLocation] = useState('')
  const [eventName, setEventName] = useState('')
  const [temperature, setTemperature] = useState('normal')
  const [memo, setMemo] = useState('')
  const [duplicates, setDuplicates] = useState([])
  const fileRef = useRef()
  const router = useRouter()

  const TEMP_OPTIONS = [
    { value: 'hot',    label: t('temp.hot'),    emoji: '🔥' },
    { value: 'normal', label: t('temp.normal'), emoji: '🤝' },
    { value: 'watch',  label: t('temp.watch'),  emoji: '👀' },
  ]

  const email = contact?.email || manualEmail

  const initials = (name) => {
    if (!name) return '?'
    return name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?'
  }

  function switchLocale() {
    const next = i18n.language === 'ja' ? 'en' : 'ja'
    router.push(router.pathname, router.asPath, { locale: next })
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  async function onFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (fileRef.current) fileRef.current.value = ''
    const dataUrl = await compressImage(file)
    setImages(prev => [...prev, { preview: dataUrl, base64: dataUrl.split(',')[1] }])
  }

  function removeImage(index) {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  async function onAnalyze() {
    setStep(STEPS.ANALYZING)
    setStatusMsg(t('home.analyzing_status'))
    try {
      // refreshSession() で必ず最新トークンを取得（getSession はキャッシュを返すだけ）
      let session
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
      if (!refreshErr && refreshed?.session?.access_token) {
        session = refreshed.session
      } else {
        // リフレッシュ失敗時は getSession にフォールバック
        const { data: fallback } = await supabase.auth.getSession()
        session = fallback?.session
      }
      if (!session?.access_token) {
        router.replace('/login')
        return
      }
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          image: images[0].base64,
          mediaType: 'image/jpeg',
          capturedAt: new Date().toISOString(),
          locale: i18n.language,
        })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      if (data.duplicates && data.duplicates.length > 0) {
        setContact(data.contact)
        setDuplicates(data.duplicates)
        setStep(STEPS.DUPLICATE)
        return
      }
      setContact(data.contact)
      setSubject(data.subject)
      setBody(data.body)
      setStep(STEPS.CONFIRM)
    } catch (err) {
      setErrorMsg(err.message)
      setStep(STEPS.ERROR)
    }
  }

  async function uploadAllImages() {
    const urls = []
    for (const img of images) {
      try {
        const byteString = atob(img.base64)
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
        const blob = new Blob([ab], { type: 'image/jpeg' })
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error } = await supabase.storage
          .from('cards')
          .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
        if (!error) {
          const { data: urlData } = supabase.storage.from('cards').getPublicUrl(fileName)
          if (urlData?.publicUrl) urls.push(urlData.publicUrl)
        }
      } catch (e) {
        console.error('upload error:', e)
      }
    }
    return urls
  }

  async function saveContact(card_image_urls, mail_sent_at) {
    const { data: { session } } = await supabase.auth.getSession()
    const r = await fetch('/api/contacts/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        name: contact?.name || null,
        company: contact?.company || null,
        department: contact?.department || null,
        title: contact?.title || null,
        email: contact?.email || null,
        phone: contact?.phone || null,
        card_image_urls,
        subject,
        body,
        mail_sent_at,
        location: location || null,
        event_name: eventName || null,
        met_at: new Date().toISOString().slice(0, 10),
        temperature,
        memo: memo || null,
      }),
    })
    const json = await r.json()
    if (!r.ok) throw new Error(json.error)
    return json.data
  }

  async function onSendNow() {
    if (!email) { alert(t('contact.no_email_alert')); return }
    setSaveOnly(false)
    setStep(STEPS.SENDING)
    try {
      const card_image_urls = await uploadAllImages()
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ to: email, subject, body })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      await saveContact(card_image_urls, new Date().toISOString())
      setStep(STEPS.DONE)
    } catch (err) {
      setErrorMsg(err.message)
      setStep(STEPS.ERROR)
    }
  }

  async function onSaveOnly() {
    setSaveOnly(true)
    setStep(STEPS.SENDING)
    try {
      const card_image_urls = await uploadAllImages()
      await saveContact(card_image_urls, null)
      setStep(STEPS.DONE)
    } catch (err) {
      setErrorMsg(err.message)
      setStep(STEPS.ERROR)
    }
  }

  function reset() {
    setStep(STEPS.UPLOAD)
    setImages([])
    setContact(null)
    setSubject('')
    setBody('')
    setManualEmail('')
    setErrorMsg('')
    setSaveOnly(false)
    setLocation('')
    setEventName('')
    setTemperature('normal')
    setMemo('')
    setDuplicates([])
    if (fileRef.current) fileRef.current.value = ''
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
        <title>{t('app.name')}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">

        {/* ── UPLOAD ── */}
        {step === STEPS.UPLOAD && (
          <div className="page">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFile}
              style={{ display: 'none' }}
            />

            <div className="top-bar">
              <div className="eyebrow">{t('app.tagline')}</div>
              <div className="top-right">
                <button className="lang-btn" onClick={switchLocale}>{t('lang.switch')}</button>
                {user?.email && <span className="user-email">{user.email}</span>}
                <button className="logout-btn" onClick={handleLogout}>{t('nav.logout')}</button>
              </div>
            </div>

            {images.length === 0 ? (
              <>
                <h1 className="title">{t('home.title_line1')}<br/>{t('home.title_line2')}</h1>
                <p className="sub">{t('home.sub_line1')}<br/>{t('home.sub_line2')}</p>
                <button className="upload-btn" onClick={() => fileRef.current.click()}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  {t('home.capture')}
                </button>
                <p className="hint">{t('home.gallery_hint')}</p>
              </>
            ) : (
              <>
                <div className="thumb-row">
                  {images.map((img, i) => (
                    <div key={i} className="thumb-wrap">
                      <img src={img.preview} className="thumb" alt="" />
                      <button className="thumb-remove" onClick={() => removeImage(i)}>×</button>
                    </div>
                  ))}
                  {images.length < 3 && (
                    <button className="thumb-add" onClick={() => fileRef.current.click()}>
                      <span>+</span>
                      <span className="thumb-add-label">{t('home.add')}</span>
                    </button>
                  )}
                </div>
                <p className="hint" style={{ textAlign: 'left', marginBottom: 20 }}>
                  {t('home.photo_count', { count: images.length })}
                </p>
                <button className="upload-btn" onClick={onAnalyze}>{t('home.analyze')}</button>
                <button className="ghost-btn" onClick={reset}>{t('home.redo')}</button>
              </>
            )}

            <button className="list-btn" onClick={() => router.push('/contacts')}>
              {t('nav.contacts')} →
            </button>
            <button className="list-btn" style={{ marginTop: 8 }} onClick={() => router.push('/settings/team')}>
              {t('nav.team')} →
            </button>
            <button className="list-btn" style={{ marginTop: 8 }} onClick={() => router.push('/settings/profile')}>
              {t('nav.profile')} →
            </button>
          </div>
        )}

        {/* ── ANALYZING ── */}
        {step === STEPS.ANALYZING && (
          <div className="page">
            <div className="prog-bar"><div className="prog-fill" style={{ width: '40%' }} /></div>
            <div className="status-row">
              <div className="spinner" />
              <span className="status-text">{statusMsg}</span>
            </div>
            {images[0] && <img src={images[0].preview} className="preview-img" alt="" />}
            <p className="hint" style={{ marginTop: 16 }}>{t('home.analyzing_hint')}</p>
          </div>
        )}

        {/* ── DUPLICATE ── */}
        {step === STEPS.DUPLICATE && (
          <div className="page">
            <div className="prog-bar"><div className="prog-fill" style={{ width: '50%' }} /></div>

            <div className="dup-icon">⚠️</div>
            <h2 className="dup-title">{t('duplicate.title')}</h2>
            <p className="dup-email">{contact?.email}</p>

            <div className="dup-name">{duplicates[0]?.name || t('duplicate.unknown_name')}</div>
            {duplicates[0]?.company && <div className="dup-company">{duplicates[0].company}</div>}

            <div className="dup-history-label">{t('duplicate.history_label')}</div>
            <div className="dup-history">
              {duplicates.map((d) => (
                <div key={d.id} className="dup-history-item">
                  <div className="dup-history-date">
                    {d.met_at
                      ? new Date(d.met_at).toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                      : new Date(d.created_at).toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    }
                  </div>
                  <div className="dup-history-meta">
                    {[d.event_name, d.location].filter(Boolean).join(' · ') || '—'}
                  </div>
                </div>
              ))}
            </div>

            <p className="dup-note">{t('duplicate.note')}</p>

            <button className="send-btn" style={{ marginTop: 24 }} onClick={() => router.push('/contacts')}>
              {t('duplicate.view_contacts')}
            </button>
            <button className="ghost-btn" onClick={reset}>{t('duplicate.scan_another')}</button>
          </div>
        )}

        {/* ── CONFIRM ── */}
        {step === STEPS.CONFIRM && (
          <div className="page">
            <div className="prog-bar"><div className="prog-fill" style={{ width: '60%' }} /></div>
            <div className="step-label">{t('step.confirm')}</div>

            <div className="contact-card">
              <div className="avatar">{initials(contact?.name)}</div>
              <div>
                <div className="contact-name">{contact?.name || '—'}</div>
                <div className="contact-meta">{[contact?.company, contact?.title].filter(Boolean).join(' · ') || '—'}</div>
              </div>
            </div>

            {images.length > 0 && (
              <div className="confirm-thumbs">
                {images.map((img, i) => (
                  <img key={i} src={img.preview} className="confirm-thumb" alt="" />
                ))}
              </div>
            )}

            {contact?.email ? (
              <div className="email-pill">{contact.email}</div>
            ) : (
              <div className="email-missing">
                <p>{t('confirm.no_email')}</p>
                <input
                  type="email"
                  placeholder={t('confirm.manual_email_placeholder')}
                  value={manualEmail}
                  onChange={e => setManualEmail(e.target.value)}
                  className="text-input"
                />
              </div>
            )}

            <div className="mail-section">
              <label className="field-label">{t('confirm.subject')}</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="text-input" />
              <label className="field-label" style={{ marginTop: 12 }}>{t('confirm.body')}</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} className="textarea" rows={7} />
            </div>

            <button className="send-btn" onClick={() => setStep(STEPS.CONTEXT)}>
              {t('confirm.next')}
            </button>
            <button className="ghost-btn" onClick={reset}>{t('home.redo')}</button>
          </div>
        )}

        {/* ── CONTEXT ── */}
        {step === STEPS.CONTEXT && (
          <div className="page">
            <div className="prog-bar"><div className="prog-fill" style={{ width: '80%' }} /></div>
            <div className="step-label">{t('step.context')}</div>

            <div className="ctx-name">
              {contact?.name || '—'}
              <span className="ctx-company">{contact?.company ? `（${contact.company}）` : ''}</span>
            </div>

            <label className="field-label" style={{ marginTop: 4 }}>{t('context.event_label')}</label>
            <input
              type="text"
              placeholder={t('context.event_placeholder')}
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              className="text-input"
            />

            <label className="field-label" style={{ marginTop: 14 }}>{t('context.met_label')}</label>
            <input
              type="date"
              value={location || new Date().toISOString().slice(0, 10)}
              onChange={e => setLocation(e.target.value)}
              className="text-input date-input"
            />

            <label className="field-label" style={{ marginTop: 14 }}>{t('context.temp_label')}</label>
            <div className="temp-row">
              {TEMP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  className={`temp-btn ${temperature === opt.value ? 'active' : ''}`}
                  onClick={() => setTemperature(opt.value)}
                >
                  <span className="temp-emoji">{opt.emoji}</span>
                  <span className="temp-label">{opt.label}</span>
                </button>
              ))}
            </div>

            <label className="field-label" style={{ marginTop: 14 }}>{t('context.memo_label')}</label>
            <textarea
              placeholder={t('context.memo_placeholder')}
              value={memo}
              onChange={e => setMemo(e.target.value)}
              className="textarea"
              rows={3}
            />

            <button className="send-btn" style={{ marginTop: 20 }} onClick={onSendNow}
              disabled={!email && !manualEmail}>
              {t('context.send_now')}
            </button>
            <button className="save-btn" onClick={onSaveOnly}>{t('context.save_later')}</button>
            <button className="ghost-btn" onClick={() => setStep(STEPS.CONFIRM)}>{t('context.back')}</button>
          </div>
        )}

        {/* ── SENDING ── */}
        {step === STEPS.SENDING && (
          <div className="page center">
            <div className="prog-bar"><div className="prog-fill" style={{ width: '95%' }} /></div>
            <div className="big-spinner" />
            <p className="status-text" style={{ marginTop: 20 }}>
              {saveOnly ? t('sending.saving') : t('sending.sending')}
            </p>
            <p className="hint">
              {saveOnly ? t('sending.saving_hint') : t('sending.sending_hint')}
            </p>
          </div>
        )}

        {/* ── DONE ── */}
        {step === STEPS.DONE && (
          <div className="page center">
            <div className="check-circle">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            {saveOnly ? (
              <>
                <h2 className="done-title">{t('done.saved_title')}</h2>
                <p className="done-name">
                  {contact?.name
                    ? t('done.saved_message', { name: contact.name })
                    : t('done.saved_message_generic')}
                </p>
                {temperature && (
                  <div className="done-temp">
                    {TEMP_OPTIONS.find(o => o.value === temperature)?.emoji}{' '}
                    {TEMP_OPTIONS.find(o => o.value === temperature)?.label}
                  </div>
                )}
                <div className="done-note">{t('done.later_note')}</div>
                <button className="send-btn" style={{ marginTop: 32 }} onClick={() => router.push('/contacts')}>
                  {t('done.view_list')}
                </button>
                <button className="ghost-btn" style={{ marginTop: 8 }} onClick={reset}>{t('done.next_card')}</button>
              </>
            ) : (
              <>
                <h2 className="done-title">{t('done.sent_title')}</h2>
                <p className="done-name">
                  {contact?.name
                    ? t('done.sent_message', { name: contact.name })
                    : t('done.sent_message_generic')}
                </p>
                <p className="done-addr">{email}</p>
                <div className="done-note">{t('done.inbox_note')}</div>
                <button className="send-btn" style={{ marginTop: 32 }} onClick={reset}>{t('done.next_card')}</button>
                <button className="ghost-btn" onClick={reset}>{t('done.top_back')}</button>
              </>
            )}
          </div>
        )}

        {/* ── ERROR ── */}
        {step === STEPS.ERROR && (
          <div className="page">
            <div className="error-box">
              <div className="error-label">{t('error.label')}</div>
              <p className="error-msg">{errorMsg}</p>
            </div>
            <button className="ghost-btn" onClick={reset}>{t('error.retry')}</button>
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
        .page {
          flex: 1;
          padding: 3rem 1.5rem 2rem;
          display: flex;
          flex-direction: column;
        }
        .page.center { align-items: center; justify-content: center; text-align: center; }

        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
        }
        .eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: .12em;
          color: #7b9e87;
          text-transform: uppercase;
        }
        .top-right {
          display: flex;
          align-items: center;
          gap: 10px;
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
        .user-email {
          font-size: 11px;
          color: #3a3a4a;
          font-family: 'DM Mono', monospace;
          max-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .logout-btn {
          background: none;
          border: none;
          color: #3a3a4a;
          font-size: 12px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          padding: 4px 0;
          flex-shrink: 0;
        }
        .logout-btn:active { color: #7b9e87; }

        .step-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: .1em;
          color: #5a5650;
          text-transform: uppercase;
          margin-bottom: 1.25rem;
        }

        .title {
          font-size: 42px;
          font-weight: 700;
          line-height: 1.15;
          color: #f0ede8;
          margin-bottom: 1rem;
        }
        .sub {
          font-size: 15px;
          color: #8a8680;
          line-height: 1.7;
          margin-bottom: 3rem;
        }
        .hint {
          font-size: 12px;
          color: #555;
          text-align: center;
          margin-top: 8px;
        }

        .thumb-row {
          display: flex;
          gap: 10px;
          margin-top: 1rem;
          margin-bottom: 8px;
        }
        .thumb-wrap {
          position: relative;
          flex: 1;
          aspect-ratio: 3/2;
          max-width: 120px;
        }
        .thumb {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid #1e1e2a;
          display: block;
        }
        .thumb-remove {
          position: absolute;
          top: -6px;
          right: -6px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #e24b4a;
          color: #fff;
          border: none;
          font-size: 13px;
          line-height: 20px;
          text-align: center;
          cursor: pointer;
          padding: 0;
        }
        .thumb-add {
          flex: 1;
          max-width: 120px;
          aspect-ratio: 3/2;
          background: #12121a;
          border: 1px dashed #2a2a3a;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #5a5650;
          font-size: 22px;
          gap: 2px;
        }
        .thumb-add-label {
          font-size: 11px;
          font-family: 'Noto Sans JP', sans-serif;
        }
        .thumb-add:active { border-color: #7b9e87; color: #7b9e87; }

        .confirm-thumbs {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }
        .confirm-thumb {
          flex: 1;
          max-width: 120px;
          height: 70px;
          object-fit: cover;
          border-radius: 8px;
          border: 1px solid #1e1e2a;
        }

        .ctx-name {
          font-size: 18px;
          font-weight: 700;
          color: #f0ede8;
          margin-bottom: 1.25rem;
          line-height: 1.4;
        }
        .ctx-company {
          font-size: 13px;
          font-weight: 400;
          color: #5a5650;
        }

        .temp-row {
          display: flex;
          gap: 8px;
          margin-bottom: 4px;
        }
        .temp-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          cursor: pointer;
          transition: all .15s;
        }
        .temp-btn.active {
          background: #1a2e22;
          border-color: #7b9e87;
        }
        .temp-emoji { font-size: 22px; line-height: 1; }
        .temp-label {
          font-size: 12px;
          font-family: 'Noto Sans JP', sans-serif;
          color: #5a5650;
        }
        .temp-btn.active .temp-label { color: #7b9e87; }

        .date-input {
          color-scheme: dark;
        }

        .upload-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          padding: 18px;
          background: #7b9e87;
          color: #0a0a0f;
          border: none;
          border-radius: 14px;
          font-size: 16px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: opacity .15s;
        }
        .upload-btn:active { opacity: .8; }

        .list-btn {
          width: 100%;
          padding: 14px;
          background: transparent;
          color: #7b9e87;
          border: 1px solid #1a3525;
          border-radius: 12px;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          margin-top: 16px;
          transition: background .15s;
        }
        .list-btn:active { background: #0d1f15; }

        .prog-bar {
          height: 2px;
          background: #1e1e2a;
          border-radius: 1px;
          margin-bottom: 1rem;
          overflow: hidden;
        }
        .prog-fill {
          height: 100%;
          background: #7b9e87;
          border-radius: 1px;
          transition: width .4s ease;
        }

        .status-row { display: flex; align-items: center; gap: 10px; margin-bottom: 1.25rem; }
        .spinner {
          width: 18px; height: 18px;
          border: 2px solid #1e1e2a;
          border-top-color: #7b9e87;
          border-radius: 50%;
          animation: spin .7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .big-spinner {
          width: 56px; height: 56px;
          border: 3px solid #1e1e2a;
          border-top-color: #7b9e87;
          border-radius: 50%;
          animation: spin .9s linear infinite;
        }
        .status-text { font-size: 15px; font-weight: 500; color: #f0ede8; }

        .preview-img {
          width: 100%;
          max-height: 200px;
          object-fit: contain;
          border-radius: 10px;
          border: 1px solid #1e1e2a;
        }

        .contact-card {
          display: flex;
          align-items: center;
          gap: 14px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 14px;
          padding: 1rem 1.1rem;
          margin-bottom: .75rem;
        }
        .avatar {
          width: 44px; height: 44px;
          border-radius: 50%;
          background: #1a2e22;
          color: #7b9e87;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 700;
          flex-shrink: 0;
          font-family: 'DM Mono', monospace;
        }
        .contact-name { font-size: 16px; font-weight: 700; color: #f0ede8; margin-bottom: 2px; }
        .contact-meta { font-size: 12px; color: #5a5650; }

        .email-pill {
          background: #0d1f15;
          border: 1px solid #1a3525;
          color: #7b9e87;
          font-size: 13px;
          font-family: 'DM Mono', monospace;
          padding: 8px 14px;
          border-radius: 999px;
          margin-bottom: 1.25rem;
          word-break: break-all;
        }
        .email-missing {
          background: #1a1408;
          border: 1px solid #2a2010;
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 1rem;
        }
        .email-missing p { font-size: 12px; color: #6a5a30; margin-bottom: 8px; }

        .mail-section { flex: 1; margin-bottom: 1.25rem; }
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
          padding: 10px 12px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 8px;
          color: #f0ede8;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          outline: none;
        }
        .text-input:focus { border-color: #7b9e87; }
        .textarea {
          width: 100%;
          padding: 10px 12px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 8px;
          color: #f0ede8;
          font-size: 13px;
          font-family: 'Noto Sans JP', sans-serif;
          line-height: 1.7;
          resize: vertical;
          outline: none;
        }
        .textarea:focus { border-color: #7b9e87; }

        .send-btn {
          width: 100%;
          padding: 16px;
          background: #7b9e87;
          color: #0a0a0f;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: opacity .15s;
          margin-top: .5rem;
        }
        .send-btn:disabled { opacity: .4; cursor: not-allowed; }
        .send-btn:not(:disabled):active { opacity: .8; }

        .save-btn {
          width: 100%;
          padding: 14px;
          background: transparent;
          color: #7b9e87;
          border: 1px solid #1a3525;
          border-radius: 12px;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          margin-top: 8px;
          transition: background .15s;
        }
        .save-btn:active { background: #0d1f15; }

        .ghost-btn {
          width: 100%;
          padding: 14px;
          background: transparent;
          color: #5a5650;
          border: 1px solid #1e1e2a;
          border-radius: 12px;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          margin-top: 8px;
        }

        .check-circle {
          width: 80px; height: 80px;
          border-radius: 50%;
          background: #0d1f15;
          border: 2px solid #7b9e87;
          display: flex; align-items: center; justify-content: center;
          color: #7b9e87;
          margin-bottom: 1.5rem;
        }
        .done-title { font-size: 28px; font-weight: 700; margin-bottom: .5rem; }
        .done-name { font-size: 15px; color: #8a8680; margin-bottom: 4px; }
        .done-addr { font-size: 12px; color: #7b9e87; font-family: 'DM Mono', monospace; margin-bottom: 1.5rem; }
        .done-temp {
          font-size: 14px;
          color: #7b9e87;
          margin: 8px 0 12px;
        }
        .done-note {
          background: #0d1f15;
          border: 1px solid #1a3525;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 13px;
          color: #7b9e87;
        }

        .error-box {
          background: #1a0a0a;
          border: 1px solid #2a1010;
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1rem;
        }
        .error-label {
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          color: #e24b4a;
          letter-spacing: .08em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .error-msg { font-size: 14px; color: #c08080; line-height: 1.6; }

        .dup-icon {
          font-size: 48px;
          text-align: center;
          margin-bottom: 12px;
        }
        .dup-title {
          font-size: 22px;
          font-weight: 700;
          color: #f0ede8;
          text-align: center;
          margin-bottom: 6px;
        }
        .dup-email {
          font-size: 12px;
          color: #7b9e87;
          font-family: 'DM Mono', monospace;
          text-align: center;
          margin-bottom: 20px;
          word-break: break-all;
        }
        .dup-card {
          background: #12121a;
          border: 1px solid #2a2a3a;
          border-radius: 14px;
          padding: 16px;
          margin-bottom: 16px;
        }
        .dup-name {
          font-size: 16px;
          font-weight: 700;
          color: #f0ede8;
          margin-bottom: 2px;
        }
        .dup-company {
          font-size: 12px;
          color: #5a5650;
          margin-bottom: 12px;
        }
        .dup-divider {
          height: 1px;
          background: #1e1e2a;
          margin-bottom: 12px;
        }
        .dup-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 8px;
        }
        .dup-label {
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          color: #5a5650;
          text-transform: uppercase;
          letter-spacing: .06em;
          flex-shrink: 0;
        }
        .dup-value {
          font-size: 13px;
          color: #c0bdb8;
          text-align: right;
        }
        .dup-note {
          font-size: 12px;
          color: #5a5650;
          text-align: center;
          line-height: 1.6;
        }
        .dup-history-label {
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          color: #5a5650;
          text-transform: uppercase;
          letter-spacing: .06em;
          margin: 16px 0 8px;
        }
        .dup-history {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 16px;
        }
        .dup-history-item {
          background: #12121a;
          border: 1px solid #2a2a3a;
          border-radius: 10px;
          padding: 10px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .dup-history-date {
          font-size: 13px;
          font-weight: 700;
          color: #f0ede8;
          flex-shrink: 0;
        }
        .dup-history-meta {
          font-size: 12px;
          color: #5a5650;
          text-align: right;
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
