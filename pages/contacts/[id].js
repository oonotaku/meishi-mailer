import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { useRequireAuth } from '../../lib/useRequireAuth'

const TEMP_OPTIONS = [
  { value: 'hot',    label: '熱い',   emoji: '🔥' },
  { value: 'normal', label: '普通',   emoji: '🤝' },
  { value: 'watch',  label: '様子見', emoji: '👀' },
]

export default function ContactDetail() {
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
  const [editingCtx, setEditingCtx] = useState(false)
  const [ctxForm, setCtxForm] = useState({ event_name: '', location: '', met_at: '', temperature: 'normal', memo: '' })
  const [ctxSaving, setCtxSaving] = useState(false)
  const [ctxMsg, setCtxMsg] = useState(null)
  const [visibility, setVisibility] = useState('private')
  const [visSaving, setVisSaving] = useState(false)
  const [visError, setVisError] = useState('')

  useEffect(() => {
    if (!id) return
    supabase.from('contacts').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setContact(data)
        setSubject(data.subject || '')
        setBody(data.body || '')
        setSent(!!data.mail_sent_at)
        setSentAt(data.mail_sent_at || null)
        setCtxForm({
          event_name:  data.event_name  || '',
          location:    data.location    || '',
          met_at:      data.met_at      || '',
          temperature: data.temperature || 'normal',
          memo:        data.memo        || '',
        })
        setVisibility(data.visibility || 'private')
      }
      setLoading(false)
    })
  }, [id])

  async function handleSaveCtx(e) {
    e.preventDefault()
    setCtxSaving(true)
    setCtxMsg(null)
    try {
      const patch = {
        event_name:  ctxForm.event_name.trim()  || null,
        location:    ctxForm.location.trim()    || null,
        met_at:      ctxForm.met_at             || null,
        temperature: ctxForm.temperature        || null,
        memo:        ctxForm.memo.trim()        || null,
      }
      const { error } = await supabase.from('contacts').update(patch).eq('id', id)
      if (error) throw error
      setContact(prev => ({ ...prev, ...patch }))
      setCtxMsg({ ok: true, text: '保存しました' })
      setEditingCtx(false)
    } catch (err) {
      setCtxMsg({ ok: false, text: err.message })
    } finally {
      setCtxSaving(false)
    }
  }

  async function handleToggleVisibility() {
    const next = visibility === 'private' ? 'team' : 'private'
    setVisSaving(true)
    setVisError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/update-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contactId: id, visibility: next }),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json.error)
      setVisibility(next)
      setContact(prev => ({ ...prev, visibility: next }))
    } catch (err) {
      setVisError(err.message)
    } finally {
      setVisSaving(false)
    }
  }

  // card_image_urls(配列) と旧 card_image_url(文字列) の両方に対応
  const cardImages = (contact) => {
    if (contact?.card_image_urls?.length) return contact.card_image_urls
    if (contact?.card_image_url) return [contact.card_image_url]
    return []
  }

  async function onSend() {
    if (!contact?.email) { alert('メールアドレスがありません'); return }
    setSending(true)
    setErrorMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
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
    } finally {
      setSending(false)
    }
  }

  const isOwner = user?.id === contact?.owner_id

  const formatDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
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
        <p>名刺が見つかりません</p>
        <button onClick={() => router.push('/contacts')} style={{ background: 'none', border: '1px solid #1e1e2a', color: '#7b9e87', padding: '10px 20px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit' }}>一覧に戻る</button>
      </div>
    )
  }

  const initials = (name) => {
    if (!name) return '?'
    return name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?'
  }

  return (
    <>
      <Head>
        <title>{contact.name || '名刺詳細'} — 名刺メーラー</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        {/* ヘッダー */}
        <div className="header">
          <button className="back-btn" onClick={() => router.push('/contacts')}>← 一覧</button>
          <div className={`badge ${sent ? 'sent' : 'unsent'}`}>{sent ? '送信済み' : '未送信'}</div>
        </div>

        <div className="page">

          {/* 1. 名刺写真 */}
          {cardImages(contact).length > 0 ? (
            cardImages(contact).length === 1 ? (
              <div className="card-img-wrap">
                <img src={cardImages(contact)[0]} className="card-img" alt="名刺" />
              </div>
            ) : (
              <div className="card-imgs-scroll">
                {cardImages(contact).map((url, i) => (
                  <img key={i} src={url} className="card-img-scroll-item" alt={`名刺${i + 1}`} />
                ))}
              </div>
            )
          ) : (
            <div className="card-img-placeholder">
              <span>名刺画像なし</span>
            </div>
          )}

          {/* 2. 名前・会社・役職・連絡先 */}
          <div className="info-section">
            <div className="info-name">{contact.name || '（名前なし）'}</div>
            {contact.company && <div className="info-company">{contact.company}</div>}
            {(contact.department || contact.title) && (
              <div className="info-sub">{[contact.department, contact.title].filter(Boolean).join(' · ')}</div>
            )}
            <div className="info-contacts">
              {contact.email && (
                <div className="info-row">
                  <span className="info-icon">✉</span>
                  <span className="info-val mono">{contact.email}</span>
                </div>
              )}
              {contact.phone && (
                <div className="info-row">
                  <span className="info-icon">☎</span>
                  <span className="info-val mono">{contact.phone}</span>
                </div>
              )}
            </div>

            {/* 共有範囲 */}
            <div className="vis-row">
              {user?.id === contact.owner_id ? (
                <button
                  className={`vis-toggle ${visibility}`}
                  onClick={handleToggleVisibility}
                  disabled={visSaving}
                >
                  {visSaving ? '…' : visibility === 'team' ? '👥 チーム共有' : '🔒 自分のみ'}
                </button>
              ) : (
                <span className={`vis-badge-detail ${visibility}`}>
                  {visibility === 'team' ? '👥 チーム共有' : '🔒 自分のみ'}
                </span>
              )}
              {visError && <span className="vis-error">{visError}</span>}
            </div>
          </div>

          {/* 3. 区切り線 */}
          <div className="divider" />

          {/* 4. 出会い・メモ */}
          <div className="ctx-section">
            <div className="ctx-header">
              <div className="section-label">CONTEXT</div>
              {!editingCtx && (
                <button className="ctx-edit-btn" onClick={() => { setCtxMsg(null); setEditingCtx(true) }}>編集</button>
              )}
            </div>

            {editingCtx ? (
              <form onSubmit={handleSaveCtx} className="ctx-form">
                <label className="field-label">イベント名</label>
                <input type="text" className="text-input" maxLength={100} placeholder="展示会・交流会 など"
                  value={ctxForm.event_name} onChange={e => setCtxForm(f => ({ ...f, event_name: e.target.value }))} />

                <label className="field-label" style={{ marginTop: 10 }}>場所</label>
                <input type="text" className="text-input" maxLength={100} placeholder="東京・オンライン など"
                  value={ctxForm.location} onChange={e => setCtxForm(f => ({ ...f, location: e.target.value }))} />

                <label className="field-label" style={{ marginTop: 10 }}>出会った日</label>
                <input type="date" className="text-input"
                  value={ctxForm.met_at} onChange={e => setCtxForm(f => ({ ...f, met_at: e.target.value }))} />

                <label className="field-label" style={{ marginTop: 10 }}>温度感</label>
                <div className="temp-row">
                  {TEMP_OPTIONS.map(opt => (
                    <button key={opt.value} type="button"
                      className={`temp-btn ${ctxForm.temperature === opt.value ? 'active' : ''}`}
                      onClick={() => setCtxForm(f => ({ ...f, temperature: opt.value }))}>
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>

                <label className="field-label" style={{ marginTop: 10 }}>メモ</label>
                <textarea className="textarea" rows={4} maxLength={1000} placeholder="自由記述"
                  value={ctxForm.memo} onChange={e => setCtxForm(f => ({ ...f, memo: e.target.value }))} />

                {ctxMsg && (
                  <div className={`ctx-msg ${ctxMsg.ok ? 'success' : 'error'}`}>{ctxMsg.text}</div>
                )}
                <div className="ctx-actions">
                  <button type="submit" className="ctx-save-btn" disabled={ctxSaving}>
                    {ctxSaving ? '保存中...' : '保存'}
                  </button>
                  <button type="button" className="ghost-btn" style={{ marginTop: 0 }}
                    onClick={() => {
                      setEditingCtx(false)
                      setCtxMsg(null)
                      setCtxForm({
                        event_name:  contact.event_name  || '',
                        location:    contact.location    || '',
                        met_at:      contact.met_at      || '',
                        temperature: contact.temperature || 'normal',
                        memo:        contact.memo        || '',
                      })
                    }}
                    disabled={ctxSaving}>キャンセル</button>
                </div>
              </form>
            ) : (
              <div className="ctx-display">
                {(contact.event_name || contact.location || contact.met_at) ? (
                  <div className="ctx-meta">
                    {contact.event_name && <span className="ctx-tag">{contact.event_name}</span>}
                    {contact.location   && <span className="ctx-tag">{contact.location}</span>}
                    {contact.met_at     && <span className="ctx-date">{contact.met_at}</span>}
                  </div>
                ) : null}
                {contact.temperature && (
                  <div className="ctx-temp">
                    {TEMP_OPTIONS.find(o => o.value === contact.temperature)?.emoji}{' '}
                    {TEMP_OPTIONS.find(o => o.value === contact.temperature)?.label}
                  </div>
                )}
                {contact.memo ? (
                  <div className="ctx-memo">{contact.memo}</div>
                ) : (!contact.event_name && !contact.location && !contact.met_at && !contact.temperature) ? (
                  <div className="ctx-empty">未入力 — 編集して追加できます</div>
                ) : null}
              </div>
            )}
          </div>

          <div className="divider" />

          {/* 5・6. 送信済み / 未送信で切り替え */}
          {sent && !resendMode ? (
            <div className="sent-section">
              <div className="sent-header">
                <div className="sent-label">送信済み</div>
                <div className="sent-date">{formatDate(sentAt)}</div>
              </div>
              <div className="mail-preview">
                <div className="preview-label">件名</div>
                <div className="preview-text">{subject}</div>
                <div className="preview-label" style={{ marginTop: 12 }}>本文</div>
                <div className="preview-body">{body}</div>
              </div>
              {isOwner && (
                <button className="resend-btn" onClick={() => setResendMode(true)}>
                  再送信する
                </button>
              )}
            </div>
          ) : (
            <div className="mail-section">
              {resendMode && (
                <div className="resend-notice">再送信モード — 内容を編集して送信できます</div>
              )}
              <label className="field-label">件名</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="text-input"
              />
              <label className="field-label" style={{ marginTop: 12 }}>本文</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                className="textarea"
                rows={8}
              />

              {errorMsg && (
                <div className="error-box">
                  <p className="error-msg">{errorMsg}</p>
                </div>
              )}

              {isOwner && (
                <>
                  <button className="send-btn" onClick={onSend} disabled={sending || !contact.email}>
                    {sending ? '送信中...' : 'メールを送信する →'}
                  </button>
                  {resendMode && (
                    <button className="ghost-btn" onClick={() => setResendMode(false)}>キャンセル</button>
                  )}
                </>
              )}
            </div>
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
          justify-content: space-between;
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
        .badge {
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          padding: 3px 10px;
          border-radius: 999px;
        }
        .badge.sent { background: #0d1f15; color: #7b9e87; border: 1px solid #1a3525; }
        .badge.unsent { background: #1a1408; color: #8a6a30; border: 1px solid #2a2010; }

        .page {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding-bottom: 2rem;
        }

        /* 名刺写真 */
        .card-img-wrap {
          background: #0d0d14;
          border-bottom: 1px solid #1e1e2a;
        }
        .card-img {
          width: 100%;
          display: block;
          max-height: 260px;
          object-fit: contain;
        }
        .card-imgs-scroll {
          display: flex;
          overflow-x: auto;
          gap: 8px;
          padding: 10px 12px;
          background: #0d0d14;
          border-bottom: 1px solid #1e1e2a;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }
        .card-imgs-scroll::-webkit-scrollbar { display: none; }
        .card-img-scroll-item {
          flex-shrink: 0;
          height: 200px;
          width: auto;
          border-radius: 8px;
          border: 1px solid #1e1e2a;
          scroll-snap-align: start;
          object-fit: contain;
          background: #12121a;
        }
        .card-img-placeholder {
          height: 120px;
          background: #12121a;
          border-bottom: 1px solid #1e1e2a;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          color: #3a3a4a;
        }

        /* 名前・会社・連絡先 */
        .info-section {
          padding: 1.25rem 1.5rem 1rem;
        }
        .info-name {
          font-size: 22px;
          font-weight: 700;
          color: #f0ede8;
          margin-bottom: 4px;
        }
        .info-company {
          font-size: 14px;
          color: #8a8680;
          margin-bottom: 2px;
        }
        .info-sub {
          font-size: 12px;
          color: #5a5650;
          margin-bottom: 10px;
        }
        .info-contacts {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 10px;
        }
        .info-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .info-icon {
          font-size: 13px;
          color: #5a5650;
          width: 16px;
          flex-shrink: 0;
        }
        .info-val {
          font-size: 13px;
          color: #7b9e87;
          word-break: break-all;
        }
        .mono { font-family: 'DM Mono', monospace; }

        /* 共有範囲 */
        .vis-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 12px;
        }
        .vis-toggle {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          transition: opacity .15s, background .15s, color .15s, border-color .15s;
          border: 1px solid;
        }
        .vis-toggle.private {
          background: #12121a;
          color: #5a5650;
          border-color: #1e1e2a;
        }
        .vis-toggle.private:hover:not(:disabled) {
          color: #8a8680;
          border-color: #3a3a4a;
        }
        .vis-toggle.team {
          background: #0d1f15;
          color: #7b9e87;
          border-color: #1a3525;
        }
        .vis-toggle.team:hover:not(:disabled) {
          opacity: .8;
        }
        .vis-toggle:disabled { opacity: .6; cursor: not-allowed; }
        .vis-badge-detail {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          border: 1px solid;
        }
        .vis-badge-detail.private { background: #12121a; color: #5a5650; border-color: #1e1e2a; }
        .vis-badge-detail.team    { background: #0d1f15; color: #7b9e87;  border-color: #1a3525; }
        .vis-error { font-size: 11px; color: #c08080; }

        /* 区切り線 */
        .divider {
          height: 1px;
          background: #1e1e2a;
          margin: 0 1.5rem .25rem;
        }

        /* 送信済みセクション */
        .sent-section {
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .sent-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .sent-label {
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          color: #7b9e87;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .sent-date {
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          color: #5a5650;
        }
        .mail-preview {
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 12px;
          padding: 1rem;
        }
        .preview-label {
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          color: #5a5650;
          letter-spacing: .08em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .preview-text {
          font-size: 14px;
          color: #f0ede8;
        }
        .preview-body {
          font-size: 13px;
          color: #8a8680;
          line-height: 1.75;
          white-space: pre-wrap;
        }
        .resend-btn {
          width: 100%;
          padding: 13px;
          background: transparent;
          color: #7b9e87;
          border: 1px solid #1a3525;
          border-radius: 12px;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: background .15s;
        }
        .resend-btn:active { background: #0d1f15; }

        /* CONTEXT セクション */
        .ctx-section {
          padding: 1rem 1.5rem 1.25rem;
        }
        .ctx-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: .75rem;
        }
        .section-label {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: .1em;
          color: #5a5650;
          text-transform: uppercase;
        }
        .ctx-edit-btn {
          background: none;
          border: 1px solid #2a2a3a;
          border-radius: 6px;
          color: #5a5650;
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          padding: 3px 9px;
          cursor: pointer;
          transition: color .15s, border-color .15s;
        }
        .ctx-edit-btn:hover { color: #7b9e87; border-color: #7b9e87; }
        .ctx-display {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ctx-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }
        .ctx-tag {
          font-size: 12px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 6px;
          padding: 3px 9px;
          color: #8a8680;
          font-family: 'Noto Sans JP', sans-serif;
        }
        .ctx-date {
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          color: #5a5650;
        }
        .ctx-temp {
          font-size: 13px;
          color: #8a8680;
        }
        .ctx-memo {
          font-size: 13px;
          color: #8a8680;
          line-height: 1.75;
          white-space: pre-wrap;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          padding: .75rem 1rem;
        }
        .ctx-empty {
          font-size: 12px;
          color: #3a3a4a;
          font-family: 'DM Mono', monospace;
        }
        .ctx-form {
          display: flex;
          flex-direction: column;
        }
        .temp-row {
          display: flex;
          gap: 8px;
          margin-bottom: 4px;
        }
        .temp-btn {
          flex: 1;
          padding: 9px 4px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 8px;
          color: #5a5650;
          font-size: 13px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: border-color .15s, color .15s;
        }
        .temp-btn.active {
          border-color: #7b9e87;
          color: #f0ede8;
          background: #0d1f15;
        }
        .ctx-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 4px;
        }
        .ctx-save-btn {
          width: 100%;
          padding: 14px;
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
        .ctx-save-btn:disabled { opacity: .6; cursor: not-allowed; }
        .ctx-msg {
          margin-top: 8px;
          padding: 9px 12px;
          border-radius: 8px;
          font-size: 13px;
        }
        .ctx-msg.success { background: #0d1f15; border: 1px solid #1a3525; color: #7b9e87; }
        .ctx-msg.error   { background: #1a0a0a; border: 1px solid #2a1010; color: #c08080; }

        /* 未送信フォーム */
        .mail-section {
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          flex: 1;
        }
        .resend-notice {
          font-size: 12px;
          color: #8a6a30;
          background: #1a1408;
          border: 1px solid #2a2010;
          border-radius: 8px;
          padding: 8px 12px;
          margin-bottom: 12px;
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
          padding: 10px 12px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 8px;
          color: #f0ede8;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          outline: none;
          margin-bottom: 4px;
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
          margin-bottom: 12px;
        }
        .textarea:focus { border-color: #7b9e87; }
        .error-box {
          background: #1a0a0a;
          border: 1px solid #2a1010;
          border-radius: 10px;
          padding: 12px;
          margin-bottom: 12px;
        }
        .error-msg { font-size: 13px; color: #c08080; }
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
        }
        .send-btn:disabled { opacity: .5; cursor: not-allowed; }
        .send-btn:not(:disabled):active { opacity: .8; }
        .ghost-btn {
          width: 100%;
          padding: 13px;
          background: transparent;
          color: #5a5650;
          border: 1px solid #1e1e2a;
          border-radius: 12px;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          margin-top: 8px;
        }
      `}</style>
    </>
  )
}
