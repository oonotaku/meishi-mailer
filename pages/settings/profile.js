import { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { supabase } from '../../lib/supabase'
import { useRequireAuth } from '../../lib/useRequireAuth'
import { SNS_CONFIG, PRESET_CATEGORIES } from '../../lib/snsConfig'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.src = url
  })
}

const SCAN_SNS_MAP = {
  line:      'sns_line',
  whatsapp:  'sns_whatsapp',
  instagram: 'sns_instagram',
  x:         'sns_x',
  facebook:  'sns_facebook',
  linkedin:  'sns_linkedin',
  github:    'sns_github',
  youtube:   'sns_youtube',
  tiktok:    'sns_tiktok',
  note:      'sns_note',
  wantedly:  'sns_wantedly',
}

function SortableAffiliationItem({ item, onDelete, onChange }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  return (
    <div ref={setNodeRef} style={style} className="affiliation-item">
      <span className="drag-handle" {...attributes} {...listeners}>⠿</span>
      <div className="affiliation-inputs">
        <input type="text" value={item.company_name}
          onChange={e => onChange(item.id, 'company_name', e.target.value)}
          placeholder="会社名・団体名" maxLength={100} />
        <input type="text" value={item.title || ''}
          onChange={e => onChange(item.id, 'title', e.target.value)}
          placeholder="肩書き・役職（任意）"
          maxLength={100} />
      </div>
      <button type="button" className="affil-delete-btn" onClick={() => onDelete(item.id)}>✕</button>
    </div>
  )
}


