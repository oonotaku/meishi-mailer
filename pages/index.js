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
  const [scannedUserId, setScannedUserId] = useState(null)
  const [qrDuplicateContact, setQrDuplicateContact] = useState(null)
  const [qrSavingEncounter, setQrSavingEncounter] = useState(false)
  const [meishiUser, setMeishiUser] = useState(null)
  const [duplicateContactId, setDuplicateContactId] = useState(null)
  const [duplicateType, setDuplicateType] = useState(null)
  const [matchedSns, setMatchedSns] = useState([])
  const [addCardConfirmId, setAddCardConfirmId] = useState(null)
  const [addingCard, setAddingCard] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [showQrSheet, setShowQrSheet] = useState(false)
  const [showMyQr, setShowMyQr] = useState(false)
  const fileRef = useRef()
  const contextFileRef = useRef()
  const recognitionRef = useRef(null)
  const memoBaseRef = useRef('')
  const videoRef = useRef(null)
  const qrScanningRef = useRef(false)
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

  useEffect(() => {
    if (step !== STEPS.USER_QR_SCAN) return

    let stream = null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    qrScanningRef.current = true

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        })
        if (!videoRef.current) return
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        scanLoop()
      } catch (err) {
        alert('カメラへのアクセスが拒否されました。設定からカメラを許可してください。')
        setStep(STEPS.UPLOAD)
      }
    }

    async function scanLoop() {
      if (!qrScanningRef.current) return
      const video = videoRef.current
      if (!video || video.readyState < 2) {
        requestAnimationFrame(scanLoop)
        return
      }
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      const jsQR = (await import('jsqr')).default
      const qr = jsQR(imageData.data, imageData.width, imageData.height)

      if (qr) {
        const url = qr.data
        const match = url.match(/koryu\.app\/p\/([0-9a-f-]{36})/i)
          || url.match(/meishi-mailer\.com\/p\/([0-9a-f-]{36})/i)
          || url.match(/meishi-mailer-mu\.vercel\.app\/p\/([0-9a-f-]{36})/i)

        if (match) {
          qrScanningRef.current = false
          if (stream) stream.getTracks().forEach(t => t.stop())

          const userId = match[1]
          if (userId === user?.id) {
            alert('自分自身のQRコードです。')
            setStep(STEPS.UPLOAD)
            return
          }

          const r = await fetch(`/api/profile/public?userId=${userId}`)
          if (!r.ok) { alert('プロフィールの取得に失敗しました。'); setStep(STEPS.UPLOAD); return }
          const data = await r.json()
          setScannedProfile(data)
          setScannedUserId(userId)

          // 重複チェック: koryu_user_id → email の順で照合
          let dupContact = null
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session?.access_token) {
              const listRes = await fetch('/api/contacts/list', {
                headers: { Authorization: `Bearer ${session.access_token}` },
              })
              if (listRes.ok) {
                const listJson = await listRes.json()
                const contacts = listJson.data || []

                // ① koryu_user_id で検索（最優先）
                dupContact = contacts.find(c =>
                  c.koryu_user_id && c.koryu_user_id === userId
                ) ?? null

                // ② ヒットしなければemailで検索（フォールバック）
                if (!dupContact && data.email) {
                  dupContact = contacts.find(c =>
                    c.email?.toLowerCase() === data.email?.toLowerCase()
                  ) ?? null

                  // emailでヒットしたが koryu_user_id 未設定 → 非同期で紐付け更新
                  if (dupContact && !dupContact.koryu_user_id) {
                    fetch('/api/contacts/update-koryu-user-id', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                      body: JSON.stringify({ contact_id: dupContact.id, koryu_user_id: userId }),
                    }).catch(() => {})
                  }
                }
              }
            }
          } catch (e) { /* スキップして従来通り進む */ }
          setQrDuplicateContact(dupContact)
          setStep(STEPS.USER_QR_CONFIRM)
          return
        }
      }

      requestAnimationFrame(scanLoop)
    }

    startCamera()

    return () => {
      qrScanningRef.current = false
      if (stream) stream.getTracks().forEach(t => t.stop())
    }
  }, [step])

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

  async function handleAddCard(contactId) {
    setAddingCard(true)
    try {
      const card_image_urls = await uploadImages(cardImages, 'cards')
      const { data: { session } } = await supabase.auth.getSession()
      const cardData = cards[0] || contact
      const r1 = await fetch('/api/contacts/add-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contact_id: contactId, card: cardData, image_url: card_image_urls[0] || null }),
      })
      if (!r1.ok) throw new Error((await r1.json()).error)
      await fetch('/api/encounters/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contact_id: contactId, met_at: new Date().toISOString() }),
      })
      router.push(`/contacts/${contactId}`)
    } catch (e) {
      alert(e.message || 'エラーが発生しました')
      setAddingCard(false)
      setAddCardConfirmId(null)
    }
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
        koryu_user_id: meishiUser?.user_id ?? null,
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
          body: JSON.stringify({ to: email, subject, body, selected_preset: 'business' }),
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
        body: JSON.stringify({ to: email, subject, body, selected_preset: 'business' })
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
    if (fileRef.current) fileRef.current.value = ''
    if (contextFileRef.current) contextFileRef.current.value = ''
  }

  function retakePhoto() {
    setCardImages([])
    setContextImages([])
    setQrResults([])
    if (fileRef.current) fileRef.current.value = ''
    if (contextFileRef.current) contextFileRef.current.value = ''
    setTimeout(() => fileRef.current?.click(), 80)
  }

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #1e1e2a', borderTopColor: '#7b9e87', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  const isJa = i18n.language !== 'en'

  if (!user) return (
    <>
      <Head>
        <title>{isJa ? 'Koryu — 名刺の裏面が、あなたのSNSハブになる。' : 'Koryu — Your card, reimagined.'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="description" content={isJa ? '名刺をスキャンするだけで、ベントーグリッドのプロフィールページが完成。SNSでつながる新しい名刺体験。' : 'Scan a business card, create a stunning bento-grid profile, and connect on SNS instantly.'} />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="lp-shell">

        {/* ── HEADER ── */}
        <header className="lp-header">
          <span className="lp-logo">Koryu</span>
          <div className="lp-header-actions">
            <button className="lp-lang-btn" onClick={switchLocale}>{t('lang.switch')}</button>
            <a href="/login" className="lp-login-btn">ログイン / Login</a>
            <a href="/login" className="lp-cta-btn-sm">無料で始める</a>
          </div>
        </header>

        {/* ── HERO ── */}
        <section className="lp-hero">
          <div className="lp-hero-text">
            <div className="lp-eyebrow">KORYU · 交流</div>
            <h1 className="lp-hero-title">
              名刺の裏面が、<br />
              <span className="lp-hero-accent">あなたのSNSハブ</span>になる。
            </h1>
            <p className="lp-hero-en">Your card, reimagined as a living profile.</p>
            <p className="lp-hero-sub">交流会で出会った人を、忘れない。<br />名刺をスキャンして、出会いの記録とSNSプロフィールをひとつに。<br />QRで共有できる、あたらしい名刺体験です。</p>
            <div className="lp-hero-ctas">
              <a href="/login" className="lp-cta-btn">無料で始める →</a>
              <span className="lp-hero-note">クレジットカード不要</span>
            </div>
          </div>

          {/* Bento Demo */}
          <div className="lp-bento-wrap">
            <div className="lp-bento-phone">
              <div className="lp-bento-grid">
                {/* Header block L */}
                <div className="lp-block lp-block-L lp-block-header-demo">
                  <div className="lp-demo-avatar">山</div>
                  <div className="lp-demo-info">
                    <div className="lp-demo-name">山田 太郎</div>
                    <div className="lp-demo-title">Product Manager</div>
                    <div className="lp-demo-company">Koryu株式会社</div>
                  </div>
                </div>
                {/* SNS S blocks */}
                <div className="lp-block lp-block-S" style={{background:'#000000'}}>
                  <span className="lp-block-sns-icon">𝕏</span>
                  <span className="lp-block-sns-label">@yamada_t</span>
                </div>
                <div className="lp-block lp-block-S" style={{background:'linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)'}}>
                  <span className="lp-block-sns-icon">📷</span>
                  <span className="lp-block-sns-label">Instagram</span>
                </div>
                {/* Text M block */}
                <div className="lp-block lp-block-M" style={{background:'#1a2e22', color:'#7b9e87'}}>
                  <div className="lp-block-text-body">「プロダクトで、<br />世界を少し<br />良くしたい。」</div>
                </div>
                {/* LinkedIn S block */}
                <div className="lp-block lp-block-S" style={{background:'#0077b5'}}>
                  <span className="lp-block-sns-icon">in</span>
                  <span className="lp-block-sns-label">LinkedIn</span>
                </div>
                {/* Link block S */}
                <div className="lp-block lp-block-S" style={{background:'#f5f0e8', color:'#1a1a1a'}}>
                  <span className="lp-block-link-title">Portfolio ↗</span>
                </div>
              </div>
              <div className="lp-bento-url">koryu.app/p/yamada</div>
            </div>
          </div>
        </section>

        {/* ── WOW SECTION ── */}
        <section className="lp-wow">
          <div className="lp-wow-inner">
            <div className="lp-section-badge">Profile</div>
            <h2 className="lp-section-title">
              こんなプロフィールページが<br />作れます
            </h2>
            <p className="lp-section-en">Create a stunning bento-grid profile in minutes.</p>
            <div className="lp-wow-grid">
              <div className="lp-wow-card lp-wow-card-dark">
                <div className="lp-wow-theme-label">Dark</div>
                <div className="lp-mini-bento lp-mini-dark">
                  <div className="lp-mini-header"></div>
                  <div className="lp-mini-row">
                    <div className="lp-mini-s" style={{background:'#111'}}></div>
                    <div className="lp-mini-s" style={{background:'#1a3525'}}></div>
                  </div>
                  <div className="lp-mini-m" style={{background:'#0e0e16'}}></div>
                </div>
              </div>
              <div className="lp-wow-card lp-wow-card-sakura">
                <div className="lp-wow-theme-label">Sakura</div>
                <div className="lp-mini-bento lp-mini-sakura">
                  <div className="lp-mini-header" style={{background:'#f7d6d9'}}></div>
                  <div className="lp-mini-row">
                    <div className="lp-mini-s" style={{background:'#e8a0aa'}}></div>
                    <div className="lp-mini-s" style={{background:'#f0c0c8'}}></div>
                  </div>
                  <div className="lp-mini-m" style={{background:'#fce8ea'}}></div>
                </div>
              </div>
              <div className="lp-wow-card lp-wow-card-ocean">
                <div className="lp-wow-theme-label">Ocean</div>
                <div className="lp-mini-bento lp-mini-ocean">
                  <div className="lp-mini-header" style={{background:'#1a3a5c'}}></div>
                  <div className="lp-mini-row">
                    <div className="lp-mini-s" style={{background:'#0d2a45'}}></div>
                    <div className="lp-mini-s" style={{background:'#1e4060'}}></div>
                  </div>
                  <div className="lp-mini-m" style={{background:'#122233'}}></div>
                </div>
              </div>
            </div>
            <p className="lp-wow-note">6種のテーマ · ブロック自由配置 · QRコード即発行</p>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="lp-how">
          <div className="lp-how-inner">
            <div className="lp-section-badge">How it works</div>
            <h2 className="lp-section-title">3ステップで完成</h2>
            <p className="lp-section-en">From card to profile in under a minute.</p>
            <div className="lp-steps">
              <div className="lp-step">
                <div className="lp-step-num">01</div>
                <div className="lp-step-icon">📸</div>
                <h3 className="lp-step-title">名刺をスキャン</h3>
                <p className="lp-step-body">AIが名前・会社・SNSを自動で読み取り</p>
              </div>
              <div className="lp-step-arrow">→</div>
              <div className="lp-step">
                <div className="lp-step-num">02</div>
                <div className="lp-step-icon">📝</div>
                <h3 className="lp-step-title">出会いを記録する</h3>
                <p className="lp-step-body">いつ・どこで・どんな縁かを残す</p>
              </div>
              <div className="lp-step-arrow">→</div>
              <div className="lp-step">
                <div className="lp-step-num">03</div>
                <div className="lp-step-icon">🔗</div>
                <h3 className="lp-step-title">QRでつながる</h3>
                <p className="lp-step-body">次の出会いでQRを見せるだけでSNSでつながれる</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── PRICING ── */}
        <section className="lp-pricing">
          <div className="lp-pricing-inner">
            <div className="lp-section-badge">Pricing</div>
            <h2 className="lp-section-title">シンプルな料金体系</h2>
            <p className="lp-section-en">Start free. Upgrade when you're ready.</p>
            <div className="lp-pricing-grid">
              <div className="lp-plan-card">
                <div className="lp-plan-name">FREE</div>
                <div className="lp-plan-price">¥0</div>
                <div className="lp-plan-period">ずっと無料</div>
                <ul className="lp-plan-features">
                  <li>名刺スキャン</li>
                  <li>プロフィール作成</li>
                  <li>SNSリンク管理</li>
                  <li>出会い記録</li>
                </ul>
                <a href="/login" className="lp-plan-btn lp-plan-btn-ghost">無料で始める</a>
              </div>
              <div className="lp-plan-card lp-plan-card-pro">
                <div className="lp-plan-badge">Pro</div>
                <div className="lp-plan-name">PRO</div>
                <div className="lp-plan-price">¥500</div>
                <div className="lp-plan-period">/ 月（年払い ¥5,000）</div>
                <ul className="lp-plan-features">
                  <li>ベントーグリッド編集</li>
                  <li>6種テーマ選択</li>
                  <li>QRコード発行</li>
                  <li>Free の全機能</li>
                </ul>
                <a href="/login" className="lp-plan-btn lp-plan-btn-primary">Proで始める</a>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CTA ── */}
        <section className="lp-final-cta">
          <h2 className="lp-final-title">あなたの名刺、<br />もっとリッチに。</h2>
          <p className="lp-final-en">Your next connection deserves more than a paper card.</p>
          <a href="/login" className="lp-cta-btn lp-cta-btn-light">今すぐ無料で始める →</a>
        </section>

        {/* ── FOOTER ── */}
        <footer className="lp-footer">
          <span className="lp-footer-logo">Koryu</span>
          <div className="lp-footer-links">
            <a href="/privacy" className="lp-footer-link">プライバシーポリシー</a>
            <span className="lp-footer-sep">·</span>
            <a href="/terms" className="lp-footer-link">利用規約</a>
          </div>
          <p className="lp-footer-copy">© 2026 Koryu / node-bee LLC</p>
        </footer>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { background: #f8f7f4; color: #1a1a1a; font-family: 'Noto Sans JP', sans-serif; }
      `}</style>
      <style jsx>{`
        .lp-shell { min-height: 100svh; display: flex; flex-direction: column; }

        /* ── HEADER ── */
        .lp-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 1rem 1.5rem;
          background: rgba(248,247,244,0.9);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid #e8e4de;
          position: sticky; top: 0; z-index: 100;
        }
        .lp-logo {
          font-family: 'DM Mono', monospace; font-size: 16px; font-weight: 500;
          color: #7b9e87; letter-spacing: .06em;
        }
        .lp-header-actions { display: flex; align-items: center; gap: 8px; }
        .lp-lang-btn {
          background: none; border: 1px solid #d0ccc6; border-radius: 4px;
          color: #8a8680; font-size: 10px; font-family: 'DM Mono', monospace;
          cursor: pointer; padding: 3px 7px; letter-spacing: .06em;
        }
        .lp-lang-btn:hover { border-color: #7b9e87; color: #7b9e87; }
        .lp-login-btn { font-size: 13px; color: #6b6660; text-decoration: none; padding: 6px 10px; }
        .lp-login-btn:hover { color: #1a1a1a; }
        .lp-cta-btn-sm {
          font-size: 12px; font-weight: 700; color: #fff;
          background: #7b9e87; text-decoration: none;
          padding: 8px 16px; border-radius: 8px;
          font-family: 'Noto Sans JP', sans-serif;
        }
        .lp-cta-btn-sm:hover { background: #6a8d76; }

        /* ── HERO ── */
        .lp-hero {
          display: flex; flex-direction: column; align-items: center;
          gap: 3rem; padding: 4rem 1.5rem 3rem; max-width: 900px;
          margin: 0 auto; width: 100%;
        }
        .lp-hero-text { text-align: center; }
        .lp-eyebrow {
          font-family: 'DM Mono', monospace; font-size: 11px;
          letter-spacing: .2em; color: #7b9e87; margin-bottom: 1.25rem;
        }
        .lp-hero-title {
          font-size: clamp(26px, 7vw, 44px); font-weight: 700;
          line-height: 1.35; color: #1a1a1a; margin-bottom: .75rem;
        }
        .lp-hero-accent {
          color: #7b9e87;
          background: linear-gradient(135deg, #7b9e87, #5a8070);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-hero-en {
          font-size: 13px; color: #9a9690; letter-spacing: .04em;
          font-family: 'DM Mono', monospace; margin-bottom: 1.25rem;
        }
        .lp-hero-sub {
          font-size: 14px; color: #6b6660; line-height: 1.9;
          margin-bottom: 2rem; max-width: 400px; margin-left: auto; margin-right: auto;
        }
        .lp-hero-ctas { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .lp-cta-btn {
          display: inline-block; background: #7b9e87; color: #fff;
          font-size: 15px; font-weight: 700; font-family: 'Noto Sans JP', sans-serif;
          text-decoration: none; padding: 15px 34px; border-radius: 14px;
          transition: background .15s;
        }
        .lp-cta-btn:hover { background: #6a8d76; }
        .lp-cta-btn-light {
          background: #fff; color: #1a1a1a;
        }
        .lp-cta-btn-light:hover { background: #f0ede8; }
        .lp-hero-note { font-size: 12px; color: #aaa9a6; }

        /* ── BENTO DEMO ── */
        .lp-bento-wrap { width: 100%; display: flex; justify-content: center; }
        .lp-bento-phone {
          width: 280px;
          background: #0a0a0f;
          border-radius: 28px;
          padding: 20px 16px 16px;
          box-shadow: 0 30px 80px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.08);
        }
        .lp-bento-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .lp-block {
          border-radius: 16px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          padding: 12px;
          position: relative;
          min-height: 80px;
        }
        .lp-block-L { grid-column: span 2; flex-direction: row; align-items: center; gap: 12px; background: #12121e; min-height: 90px; }
        .lp-block-S { min-height: 80px; justify-content: space-between; }
        .lp-block-M { min-height: 110px; grid-column: span 1; background: #1a2e22; }
        .lp-block-header-demo { background: #12121e; }
        .lp-demo-avatar {
          width: 48px; height: 48px; border-radius: 50%;
          background: #7b9e87; color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 700; flex-shrink: 0;
        }
        .lp-demo-info { flex: 1; min-width: 0; }
        .lp-demo-name { font-size: 13px; font-weight: 700; color: #f0ede8; margin-bottom: 2px; }
        .lp-demo-title { font-size: 10px; color: #7b9e87; }
        .lp-demo-company { font-size: 10px; color: #5a5650; margin-top: 1px; }
        .lp-block-sns-icon {
          font-size: 16px; font-weight: 700; color: #fff;
          font-family: 'DM Mono', monospace;
        }
        .lp-block-sns-label { font-size: 9px; color: rgba(255,255,255,0.6); margin-top: auto; }
        .lp-block-text-body {
          font-size: 11px; line-height: 1.7; color: #7b9e87; font-weight: 700;
        }
        .lp-block-link-title { font-size: 11px; font-weight: 700; color: #1a1a1a; }
        .lp-bento-url {
          margin-top: 12px; text-align: center;
          font-family: 'DM Mono', monospace; font-size: 10px; color: #3a3a4a;
        }

        /* ── WOW SECTION ── */
        .lp-wow { background: #1a1a22; padding: 4rem 1.5rem; }
        .lp-wow-inner { max-width: 680px; margin: 0 auto; text-align: center; }
        .lp-section-badge {
          display: inline-block; background: rgba(123,158,135,0.15);
          color: #7b9e87; font-family: 'DM Mono', monospace;
          font-size: 10px; letter-spacing: .14em; padding: 4px 12px;
          border-radius: 999px; border: 1px solid rgba(123,158,135,0.3);
          margin-bottom: 1rem;
        }
        .lp-section-title {
          font-size: clamp(20px, 5vw, 28px); font-weight: 700;
          color: #f0ede8; margin-bottom: .5rem; line-height: 1.4;
        }
        .lp-section-en {
          font-size: 12px; color: #5a5650; font-family: 'DM Mono', monospace;
          letter-spacing: .04em; margin-bottom: 2rem;
        }
        .lp-wow-grid {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;
          margin-bottom: 1.5rem;
        }
        .lp-wow-card {
          border-radius: 16px; overflow: hidden; padding: 12px;
          border: 1px solid #2a2a3a;
        }
        .lp-wow-card-dark { background: #0e0e16; }
        .lp-wow-card-sakura { background: #fce8ea; border-color: #f0c0c8; }
        .lp-wow-card-ocean { background: #0d2a45; border-color: #1e4060; }
        .lp-wow-theme-label {
          font-size: 9px; font-family: 'DM Mono', monospace;
          color: #5a5650; margin-bottom: 8px; letter-spacing: .08em;
        }
        .lp-wow-card-sakura .lp-wow-theme-label { color: #c06070; }
        .lp-wow-card-ocean .lp-wow-theme-label { color: #4a90b8; }
        .lp-mini-bento { display: flex; flex-direction: column; gap: 5px; }
        .lp-mini-header { height: 28px; border-radius: 8px; background: #1e1e2a; }
        .lp-mini-row { display: flex; gap: 5px; }
        .lp-mini-s { flex: 1; height: 24px; border-radius: 6px; }
        .lp-mini-m { height: 32px; border-radius: 8px; }
        .lp-wow-note {
          font-size: 12px; color: #5a5650; font-family: 'DM Mono', monospace;
          letter-spacing: .06em;
        }

        /* ── HOW IT WORKS ── */
        .lp-how { background: #f8f7f4; padding: 4rem 1.5rem; }
        .lp-how-inner { max-width: 680px; margin: 0 auto; text-align: center; }
        .lp-how .lp-section-title { color: #1a1a1a; }
        .lp-how .lp-section-en { color: #9a9690; }
        .lp-steps {
          display: flex; flex-direction: column; gap: 0; align-items: center;
          margin-top: 2rem;
        }
        .lp-step {
          background: #fff; border: 1px solid #e8e4de; border-radius: 16px;
          padding: 1.5rem; width: 100%; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: 8px;
        }
        .lp-step-num {
          font-family: 'DM Mono', monospace; font-size: 10px;
          color: #7b9e87; letter-spacing: .1em;
        }
        .lp-step-icon { font-size: 28px; }
        .lp-step-title { font-size: 15px; font-weight: 700; color: #1a1a1a; }
        .lp-step-body { font-size: 13px; color: #6b6660; line-height: 1.7; }
        .lp-step-arrow {
          font-size: 20px; color: #7b9e87; padding: 8px; transform: rotate(90deg);
        }

        /* ── PRICING ── */
        .lp-pricing { background: #fff; padding: 4rem 1.5rem; }
        .lp-pricing-inner { max-width: 560px; margin: 0 auto; text-align: center; }
        .lp-pricing .lp-section-title { color: #1a1a1a; }
        .lp-pricing .lp-section-en { color: #9a9690; }
        .lp-pricing-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 2rem; }
        .lp-plan-card {
          background: #f8f7f4; border: 1px solid #e8e4de; border-radius: 16px;
          padding: 1.5rem 1.25rem; display: flex; flex-direction: column;
          gap: 8px; position: relative; text-align: left;
        }
        .lp-plan-card-pro { background: #0d1610; border-color: #2a3e30; }
        .lp-plan-badge {
          position: absolute; top: -10px; right: 14px;
          background: #7b9e87; color: #fff;
          font-size: 10px; font-weight: 700; font-family: 'DM Mono', monospace;
          padding: 2px 10px; border-radius: 4px; letter-spacing: .06em;
        }
        .lp-plan-name {
          font-family: 'DM Mono', monospace; font-size: 11px;
          letter-spacing: .1em; color: #9a9690;
        }
        .lp-plan-card-pro .lp-plan-name { color: #5a7a65; }
        .lp-plan-price { font-size: 28px; font-weight: 700; color: #1a1a1a; }
        .lp-plan-card-pro .lp-plan-price { color: #f0ede8; }
        .lp-plan-period { font-size: 11px; color: #9a9690; }
        .lp-plan-card-pro .lp-plan-period { color: #5a7a65; }
        .lp-plan-features { list-style: none; display: flex; flex-direction: column; gap: 6px; flex: 1; margin: 4px 0; }
        .lp-plan-features li { font-size: 12px; color: #6b6660; }
        .lp-plan-card-pro .lp-plan-features li { color: #7b9e87; }
        .lp-plan-features li::before { content: '✓ '; color: #7b9e87; }
        .lp-plan-btn {
          display: block; text-align: center; text-decoration: none;
          padding: 11px; border-radius: 10px; font-size: 13px; font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif; margin-top: 4px; transition: opacity .15s;
        }
        .lp-plan-btn-ghost { border: 1px solid #d0ccc6; color: #6b6660; }
        .lp-plan-btn-ghost:hover { border-color: #7b9e87; color: #7b9e87; }
        .lp-plan-btn-primary { background: #7b9e87; color: #fff; }
        .lp-plan-btn-primary:hover { background: #6a8d76; }

        /* ── FINAL CTA ── */
        .lp-final-cta {
          background: linear-gradient(135deg, #1a2e22 0%, #0a1a10 100%);
          padding: 5rem 1.5rem; text-align: center;
        }
        .lp-final-title {
          font-size: clamp(22px, 6vw, 36px); font-weight: 700;
          color: #f0ede8; margin-bottom: .75rem; line-height: 1.4;
        }
        .lp-final-en {
          font-size: 12px; color: #5a7a65; font-family: 'DM Mono', monospace;
          letter-spacing: .04em; margin-bottom: 2rem;
        }

        /* ── FOOTER ── */
        .lp-footer {
          background: #f0ede8; padding: 2rem 1.5rem;
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          border-top: 1px solid #e0dcd6;
        }
        .lp-footer-logo {
          font-family: 'DM Mono', monospace; font-size: 14px;
          font-weight: 500; color: #7b9e87; letter-spacing: .06em;
        }
        .lp-footer-links { display: flex; align-items: center; gap: 10px; }
        .lp-footer-link {
          font-size: 11px; color: #8a8680; text-decoration: none;
        }
        .lp-footer-link:hover { color: #1a1a1a; }
        .lp-footer-sep { font-size: 11px; color: #c0bcb8; }
        .lp-footer-copy { font-size: 11px; color: #b0aca8; font-family: 'DM Mono', monospace; }
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
          <div className="page upload-page">
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
              <div className="top-logo">Koryu</div>
              <div className="top-right">
                {user && <span className="user-email">{user.email}</span>}
                {user && (
                  <button className="logout-btn" onClick={async () => {
                    await supabase.auth.signOut()
                    window.location.href = '/login'
                  }}>{i18n.language === 'en' ? 'Log out' : 'ログアウト'}</button>
                )}
                <button className="lang-btn" onClick={switchLocale}>{t('lang.switch')}</button>
              </div>
            </div>

            {cardImages.length === 0 ? (
              <>
                <div className="upload-content">
                <div className="scan-hero">
                  <button className="upload-btn" onClick={() => fileRef.current.click()}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                    {t('home.capture')}
                  </button>
                  <p className="hint">{t('home.gallery_hint')}</p>
                </div>

                <div className="secondary-actions">
                  <button className="action-card" onClick={() => setShowQrSheet(true)}>
                    <div className="action-card-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                        <rect x="3" y="14" width="7" height="7"/>
                        <path d="M14 14h3v3m0 4h4v-4m-4 0h-3"/>
                      </svg>
                    </div>
                    <div className="action-card-text">
                      <div className="action-card-title">{i18n.language === 'en' ? 'Connect via QR' : 'QRで繋がる'}</div>
                      <div className="action-card-sub">{i18n.language === 'en' ? 'Scan or show your QR code' : '読み取る・自分のQRを表示'}</div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{flexShrink:0,color:'#3a3a4a'}}>
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  </button>
                </div>
                </div>

                {/* QR底シート */}
                {showQrSheet && (
                  <div className="qr-sheet-overlay" onClick={() => { setShowQrSheet(false); setShowMyQr(false) }}>
                    <div className="qr-sheet" onClick={e => e.stopPropagation()}>
                      <div className="qr-sheet-title">
                        {i18n.language === 'en' ? 'Connect via QR' : 'QRで繋がる'}
                      </div>
                      <button className="qr-sheet-option" onClick={() => { setShowQrSheet(false); setStep(STEPS.USER_QR_SCAN) }}>
                        <div className="qr-sheet-option-icon">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                          </svg>
                        </div>
                        <div className="qr-sheet-option-text">
                          <div className="qr-sheet-option-title">{i18n.language === 'en' ? 'Scan their QR' : '相手のQRを読み取る'}</div>
                          <div className="qr-sheet-option-sub">{i18n.language === 'en' ? 'Camera scan to add contact' : 'カメラでスキャンしてコンタクト追加'}</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{color:'#3a3a4a',flexShrink:0}}>
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </button>
                      <button className="qr-sheet-option" onClick={() => { setShowMyQr(true) }}>
                        <div className="qr-sheet-option-icon">
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                            <rect x="3" y="14" width="7" height="7"/>
                            <path d="M14 14h3v3m0 4h4v-4m-4 0h-3"/>
                          </svg>
                        </div>
                        <div className="qr-sheet-option-text">
                          <div className="qr-sheet-option-title">{i18n.language === 'en' ? 'Show my QR' : '自分のQRを表示'}</div>
                          <div className="qr-sheet-option-sub">{i18n.language === 'en' ? 'Show full-screen QR code' : '大きなQRコードを表示'}</div>
                        </div>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{color:'#3a3a4a',flexShrink:0}}>
                          <path d="M9 18l6-6-6-6"/>
                        </svg>
                      </button>
                      <button className="qr-sheet-cancel" onClick={() => { setShowQrSheet(false); setShowMyQr(false) }}>
                        {i18n.language === 'en' ? 'Cancel' : 'キャンセル'}
                      </button>
                    </div>
                  </div>
                )}

                {/* 大きなQRコード表示 */}
                {showMyQr && user && (
                  <div className="qr-sheet-overlay" onClick={() => { setShowMyQr(false); setShowQrSheet(false) }}>
                    <div className="qr-sheet" onClick={e => e.stopPropagation()} style={{alignItems:'center', gap:20, paddingTop:28}}>
                      <div style={{fontSize:15, fontWeight:700, color:'#f0ede8'}}>
                        {i18n.language === 'en' ? 'My QR Code' : '自分のQRコード'}
                      </div>
                      <div style={{background:'#fff', borderRadius:16, padding:14, display:'inline-block'}}>
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`https://koryu.app/p/${profile?.username || user.id}`)}&bgcolor=ffffff&color=111111&margin=2`}
                          alt="My QR"
                          style={{width:220, height:220, display:'block'}}
                        />
                      </div>
                      <div style={{fontSize:11, color:'#5a5a7a', fontFamily:'DM Mono, monospace', textAlign:'center'}}>
                        koryu.app/p/{user.id.slice(0,16)}...
                      </div>
                      <button className="qr-sheet-cancel" style={{width:'100%'}} onClick={() => { setShowMyQr(false); setShowQrSheet(false) }}>
                        {i18n.language === 'en' ? 'Close' : '閉じる'}
                      </button>
                    </div>
                  </div>
                )}


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

                <div className="quick-memo-wrap">
                  <label className="quick-memo-label">
                    {i18n.language === 'en' ? 'Quick note (optional)' : 'ひとこと（任意）'}
                  </label>
                  <textarea
                    className="quick-memo-input"
                    placeholder={i18n.language === 'en' ? 'e.g. Met at the conference, in charge of sales...' : '例：展示会で交換、営業担当…'}
                    value={memo}
                    onChange={e => setMemo(e.target.value)}
                    rows={2}
                  />
                </div>

                <button className="upload-btn" onClick={onAnalyze}>
                  {t('home.analyze')}
                </button>
                <button className="ghost-btn" onClick={retakePhoto}>
                  {i18n.language === 'en' ? 'Retake' : '撮り直す'}
                </button>
              </>
            )}

            {/* ── BOTTOM NAV ── */}
            <nav className="bottom-nav">
              <div className="bn-item bn-active">
                <div className="bn-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
                <span className="bn-label">{i18n.language === 'en' ? 'Scan' : 'スキャン'}</span>
              </div>
              <button className="bn-item" onClick={() => router.push('/contacts')}>
                <div className="bn-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <span className="bn-label">{i18n.language === 'en' ? 'Contacts' : 'つながり'}</span>
              </button>
              <button className="bn-item" onClick={() => router.push('/settings/profile')}>
                <div className="bn-icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <span className="bn-label">{i18n.language === 'en' ? 'Profile' : 'プロフィール'}</span>
              </button>
            </nav>
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
          <div className="page" style={{ padding: 0, position: 'relative' }}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100svh',
                objectFit: 'cover',
                display: 'block',
                background: '#000',
              }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'space-between',
              padding: '60px 24px 48px',
              pointerEvents: 'none',
            }}>
              <div style={{
                color: '#fff', fontSize: 15, fontWeight: 600,
                textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                background: 'rgba(0,0,0,0.4)', padding: '8px 16px',
                borderRadius: 20, backdropFilter: 'blur(8px)',
              }}>
                KoryuのQRに向けてください
              </div>
              <div style={{
                width: 220, height: 220,
                border: '3px solid rgba(255,255,255,0.8)',
                borderRadius: 20,
                boxShadow: '0 0 0 4000px rgba(0,0,0,0.45)',
              }} />
              <button
                onClick={() => {
                  qrScanningRef.current = false
                  if (videoRef.current?.srcObject) {
                    videoRef.current.srcObject.getTracks().forEach(t => t.stop())
                  }
                  setStep(STEPS.UPLOAD)
                }}
                style={{
                  pointerEvents: 'auto',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: '#fff', fontSize: 15, fontWeight: 600,
                  padding: '12px 32px', borderRadius: 30,
                  backdropFilter: 'blur(8px)', cursor: 'pointer',
                }}
              >
                キャンセル
              </button>
            </div>
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
                ✓ Koryuユーザー
              </div>
            </div>

            {qrDuplicateContact && (
              <div style={{
                background: '#2a1a00', border: '1px solid #6b4000',
                borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                fontSize: 13, color: '#f59e0b', lineHeight: 1.6,
              }}>
                ⚠️ 「{qrDuplicateContact.name}」として登録済みの可能性があります
              </div>
            )}

            {qrDuplicateContact ? (
              <>
                <button
                  className="send-btn"
                  disabled={qrSavingEncounter}
                  style={{ marginTop: 0 }}
                  onClick={async () => {
                    setQrSavingEncounter(true)
                    try {
                      const { data: { session } } = await supabase.auth.getSession()
                      const r = await fetch('/api/encounters/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                        body: JSON.stringify({ contact_id: qrDuplicateContact.id, met_at: new Date().toISOString() }),
                      })
                      if (r.ok) {
                        const dupId = qrDuplicateContact.id
                        setScannedProfile(null)
                        setQrDuplicateContact(null)
                        router.push(`/contacts/${dupId}`)
                      } else {
                        const json = await r.json()
                        alert(json.error || '保存に失敗しました')
                      }
                    } catch (e) {
                      alert('エラーが発生しました')
                    } finally {
                      setQrSavingEncounter(false)
                    }
                  }}
                >
                  {qrSavingEncounter ? '…' : 'この交流を記録する'}
                </button>
                <button
                  className="save-btn"
                  disabled={qrSavingEncounter}
                  onClick={async () => {
                    const session = await supabase.auth.getSession()
                    const token = session.data.session?.access_token
                    const body = {
                      name: scannedProfile.name,
                      company: scannedProfile.company || '',
                      title: scannedProfile.title || '',
                      email: scannedProfile.email || '',
                      phone: scannedProfile.phone || '',
                      extracted_sns: scannedProfile.extracted_sns || {},
                      memo: `Koryuプロフィール: ${scannedProfile.profile_url}`,
                      met_at: new Date().toISOString(),
                      visibility: 'private',
                      koryu_user_id: scannedUserId ?? null,
                    }
                    const r = await fetch('/api/contacts/save', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify(body),
                    })
                    if (r.ok) {
                      const data = await r.json()
                      const contactId = data.data?.id
                      setScannedProfile(null)
                      setQrDuplicateContact(null)
                      if (contactId) {
                        router.push(`/contacts/${contactId}`)
                      } else {
                        setStep(STEPS.UPLOAD)
                      }
                    } else {
                      alert('保存に失敗しました')
                    }
                  }}
                >
                  新規コンタクトとして追加
                </button>
              </>
            ) : (
              <button className="upload-btn" onClick={async () => {
                const session = await supabase.auth.getSession()
                const token = session.data.session?.access_token
                const body = {
                  name: scannedProfile.name,
                  company: scannedProfile.company || '',
                  title: scannedProfile.title || '',
                  email: scannedProfile.email || '',
                  phone: scannedProfile.phone || '',
                  extracted_sns: scannedProfile.extracted_sns || {},
                  memo: `Koryuプロフィール: ${scannedProfile.profile_url}`,
                  met_at: new Date().toISOString(),
                  visibility: 'private',
                  koryu_user_id: scannedUserId ?? null,
                }
                const r = await fetch('/api/contacts/save', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify(body),
                })
                if (r.ok) {
                  const data = await r.json()
                  const contactId = data.data?.id
                  setScannedProfile(null)
                  if (contactId) {
                    router.push(`/contacts/${contactId}`)
                  } else {
                    setStep(STEPS.UPLOAD)
                  }
                } else {
                  alert('保存に失敗しました')
                }
              }}>
                コンタクトに追加
              </button>
            )}

            <button className="ghost-btn" style={{ marginTop: 12 }} disabled={qrSavingEncounter} onClick={() => {
              setScannedProfile(null)
              setQrDuplicateContact(null)
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

            {addCardConfirmId === emailDuplicates[0].id ? (
              <div style={{ marginTop: 12, padding: '12px 16px', background: '#f5f5f5', borderRadius: 10, textAlign: 'center' }}>
                <p style={{ margin: '0 0 10px', fontSize: 13 }}>
                  {t('duplicate.add_card_confirm', { name: emailDuplicates[0].name || t('duplicate.unknown_name') })}
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button
                    className="send-btn"
                    style={{ flex: 1, fontSize: 14 }}
                    disabled={addingCard}
                    onClick={() => handleAddCard(emailDuplicates[0].id)}
                  >
                    {addingCard ? '…' : t('duplicate.add_card_confirm_btn')}
                  </button>
                  <button
                    className="ghost-btn"
                    style={{ flex: 1, fontSize: 14, marginTop: 0 }}
                    onClick={() => setAddCardConfirmId(null)}
                  >
                    {t('duplicate.add_card_cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="save-btn"
                onClick={() => setAddCardConfirmId(emailDuplicates[0].id)}
              >
                {t('duplicate.add_card')}
              </button>
            )}

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

            {addCardConfirmId === nameDuplicates[0]?.id ? (
              <div style={{ marginTop: 12, padding: '12px 16px', background: '#f5f5f5', borderRadius: 10, textAlign: 'center' }}>
                <p style={{ margin: '0 0 10px', fontSize: 13 }}>
                  {t('duplicate.add_card_confirm', { name: nameDuplicates[0].name || t('duplicate.unknown_name') })}
                </p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button
                    className="send-btn"
                    style={{ flex: 1, fontSize: 14 }}
                    disabled={addingCard}
                    onClick={() => handleAddCard(nameDuplicates[0].id)}
                  >
                    {addingCard ? '…' : t('duplicate.add_card_confirm_btn')}
                  </button>
                  <button
                    className="ghost-btn"
                    style={{ flex: 1, fontSize: 14, marginTop: 0 }}
                    onClick={() => setAddCardConfirmId(null)}
                  >
                    {t('duplicate.add_card_cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="ghost-btn"
                style={{ marginTop: 4 }}
                onClick={() => setAddCardConfirmId(nameDuplicates[0]?.id)}
              >
                {t('duplicate.add_card')}
              </button>
            )}

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
              <div style={{ flex: 1, minWidth: 0 }}>
                <input
                  className="confirm-edit-name"
                  value={contact?.name || ''}
                  onChange={e => setContact({ ...contact, name: e.target.value })}
                  placeholder={i18n.language === 'en' ? 'Name' : '名前'}
                />
                <input
                  className="confirm-edit-meta"
                  value={contact?.company || ''}
                  onChange={e => setContact({ ...contact, company: e.target.value })}
                  placeholder={i18n.language === 'en' ? 'Company' : '会社名'}
                />
                <input
                  className="confirm-edit-meta"
                  value={contact?.title || ''}
                  onChange={e => setContact({ ...contact, title: e.target.value })}
                  placeholder={i18n.language === 'en' ? 'Title' : '役職'}
                />
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
                    ✓ Koryuユーザーです
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


            {memo && (
              <div className="confirm-memo">
                <span className="confirm-memo-label">
                  {i18n.language === 'en' ? '📝 Your note' : '📝 ひとこと'}
                </span>
                <span className="confirm-memo-text">{memo}</span>
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
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          padding: 5px 10px;
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

        /* ── TOP LOGO ── */
        .top-logo {
          font-family: 'DM Mono', monospace;
          font-size: 18px;
          font-weight: 500;
          color: #7b9e87;
          letter-spacing: .06em;
        }

        /* ── UPLOAD PAGE ── */
        .upload-page {
          padding-bottom: 90px !important;
        }
        .upload-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 16px;
        }
        .scan-hero {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .secondary-actions {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .action-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          cursor: pointer;
          width: 100%;
          text-align: left;
          transition: background .15s;
          color: #f0ede8;
          font-family: 'Noto Sans JP', sans-serif;
        }
        .action-card:active { background: rgba(255,255,255,0.06); }
        .my-qr-static { cursor: default; }
        .action-card-icon {
          width: 44px; height: 44px;
          border-radius: 10px;
          background: #1a2e22;
          border: 1px solid #2a3e30;
          display: flex; align-items: center; justify-content: center;
          color: #7b9e87; flex-shrink: 0;
        }
        .action-card-text { flex: 1; min-width: 0; }
        .action-card-title { font-size: 14px; font-weight: 700; color: #f0ede8; margin-bottom: 2px; }
        .action-card-sub { font-size: 11px; color: #5a5650; }
        .my-qr-img {
          width: 48px; height: 48px;
          border-radius: 6px; flex-shrink: 0;
        }

        /* ── BOTTOM NAV ── */
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 430px;
          display: flex;
          align-items: stretch;
          background: rgba(10,10,15,0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-top: 1px solid rgba(255,255,255,0.07);
          padding: 8px 0;
          padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
          z-index: 50;
        }
        .bn-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 4px 0;
          background: none;
          border: none;
          cursor: pointer;
          color: #3a3a4a;
          font-family: 'Noto Sans JP', sans-serif;
          transition: color .15s;
        }
        .bn-item:active { opacity: .7; }
        .bn-icon {
          display: flex; align-items: center; justify-content: center;
        }
        .bn-label {
          font-size: 10px;
          letter-spacing: .02em;
        }
        .bn-active { color: #7b9e87; cursor: default; }

        /* ── QUICK MEMO ── */
        /* ── QR SHEET ── */
        .qr-sheet-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: flex-end; justify-content: center;
        }
        .qr-sheet {
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 20px 20px 0 0;
          padding: 20px 16px calc(20px + env(safe-area-inset-bottom));
          width: 100%; max-width: 430px;
          display: flex; flex-direction: column; gap: 10px;
        }
        .qr-sheet-title {
          font-size: 13px; color: #5a5a7a;
          font-family: 'DM Mono', monospace;
          letter-spacing: .06em; text-align: center;
          margin-bottom: 4px;
        }
        .qr-sheet-option {
          display: flex; align-items: center; gap: 14px;
          background: #1a1a24; border: 1px solid #1e1e2a;
          border-radius: 14px; padding: 14px 16px;
          cursor: pointer; text-align: left; width: 100%;
        }
        .qr-sheet-option:active { background: #22222e; }
        .qr-sheet-myqr { cursor: default; }
        .qr-sheet-option-icon {
          width: 44px; height: 44px; border-radius: 12px;
          background: #0d0d14; border: 1px solid #2a2a3a;
          display: flex; align-items: center; justify-content: center;
          color: #7b9e87; flex-shrink: 0;
        }
        .qr-sheet-option-text { flex: 1; }
        .qr-sheet-option-title { font-size: 15px; font-weight: 600; color: #f0ede8; margin-bottom: 2px; }
        .qr-sheet-option-sub { font-size: 11px; color: #5a5a7a; }
        .qr-sheet-cancel {
          margin-top: 4px; padding: 14px;
          background: #1a1a24; border: 1px solid #1e1e2a;
          border-radius: 14px; color: #6a6a8a;
          font-size: 15px; cursor: pointer; width: 100%;
        }
        .qr-sheet-cancel:active { background: #22222e; }



        /* ── QUICK MEMO ── */
        .quick-memo-wrap {
          margin-bottom: 4px;
        }
        .quick-memo-label {
          display: block;
          font-size: 11px;
          color: #5a5650;
          letter-spacing: .06em;
          font-family: 'DM Mono', monospace;
          margin-bottom: 6px;
        }
        .quick-memo-input {
          width: 100%;
          padding: 10px 12px;
          background: #0d0d14;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          color: #f0ede8;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          line-height: 1.6;
          resize: none;
          outline: none;
          transition: border-color .15s;
        }
        .quick-memo-input:focus { border-color: #7b9e87; }
        .quick-memo-input::placeholder { color: #3a3a4a; }

        /* ── CONFIRM EDITABLE FIELDS ── */
        .confirm-edit-name {
          background: transparent;
          border: none;
          border-bottom: 1px solid #2a2a3a;
          color: #f0ede8;
          font-size: 17px;
          font-weight: 700;
          font-family: 'DM Sans', sans-serif;
          width: 100%;
          padding: 2px 0 4px;
          margin-bottom: 6px;
          outline: none;
          display: block;
        }
        .confirm-edit-name:focus { border-bottom-color: #7b9e87; }
        .confirm-edit-meta {
          background: transparent;
          border: none;
          border-bottom: 1px solid #1e1e2a;
          color: rgba(240,237,232,0.6);
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          width: 100%;
          padding: 2px 0 3px;
          margin-bottom: 4px;
          outline: none;
          display: block;
        }
        .confirm-edit-meta:focus { border-bottom-color: #7b9e87; color: #f0ede8; }
        .confirm-edit-meta::placeholder { color: #3a3a4a; }
        .confirm-edit-name::placeholder { color: #3a3a4a; }

        /* ── CONFIRM MEMO ── */
        .confirm-memo {
          display: flex;
          flex-direction: column;
          gap: 4px;
          background: rgba(123,158,135,0.08);
          border: 1px solid rgba(123,158,135,0.2);
          border-radius: 10px;
          padding: 10px 14px;
          margin-bottom: 4px;
        }
        .confirm-memo-label {
          font-size: 11px;
          color: #7b9e87;
          font-family: 'DM Mono', monospace;
          letter-spacing: .06em;
        }
        .confirm-memo-text {
          font-size: 14px;
          color: rgba(240,237,232,0.8);
          line-height: 1.5;
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
