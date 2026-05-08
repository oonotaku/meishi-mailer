import { useState, useRef, useEffect } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { SNS_CONFIG, PRESET_CATEGORIES } from '../lib/snsConfig'

const STEPS = { UPLOAD: 0, ANALYZING: 1, CONFIRM: 2, CONTEXT: 3, SENDING: 4, DONE: 5, ERROR: 6, DUPLICATE_EMAIL: 7, DUPLICATE_NAME: 8, USER_QR_SCAN: 'USER_QR_SCAN', USER_QR_CONFIRM: 'USER_QR_CONFIRM' }

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
  const { user, profile, loading: authLoading } = useAuth()
  const [step, setStep] = useState(STEPS.UPLOAD)
  const [cardImages, setCardImages] = useState([])
  const [contextImages, setContextImages] = useState([])
  const [qrResults, setQrResults] = useState([])
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
  const [emailDuplicates, setEmailDuplicates] = useState([])
  const [nameDuplicates, setNameDuplicates] = useState([])
  const [cards, setCards] = useState([])
  const [selectedCardIndex, setSelectedCardIndex] = useState(0)
  const [scannedProfile, setScannedProfile] = useState(null)
  const [meishiUser, setMeishiUser] = useState(null)
  const [duplicateContactId, setDuplicateContactId] = useState(null)
  const [duplicateType, setDuplicateType] = useState(null)
  const [matchedSns, setMatchedSns] = useState([])
  const [selectedPreset, setSelectedPreset] = useState('business')
  const [speechSupported, setSpeechSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const fileRef = useRef()
  const contextFileRef = useRef()
  const recognitionRef = useRef(null)
  const memoBaseRef = useRef('')
  const router = useRouter()

  useEffect(() => {
    setSpeechSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition))
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (router.query.scan !== '1') return
    // クエリパラメータを除去してからファイル選択を起動
    router.replace('/', undefined, { shallow: true })
    setTimeout(() => {
      if (fileRef.current) fileRef.current.click()
    }, 300)
  }, [authLoading, router.query.scan])

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

  async function onCardFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (fileRef.current) fileRef.current.value = ''
    const dataUrl = await compressImage(file)
    const base64 = dataUrl.split(',')[1]
    setCardImages(prev => [...prev, { preview: dataUrl, base64 }])

    try {
      const jsQR = (await import('jsqr')).default
      const img = new Image()
      img.src = dataUrl
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        canvas.getContext('2d').drawImage(img, 0, 0)
        const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code?.data) {
          setQrResults(prev => [...prev, code.data])
        }
      }
    } catch (e) {
      console.error('[jsQR]', e)
    }
  }

  async function onContextFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (contextFileRef.current) contextFileRef.current.value = ''
    const dataUrl = await compressImage(file)
    setContextImages(prev => [...prev, { preview: dataUrl, base64: dataUrl.split(',')[1] }])
  }

  function removeCardImage(index) {
    setCardImages(prev => prev.filter((_, i) => i !== index))
  }

  function removeContextImage(index) {
    setContextImages(prev => prev.filter((_, i) => i !== index))
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
          images: cardImages.map(img => ({ data: img.base64, media_type: 'image/jpeg' })),
          qr_results: qrResults,
          capturedAt: new Date().toISOString(),
          locale: i18n.language,
          ...(memo && { memo }),
        })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      const parsedCards = data.cards || [data.contact]
      if (data.email_duplicates && data.email_duplicates.length > 0) {
        setContact(data.contact)
        setCards(parsedCards)
        setSubject(data.subject)
        setBody(data.body)
        setEmailDuplicates(data.email_duplicates)
        setDuplicateType('email')
        setStep(STEPS.DUPLICATE_EMAIL)
        return
      }
      if (data.name_duplicates && data.name_duplicates.length > 0) {
        setContact(data.contact)
        setCards(parsedCards)
        setSubject(data.subject)
        setBody(data.body)
        setMatchedSns(data.matched_sns || [])
        setSelectedPreset(data.recommended_preset || 'business')
        setNameDuplicates(data.name_duplicates)
        setDuplicateType('name')
        setStep(STEPS.DUPLICATE_NAME)
        return
      }
      setContact(data.contact)
      setCards(parsedCards)
      setSelectedCardIndex(0)
      setSubject(data.subject)
      setBody(data.body)
      setMatchedSns(data.matched_sns || [])
      setSelectedPreset(data.recommended_preset || 'business')
      setMeishiUser(data.meishi_user || null)
      setStep(STEPS.CONFIRM)
    } catch (err) {
      setErrorMsg(err.message)
      setStep(STEPS.ERROR)
    }
  }

  async function uploadImages(imageList, bucket) {
    const urls = []
    for (const img of imageList) {
      try {
        const byteString = atob(img.base64)
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
        const blob = new Blob([ab], { type: 'image/jpeg' })
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error } = await supabase.storage
          .from(bucket)
          .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
        if (!error) {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName)
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
        website: contact?.website || null,
        card_image_urls,
        subject,
        body,
        mail_sent_at,
        location: location || null,
        event_name: eventName || null,
        met_at: new Date().toISOString().slice(0, 10),
        temperature,
        memo: memo || null,
        extracted_sns: contact?.sns || null,
        cards: cards || [],
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

    // 重複コンタクトへの出会い追記モード
    if (duplicateContactId) {
      try {
        const { data: refreshed } = await supabase.auth.refreshSession()
        const session = refreshed?.session || (await supabase.auth.getSession()).data.session
        const r = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ to: email, subject, body, selected_preset: selectedPreset }),
        })
        const data = await r.json()
        if (!r.ok) throw new Error(data.error)
        await fetch('/api/encounters/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            contact_id: duplicateContactId,
            met_at: new Date().toISOString().slice(0, 10),
            event_name: eventName || null,
            location: location || null,
            memo: memo || null,
            temperature,
          }),
        })
        setStep(STEPS.DONE)
      } catch (err) {
        setErrorMsg(err.message)
        setStep(STEPS.ERROR)
      }
      return
    }

    try {
      const card_image_urls = await uploadImages(cardImages, 'cards')
      const encounter_photo_urls = await uploadImages(contextImages, 'encounters')
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ to: email, subject, body, selected_preset: selectedPreset })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      const saved = await saveContact(card_image_urls, new Date().toISOString())
      if (saved?.encounter_id && encounter_photo_urls.length > 0) {
        await fetch('/api/encounters/update-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ encounter_id: saved.encounter_id, photo_urls: encounter_photo_urls }),
        })
      }
      setStep(STEPS.DONE)
    } catch (err) {
      setErrorMsg(err.message)
      setStep(STEPS.ERROR)
    }
  }

  async function onSaveOnly() {
    setSaveOnly(true)
    setStep(STEPS.SENDING)

    // 重複コンタクトへの出会い追記モード
    if (duplicateContactId) {
      try {
        const { data: refreshed } = await supabase.auth.refreshSession()
        const session = refreshed?.session || (await supabase.auth.getSession()).data.session
        await fetch('/api/encounters/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            contact_id: duplicateContactId,
            met_at: new Date().toISOString().slice(0, 10),
            event_name: eventName || null,
            location: location || null,
            memo: memo || null,
            temperature,
          }),
        })
        setStep(STEPS.DONE)
      } catch (err) {
        setErrorMsg(err.message)
        setStep(STEPS.ERROR)
      }
      return
    }

    try {
      const card_image_urls = await uploadImages(cardImages, 'cards')
      const encounter_photo_urls = await uploadImages(contextImages, 'encounters')
      const { data: { session } } = await supabase.auth.getSession()
      const saved = await saveContact(card_image_urls, null)
      if (saved?.encounter_id && encounter_photo_urls.length > 0) {
        await fetch('/api/encounters/update-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ encounter_id: saved.encounter_id, photo_urls: encounter_photo_urls }),
        })
      }
      setStep(STEPS.DONE)
    } catch (err) {
      setErrorMsg(err.message)
      setStep(STEPS.ERROR)
    }
  }

  function toggleVoice() {
    if (isListening) {
      recognitionRef.current?.abort()
      recognitionRef.current = null
      setIsListening(false)
      setInterimText('')
      return
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SR()
    recognition.lang = i18n.language === 'ja' ? 'ja-JP' : 'en-US'
    recognition.continuous = true
    recognition.interimResults = true
    memoBaseRef.current = memo
    recognition.onresult = (e) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          final += e.results[i][0].transcript
        } else {
          interim += e.results[i][0].transcript
        }
      }
      if (final) {
        const newBase = memoBaseRef.current
          ? memoBaseRef.current + ' ' + final
          : final
        memoBaseRef.current = newBase
        setMemo(newBase)
        setInterimText('')
      } else {
        setInterimText(interim)
      }
    }
    recognition.onend = () => { setIsListening(false); setInterimText('') }
    recognition.onerror = () => { setIsListening(false); setInterimText('') }
    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  function reset() {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null
      recognitionRef.current.onend = null
      recognitionRef.current.onerror = null
      try { recognitionRef.current.abort() } catch {}
      recognitionRef.current = null
    }
    setIsListening(false)
    setInterimText('')
    setStep(STEPS.UPLOAD)
    setCardImages([])
    setContextImages([])
    setQrResults([])
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
    setEmailDuplicates([])
    setNameDuplicates([])
    setCards([])
    setSelectedCardIndex(0)
    setDuplicateContactId(null)
    setDuplicateType(null)
    setMatchedSns([])
    setSelectedPreset('business')
    if (fileRef.current) fileRef.current.value = ''
    if (contextFileRef.current) contextFileRef.current.value = ''
  }

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #1e1e2a', borderTopColor: '#7b9e87', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  if (!user) return (
    <>
      <Head>
        <title>{i18n.language === 'en' ? 'Card Mailer — AI Business Card Scanner' : '名刺メーラー — AI名刺スキャナー'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="lp-shell">
        {/* Header */}
        <header className="lp-header">
          <span className="lp-logo">MeishiMailer</span>
          <div className="lp-header-actions">
            <button className="lp-lang-btn" onClick={switchLocale}>{t('lang.switch')}</button>
            <a href="/login" className="lp-login-btn">{t('landing.login')}</a>
            <a href="/login" className="lp-cta-btn-sm">{t('landing.cta')}</a>
          </div>
        </header>

        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-eyebrow">MEISHI-MAILER</div>
          <h1 className="lp-hero-title">
            {i18n.language === 'en'
              ? <>Connect deeper with everyone you meet.</>
              : <>名刺交換した人と、<br />最速で最深まで。</>
            }
          </h1>
          <p className="lp-hero-sub">{t('landing.hero_sub')}</p>
          <a href="/login" className="lp-cta-btn">{t('landing.cta')} →</a>
        </section>

        {/* Features */}
        <section className="lp-features">
          <div className="lp-feat-grid">
            <div className="lp-feat-card">
              <div className="lp-feat-icon">📸</div>
              <h3 className="lp-feat-title">{t('landing.feat1_title')}</h3>
              <p className="lp-feat-body">{t('landing.feat1_body')}</p>
            </div>
            <div className="lp-feat-card">
              <div className="lp-feat-icon">✍️</div>
              <h3 className="lp-feat-title">{t('landing.feat2_title')}</h3>
              <p className="lp-feat-body">{t('landing.feat2_body')}</p>
            </div>
            <div className="lp-feat-card">
              <div className="lp-feat-icon">📧</div>
              <h3 className="lp-feat-title">{t('landing.feat3_title')}</h3>
              <p className="lp-feat-body">{t('landing.feat3_body')}</p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="lp-pricing">
          <h2 className="lp-section-title">{t('landing.pricing_title')}</h2>
          <div className="lp-pricing-grid">
            <div className="lp-plan-card">
              <div className="lp-plan-name">{t('landing.free_plan')}</div>
              <div className="lp-plan-price">¥0</div>
              <ul className="lp-plan-features">
                <li>{t('landing.free_scans')}</li>
                <li>{t('landing.free_features')}</li>
              </ul>
              <a href="/login" className="lp-plan-btn lp-plan-btn-ghost">{t('landing.cta')}</a>
            </div>
            <div className="lp-plan-card lp-plan-card-pro">
              <div className="lp-plan-badge">Pro</div>
              <div className="lp-plan-name">{t('landing.pro_plan')}</div>
              <div className="lp-plan-price">{t('landing.pro_price')}</div>
              <ul className="lp-plan-features">
                <li>{t('landing.pro_scans')}</li>
                <li>{t('landing.pro_features')}</li>
              </ul>
              <a href="/login" className="lp-plan-btn lp-plan-btn-primary">{t('landing.cta')}</a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="lp-footer">
          <p className="lp-footer-copy">{t('landing.footer_copy')}</p>
          <div className="lp-footer-links">
            <a href="/privacy" className="lp-footer-link">
              {i18n.language === 'en' ? 'Privacy Policy' : 'プライバシーポリシー'}
            </a>
            <span className="lp-footer-sep">·</span>
            <a href="/terms" className="lp-footer-link">
              {i18n.language === 'en' ? 'Terms of Service' : '利用規約'}
            </a>
          </div>
        </footer>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #0a0a0f; color: #f0ede8; font-family: 'Noto Sans JP', sans-serif; }
      `}</style>
      <style jsx>{`
        .lp-shell {
          min-height: 100svh;
          display: flex;
          flex-direction: column;
        }
        /* Header */
        .lp-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #1e1e2a;
          position: sticky;
          top: 0;
          background: #0a0a0f;
          z-index: 10;
        }
        .lp-logo {
          font-family: 'DM Mono', monospace;
          font-size: 15px;
          font-weight: 500;
          color: #7b9e87;
          letter-spacing: .04em;
        }
        .lp-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .lp-lang-btn {
          background: none;
          border: 1px solid #2a2a3a;
          border-radius: 4px;
          color: #5a5650;
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          padding: 2px 6px;
          letter-spacing: .06em;
        }
        .lp-lang-btn:hover { color: #7b9e87; border-color: #7b9e87; }
        .lp-login-btn {
          font-size: 13px;
          color: #8a8680;
          text-decoration: none;
          padding: 6px 12px;
        }
        .lp-login-btn:hover { color: #f0ede8; }
        .lp-cta-btn-sm {
          font-size: 12px;
          font-weight: 700;
          color: #0a0a0f;
          background: #7b9e87;
          text-decoration: none;
          padding: 7px 14px;
          border-radius: 8px;
          font-family: 'Noto Sans JP', sans-serif;
        }
        .lp-cta-btn-sm:hover { opacity: .9; }
        /* Hero */
        .lp-hero {
          flex: 0 0 auto;
          padding: 5rem 1.5rem 4rem;
          max-width: 680px;
          margin: 0 auto;
          width: 100%;
          text-align: center;
        }
        .lp-eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: .18em;
          color: #7b9e87;
          text-transform: uppercase;
          margin-bottom: 1.5rem;
        }
        .lp-hero-title {
          font-size: clamp(28px, 7vw, 48px);
          font-weight: 700;
          line-height: 1.3;
          color: #f0ede8;
          margin-bottom: 1.25rem;
        }
        .lp-hero-sub {
          font-size: 15px;
          color: #8a8680;
          line-height: 1.8;
          margin-bottom: 2.5rem;
          max-width: 480px;
          margin-left: auto;
          margin-right: auto;
        }
        .lp-cta-btn {
          display: inline-block;
          background: #7b9e87;
          color: #0a0a0f;
          font-size: 16px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          text-decoration: none;
          padding: 16px 36px;
          border-radius: 14px;
          transition: opacity .15s;
        }
        .lp-cta-btn:hover { opacity: .9; }
        /* Features */
        .lp-features {
          padding: 3rem 1.5rem;
          max-width: 720px;
          margin: 0 auto;
          width: 100%;
        }
        .lp-feat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1rem;
        }
        .lp-feat-card {
          background: #0e0e16;
          border: 1px solid #1e1e2a;
          border-radius: 14px;
          padding: 1.75rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .lp-feat-icon { font-size: 28px; }
        .lp-feat-title {
          font-size: 15px;
          font-weight: 700;
          color: #f0ede8;
        }
        .lp-feat-body {
          font-size: 13px;
          color: #7a7470;
          line-height: 1.7;
        }
        /* Pricing */
        .lp-pricing {
          padding: 3rem 1.5rem 4rem;
          max-width: 560px;
          margin: 0 auto;
          width: 100%;
          text-align: center;
        }
        .lp-section-title {
          font-size: 20px;
          font-weight: 700;
          color: #f0ede8;
          margin-bottom: 2rem;
        }
        .lp-pricing-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        .lp-plan-card {
          background: #0e0e16;
          border: 1px solid #1e1e2a;
          border-radius: 14px;
          padding: 1.75rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 10px;
          position: relative;
          text-align: left;
        }
        .lp-plan-card-pro {
          border-color: #2a3e30;
          background: #0d1610;
        }
        .lp-plan-badge {
          position: absolute;
          top: -10px;
          right: 14px;
          background: #7b9e87;
          color: #0a0a0f;
          font-size: 10px;
          font-weight: 700;
          font-family: 'DM Mono', monospace;
          padding: 2px 8px;
          border-radius: 4px;
          letter-spacing: .06em;
        }
        .lp-plan-name {
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          letter-spacing: .08em;
          color: #5a5650;
          text-transform: uppercase;
        }
        .lp-plan-price {
          font-size: 24px;
          font-weight: 700;
          color: #f0ede8;
        }
        .lp-plan-features {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }
        .lp-plan-features li {
          font-size: 12px;
          color: #7a7470;
        }
        .lp-plan-features li::before {
          content: '✓ ';
          color: #7b9e87;
        }
        .lp-plan-btn {
          display: block;
          text-align: center;
          text-decoration: none;
          padding: 11px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          margin-top: 6px;
          transition: opacity .15s;
        }
        .lp-plan-btn-ghost {
          border: 1px solid #2a2a3a;
          color: #7a7470;
        }
        .lp-plan-btn-ghost:hover { border-color: #7b9e87; color: #7b9e87; }
        .lp-plan-btn-primary {
          background: #7b9e87;
          color: #0a0a0f;
        }
        .lp-plan-btn-primary:hover { opacity: .9; }
        /* Footer */
        .lp-footer {
          margin-top: auto;
          padding: 2rem 1.5rem;
          border-top: 1px solid #1e1e2a;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }
        .lp-footer-copy {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: #3a3a4a;
        }
        .lp-footer-links {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .lp-footer-link {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: #3a3a4a;
          text-decoration: none;
          letter-spacing: .04em;
        }
        .lp-footer-link:hover { color: #5a5650; }
        .lp-footer-sep {
          font-size: 11px;
          color: #2a2a3a;
          font-family: 'DM Mono', monospace;
        }
      `}</style>
    </>
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
              onChange={onCardFile}
              style={{ display: 'none' }}
            />
            <input ref={contextFileRef} type="file" accept="image/*"
              onChange={onContextFile} style={{ display: 'none' }} />

            <div className="top-bar">
              <div className="eyebrow">{t('app.tagline')}</div>
              <div className="top-right">
                <button className="lang-btn" onClick={switchLocale}>{t('lang.switch')}</button>
                {user?.email && <span className="user-email">{user.email}</span>}
                <button className="logout-btn" onClick={handleLogout}>{t('nav.logout')}</button>
              </div>
            </div>

            {cardImages.length === 0 ? (
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
                <div className="photo-zone">
                  <div className="zone-header">
                    <span className="zone-label">{t('home.card_zone_label')}</span>
                    <span className="zone-count">{cardImages.length}/6</span>
                  </div>
                  <div className="thumb-row">
                    {cardImages.map((img, i) => (
                      <div key={i} className="thumb-wrap">
                        <img src={img.preview} className="thumb" alt="" />
                        <button className="thumb-remove" onClick={() => removeCardImage(i)}>×</button>
                      </div>
                    ))}
                    {cardImages.length < 6 && (
                      <button className="thumb-add" onClick={() => fileRef.current.click()}>
                        <span className="thumb-add-label">{t('home.add')}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="photo-zone context-zone">
                  <div className="zone-header">
                    <span className="zone-label">{t('home.context_zone_label')}</span>
                    <span className="zone-hint">{t('home.context_zone_hint')}</span>
                  </div>
                  {contextImages.length > 0 && (
                    <div className="thumb-row">
                      {contextImages.map((img, i) => (
                        <div key={i} className="thumb-wrap">
                          <img src={img.preview} className="thumb" alt="" />
                          <button className="thumb-remove" onClick={() => removeContextImage(i)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="context-add-btn" onClick={() => contextFileRef.current.click()}>
                    + {t('home.context_add')}
                  </button>
                </div>

                <button className="upload-btn" onClick={onAnalyze}>
                  {t('home.analyze')}
                </button>
                <button className="ghost-btn" onClick={reset}>{t('home.redo')}</button>
              </>
            )}

            <button className="list-btn" onClick={() => router.push('/contacts')}>
              {t('nav.contacts')} →
            </button>
            <button className="list-btn" style={{ marginTop: 8 }} onClick={() => setStep(STEPS.USER_QR_SCAN)}>
              🔗 QRで繋がる →
            </button>
            <button className="list-btn" style={{ marginTop: 8 }} onClick={() => router.push('/settings/team')}>
              {t('nav.team')} →
            </button>
            <button className="list-btn" style={{ marginTop: 8 }} onClick={() => router.push('/settings/profile')}>
              {t('nav.profile')} →
            </button>

            {/* 自分のプロフィールQR */}
            {user && (
              <div style={{
                marginTop: 20, padding: '16px', borderRadius: 16,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.5px' }}>
                  自分のプロフィールQR
                </div>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`https://www.meishi-mailer.com/p/${user.id}`)}&bgcolor=ffffff&color=111111&margin=2`}
                  alt="My profile QR"
                  style={{ width: 120, height: 120, borderRadius: 8 }}
                />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                  meishi-mailer.com/p/{user.id.slice(0, 8)}...
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ANALYZING ── */}
        {step === STEPS.ANALYZING && (
          <div className="page">
            <div className="prog-bar"><div className="prog-fill" style={{ width: '60%' }} /></div>
            <div className="status-row">
              <div className="spinner" />
              <span className="status-text">{statusMsg}</span>
            </div>
            {cardImages[0] && <img src={cardImages[0].preview} className="preview-img" alt="" />}
            <p className="hint" style={{ marginTop: 16 }}>{t('home.analyzing_hint')}</p>
          </div>
        )}

        {/* ── USER_QR_SCAN ── */}
        {step === STEPS.USER_QR_SCAN && (
          <div className="page">
            <h2 className="step-title">QRで繋がる</h2>
            <p className="hint" style={{ marginBottom: 16 }}>
              相手の meishi-mailer プロフィールQRを撮影してください
            </p>

            <button className="upload-btn" onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'image/*'
              input.capture = 'environment'
              input.onchange = async e => {
                const file = e.target.files[0]
                if (!file) return
                const bitmap = await createImageBitmap(file)
                const canvas = document.createElement('canvas')
                canvas.width = bitmap.width
                canvas.height = bitmap.height
                const ctx = canvas.getContext('2d')
                ctx.drawImage(bitmap, 0, 0)
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
                const jsQR = (await import('jsqr')).default
                const qr = jsQR(imageData.data, imageData.width, imageData.height)
                if (!qr) {
                  alert('QRコードを読み取れませんでした。もう一度試してください。')
                  return
                }
                const url = qr.data
                const match = url.match(/meishi-mailer\.com\/p\/([0-9a-f-]{36})/i)
                  || url.match(/meishi-mailer-mu\.vercel\.app\/p\/([0-9a-f-]{36})/i)
                if (!match) {
                  alert('meishi-mailerのプロフィールQRではありません。')
                  return
                }
                const userId = match[1]
                if (userId === user?.id) {
                  alert('自分自身のQRコードです。')
                  return
                }
                const r = await fetch(`/api/profile/public?userId=${userId}`)
                if (!r.ok) { alert('プロフィールの取得に失敗しました。'); return }
                const data = await r.json()
                setScannedProfile(data)
                setStep(STEPS.USER_QR_CONFIRM)
              }
              input.click()
            }}>
              📷 QRコードを撮影
            </button>

            <button className="ghost-btn" style={{ marginTop: 12 }} onClick={() => setStep(STEPS.UPLOAD)}>
              キャンセル
            </button>
          </div>
        )}

        {/* ── USER_QR_CONFIRM ── */}
        {step === STEPS.USER_QR_CONFIRM && scannedProfile && (
          <div className="page">
            <h2 className="step-title">コンタクトに追加</h2>

            <div style={{
              background: 'rgba(255,255,255,0.05)', borderRadius: 16,
              padding: 20, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 10, marginBottom: 24,
            }}>
              {scannedProfile.avatar_url && (
                <img src={scannedProfile.avatar_url} alt=""
                  style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover' }} />
              )}
              <div style={{ fontSize: 18, fontWeight: 700 }}>{scannedProfile.name}</div>
              {scannedProfile.company && (
                <div style={{ fontSize: 14, opacity: 0.6 }}>{scannedProfile.company} {scannedProfile.title}</div>
              )}
              {scannedProfile.bio && (
                <div style={{ fontSize: 13, opacity: 0.5, textAlign: 'center' }}>{scannedProfile.bio}</div>
              )}
              <div style={{ fontSize: 11, color: '#22c55e', fontFamily: 'monospace', marginTop: 4 }}>
                ✓ meishi-mailerユーザー
              </div>
            </div>

            <button className="upload-btn" onClick={async () => {
              const session = await supabase.auth.getSession()
              const token = session.data.session?.access_token
              const body = {
                name: scannedProfile.name,
                company: scannedProfile.company || '',
                title: scannedProfile.title || '',
                email: scannedProfile.email || '',
                phone: scannedProfile.phone || '',
                memo: `meishi-mailerプロフィール: ${scannedProfile.profile_url}`,
                met_at: new Date().toISOString(),
                visibility: 'private',
              }
              const r = await fetch('/api/contacts/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(body),
              })
              if (r.ok) {
                setScannedProfile(null)
                setStep(STEPS.DONE)
              } else {
                alert('保存に失敗しました')
              }
            }}>
              コンタクトに追加
            </button>

            <button className="ghost-btn" style={{ marginTop: 12 }} onClick={() => {
              setScannedProfile(null)
              setStep(STEPS.UPLOAD)
            }}>
              キャンセル
            </button>
          </div>
        )}

        {/* ── DUPLICATE ── */}
        {step === STEPS.DUPLICATE_EMAIL && (
          <div className="page">
            <div className="prog-bar"><div className="prog-fill" style={{ width: '50%' }} /></div>

            <div className="dup-icon">⚠️</div>
            <h2 className="dup-title">{t('duplicate.title')}</h2>
            <p className="dup-email">{contact?.email}</p>

            <div className="dup-name">{emailDuplicates[0]?.name || t('duplicate.unknown_name')}</div>
            {emailDuplicates[0]?.company && <div className="dup-company">{emailDuplicates[0].company}</div>}

            <div className="dup-history-label">{t('duplicate.history_label')}</div>
            <div className="dup-history">
              {emailDuplicates.map((d) => (
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

            <button
              className="send-btn"
              style={{ marginTop: 20 }}
              onClick={() => {
                setDuplicateContactId(emailDuplicates[0].id)
                setStep(STEPS.CONTEXT)
              }}
            >
              {t('duplicate.add_encounter')}
            </button>
            <button className="save-btn" onClick={() => router.push('/contacts')}>
              {t('duplicate.view_contacts')}
            </button>
            <button className="ghost-btn" onClick={reset}>{t('duplicate.scan_another')}</button>
          </div>
        )}

        {step === STEPS.DUPLICATE_NAME && (
          <div className="page">
            <div className="prog-bar"><div className="prog-fill" style={{ width: '50%' }} /></div>

            <div className="dup-icon">👤</div>
            <h2 className="dup-title">{t('duplicate.name_title')}</h2>
            <p className="dup-email">{contact?.name}</p>

            <div className="dup-history-label">{t('duplicate.history_label')}</div>
            <div className="dup-history">
              {nameDuplicates.map((d) => (
                <div key={d.id} className="dup-history-item">
                  <div className="dup-history-date">
                    {d.name}
                    {d.company ? ` · ${d.company}` : ''}
                    {d.email ? ` · ${d.email}` : ''}
                  </div>
                  <div className="dup-history-meta">
                    {d.met_at
                      ? new Date(d.met_at).toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                      : new Date(d.created_at).toLocaleDateString(i18n.language === 'ja' ? 'ja-JP' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                    }
                  </div>
                </div>
              ))}
            </div>

            <p className="dup-note">{t('duplicate.name_note')}</p>

            <button
              className="send-btn"
              style={{ marginTop: 20 }}
              onClick={() => {
                setNameDuplicates([])
                setDuplicateType(null)
                setStep(STEPS.CONFIRM)
              }}
            >
              {t('duplicate.register_new')}
            </button>
            <button
              className="save-btn"
              onClick={() => {
                setDuplicateContactId(nameDuplicates[0].id)
                setStep(STEPS.CONTEXT)
              }}
            >
              {t('duplicate.add_encounter')}
            </button>
            <button className="ghost-btn" onClick={() => router.push('/contacts')}>
              {t('duplicate.view_contacts')}
            </button>
            <button className="ghost-btn" style={{ marginTop: 4 }} onClick={reset}>{t('duplicate.scan_another')}</button>
          </div>
        )}

        {/* ── CONFIRM ── */}
        {step === STEPS.CONFIRM && (
          <div className="page">
            <div className="prog-bar"><div className="prog-fill" style={{ width: '80%' }} /></div>
            <div className="step-label">{t('step.confirm')}</div>

            {cards.length > 1 && (
              <div className="card-tabs">
                {cards.map((c, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`card-tab${selectedCardIndex === i ? ' active' : ''}`}
                    onClick={() => {
                      setSelectedCardIndex(i)
                      setContact({ ...c, name: c.name || contact?.name })
                    }}
                  >
                    {c.company || c.name || `Card ${i + 1}`}
                  </button>
                ))}
              </div>
            )}

            <div className="contact-card">
              <div className="avatar">{initials(contact?.name)}</div>
              <div>
                <div className="contact-name">{contact?.name || '—'}</div>
                <div className="contact-meta">{[contact?.company, contact?.title].filter(Boolean).join(' · ') || '—'}</div>
              </div>
            </div>

            {meishiUser && (
              <a
                href={meishiUser.profile_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 12,
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.3)',
                  textDecoration: 'none', marginTop: 8,
                }}
              >
                {meishiUser.avatar_url && (
                  <img src={meishiUser.avatar_url} alt=""
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                )}
                <div>
                  <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 700 }}>
                    ✓ meishi-mailerユーザーです
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                    プロフィールを見る →
                  </div>
                </div>
              </a>
            )}

            {cardImages.length > 0 && (
              <div className="confirm-thumbs">
                {cardImages.map((img, i) => (
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

            {/* SNS マッチングセクション */}
            {matchedSns.length > 0 && (
              <div className="sns-match-section">
                <div className="sns-match-heading">
                  🔗 {i18n.language === 'en' ? 'Connect on SNS' : 'この人と繋がれるSNS'}
                </div>
                <div className="sns-match-list">
                  {matchedSns.map(s => (
                    <button
                      key={s.platform}
                      className="sns-match-btn"
                      style={{ borderColor: s.color, color: s.color }}
                      onClick={() => window.open(s.card_url, '_blank')}
                    >
                      <span className="sns-match-icon-wrap">
                        {s.icon ? (
                          <img
                            src={`https://cdn.simpleicons.org/${s.icon}/${s.color.replace('#','')}`}
                            width="16" height="16" alt={s.label}
                            style={{ display: 'block' }}
                            onError={e => { e.target.style.display = 'none' }}
                          />
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.label[0]}</span>
                        )}
                      </span>
                      <span className="sns-match-label">{s.label}</span>
                      <span className="sns-match-sub">
                        {i18n.language === 'en' ? '→ Follow' : '→ タップしてフォロー'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* プリセット選択 */}
            {SNS_CONFIG.some(f => profile?.[f.key]) && (
              <div className="preset-sel-section">
                <div className="preset-sel-heading">
                  📤 {i18n.language === 'en' ? 'SNS to include in email' : '相手に送るSNSを選ぶ'}
                </div>
                <div className="preset-sel-tabs">
                  {[
                    { key: 'business', label: i18n.language === 'en' ? 'Business' : 'ビジネス' },
                    { key: 'personal', label: i18n.language === 'en' ? 'Personal' : '個人' },
                    { key: 'all',      label: i18n.language === 'en' ? 'All' : 'すべて' },
                  ].map(p => (
                    <button
                      key={p.key}
                      type="button"
                      className={`preset-sel-tab ${selectedPreset === p.key ? 'active' : ''}`}
                      onClick={() => setSelectedPreset(p.key)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="preset-sel-hint">
                  {i18n.language === 'en'
                    ? 'Selected SNS links will be included in the email'
                    : '選択したプリセットのSNSリンクがメールに含まれます'}
                </p>
              </div>
            )}

            <div className="mail-section">
              <label className="field-label">{t('confirm.subject')}</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className="text-input" />
              <label className="field-label" style={{ marginTop: 12 }}>{t('confirm.body')}</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} className="textarea" rows={7} />
            </div>

            <button className="send-btn" onClick={onSendNow} disabled={!email && !manualEmail}>
              {t('context.send_now')}
            </button>
            <button className="save-btn" onClick={onSaveOnly}>{t('context.save_later')}</button>
            <button className="ghost-btn" onClick={reset}>{t('home.redo')}</button>
          </div>
        )}

        {/* ── CONTEXT ── */}
        {step === STEPS.CONTEXT && (
          <div className="page">
            <div className="prog-bar"><div className="prog-fill" style={{ width: duplicateContactId ? '80%' : '40%' }} /></div>
            <div className="step-label">{t('step.context')}</div>
            <h2 className="ctx-title">{t('context.step_title')}</h2>

            {duplicateContactId && (
              <div className="ctx-name">
                {contact?.name || '—'}
                <span className="ctx-company">{contact?.company ? `（${contact.company}）` : ''}</span>
              </div>
            )}

            <label className="field-label" style={{ marginTop: duplicateContactId ? 4 : 16 }}>{t('context.event_label')}</label>
            <input
              type="text"
              placeholder={t('context.event_placeholder')}
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              className="text-input"
            />

            <label className="field-label" style={{ marginTop: 20 }}>{t('context.met_label')}</label>
            <input
              type="date"
              value={location || new Date().toISOString().slice(0, 10)}
              onChange={e => setLocation(e.target.value)}
              className="text-input date-input"
            />

            <label className="field-label" style={{ marginTop: 20 }}>{t('context.temp_label')}</label>
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

            <div className="memo-label-row">
              <label className="field-label">{t('context.memo_label')}</label>
              {speechSupported && (
                <button
                  type="button"
                  className={`mic-btn${isListening ? ' mic-active' : ''}`}
                  onClick={toggleVoice}
                  aria-label={t(isListening ? 'context.mic_stop' : 'context.mic_start')}
                >
                  {isListening ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="6" width="12" height="12" rx="2"/>
                    </svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                      <line x1="12" y1="19" x2="12" y2="22"/>
                    </svg>
                  )}
                </button>
              )}
            </div>
            <textarea
              placeholder={t('context.memo_placeholder')}
              value={isListening && interimText
                ? (memo ? memo + ' ' + interimText : interimText)
                : memo}
              onChange={e => { if (!isListening) setMemo(e.target.value) }}
              readOnly={isListening}
              className={`textarea${isListening ? ' textarea-listening' : ''}`}
              rows={3}
            />

            {duplicateContactId ? (
              <>
                <button className="send-btn" style={{ marginTop: 20 }} onClick={onSendNow}
                  disabled={!email && !manualEmail}>
                  {t('context.send_now')}
                </button>
                <button className="save-btn" onClick={onSaveOnly}>{t('context.save_later')}</button>
                <button className="ghost-btn" onClick={() => setStep(duplicateType === 'name' ? STEPS.DUPLICATE_NAME : STEPS.DUPLICATE_EMAIL)}>{t('context.back')}</button>
              </>
            ) : (
              <>
                <button className="send-btn" style={{ marginTop: 20 }} onClick={onAnalyze}>
                  {t('context.analyze_generate')}
                </button>
                <button className="ghost-btn" onClick={() => setStep(STEPS.UPLOAD)}>{t('context.back')}</button>
              </>
            )}
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

        <div className="page-footer">
          <a href="/privacy" className="footer-link">
            {i18n.language === 'en' ? 'Privacy Policy' : 'プライバシーポリシー'}
          </a>
          <span className="footer-sep">·</span>
          <a href="/terms" className="footer-link">
            {i18n.language === 'en' ? 'Terms of Service' : '利用規約'}
          </a>
        </div>
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

        .card-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 12px;
          overflow-x: auto;
        }
        .card-tab {
          flex: 0 0 auto;
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid #2a2a3a;
          background: transparent;
          color: #8a8680;
          font-size: 12px;
          cursor: pointer;
          white-space: nowrap;
        }
        .card-tab.active {
          border-color: #7b9e87;
          color: #7b9e87;
          background: rgba(123,158,135,.08);
        }
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

        .ctx-title {
          font-size: 22px;
          font-weight: 700;
          color: #f0ede8;
          line-height: 1.3;
          margin-bottom: 4px;
        }
        .ctx-name {
          font-size: 16px;
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
          gap: 5px;
          min-height: 64px;
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

        .memo-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 14px;
          margin-bottom: 5px;
        }
        .memo-label-row .field-label {
          margin-bottom: 0;
          margin-top: 0;
        }
        .mic-btn {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #12121a;
          border: 1px solid #2a2a3a;
          color: #5a5650;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all .15s;
          flex-shrink: 0;
        }
        .mic-btn:hover { border-color: #7b9e87; color: #7b9e87; }
        .mic-btn.mic-active {
          background: #2a0808;
          border-color: #e24b4a;
          color: #e24b4a;
          animation: mic-pulse .9s ease-in-out infinite;
        }
        @keyframes mic-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(226,75,74,.5); }
          50% { box-shadow: 0 0 0 6px rgba(226,75,74,0); }
        }
        .textarea-listening {
          border-color: #e24b4a;
          color: #a08080;
        }
        .page-footer {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          padding: 1.5rem 1.5rem 2rem;
        }
        .footer-link {
          font-size: 11px;
          color: #3a3a4a;
          font-family: 'DM Mono', monospace;
          text-decoration: none;
          letter-spacing: .04em;
        }
        .footer-link:hover { color: #5a5650; }
        .footer-sep {
          font-size: 11px;
          color: #2a2a3a;
          font-family: 'DM Mono', monospace;
        }

        /* ── SNS マッチング ── */
        .sns-match-section {
          background: #0d0f1a;
          border: 1px solid #1e1e2a;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 14px;
        }
        .sns-match-heading {
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          letter-spacing: .08em;
          color: #5a5650;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .sns-match-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sns-match-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          height: 46px;
          background: transparent;
          border: 1.5px solid #5a5650;
          border-radius: 10px;
          color: #5a5650;
          cursor: pointer;
          padding: 0 12px;
          transition: opacity .15s;
        }
        .sns-match-btn:active { opacity: .65; }
        .sns-match-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          flex-shrink: 0;
        }
        .sns-match-label {
          flex: 1;
          font-size: 13px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          text-align: left;
        }
        .sns-match-sub {
          font-size: 10px;
          opacity: .55;
          font-family: 'DM Mono', monospace;
          flex-shrink: 0;
        }

        /* ── プリセット選択 ── */
        .preset-sel-section {
          background: #0d0f1a;
          border: 1px solid #1e1e2a;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 14px;
        }
        .preset-sel-heading {
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          letter-spacing: .08em;
          color: #5a5650;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .preset-sel-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 8px;
        }
        .preset-sel-tab {
          flex: 1;
          padding: 8px 4px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 8px;
          color: #5a5650;
          font-size: 12px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: all .15s;
        }
        .preset-sel-tab.active {
          background: #1a2e22;
          border-color: #7b9e87;
          color: #7b9e87;
        }
        .preset-sel-hint {
          font-size: 11px;
          color: #3a3a4a;
          line-height: 1.5;
        }

        .photo-zone {
          width: 100%;
          background: #0d0d14;
          border: 1px solid #1e1e2a;
          border-radius: 12px;
          padding: 12px 14px;
          margin-bottom: 10px;
        }
        .context-zone { border-style: dashed; }
        .zone-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
        }
        .zone-label {
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          color: #7b9e87;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .zone-count {
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          color: #3a3a4a;
        }
        .zone-hint { font-size: 10px; color: #3a3a4a; }
        .context-add-btn {
          width: 100%;
          padding: 10px;
          background: none;
          border: 1px dashed #2a2a3a;
          border-radius: 8px;
          color: #5a5650;
          font-size: 13px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          margin-top: 8px;
          transition: color .15s, border-color .15s;
        }
        .context-add-btn:hover { color: #7b9e87; border-color: #7b9e87; }
      `}</style>
    </>
  )
}

export const getStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale, ['common'])),
  },
})