export default function ProfileSettings() {
  const { t, i18n } = useTranslation('common')
  const { user, profile, loading: authLoading } = useRequireAuth()
  const [provider, setProvider] = useState(null)
  const [savedProvider, setSavedProvider] = useState(null)
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
  const [bio, setBio] = useState('')
  const [nameEdit, setNameEdit] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [nameSaving, setNameSaving] = useState(false)
  const [nameMsg, setNameMsg] = useState(null)
  const [gmailEmail, setGmailEmail] = useState(null)
  const [gmailDisconnecting, setGmailDisconnecting] = useState(false)
  const [billingLoading, setBillingLoading] = useState(false)
  const [upgradeMsg, setUpgradeMsg] = useState(null)
  const [snsValues, setSnsValues] = useState({})
  const [snsSaving, setSnsSaving] = useState(false)
  const [snsMsg, setSnsMsg] = useState(null)
  const [presetTab, setPresetTab] = useState('business')
  const [expandedSns, setExpandedSns] = useState({})
  const [activeTab, setActiveTab] = useState('profile_tab')
  const [affiliations, setAffiliations] = useState([])
  const [affilSaving, setAffilSaving] = useState(false)
  const qrFileRef = useRef(null)
  const cardFileRef = useRef(null)
  const personalRef = useRef(null)
  const businessRef = useRef(null)
  const cardappRef = useRef(null)
  const [qrTarget, setQrTarget] = useState(null)
  const [scanStep, setScanStep] = useState('idle')
  const [scanResult, setScanResult] = useState(null)
  const [scanName, setScanName] = useState('')
  const [scanCompany, setScanCompany] = useState('')
  const [scanTitle, setScanTitle] = useState('')
  const [scanPhone, setScanPhone] = useState('')
  const [scanWebsite, setScanWebsite] = useState('')
  const [scanContactEmail, setScanContactEmail] = useState('')
  const [scanShowPhone, setScanShowPhone] = useState(false)
  const [scanShowWebsite, setScanShowWebsite] = useState(true)
  const [scanShowEmail, setScanShowEmail] = useState(false)
  const [scanSnsChecked, setScanSnsChecked] = useState({})
  const [scanSaving, setScanSaving] = useState(false)
  const [scanError, setScanError] = useState(null)
  const [phone, setPhone] = useState('')
  const [website, setWebsite] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [showPhone, setShowPhone] = useState(false)
  const [showWebsite, setShowWebsite] = useState(true)
  const [showEmail, setShowEmail] = useState(false)
  const [contactSaving, setContactSaving] = useState(false)
  const [contactMsg, setContactMsg] = useState(null)
  const [affilMsg, setAffilMsg] = useState(null)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const router = useRouter()

  useEffect(() => {
    if (profile !== null && localName === null) {
      setLocalName(profile?.name || '')
      setBio(profile?.bio || '')
      setPhone(profile?.phone || '')
      setWebsite(profile?.website || '')
      setContactEmail(profile?.contact_email || '')
      setShowPhone(profile?.show_phone ?? false)
      setShowWebsite(profile?.show_website ?? true)
      setShowEmail(profile?.show_email ?? false)
    }
    if (profile !== null && Object.keys(snsValues).length === 0) {
      const initial = {}
      SNS_CONFIG.forEach(f => {
        const raw = profile?.[f.key] || ''
        if (f.inputMode === 'username' && f.baseUrl && raw.startsWith(f.baseUrl)) {
          initial[f.key] = raw.slice(f.baseUrl.length)
        } else {
          initial[f.key] = raw
        }
      })
      setSnsValues(initial)
    }
    if (profile !== null && provider === null) {
      setProvider(profile?.smtp_provider || 'sendgrid')
      setSavedProvider(profile?.smtp_provider || 'sendgrid')
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

  useEffect(() => {
    if (!user) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch('/api/profile/affiliations', {
        headers: { Authorization: `Bearer ${session.access_token}` }
      }).then(r => r.json()).then(data => {
        if (data.affiliations) setAffiliations(data.affiliations)
      })
    })
  }, [user])

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
        body: JSON.stringify({ name: trimmed, bio: bio.trim() }),
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

  const currentProvider = savedProvider || profile?.smtp_provider || 'sendgrid'
  const isConfigured = currentProvider === 'gmail'
    ? !!profile?.gmail_email
    : (currentProvider === 'sendgrid'
      ? !!profile?.sender_email
      : !!profile?.sender_email && !!profile?.smtp_host)

  async function handleGmailConnect() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const oauthUrl = `/api/auth/gmail/connect?token=${encodeURIComponent(session.access_token)}`
    const w = 600, h = 700
    const left = Math.round(window.screenX + (window.outerWidth - w) / 2)
    const top = Math.round(window.screenY + (window.outerHeight - h) / 2)
    const popup = window.open(oauthUrl, 'gmail-oauth', `width=${w},height=${h},left=${left},top=${top}`)

    if (!popup) {
      window.location.href = oauthUrl
      return
    }

    const handler = (event) => {
      if (event.data?.type !== 'gmail-oauth') return
      window.removeEventListener('message', handler)
      clearInterval(pollTimer)

      if (event.data.status === 'connected') {
        setGmailEmail(event.data.email)
        setProvider('gmail')
        setSavedProvider('gmail')
        setMsg({ ok: true, text: t('profile.gmail_connect_success') })
      } else {
        setMsg({ ok: false, text: t('profile.gmail_connect_error') })
      }
    }
    window.addEventListener('message', handler)

    const pollTimer = setInterval(() => {
      if (popup.closed) {
        clearInterval(pollTimer)
        window.removeEventListener('message', handler)
      }
    }, 1000)
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
      setSavedProvider(normalizedProvider)
      setMsg({ ok: true, text: t('profile.saved') })
      setApiKey('')
      setSmtpPassword('')
    } catch (err) {
      setMsg({ ok: false, text: err.message })
    } finally {
      setSaving(false)
    }
  }

  function handleDragEnd(event) {
    const { active, over } = event
    if (active.id !== over?.id) {
      setAffiliations(items => {
        const oldIndex = items.findIndex(i => i.id === active.id)
        const newIndex = items.findIndex(i => i.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  function addAffiliation() {
    if (affiliations.length >= 5) return
    setAffiliations(prev => [...prev, { id: `new-${Date.now()}`, company_name: '', title: '' }])
  }

  function changeAffiliation(id, field, value) {
    setAffiliations(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a))
  }

  function deleteAffiliation(id) {
    setAffiliations(prev => prev.filter(a => a.id !== id))
  }

  async function handleAffilSave() {
    const valid = affiliations.filter(a => a.company_name.trim())
    setAffilSaving(true)
    setAffilMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/profile/affiliations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ affiliations: valid.map((a, i) => ({
          company_name: a.company_name.trim(),
          title: a.title?.trim() || null,
          order_index: i
        })) })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setAffilMsg({ ok: true, text: t('profile.saved') })
      setTimeout(() => setAffilMsg(null), 2500)
    } catch (err) {
      setAffilMsg({ ok: false, text: err.message })
    } finally {
      setAffilSaving(false)
    }
  }

  async function handleQrScan(e) {
    const file = e.target.files?.[0]
    if (!file || !qrTarget) return
    e.target.value = ''

    const jsQR = (await import('jsqr')).default
    const img = new Image()
    img.src = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      if (code?.data) {
        setSnsValues(prev => ({ ...prev, [qrTarget]: code.data }))
      } else {
        alert(t('sns.qr_error'))
      }
      URL.revokeObjectURL(img.src)
    }
  }

  async function handleSnsSave(e) {
    e.preventDefault()
    setSnsSaving(true)
    setSnsMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/profile/update-sns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify((() => {
          const snsPayload = {}
          SNS_CONFIG.forEach(f => {
            const val = snsValues[f.key]?.trim() || ''
            snsPayload[f.key] = (f.inputMode === 'username' && f.baseUrl && val) ? f.baseUrl + val : val
          })
          return snsPayload
        })()),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setSnsMsg({ ok: true, text: t('profile.saved') })
      setTimeout(() => setSnsMsg(null), 2500)
    } catch (err) {
      setSnsMsg({ ok: false, text: err.message })
    } finally {
      setSnsSaving(false)
    }
  }

  async function handleContactSave() {
    setContactSaving(true)
    setContactMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/profile/update-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          phone: phone.trim() || null,
          website: website.trim() || null,
          contact_email: contactEmail.trim() || null,
          show_phone: showPhone,
          show_website: showWebsite,
          show_email: showEmail,
        }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setContactMsg({ ok: true, text: t('profile.saved') })
      setTimeout(() => setContactMsg(null), 2500)
    } catch (err) {
      setContactMsg({ ok: false, text: err.message })
    } finally {
      setContactSaving(false)
    }
  }

  async function handleCardFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setScanError(null)
    setScanStep('analyzing')
    try {
      const dataUrl = await compressImage(file)
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/profile/scan-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ imageBase64: dataUrl.split(',')[1] }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)

      setScanResult(data)
      setScanName(data.name || '')
      setScanCompany(data.company || '')
      setScanTitle(data.title || '')
      setScanPhone(data.phones?.[0] || '')
      setScanWebsite(data.website || '')
      setScanContactEmail(data.email || '')
      setScanShowPhone(false)
      setScanShowWebsite(true)
      setScanShowEmail(false)

      const checked = {}
      if (data.sns) {
        Object.entries(SCAN_SNS_MAP).forEach(([cat, snsKey]) => {
          if (data.sns[cat] && !snsValues[snsKey]) checked[cat] = true
        })
      }
      setScanSnsChecked(checked)
      setScanStep('confirm')
    } catch {
      setScanError('読み取れませんでした。手動で入力してください。')
      setScanStep('idle')
    }
  }

  async function handleScanSave() {
    setScanSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session.access_token

      if (scanName.trim()) {
        await fetch('/api/profile/update-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: scanName.trim(), bio: profile?.bio || '' }),
        })
        setLocalName(scanName.trim())
      }

      if (scanCompany.trim()) {
        const newEntry = { company_name: scanCompany.trim(), title: scanTitle.trim() || null, order_index: 0 }
        const rest = affiliations
          .filter(a => a.company_name?.trim())
          .map((a, i) => ({ company_name: a.company_name, title: a.title || null, order_index: i + 1 }))
        const merged = [newEntry, ...rest].slice(0, 5)
        await fetch('/api/profile/affiliations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ affiliations: merged }),
        })
        setAffiliations(merged.map((a, i) => ({ ...a, id: `scanned-${i}` })))
      }

      await fetch('/api/profile/update-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          phone: scanPhone.trim() || null,
          website: scanWebsite.trim() || null,
          contact_email: scanContactEmail.trim() || null,
          show_phone: scanShowPhone,
          show_website: scanShowWebsite,
          show_email: scanShowEmail,
        }),
      })
      setPhone(scanPhone.trim())
      setWebsite(scanWebsite.trim())
      setContactEmail(scanContactEmail.trim())
      setShowPhone(scanShowPhone)
      setShowWebsite(scanShowWebsite)
      setShowEmail(scanShowEmail)

      const hasSns = scanResult?.sns && Object.entries(SCAN_SNS_MAP).some(([cat]) => scanSnsChecked[cat] && scanResult.sns[cat])
      if (hasSns) {
        const next = { ...snsValues }
        Object.entries(SCAN_SNS_MAP).forEach(([cat, snsKey]) => {
          if (!scanSnsChecked[cat] || !scanResult.sns[cat]) return
          const raw = scanResult.sns[cat].trim().replace(/^@/, '')
          const cfg = SNS_CONFIG.find(f => f.key === snsKey)
          if (!cfg) return
          next[snsKey] = (cfg.inputMode === 'username' && cfg.baseUrl && raw.startsWith(cfg.baseUrl))
            ? raw.slice(cfg.baseUrl.length) : raw
        })
        const snsPayload = {}
        SNS_CONFIG.forEach(f => {
          const val = next[f.key]?.trim() || ''
          snsPayload[f.key] = (f.inputMode === 'username' && f.baseUrl && val) ? f.baseUrl + val : val
        })
        await fetch('/api/profile/update-sns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(snsPayload),
        })
        setSnsValues(next)
      }

      setScanStep('idle')
      setScanResult(null)
    } catch (err) {
      setScanError(err.message)
      setScanStep('idle')
    } finally {
      setScanSaving(false)
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
                <div className="field-group" style={{ marginTop: 16 }}>
                  <div className="field-label">一言コメント</div>
                  <textarea
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder="例：営業歴10年。出会いを大切にしています。"
                    maxLength={100}
                    rows={2}
                    className="text-input bio-textarea"
                  />
                  <div className="char-count">{bio.length} / 100</div>
                </div>
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

            <input
              ref={cardFileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleCardFile}
            />

            <button
              type="button"
              className={`card-scan-btn ${scanStep === 'analyzing' ? 'scanning' : ''}`}
              onClick={() => { if (scanStep === 'idle') { setScanError(null); cardFileRef.current?.click() } }}
              disabled={scanStep === 'analyzing'}
            >
              {scanStep === 'analyzing' ? (
                <><span className="card-scan-spinner" />名刺を読み取っています...</>
              ) : '📷 名刺からプロフィールを入力'}
            </button>

            {scanError && scanStep === 'idle' && (
              <div className="scan-error-msg">{scanError}</div>
            )}
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

          <div className="tab-bar">
            {[
              { key: 'profile_tab', label: 'プロフィール' },
              { key: 'sns',         label: 'SNS' },
              { key: 'email',       label: t('profile.tab_email') },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'email' && (
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
                  const effective = savedProvider || profile?.smtp_provider || 'sendgrid'
                  const isCurrentProvider =
                    effective === p ||
                    (effective === 'other' && p === 'custom')
                  return (
                    <button
                      key={p}
                      type="button"
                      className={`provider-tab ${normalizedProvider === p ? 'active' : ''}`}
                      onClick={() => { setProvider(p); setMsg(null) }}
                    >
                      {t(`profile.provider_${p}`)}
                      {isCurrentProvider && (
                        <span className="in-use-badge">{t('profile.in_use')}</span>
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
          )}

          {activeTab === 'sns' && (
            <div className="section">
              {/* プリセットプレビューパネル */}
              <div className="preset-panel">
                <div className="preset-panel-header">
                  <span className="section-label">プレビュー</span>
                  <div className="preset-tabs">
                    {[
                      { key: 'business', label: 'ビジネス' },
                      { key: 'personal', label: '個人' },
                      { key: 'all',      label: 'すべて' },
                    ].map(p => (
                      <button key={p.key} type="button"
                        className={`preset-tab-btn ${presetTab === p.key ? 'active' : ''}`}
                        onClick={() => setPresetTab(p.key)}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="preset-icons">
                  {SNS_CONFIG
                    .filter(f => PRESET_CATEGORIES[presetTab].includes(f.category))
                    .map(f => {
                      const isSet = !!snsValues[f.key]
                      const sectionRef = f.category === 'personal' ? personalRef : f.category === 'business' ? businessRef : cardappRef
                      return (
                        <button key={f.key} type="button"
                          className={`preset-icon-btn ${isSet ? 'set' : 'unset'}`}
                          title={isSet ? f.label : `${f.label}（未設定）`}
                          onClick={() => {
                            if (!isSet) {
                              setExpandedSns(prev => ({ ...prev, [f.key]: true }))
                              setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                            }
                          }}>
                          {f.icon ? (
                            <img
                              src={`https://cdn.simpleicons.org/${f.icon}/${isSet ? f.color.replace('#','') : '3a3a4a'}`}
                              width="18" height="18" alt={f.label}
                              style={{ display: 'block' }}
                              onError={e => { e.target.style.display = 'none' }}
                            />
                          ) : (
                            <span className="preset-icon-text" style={{ color: isSet ? f.color : '#3a3a4a' }}>
                              {f.label[0]}
                            </span>
                          )}
                        </button>
                      )
                    })}
                </div>
                <p className="preset-hint">
                  {presetTab === 'business' ? 'ビジネス相手に共有されるSNSのプレビュー' :
                   presetTab === 'personal' ? '個人として共有されるSNSのプレビュー' :
                   'すべてのSNSが相手に表示されます'}
                  {' · '}グレー = 未設定（タップして追加）
                </p>
              </div>

              <input ref={qrFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleQrScan} />

              {/* カテゴリ別セクション */}
              {[
                { cat: 'personal', label: '個人でつながる',       ref: personalRef },
                { cat: 'business', label: 'ビジネス・クリエイター', ref: businessRef },
                { cat: 'cardapp',  label: '名刺管理アプリ',        ref: cardappRef },
              ].map(({ cat, label, ref }) => (
                <div key={cat} className="sns-category-section" ref={ref}>
                  <div className="sns-category-header">{label}</div>
                  {SNS_CONFIG.filter(f => f.category === cat).map(f => {
                    const val = snsValues[f.key] || ''
                    const isExpanded = !!expandedSns[f.key]
                    return (
                      <div key={f.key} className="sns-item">
                        <div className="sns-item-row">
                          <div className="sns-item-info">
                            {f.icon ? (
                              <img
                                src={`https://cdn.simpleicons.org/${f.icon}/${f.color.replace('#','')}`}
                                width="18" height="18" alt={f.label}
                                className="sns-item-icon"
                                onError={e => { e.target.style.display = 'none' }}
                              />
                            ) : (
                              <div className="sns-item-icon-fallback" style={{ background: f.color }}>
                                {f.label[0]}
                              </div>
                            )}
                            <div className="sns-item-meta">
                              <span className="sns-item-label">{f.label}</span>
                              {val && !isExpanded && (
                                <span className="sns-item-value-preview">
                                  {f.inputMode === 'username' ? `@${val}` : val}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={`sns-toggle-btn ${val ? 'edit' : 'add'}${isExpanded ? ' open' : ''}`}
                            onClick={() => setExpandedSns(prev => ({ ...prev, [f.key]: !prev[f.key] }))}
                          >
                            {isExpanded ? '閉じる' : val ? '編集' : '+ 追加'}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="sns-item-form">
                            {f.inputMode === 'qr' && (
                              <div>
                                <button type="button" className="qr-scan-btn"
                                  onClick={() => { setQrTarget(f.key); setTimeout(() => qrFileRef.current?.click(), 50) }}>
                                  {val ? t('sns.qr_update') : t('sns.qr_scan')}
                                </button>
                                {val && (
                                  <button type="button" className="qr-clear-btn"
                                    onClick={() => setSnsValues(prev => ({ ...prev, [f.key]: '' }))}>
                                    {t('sns.qr_delete')}
                                  </button>
                                )}
                              </div>
                            )}
                            {f.inputMode === 'username' && (
                              <div>
                                <div className="username-input-wrap">
                                  <span className="username-prefix">{f.prefix}</span>
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={e => setSnsValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                                    placeholder="username"
                                    autoFocus
                                    className={`username-input ${val ? 'sns-input-active' : ''}`}
                                  />
                                </div>
                                {f.helpUrl && (
                                  <a href={f.helpUrl} target="_blank" rel="noopener noreferrer" className="sns-help-link">
                                    ↗ {f.label}を確認
                                  </a>
                                )}
                              </div>
                            )}
                            {f.inputMode === 'url' && (
                              <div>
                                <input
                                  type="url"
                                  value={val}
                                  onChange={e => setSnsValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                                  placeholder={f.placeholder || 'https://...'}
                                  autoFocus
                                  className={`text-input ${val ? 'sns-input-active' : ''}`}
                                />
                                {f.helpUrl && (
                                  <a href={f.helpUrl} target="_blank" rel="noopener noreferrer" className="sns-help-link">
                                    ↗ {f.label}を確認
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}

              {snsMsg && (
                <div className={`msg ${snsMsg.ok ? 'success' : 'error'}`} style={{ marginBottom: 12 }}>{snsMsg.text}</div>
              )}

              <button type="button" className="save-btn" onClick={handleSnsSave} disabled={snsSaving}>
                {snsSaving ? t('profile.saving') : t('profile.save')}
              </button>
            </div>
          )}

          {activeTab === 'profile_tab' && (
            <div className="section">

              {/* ── 所属 ── */}
              <div className="section-header">
                <div className="section-label">{t('profile.tab_affiliation')}</div>
                <span className={`config-badge ${affiliations.length > 0 ? 'configured' : 'unconfigured'}`}>
                  {affiliations.length > 0 ? t('profile.affil_count', { count: affiliations.length }) : t('profile.unconfigured')}
                </span>
              </div>
              <p className="desc" style={{ marginBottom: 14 }}>{t('profile.affil_desc')}</p>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={affiliations.map(a => a.id)} strategy={verticalListSortingStrategy}>
                  {affiliations.map(item => (
                    <SortableAffiliationItem
                      key={item.id}
                      item={item}
                      onDelete={deleteAffiliation}
                      onChange={changeAffiliation}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              {affiliations.length < 5 && (
                <button type="button" className="add-affil-btn" onClick={addAffiliation}>
                  {t('profile.affil_add')}
                </button>
              )}

              {affilMsg && (
                <div className={`msg ${affilMsg.ok ? 'success' : 'error'}`}>{affilMsg.text}</div>
              )}

              <button type="button" className="save-btn" style={{ marginTop: 14 }} onClick={handleAffilSave} disabled={affilSaving}>
                {affilSaving ? '保存中...' : '保存する'}
              </button>

              <div className="section-divider" />

              {/* ── 連絡先情報 ── */}
              <div className="section-header">
                <div className="section-label">連絡先情報</div>
                <span className="desc" style={{ fontSize: 11, margin: 0 }}>公開プロフィールへの表示設定</span>
              </div>

              <div className="contact-field">
                <div className="contact-field-top">
                  <label className="field-label">電話番号</label>
                  <label className="toggle-label">
                    <input type="checkbox" className="toggle-check" checked={showPhone} onChange={e => setShowPhone(e.target.checked)} />
                    <span className="toggle-track"><span className="toggle-thumb" /></span>
                    <span className="toggle-text">{showPhone ? '公開' : '非公開'}</span>
                  </label>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="090-0000-0000"
                  className="text-input"
                />
              </div>

              <div className="contact-field">
                <div className="contact-field-top">
                  <label className="field-label">ウェブサイト</label>
                  <label className="toggle-label">
                    <input type="checkbox" className="toggle-check" checked={showWebsite} onChange={e => setShowWebsite(e.target.checked)} />
                    <span className="toggle-track"><span className="toggle-thumb" /></span>
                    <span className="toggle-text">{showWebsite ? '公開' : '非公開'}</span>
                  </label>
                </div>
                <input
                  type="url"
                  value={website}
                  onChange={e => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="text-input"
                />
              </div>

              <div className="contact-field">
                <div className="contact-field-top">
                  <label className="field-label">連絡先メール</label>
                  <label className="toggle-label">
                    <input type="checkbox" className="toggle-check" checked={showEmail} onChange={e => setShowEmail(e.target.checked)} />
                    <span className="toggle-track"><span className="toggle-thumb" /></span>
                    <span className="toggle-text">{showEmail ? '公開' : '非公開'}</span>
                  </label>
                </div>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  placeholder="info@example.com"
                  className="text-input"
                />
              </div>

              {contactMsg && (
                <div className={`msg ${contactMsg.ok ? 'success' : 'error'}`}>{contactMsg.text}</div>
              )}

              <button type="button" className="save-btn" style={{ marginTop: 14 }} onClick={handleContactSave} disabled={contactSaving}>
                {contactSaving ? '保存中...' : '保存する'}
              </button>

              <div className="section-divider" />

              {/* ── 署名プレビュー ── */}
              <div className="sig-preview-wrap">
                <div className="section-label" style={{ marginBottom: '12px' }}>{t('profile.sig_preview_title')}</div>
                <p className="sig-preview-desc">{t('profile.sig_preview_desc')}</p>
                <div className="sig-preview-box">
                  <hr style={{ border: 'none', borderTop: '1px solid #e5e5e5', margin: '0 0 16px 0' }} />
                  <table cellPadding="0" cellSpacing="0" border="0">
                    <tbody>
                      <tr>
                        <td style={{ paddingRight: '16px', verticalAlign: 'top' }}>
                          <a href={`https://www.meishi-mailer.com/p/${user?.id}`} target="_blank" rel="noreferrer">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(`https://www.meishi-mailer.com/p/${user?.id}`)}&bgcolor=ffffff&color=000000&margin=2`}
                              width="100" height="100"
                              alt="Profile QR"
                              style={{ display: 'block', border: 0 }}
                            />
                          </a>
                          <div style={{ fontSize: '10px', color: '#999', textAlign: 'center', marginTop: '4px' }}>{t('profile.open_profile')}</div>
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          {(localName || profile?.name) && (
                            <strong style={{ fontSize: '14px', color: '#333' }}>{localName || profile?.name}</strong>
                          )}
                          {affiliations[0]?.company_name && (
                            <div style={{ color: '#555', fontSize: '12px', marginTop: '4px' }}>{affiliations[0].company_name}</div>
                          )}
                          {affiliations[0]?.title && (
                            <div style={{ color: '#777', fontSize: '12px' }}>{affiliations[0].title}</div>
                          )}
                          <div style={{ marginTop: '6px', fontSize: '11px' }}>
                            <a href={`https://www.meishi-mailer.com/p/${user?.id}`} style={{ color: '#aaa', textDecoration: 'none' }} target="_blank" rel="noreferrer">
                              {`https://www.meishi-mailer.com/p/${user?.id}`}
                            </a>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
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

      {/* ── 名刺スキャン確認オーバーレイ ── */}
      {scanStep === 'confirm' && scanResult && (
        <div className="scan-overlay">
          <div className="scan-sheet">
            <div className="scan-sheet-header">
              <span className="scan-sheet-title">名刺から読み取った情報</span>
              <button type="button" className="scan-sheet-close" onClick={() => setScanStep('idle')}>✕</button>
            </div>

            <div className="scan-sheet-body">
              <div className="scan-field-group">
                <label className="scan-field-label">名前</label>
                <input
                  type="text"
                  value={scanName}
                  onChange={e => setScanName(e.target.value)}
                  className="scan-field-input"
                  placeholder="氏名"
                />
              </div>
              <div className="scan-field-group">
                <label className="scan-field-label">会社</label>
                <input
                  type="text"
                  value={scanCompany}
                  onChange={e => setScanCompany(e.target.value)}
                  className="scan-field-input"
                  placeholder="会社名"
                />
              </div>
              <div className="scan-field-group">
                <label className="scan-field-label">肩書き</label>
                <input
                  type="text"
                  value={scanTitle}
                  onChange={e => setScanTitle(e.target.value)}
                  className="scan-field-input"
                  placeholder="役職・肩書き"
                />
              </div>

              <div className="scan-section-divider" />
              <div className="scan-field-label" style={{ marginBottom: 12 }}>連絡先情報</div>

              <div className="scan-field-group">
                <div className="scan-contact-row">
                  <label className="scan-field-label">電話番号</label>
                  <label className="toggle-label">
                    <input type="checkbox" className="toggle-check" checked={scanShowPhone} onChange={e => setScanShowPhone(e.target.checked)} />
                    <span className="toggle-track"><span className="toggle-thumb" /></span>
                    <span className="toggle-text">{scanShowPhone ? '公開' : '非公開'}</span>
                  </label>
                </div>
                <input
                  type="tel"
                  value={scanPhone}
                  onChange={e => setScanPhone(e.target.value)}
                  className="scan-field-input"
                  placeholder="090-0000-0000"
                />
              </div>

              <div className="scan-field-group">
                <div className="scan-contact-row">
                  <label className="scan-field-label">ウェブサイト</label>
                  <label className="toggle-label">
                    <input type="checkbox" className="toggle-check" checked={scanShowWebsite} onChange={e => setScanShowWebsite(e.target.checked)} />
                    <span className="toggle-track"><span className="toggle-thumb" /></span>
                    <span className="toggle-text">{scanShowWebsite ? '公開' : '非公開'}</span>
                  </label>
                </div>
                <input
                  type="url"
                  value={scanWebsite}
                  onChange={e => setScanWebsite(e.target.value)}
                  className="scan-field-input"
                  placeholder="https://example.com"
                />
              </div>

              <div className="scan-field-group">
                <div className="scan-contact-row">
                  <label className="scan-field-label">連絡先メール</label>
                  <label className="toggle-label">
                    <input type="checkbox" className="toggle-check" checked={scanShowEmail} onChange={e => setScanShowEmail(e.target.checked)} />
                    <span className="toggle-track"><span className="toggle-thumb" /></span>
                    <span className="toggle-text">{scanShowEmail ? '公開' : '非公開'}</span>
                  </label>
                </div>
                <input
                  type="email"
                  value={scanContactEmail}
                  onChange={e => setScanContactEmail(e.target.value)}
                  className="scan-field-input"
                  placeholder="info@example.com"
                />
              </div>

              <div className="scan-section-divider" />

              {(() => {
                const found = Object.entries(SCAN_SNS_MAP).filter(([cat]) => scanResult.sns?.[cat])
                if (found.length === 0) return null
                return (
                  <div className="scan-sns-section">
                    <div className="scan-field-label" style={{ marginBottom: 10 }}>名刺で見つかったSNS</div>
                    {found.map(([cat, snsKey]) => {
                      const isRegistered = !!snsValues[snsKey]
                      const raw = scanResult.sns[cat]
                      const cfg = SNS_CONFIG.find(f => f.key === snsKey)
                      return (
                        <label key={cat} className={`scan-sns-row ${isRegistered ? 'registered' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isRegistered ? false : !!scanSnsChecked[cat]}
                            disabled={isRegistered}
                            onChange={e => setScanSnsChecked(prev => ({ ...prev, [cat]: e.target.checked }))}
                            className="scan-sns-check"
                          />
                          <div className="scan-sns-info">
                            <span className="scan-sns-label">{cfg?.label || cat}</span>
                            <span className="scan-sns-value">{raw.replace(/^@/, '')}</span>
                          </div>
                          {isRegistered && <span className="scan-registered-tag">登録済み</span>}
                        </label>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            <div className="scan-sheet-actions">
              <button
                type="button"
                className="save-btn"
                onClick={handleScanSave}
                disabled={scanSaving}
              >
                {scanSaving ? '保存中...' : 'プロフィールに保存'}
              </button>
              <button
                type="button"
                className="name-cancel-btn"
                onClick={() => setScanStep('idle')}
                disabled={scanSaving}
                style={{ marginTop: 10 }}
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0a0a0f; color: #f0ede8; font-family: 'Noto Sans JP', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .affiliation-inputs {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .affiliation-inputs input {
          width: 100%;
          padding: 11px 14px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          color: #f0ede8;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          outline: none;
          box-sizing: border-box;
        }
        .affiliation-inputs input:focus {
          border-color: #7b9e87;
        }
        .affiliation-inputs input::placeholder {
          color: #3a3a4a;
        }
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
        .affiliation-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-bottom: 12px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          padding: 10px 12px;
        }
        .drag-handle {
          color: #3a3a4a;
          cursor: grab;
          font-size: 18px;
          padding-top: 10px;
          flex-shrink: 0;
          user-select: none;
          letter-spacing: -2px;
        }
        .drag-handle:active { cursor: grabbing; }
        .affil-delete-btn {
          background: none;
          border: none;
          color: #4a4a5a;
          font-size: 14px;
          cursor: pointer;
          padding: 8px 4px;
          flex-shrink: 0;
          transition: color .15s;
        }
        .affil-delete-btn:hover { color: #c08080; }
        .add-affil-btn {
          width: 100%;
          padding: 11px;
          background: none;
          border: 1px dashed #2a2a3a;
          border-radius: 10px;
          color: #5a5650;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: border-color .15s, color .15s;
          margin-top: 4px;
        }
        .add-affil-btn:hover { border-color: #7b9e87; color: #7b9e87; }
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
        .tab-bar {
          display: flex;
          gap: 6px;
          padding: 1rem 1.5rem 0;
          border-bottom: 1px solid #1e1e2a;
          margin-bottom: 0;
        }
        .tab-btn {
          padding: 8px 16px;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          color: #5a5650;
          font-size: 13px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: color .15s, border-color .15s;
          margin-bottom: -1px;
        }
        .tab-btn:hover { color: #f0ede8; }
        .tab-btn.active {
          color: #7b9e87;
          border-bottom-color: #7b9e87;
        }
        .sns-registered-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 1.25rem;
          padding: 12px 14px;
          background: #0d1f15;
          border: 1px solid #1a3525;
          border-radius: 10px;
        }
        .sns-registered-pill {
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          color: #7b9e87;
        }
        .sns-empty-hint {
          font-size: 13px;
          color: #3a3a4a;
          margin-bottom: 1.25rem;
        }
        .sns-set-badge {
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          padding: 2px 7px;
          border-radius: 999px;
          background: #0d1f15;
          color: #7b9e87;
          border: 1px solid #1a3525;
        }
        .sns-input-active {
          border-color: #2a4a35 !important;
        }
        .sns-field {
          margin-bottom: 16px;
        }
        .sns-field-label {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 13px;
          color: #a0a0b0;
          font-weight: 500;
        }
        .qr-scan-btn {
          width: 100%;
          padding: 14px;
          background: none;
          border: 1px dashed #2a2a3a;
          border-radius: 10px;
          color: #7b9e87;
          font-size: 13px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: border-color .15s, background .15s;
          text-align: center;
        }
        .qr-scan-btn:hover {
          border-color: #7b9e87;
          background: #0d1f15;
        }
        .qr-clear-btn {
          margin-top: 6px;
          background: none;
          border: none;
          color: #4a4a5a;
          font-size: 12px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          padding: 4px 0;
          transition: color .15s;
        }
        .qr-clear-btn:hover { color: #c08080; }
        .username-input-wrap {
          display: flex;
          align-items: center;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          overflow: hidden;
        }
        .username-prefix {
          padding: 11px 10px 11px 14px;
          font-size: 12px;
          color: #5a5650;
          font-family: 'DM Mono', monospace;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .username-input {
          flex: 1;
          padding: 11px 14px 11px 0;
          background: transparent;
          border: none;
          color: #f0ede8;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          outline: none;
          min-width: 0;
        }
        .username-input::placeholder { color: #3a3a4a; }
        .username-input-wrap:focus-within {
          border-color: #7b9e87;
        }
        .sns-help-link {
          display: inline-block;
          margin-top: 5px;
          font-size: 11px;
          color: #5a5650;
          text-decoration: none;
          font-family: 'DM Mono', monospace;
          transition: color .15s;
        }
        .sns-help-link:hover { color: #7b9e87; }
        .bio-textarea {
          resize: none;
          line-height: 1.6;
        }
        .char-count {
          font-size: 11px;
          color: #3a3a4a;
          text-align: right;
          margin-top: 4px;
          font-family: 'DM Mono', monospace;
        }
        .sig-preview-wrap {
          margin-top: 28px;
          padding-top: 20px;
          border-top: 1px solid #1e1e2a;
        }
        .sig-preview-desc {
          font-size: 12px;
          color: #5a5650;
          margin-bottom: 16px;
        }
        .sig-preview-box {
          background: #ffffff;
          border-radius: 10px;
          padding: 16px;
          font-family: sans-serif;
          font-size: 13px;
          line-height: 1.7;
          color: #333;
        }

        /* ── 名刺スキャンボタン ── */
        .card-scan-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 20px;
          background: none;
          border: 1px dashed #2a4a35;
          border-radius: 10px;
          color: #7b9e87;
          font-size: 13px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: background .15s, border-color .15s;
          margin-top: 4px;
        }
        .card-scan-btn:hover:not(:disabled) { background: #0d1f15; border-color: #7b9e87; }
        .card-scan-btn.scanning { color: #5a5650; border-color: #1e1e2a; cursor: default; }
        @keyframes spin-btn { to { transform: rotate(360deg); } }
        .card-scan-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid #2a2a3a;
          border-top-color: #7b9e87;
          border-radius: 50%;
          animation: spin-btn .7s linear infinite;
          flex-shrink: 0;
        }
        .scan-error-msg {
          font-size: 12px;
          color: #c08080;
          background: #1a0a0a;
          border: 1px solid #2a1010;
          border-radius: 8px;
          padding: 8px 12px;
          text-align: center;
          margin-top: 4px;
        }

        /* ── 名刺スキャン確認オーバーレイ ── */
        .scan-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10,10,15,0.97);
          z-index: 200;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }
        .scan-sheet {
          max-width: 430px;
          width: 100%;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          min-height: 100%;
          padding: 0 0 2rem;
        }
        .scan-sheet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #1e1e2a;
          position: sticky;
          top: 0;
          background: rgba(10,10,15,0.97);
          z-index: 1;
        }
        .scan-sheet-title {
          font-size: 15px;
          font-weight: 700;
          color: #f0ede8;
        }
        .scan-sheet-close {
          background: none;
          border: none;
          color: #5a5650;
          font-size: 18px;
          cursor: pointer;
          padding: 4px 8px;
          transition: color .15s;
        }
        .scan-sheet-close:hover { color: #f0ede8; }
        .scan-sheet-body {
          flex: 1;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .scan-field-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .scan-field-label {
          font-size: 10px;
          letter-spacing: .1em;
          color: #5a5650;
          text-transform: uppercase;
          font-family: 'DM Mono', monospace;
        }
        .scan-field-input {
          width: 100%;
          padding: 11px 14px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          color: #f0ede8;
          font-size: 15px;
          font-weight: 500;
          font-family: 'Noto Sans JP', sans-serif;
          outline: none;
        }
        .scan-field-input:focus { border-color: #7b9e87; }
        .scan-field-input::placeholder { color: #3a3a4a; font-weight: 400; }
        .scan-sns-section {
          padding: 14px;
          background: #0d0d14;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
        }
        .scan-sns-row {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #0f0f18;
          cursor: pointer;
        }
        .scan-sns-row:last-child { border-bottom: none; }
        .scan-sns-row.registered { opacity: .45; cursor: default; }
        .scan-sns-check {
          width: 18px;
          height: 18px;
          accent-color: #7b9e87;
          flex-shrink: 0;
          cursor: pointer;
        }
        .scan-sns-row.registered .scan-sns-check { cursor: default; }
        .scan-sns-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .scan-sns-label {
          font-size: 13px;
          font-weight: 500;
          color: #f0ede8;
        }
        .scan-sns-value {
          font-size: 12px;
          color: #5a5650;
          font-family: 'DM Mono', monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .scan-registered-tag {
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          padding: 2px 7px;
          border-radius: 999px;
          background: #0d1f15;
          color: #7b9e87;
          border: 1px solid #1a3525;
          flex-shrink: 0;
        }
        .scan-sheet-actions {
          padding: 1rem 1.5rem 0;
          display: flex;
          flex-direction: column;
        }

        /* ── プリセットパネル ── */
        .preset-panel {
          background: #0d0d14;
          border: 1px solid #1e1e2a;
          border-radius: 12px;
          padding: 14px;
          margin-bottom: 24px;
        }
        .preset-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .preset-tabs {
          display: flex;
          gap: 4px;
        }
        .preset-tab-btn {
          padding: 4px 10px;
          background: none;
          border: 1px solid #1e1e2a;
          border-radius: 6px;
          color: #5a5650;
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          transition: color .15s, border-color .15s;
        }
        .preset-tab-btn.active {
          border-color: #7b9e87;
          color: #f0ede8;
        }
        .preset-tab-btn:hover:not(.active) { color: #f0ede8; }
        .preset-icons {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          min-height: 36px;
        }
        .preset-icon-btn {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid #1e1e2a;
          background: #12121a;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: border-color .15s, opacity .15s;
          padding: 0;
        }
        .preset-icon-btn.set { border-color: #2a4a35; }
        .preset-icon-btn.unset { opacity: .4; }
        .preset-icon-btn.unset:hover { opacity: .75; border-color: #7b9e87; }
        .preset-icon-text {
          font-size: 13px;
          font-weight: 700;
          font-family: 'DM Mono', monospace;
        }
        .preset-hint {
          font-size: 11px;
          color: #3a3a4a;
          margin-top: 10px;
          line-height: 1.5;
        }

        /* ── SNSカテゴリセクション ── */
        .sns-category-section {
          margin-bottom: 8px;
          scroll-margin-top: 80px;
        }
        .sns-category-header {
          font-size: 10px;
          letter-spacing: .1em;
          color: #3a3a4a;
          text-transform: uppercase;
          font-family: 'DM Mono', monospace;
          margin-bottom: 4px;
          padding: 16px 0 8px;
          border-bottom: 1px solid #1e1e2a;
        }
        .sns-item {
          border-bottom: 1px solid #0f0f18;
          padding: 10px 0;
        }
        .sns-item:last-child { border-bottom: none; }
        .sns-item-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }
        .sns-item-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 0;
        }
        .sns-item-icon {
          flex-shrink: 0;
          display: block;
        }
        .sns-item-icon-fallback {
          width: 18px;
          height: 18px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 700;
          font-family: 'DM Mono', monospace;
          color: #fff;
          flex-shrink: 0;
        }
        .sns-item-meta {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .sns-item-label {
          font-size: 14px;
          color: #f0ede8;
          font-weight: 500;
        }
        .sns-item-value-preview {
          font-size: 11px;
          color: #5a5650;
          font-family: 'DM Mono', monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 160px;
        }
        .sns-toggle-btn {
          flex-shrink: 0;
          padding: 5px 12px;
          border-radius: 6px;
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          transition: all .15s;
          border: 1px solid;
          white-space: nowrap;
        }
        .sns-toggle-btn.add {
          background: none;
          border-color: #2a2a3a;
          color: #5a5650;
        }
        .sns-toggle-btn.add:hover { border-color: #7b9e87; color: #7b9e87; }
        .sns-toggle-btn.edit {
          background: #0d1f15;
          border-color: #1a3525;
          color: #7b9e87;
        }
        .sns-toggle-btn.open {
          background: none;
          border-color: #2a2a3a;
          color: #5a5650;
        }
        .sns-item-form {
          margin-top: 10px;
          padding: 12px;
          background: #0d0d14;
          border-radius: 10px;
          border: 1px solid #1e1e2a;
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
