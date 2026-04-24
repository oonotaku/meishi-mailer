import { useState, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { useRequireAuth } from '../lib/useRequireAuth'

const STEPS = { UPLOAD: 0, ANALYZING: 1, CONFIRM: 2, CONTEXT: 3, SENDING: 4, DONE: 5, ERROR: 6 }

const TEMP_OPTIONS = [
  { value: 'hot',    label: '熱い',    emoji: '🔥' },
  { value: 'normal', label: '普通',    emoji: '🤝' },
  { value: 'watch',  label: '様子見',  emoji: '👀' },
]

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
  // 文脈情報
  const [location, setLocation] = useState('')
  const [eventName, setEventName] = useState('')
  const [temperature, setTemperature] = useState('normal')
  const [memo, setMemo] = useState('')
  const fileRef = useRef()
  const router = useRouter()

  const email = contact?.email || manualEmail

  const initials = (name) => {
    if (!name) return '?'
    return name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?'
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
    setStatusMsg('名刺を解析中...')
    try {
      const r = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: images[0].base64,
          mediaType: 'image/jpeg',
          capturedAt: new Date().toISOString(),
        })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
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
    if (!email) { alert('メールアドレスを入力してください'); return }
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
        <title>名刺メーラー</title>
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
              <div className="eyebrow">AI名刺スキャナー</div>
              <div className="top-right">
                {user?.email && <span className="user-email">{user.email}</span>}
                <button className="logout-btn" onClick={handleLogout}>ログアウト</button>
              </div>
            </div>

            {images.length === 0 ? (
              <>
                <h1 className="title">名刺を<br/>撮るだけ。</h1>
                <p className="sub">AIが名前・会社・メールを読み取り<br/>お礼メールを自動で送ります</p>
                <button className="upload-btn" onClick={() => fileRef.current.click()}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                  名刺を撮影する
                </button>
                <p className="hint">またはギャラリーから選択</p>
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
                      <span className="thumb-add-label">追加</span>
                    </button>
                  )}
                </div>
                <p className="hint" style={{ textAlign: 'left', marginBottom: 20 }}>
                  {images.length}/3枚 撮影済み
                </p>
                <button className="upload-btn" onClick={onAnalyze}>解析する →</button>
                <button className="ghost-btn" onClick={reset}>やり直す</button>
              </>
            )}

            <button className="list-btn" onClick={() => router.push('/contacts')}>
              保存済み名刺一覧 →
            </button>
            <button className="list-btn" style={{ marginTop: 8 }} onClick={() => router.push('/settings/team')}>
              チーム設定 →
            </button>
            <button className="list-btn" style={{ marginTop: 8 }} onClick={() => router.push('/settings/profile')}>
              プロフィール設定 →
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
            <p className="hint" style={{ marginTop: 16 }}>AIが名刺を読み取っています...</p>
          </div>
        )}

        {/* ── CONFIRM（OCR確認・メール編集）── */}
        {step === STEPS.CONFIRM && (
          <div className="page">
            <div className="prog-bar"><div className="prog-fill" style={{ width: '60%' }} /></div>
            <div className="step-label">STEP 1 / 2 — 内容確認</div>

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
                <p>メールアドレスが見つかりませんでした</p>
                <input
                  type="email"
                  placeholder="手動でメールアドレスを入力"
                  value={manualEmail}
                  onChange={e => setManualEmail(e.target.value)}
                  className="text-input"
                />
              </div>
            )}

            <div className="mail-section">
              <label className="field-label">件名</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="text-input" />
              <label className="field-label" style={{ marginTop: 12 }}>本文</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} className="textarea" rows={7} />
            </div>

            <button className="send-btn" onClick={() => setStep(STEPS.CONTEXT)}>
              次へ: 文脈を入力 →
            </button>
            <button className="ghost-btn" onClick={reset}>やり直す</button>
          </div>
        )}

        {/* ── CONTEXT（文脈情報）── */}
        {step === STEPS.CONTEXT && (
          <div className="page">
            <div className="prog-bar"><div className="prog-fill" style={{ width: '80%' }} /></div>
            <div className="step-label">STEP 2 / 2 — 出会いの文脈（任意）</div>

            <div className="ctx-name">
              {contact?.name || '—'}
              <span className="ctx-company">{contact?.company ? `（${contact.company}）` : ''}</span>
            </div>

            {/* 場所 */}
            <label className="field-label" style={{ marginTop: 4 }}>場所・イベント名</label>
            <input
              type="text"
              placeholder="例：〇〇交流会、渋谷オフィス"
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              className="text-input"
            />

            {/* 出会った日 */}
            <label className="field-label" style={{ marginTop: 14 }}>出会った日</label>
            <input
              type="date"
              value={location || new Date().toISOString().slice(0, 10)}
              onChange={e => setLocation(e.target.value)}
              className="text-input date-input"
            />

            {/* 温度感 */}
            <label className="field-label" style={{ marginTop: 14 }}>温度感</label>
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

            {/* メモ */}
            <label className="field-label" style={{ marginTop: 14 }}>一言メモ</label>
            <textarea
              placeholder="話した内容、印象、次のアクションなど"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              className="textarea"
              rows={3}
            />

            <button className="send-btn" style={{ marginTop: 20 }} onClick={onSendNow}
              disabled={!email && !manualEmail}>
              今すぐ送信 →
            </button>
            <button className="save-btn" onClick={onSaveOnly}>保存して後で送る</button>
            <button className="ghost-btn" onClick={() => setStep(STEPS.CONFIRM)}>← 戻る</button>
          </div>
        )}

        {/* ── SENDING ── */}
        {step === STEPS.SENDING && (
          <div className="page center">
            <div className="prog-bar"><div className="prog-fill" style={{ width: '95%' }} /></div>
            <div className="big-spinner" />
            <p className="status-text" style={{ marginTop: 20 }}>{saveOnly ? '保存中...' : '送信中...'}</p>
            <p className="hint">{saveOnly ? 'Supabaseに保存しています' : 'Gmail経由でメールを送っています'}</p>
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
                <h2 className="done-title">保存しました！</h2>
                <p className="done-name">{contact?.name ? `${contact.name}様の名刺` : '名刺'} を保存しました</p>
                {temperature && (
                  <div className="done-temp">
                    {TEMP_OPTIONS.find(o => o.value === temperature)?.emoji}{' '}
                    {TEMP_OPTIONS.find(o => o.value === temperature)?.label}
                  </div>
                )}
                <div className="done-note">後で一覧から送信できます</div>
                <button className="send-btn" style={{ marginTop: 32 }} onClick={() => router.push('/contacts')}>一覧を見る</button>
                <button className="ghost-btn" style={{ marginTop: 8 }} onClick={reset}>次の名刺を読み取る</button>
              </>
            ) : (
              <>
                <h2 className="done-title">送信完了！</h2>
                <p className="done-name">{contact?.name ? `${contact.name}様` : '相手'} にメールを送りました</p>
                <p className="done-addr">{email}</p>
                <div className="done-note">受信トレイをご確認ください</div>
                <button className="send-btn" style={{ marginTop: 32 }} onClick={reset}>次の名刺を読み取る</button>
                <button className="ghost-btn" onClick={reset}>トップに戻る</button>
              </>
            )}
          </div>
        )}

        {/* ── ERROR ── */}
        {step === STEPS.ERROR && (
          <div className="page">
            <div className="error-box">
              <div className="error-label">エラー</div>
              <p className="error-msg">{errorMsg}</p>
            </div>
            <button className="ghost-btn" onClick={reset}>最初からやり直す</button>
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

        /* ヘッダー */
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
        .user-email {
          font-size: 11px;
          color: #3a3a4a;
          font-family: 'DM Mono', monospace;
          max-width: 160px;
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

        /* ステップラベル */
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

        /* サムネイル */
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

        /* CONFIRMのサムネイル */
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

        /* CONTEXTの人物ヘッダー */
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

        /* 温度感セレクター */
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

        /* 日付インプット */
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
      `}</style>
    </>
  )
}
