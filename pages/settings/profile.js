import React, { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { supabase } from '../../lib/supabase'
import { useRequireAuth } from '../../lib/useRequireAuth'
import { SNS_CONFIG, PRESET_CATEGORIES } from '../../lib/snsConfig'

const THEME_DEFS = [
  { id: 'dark',     bg: '#0a0a0a', card: '#1a1a1a', accent: '#22c55e', text: '#ffffff' },
  { id: 'light',    bg: '#f8f8f8', card: '#ffffff', accent: '#0070f3', text: '#111111' },
  { id: 'midnight', bg: '#0f172a', card: '#1e293b', accent: '#818cf8', text: '#e2e8f0' },
  { id: 'sunset',   bg: '#1a0800', card: '#2d1500', accent: '#f97316', text: '#fff7ed' },
  { id: 'sakura',   bg: '#fff0f3', card: '#ffffff', accent: '#f43f5e', text: '#1a1a1a' },
  { id: 'grape',    bg: '#130d1f', card: '#1e1035', accent: '#a855f7', text: '#f3e8ff' },
]
const TEXT_BG_PRESETS = ['#0a0a0a', '#ffffff', '#0f172a', '#1c1410', '#fff0f3', '#0c1a2e']

function renderText(text) {
  if (!text) return null
  return (
    <span dangerouslySetInnerHTML={{
      __html: text.replace(/\n/g, '<br>').replace(/<br\s*\/?>/gi, '<br>')
    }} />
  )
}

function getBlockTitle(block) {
  switch (block.type) {
    case 'photo': return block.content?.caption || '(キャプションなし)'
    case 'text':  return block.content?.title || block.content?.body?.slice(0, 20) || '(テキストなし)'
    case 'link':  return block.content?.title || block.content?.url || '(タイトルなし)'
    case 'sns': {
      const found = SNS_CONFIG.find(s => s.key === block.content?.platform)
      return found?.label || block.content?.platform || '(未設定)'
    }
    case 'profile_card': return 'プロフィールカード'
    case 'affiliation': return block.content?.company_name || '(会社名未設定)'
    default: return ''
  }
}

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

function AffiliationItem({ item, index, total, onDelete, onChange, onMoveUp, onMoveDown }) {
  const { t } = useTranslation('common')
  return (
    <div className="affiliation-item">
      <div className="affil-top-bar">
        <div className="affil-top-left">
          <button type="button" className="affil-reorder-btn" onClick={() => onMoveUp(index)} disabled={index === 0}>↑</button>
          <button type="button" className="affil-reorder-btn" onClick={() => onMoveDown(index)} disabled={index === total - 1}>↓</button>
        </div>
        <button type="button" className="affil-delete-btn" onClick={() => {
          if (window.confirm(`「${item.company_name || '所属'}」の情報を削除しますか？`)) onDelete(item.id)
        }}>{t('profile.affil_remove', { n: index + 1 })}</button>
      </div>
      <div className="affiliation-body">
        <div className="affiliation-inputs">
          <input type="text" value={item.company_name}
            onChange={e => onChange(item.id, 'company_name', e.target.value)}
            placeholder="会社名・団体名" maxLength={100} />
          <input type="text" value={item.title || ''}
            onChange={e => onChange(item.id, 'title', e.target.value)}
            placeholder="肩書き・役職（任意）" maxLength={100} />
        </div>
        <div className="affil-contact-fields">
          <div className="affil-contact-row">
            <input type="tel" value={item.phone || ''}
              onChange={e => onChange(item.id, 'phone', e.target.value)}
              placeholder="📞 電話番号" className="affil-contact-input" />
            <label className="toggle-label small">
              <input type="checkbox" className="toggle-check" checked={item.show_phone ?? false}
                onChange={e => onChange(item.id, 'show_phone', e.target.checked)} />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
              <span className="toggle-text">{(item.show_phone ?? false) ? t('profile.show_public') : t('profile.show_private')}</span>
            </label>
          </div>
          <div className="affil-contact-row">
            <input type="url" value={item.website || ''}
              onChange={e => onChange(item.id, 'website', e.target.value)}
              placeholder="🌐 ウェブサイト" className="affil-contact-input" />
            <label className="toggle-label small">
              <input type="checkbox" className="toggle-check" checked={item.show_website ?? true}
                onChange={e => onChange(item.id, 'show_website', e.target.checked)} />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
              <span className="toggle-text">{(item.show_website ?? true) ? t('profile.show_public') : t('profile.show_private')}</span>
            </label>
          </div>
          <div className="affil-contact-row">
            <input type="email" value={item.contact_email || ''}
              onChange={e => onChange(item.id, 'contact_email', e.target.value)}
              placeholder="✉ メール" className="affil-contact-input" />
            <label className="toggle-label small">
              <input type="checkbox" className="toggle-check" checked={item.show_email ?? false}
                onChange={e => onChange(item.id, 'show_email', e.target.checked)} />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
              <span className="toggle-text">{(item.show_email ?? false) ? t('profile.show_public') : t('profile.show_private')}</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}


export default function ProfileSettings() {
  const { t, i18n } = useTranslation('common')
  const THEMES = THEME_DEFS.map(d => ({ ...d, label: t(`profile.theme_${d.id}`) }))
  const BLOCK_TYPE_LABELS = {
    photo:        t('profile.block_photo'),
    text:         t('profile.block_text'),
    link:         t('profile.block_link'),
    sns:          t('profile.block_sns'),
    profile_card: t('profile.block_profile_card'),
    affiliation:  t('profile.block_affiliation'),
  }
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
  const [planType, setPlanType] = useState('yearly')
  const [snsValues, setSnsValues] = useState({})
  const [snsSaving, setSnsSaving] = useState(false)
  const [snsMsg, setSnsMsg] = useState(null)
  const [presetTab, setPresetTab] = useState('business')
  const [expandedSns, setExpandedSns] = useState({})
  const [openSections, setOpenSections] = useState({
    profile: false,
    affil: false,
    theme: false,
    blocks: false,
    sns: false,
    email: false,
    plan: false,
  })
  const toggleSection = (key) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }))
  const [affiliations, setAffiliations] = useState([])
  const [affilSaving, setAffilSaving] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [username, setUsername] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameChecking, setUsernameChecking] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [showUsernameWarning, setShowUsernameWarning] = useState(false)
  const planSectionRef = useRef(null)
  const qrFileRef = useRef(null)
  const cameraRef = useRef(null)
  const libraryRef = useRef(null)
  const personalRef = useRef(null)
  const businessRef = useRef(null)
  const cardappRef = useRef(null)
  const bioRef = useRef(null)
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
  const [affilMsg, setAffilMsg] = useState(null)
  const [snsDirty, setSnsDirty] = useState(false)
  const [affilDirty, setAffilDirty] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarFileRef = useRef(null)
  const [profileTheme, setProfileTheme] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [previewMode, setPreviewMode] = useState('pro') // 'pro' | 'free'

  const [blocks, setBlocks] = useState([])
  const [blocksDirty, setBlocksDirty] = useState(false)
  const [blocksSaving, setBlocksSaving] = useState(false)
  const [blocksMsg, setBlocksMsg] = useState(null)
  const [showTypeSheet, setShowTypeSheet] = useState(false)
  const [editingBlock, setEditingBlock] = useState(null)
  const [blockImageUploading, setBlockImageUploading] = useState(false)
  const blockImageRef = useRef(null)
  const blockImageTargetFieldRef = useRef('image_url')
  const bgImageRef = useRef(null)
  const [bgImageUploading, setBgImageUploading] = useState(false)
  const [bgImageUrl, setBgImageUrl] = useState(null)
  const router = useRouter()

  const isDirtyAny = snsDirty || affilDirty || blocksDirty
  const isDirty = snsDirty || affilDirty || blocksDirty

  useEffect(() => {
    if (profile !== null && localName === null) {
      setLocalName(profile?.name || '')
      setBio(profile?.bio || '')
      if (profile?.avatar_url) setAvatarUrl(profile.avatar_url)
      if (profile?.profile_bg_image_url) setBgImageUrl(profile.profile_bg_image_url)
      if (profileTheme === null) setProfileTheme(profile?.profile_theme || 'dark')
      setUsername(profile?.username || '')
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
    const msg = '保存されていない変更があります。このページを離れますか？'
    if (!isDirtyAny) {
      window.onbeforeunload = null
      return
    }
    window.onbeforeunload = (e) => {
      e.preventDefault()
      e.returnValue = msg
      return msg
    }
    const handleRouteChange = () => {
      if (!window.confirm(msg)) {
        router.events.emit('routeChangeError')
        throw 'routeChange aborted'
      }
    }
    router.events.on('routeChangeStart', handleRouteChange)
    return () => {
      window.onbeforeunload = null
      router.events.off('routeChangeStart', handleRouteChange)
    }
  }, [isDirtyAny])

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

  useEffect(() => {
    if (!user) return
    fetch(`/api/profile/blocks?userId=${user.id}`)
      .then(r => r.json())
      .then(data => { if (data.blocks) setBlocks(data.blocks) })
      .catch(() => {})
  }, [user])

  const autoResize = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }

  useEffect(() => {
    if (!editingBlock) return
    requestAnimationFrame(() => {
      document.querySelectorAll('.scan-sheet textarea').forEach(autoResize)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingBlock?.type, editingBlock?.index])

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

  async function handleCheckout(planType = 'monthly') {
    setBillingLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan_type: planType }),
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

  const completionPct =
    (avatarUrl ? 15 : 0) +
    ((localName ?? profile?.name) ? 15 : 0) +
    (bio ? 10 : 0) +
    (affiliations.filter(a => a.company_name?.trim()).length > 0 ? 15 : 0) +
    (SNS_CONFIG.some(s => !!profile?.[s.key]) ? 15 : 0) +
    (isConfigured ? 15 : 0) +
    (profile?.plan === 'pro' ? 15 : 0)
  const showCompletionBar = completionPct < 100

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

  function onSnsChange(key, value) {
    setSnsValues(prev => ({ ...prev, [key]: value }))
    setSnsDirty(true)
  }

  function moveUp(index) {
    if (index === 0) return
    setAffiliations(prev => {
      const next = [...prev]
      ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
      return next
    })
    setAffilDirty(true)
  }

  function moveDown(index) {
    setAffiliations(prev => {
      if (index >= prev.length - 1) return prev
      const next = [...prev]
      ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
      return next
    })
    setAffilDirty(true)
  }

  function addAffiliation() {
    if (affiliations.length >= 5) return
    setAffiliations(prev => [...prev, {
      id: `new-${Date.now()}`, company_name: '', title: '',
      phone: '', website: '', contact_email: '',
      show_phone: false, show_website: true, show_email: false,
    }])
    setAffilDirty(true)
  }

  function changeAffiliation(id, field, value) {
    setAffiliations(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a))
    setAffilDirty(true)
  }

  function deleteAffiliation(id) {
    setAffiliations(prev => prev.filter(a => a.id !== id))
    setAffilDirty(true)
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
          order_index: i,
          phone: a.phone?.trim() || null,
          website: a.website?.trim() || null,
          contact_email: a.contact_email?.trim() || null,
          show_phone: a.show_phone ?? false,
          show_website: a.show_website ?? true,
          show_email: a.show_email ?? false,
        })) })
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setAffilDirty(false)
      setAffilMsg({ ok: true, text: t('profile.saved') })
      setTimeout(() => setAffilMsg(null), 2500)
    } catch (err) {
      setAffilMsg({ ok: false, text: err.message })
    } finally {
      setAffilSaving(false)
    }
  }

  async function handleUnifiedSave() {
    if (isSaving) return
    setIsSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (snsDirty) {
        const snsPayload = {}
        SNS_CONFIG.forEach(f => {
          const val = snsValues[f.key]?.trim() || ''
          snsPayload[f.key] = (f.inputMode === 'username' && f.baseUrl && val) ? f.baseUrl + val : val
        })
        const r = await fetch('/api/profile/update-sns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(snsPayload),
        })
        if (!r.ok) throw new Error((await r.json()).error)
        setSnsDirty(false)
      }

      if (affilDirty) {
        const valid = affiliations.filter(a => a.company_name.trim())
        const r = await fetch('/api/profile/affiliations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ affiliations: valid.map((a, i) => ({
            company_name: a.company_name.trim(),
            title: a.title?.trim() || null,
            order_index: i,
            phone: a.phone?.trim() || null,
            website: a.website?.trim() || null,
            contact_email: a.contact_email?.trim() || null,
            show_phone: a.show_phone ?? false,
            show_website: a.show_website ?? true,
            show_email: a.show_email ?? false,
          })) }),
        })
        if (!r.ok) throw new Error((await r.json()).error)
        setAffilDirty(false)
      }

      if (blocksDirty) {
        await handleBlocksSave()
      }
    } catch (e) {
      alert('保存に失敗しました: ' + e.message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSetUsername() {
    if (usernameInput.length < 3) return
    setUsernameChecking(true)
    setUsernameError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/profile/update-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ username: usernameInput }),
      })
      const json = await r.json()
      if (!r.ok) {
        setUsernameError(json.error)
      } else {
        setUsername(json.username)
        setUsernameInput('')
        setShowUsernameWarning(false)
      }
    } catch (e) {
      setUsernameError('エラーが発生しました')
    } finally {
      setUsernameChecking(false)
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
        onSnsChange(qrTarget, code.data)
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
      setSnsDirty(false)
      setSnsMsg({ ok: true, text: t('profile.saved') })
      setTimeout(() => setSnsMsg(null), 2500)
    } catch (err) {
      setSnsMsg({ ok: false, text: err.message })
    } finally {
      setSnsSaving(false)
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
        const newEntry = {
          company_name: scanCompany.trim(),
          title: scanTitle.trim() || null,
          order_index: 0,
          phone: scanPhone.trim() || null,
          website: scanWebsite.trim() || null,
          contact_email: scanContactEmail.trim() || null,
          show_phone: scanShowPhone,
          show_website: scanShowWebsite,
          show_email: scanShowEmail,
        }
        const rest = affiliations
          .filter(a => a.company_name?.trim())
          .map((a, i) => ({
            company_name: a.company_name, title: a.title || null, order_index: i + 1,
            phone: a.phone || null, website: a.website || null, contact_email: a.contact_email || null,
            show_phone: a.show_phone ?? false, show_website: a.show_website ?? true, show_email: a.show_email ?? false,
          }))
        const merged = [newEntry, ...rest].slice(0, 5)
        await fetch('/api/profile/affiliations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ affiliations: merged }),
        })
        setAffiliations(merged.map((a, i) => ({ ...a, id: `scanned-${i}` })))
      }

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

  async function handleThemeChange(themeId) {
    const prevTheme = profileTheme
    setProfileTheme(themeId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/profile/update-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ theme: themeId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setProfileTheme(prevTheme)
    }
  }

  async function handleBlocksSave() {
    setBlocksSaving(true)
    setBlocksMsg(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/profile/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ blocks: blocks.map((b, i) => ({ ...b, order_index: i })) }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setBlocksDirty(false)
      setBlocksMsg({ ok: true, text: t('profile.saved') })
      setTimeout(() => setBlocksMsg(null), 2500)
    } catch (err) {
      setBlocksMsg({ ok: false, text: err.message })
    } finally {
      setBlocksSaving(false)
    }
  }

  async function handleBlockImageFile(file, targetField = 'image_url') {
    if (!file || !file.type.startsWith('image/')) return
    setBlockImageUploading(true)
    try {
      const dataUrl = await compressImage(file)
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/profile/upload-block-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ imageBase64: dataUrl.split(',')[1] }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setEditingBlock(prev => ({ ...prev, content: { ...prev.content, [targetField]: data.image_url } }))
    } catch {
      // silent fail
    } finally {
      setBlockImageUploading(false)
    }
  }

  function handleBlockImageUpload(e) {
    const file = e.target.files?.[0]
    if (file) handleBlockImageFile(file, blockImageTargetFieldRef.current)
    e.target.value = ''
    blockImageTargetFieldRef.current = 'image_url'
  }

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setAvatarUploading(true)
    try {
      const dataUrl = await compressImage(file)
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/profile/update-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ imageBase64: dataUrl.split(',')[1] }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setAvatarUrl(data.avatar_url)
    } catch {
      // silent fail
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handleBgImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBgImageUploading(true)
    try {
      const dataUrl = await compressImage(file)
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/profile/update-bg-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ image: dataUrl.split(',')[1] }),
      })
      const data = await res.json()
      if (data.url) setBgImageUrl(data.url)
    } catch {
      // silent fail
    } finally {
      setBgImageUploading(false)
      e.target.value = ''
    }
  }

  async function handleRemoveBgImage() {
    if (!confirm('背景画像を削除しますか？')) return
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/profile/update-bg-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ image: null }),
    })
    if (res.ok) setBgImageUrl(null)
  }

  return (
    <>
      <Head>
        <title>{t('profile.page_title')}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <div className="top-bar">
          <span className="top-logo">Koryu</span>
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
        <div className="page-title">{t('profile.header')}</div>

        <div className="page">

          <div className="profile-hero">
            <div className="hero-avatar-wrap" onClick={() => avatarFileRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="hero-avatar-img" />
              ) : (
                <div className="hero-avatar">
                  {initials(nameEdit ? nameValue : (localName ?? profile?.name))}
                </div>
              )}
              <div className="hero-avatar-overlay">
                {avatarUploading ? <span className="avatar-spinner" /> : '📷'}
              </div>
            </div>
            <input ref={avatarFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFile} />

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
                  <div className="field-label">{t('profile.bio_label')}</div>
                  <textarea
                    ref={bioRef}
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                    placeholder={t('profile.bio_placeholder')}
                    maxLength={100}
                    rows={2}
                    className="text-input bio-textarea"
                  />
                  <div className="char-count">{bio.length} / 100文字</div>
                  <div style={{ fontSize: 10, color: '#5a5650', marginTop: 3, lineHeight: 1.6 }}>
                    ※ プロフィールカードのSサイズでは約20文字まで表示 / Mサイズ約50文字 / L・XLはフル表示
                  </div>
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
                  <div className="hero-name">{renderText(localName ?? profile?.name) || '—'}</div>
                  <button className="name-edit-btn" onClick={startNameEdit}>{t('profile.name_edit')}</button>
                </div>
                {bio && (
                  <div className="bio-display" onClick={() => setNameEdit(true)}>
                    {renderText(bio)}
                  </div>
                )}
                {nameMsg && (
                  <div className={`name-msg ${nameMsg.ok ? 'success' : 'error'}`}>{nameMsg.text}</div>
                )}
              </>
            )}

            <div className="hero-email">{user?.email}</div>

            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              style={{ display: 'none' }} onChange={handleCardFile} />
            <input ref={libraryRef} type="file" accept="image/*"
              style={{ display: 'none' }} onChange={handleCardFile} />

            {scanStep === 'analyzing' ? (
              <div className="card-scan-btn scanning">
                <span className="card-scan-spinner" />名刺を読み取っています...
              </div>
            ) : (
              <div className="scan-btn-row">
                <button type="button" className="card-scan-btn"
                  onClick={() => { setScanError(null); cameraRef.current?.click() }}>
                  📷 {t('profile.scan_camera_btn')}
                </button>
                <button type="button" className="card-scan-btn"
                  onClick={() => { setScanError(null); libraryRef.current?.click() }}>
                  🖼 {t('profile.scan_library_btn')}
                </button>
              </div>
            )}

            {scanError && scanStep === 'idle' && (
              <div className="scan-error-msg">{scanError}</div>
            )}
          </div>

          <div className="divider" />

          <button
            type="button"
            className="profile-preview-btn"
            onClick={() => setShowPreview(true)}
          >
            {t('profile.open_public_profile')}
          </button>

          {/* ── プロフィールURL ── */}
          <div style={{ marginBottom: 24, padding: '16px', background: 'rgba(255,255,255,0.04)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 10 }}>
              プロフィールURL
            </div>
            {username ? (
              <div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>
                  koryu.app/p/<span style={{ color: '#4ade80', fontWeight: 700 }}>{username}</span>
                </div>
                {profile?.plan === 'pro' ? (
                  <button
                    onClick={() => setShowUsernameWarning(true)}
                    style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}
                  >
                    変更する
                  </button>
                ) : (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🔒 変更はProプランのみ
                  </div>
                )}
              </div>
            ) : profile?.plan === 'pro' ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>koryu.app/p/</span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={e => {
                      setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                      setUsernameError('')
                    }}
                    placeholder="yourname"
                    maxLength={30}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 14 }}
                  />
                </div>
                {usernameError && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{usernameError}</div>}
                <button
                  onClick={handleSetUsername}
                  disabled={usernameChecking || usernameInput.length < 3}
                  style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  {usernameChecking ? '確認中…' : '設定する'}
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
                  koryu.app/p/<span style={{ color: 'rgba(255,255,255,0.25)' }}>{user?.id?.slice(0, 8)}…</span>
                </div>
                <button
                  onClick={() => {
                    setOpenSections(prev => ({ ...prev, plan: true }))
                    setTimeout(() => planSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#facc15', background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.3)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer' }}
                >
                  🔒 ProプランでカスタムURLを設定
                </button>
              </div>
            )}
          </div>

          {/* ── Proユーザー向け変更確認モーダル ── */}
          {showUsernameWarning && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ background: '#1a1a2e', borderRadius: 20, padding: 24, maxWidth: 360, width: '100%', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: 20, marginBottom: 12 }}>⚠️</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 12 }}>ユーザー名を変更しますか？</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginBottom: 16, lineHeight: 1.6 }}>
                  現在のURL <span style={{ color: '#4ade80' }}>koryu.app/p/{username}</span> は即座に使用できなくなります。<br /><br />
                  名刺・SNS・共有済みリンクをすべて更新する必要があります。
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>koryu.app/p/</span>
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={e => {
                      setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))
                      setUsernameError('')
                    }}
                    placeholder={username}
                    maxLength={30}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 14 }}
                  />
                </div>
                {usernameError && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 8 }}>{usernameError}</div>}
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => { setShowUsernameWarning(false); setUsernameInput(''); setUsernameError('') }}
                    style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: 14, cursor: 'pointer' }}
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSetUsername}
                    disabled={usernameChecking || usernameInput.length < 3}
                    style={{ flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {usernameChecking ? '確認中…' : '理解した上で変更する'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="acc-section">
            <div className="acc-header" onClick={() => toggleSection('sns')}>
              <span className="acc-title">{t('profile.section_sns')}</span>
              <span className="acc-chevron">{openSections.sns ? '▲' : '▼'}</span>
            </div>
            {openSections.sns && (
            <div className="acc-body">
              {/* プリセットプレビューパネル */}
              <div className="preset-panel">
                <div className="preset-panel-header">
                  <span className="section-label">{t('profile.sns_preview')}</span>
                  <div className="preset-tabs">
                    {[
                      { key: 'business', label: t('profile.sns_tab_business') },
                      { key: 'personal', label: t('profile.sns_tab_personal') },
                      { key: 'all',      label: t('profile.sns_tab_all') },
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
                  {presetTab === 'business' ? t('profile.sns_hint_business') :
                   presetTab === 'personal' ? t('profile.sns_hint_personal') :
                   t('profile.sns_hint_all')}
                </p>
              </div>

              <input ref={qrFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleQrScan} />

              {/* カテゴリ別セクション */}
              {[
                { cat: 'personal', label: t('profile.sns_cat_personal'), ref: personalRef },
                { cat: 'business', label: t('profile.sns_cat_business'), ref: businessRef },
                { cat: 'cardapp',  label: '名刺管理アプリ',               ref: cardappRef },
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
                            {isExpanded ? '閉じる' : val ? t('profile.name_edit') : t('profile.sns_add')}
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
                                    onClick={() => onSnsChange(f.key, '')}>
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
                                    onChange={e => onSnsChange(f.key, e.target.value)}
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
                                  onChange={e => onSnsChange(f.key, e.target.value)}
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

            </div>
            )}
          </div>

          <div className="acc-section">
            <div className="acc-header" onClick={() => toggleSection('affil')}>
              <span className="acc-title">{t('profile.section_affiliations')}</span>
              <span className="acc-chevron">{openSections.affil ? '▲' : '▼'}</span>
            </div>
            {openSections.affil && (
            <div className="acc-body">

              {/* ── 所属＋連絡先 ── */}
              <div className="section-header">
                <div className="section-label">{t('profile.tab_affiliation')}</div>
                <span className={`config-badge ${affiliations.length > 0 ? 'configured' : 'unconfigured'}`}>
                  {affiliations.length > 0 ? t('profile.affil_count', { count: affiliations.length }) : t('profile.unconfigured')}
                </span>
              </div>
              <p className="desc" style={{ marginBottom: 14 }}>{t('profile.affil_desc')}</p>

              {affiliations.map((item, index) => (
                <AffiliationItem
                  key={item.id}
                  item={item}
                  index={index}
                  total={affiliations.length}
                  onDelete={deleteAffiliation}
                  onChange={changeAffiliation}
                  onMoveUp={moveUp}
                  onMoveDown={moveDown}
                />
              ))}

              {affiliations.length < 5 && (
                <button type="button" className="add-affil-btn" onClick={addAffiliation}>
                  {t('profile.affil_add')}
                </button>
              )}

              {affilMsg && (
                <div className={`msg ${affilMsg.ok ? 'success' : 'error'}`}>{affilMsg.text}</div>
              )}


            </div>
            )}
          </div>

          <div className="acc-section">
            <div className="acc-header" onClick={() => toggleSection('blocks')}>
              <span className="acc-title">{t('profile.tab_blocks')}</span>
              <span className="acc-chevron">{openSections.blocks ? '▲' : '▼'}</span>
            </div>
            {openSections.blocks && (
            <div className="acc-body">
              <div className="section-header">
                <div className="section-label">{t('profile.tab_blocks')}</div>
                <span className={`config-badge ${blocks.length > 0 ? 'configured' : 'unconfigured'}`}>
                  {blocks.length > 0 ? t('profile.affil_count', { count: blocks.length }) : t('profile.unconfigured')}
                </span>
              </div>
              <p className="desc">{t('profile.blocks_desc')}</p>

              {/* ── テーマ・背景画像 ── */}
              <div className="theme-section" style={{ marginBottom: 24 }}>
                <div className="scan-field-label" style={{ marginBottom: 8 }}>{t('profile.theme_label')}</div>
                <div className="theme-swatches">
                  {THEMES.map(th => (
                    <div key={th.id} className="theme-swatch-wrap" title={th.label}>
                      <button
                        type="button"
                        className={`theme-swatch${profileTheme === th.id && !bgImageUrl ? ' selected' : ''}`}
                        style={{ background: `linear-gradient(135deg, ${th.bg} 60%, ${th.card})` }}
                        onClick={() => handleThemeChange(th.id)}
                      />
                    </div>
                  ))}

                  {/* 📷 背景画像スウォッチ */}
                  <div className="theme-swatch-wrap" title="背景画像">
                    <button
                      type="button"
                      className={`theme-swatch photo-swatch${bgImageUrl ? ' selected' : ''}`}
                      style={bgImageUrl ? {
                        backgroundImage: `url(${bgImageUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      } : {}}
                      onClick={() => bgImageRef.current?.click()}
                      disabled={bgImageUploading}
                    >
                      {!bgImageUrl && <span style={{ fontSize: 18 }}>📷</span>}
                    </button>
                    {bgImageUrl && (
                      <button type="button" className="theme-photo-remove" onClick={handleRemoveBgImage}>✕</button>
                    )}
                  </div>
                </div>
                <input ref={bgImageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgImageUpload} />
                <div className="theme-label-row">
                  <span className="theme-current-label">
                    {bgImageUrl ? '背景画像' : (THEMES.find(th => th.id === profileTheme)?.label || t('profile.theme_dark'))}
                  </span>
                  <span style={{ fontSize: 11, color: '#5a5650' }}>{t('profile.theme_pro_only')}</span>
                </div>
              </div>

              {blocks.length === 0 && (
                <div className="blocks-empty">まだブロックがありません。追加してプロフィールをカスタマイズしましょう。</div>
              )}

              {blocks.map((block, index) => (
                <div key={block.id || index} className="block-item">
                  <div className="block-item-left">
                    <span className="block-item-type-badge">{BLOCK_TYPE_LABELS[block.type]}</span>
                    <span className="block-item-size-badge">{block.size}</span>
                    <span className="block-item-title">{getBlockTitle(block)}</span>
                  </div>
                  <div className="block-item-actions">
                    <button type="button" className="block-reorder-btn" disabled={index === 0}
                      onClick={() => {
                        setBlocks(prev => { const n = [...prev]; [n[index-1], n[index]] = [n[index], n[index-1]]; return n })
                        setBlocksDirty(true)
                      }}>↑</button>
                    <button type="button" className="block-reorder-btn" disabled={index === blocks.length - 1}
                      onClick={() => {
                        setBlocks(prev => { const n = [...prev]; [n[index], n[index+1]] = [n[index+1], n[index]]; return n })
                        setBlocksDirty(true)
                      }}>↓</button>
                    <button type="button" className="block-edit-btn"
                      onClick={() => setEditingBlock({ index, type: block.type, size: block.size, content: { ...block.content } })}>
                      編集
                    </button>
                    <button type="button" className="block-delete-btn"
                      onClick={() => {
                        if (window.confirm('このブロックを削除しますか？')) {
                          setBlocks(prev => prev.filter((_, i) => i !== index))
                          setBlocksDirty(true)
                        }
                      }}>✕</button>
                  </div>
                </div>
              ))}

              <button type="button" className="add-block-btn" onClick={() => setShowTypeSheet(true)}>
                {t('profile.add_block')}
              </button>

              {blocksMsg && (
                <div className={`msg ${blocksMsg.ok ? 'success' : 'error'}`} style={{ marginTop: 12 }}>{blocksMsg.text}</div>
              )}

            </div>
            )}
          </div>

          <div className="acc-section">
            <div className="acc-header" onClick={() => toggleSection('email')}>
              <span className="acc-title">{t('profile.section_email')}</span>
              <span className="acc-chevron">{openSections.email ? '▲' : '▼'}</span>
            </div>
            {openSections.email && (
            <div className="acc-body">
              <button
                type="button"
                className="save-btn"
                style={{ width: '100%' }}
                onClick={() => router.push('/settings/email')}
              >
                {t('profile.email_settings_page')}
              </button>
            </div>
            )}
          </div>

          <div className="acc-section" ref={planSectionRef}>
            <div className="acc-header" onClick={() => toggleSection('plan')}>
              <span className="acc-title">{t('profile.section_plan')}</span>
              <span className="acc-chevron">{openSections.plan ? '▲' : '▼'}</span>
            </div>
            {openSections.plan && (() => {
            const isPro = profile?.plan === 'pro'
            return (
              <div className="acc-body">
                <div className="section-header">
                  <div className="section-label">プラン</div>
                  <span className={`plan-badge ${isPro ? 'pro' : 'free'}`}>
                    {isPro ? 'Pro' : 'Free'}
                  </span>
                </div>

                {upgradeMsg && (
                  <div className="msg success" style={{ marginBottom: 12 }}>{upgradeMsg}</div>
                )}

                {isPro ? (
                  <>
                    <div className="pro-active-box">
                      <div className="pro-active-icon">✦</div>
                      <div className="pro-active-text">
                        <div className="pro-active-title">{t('profile.plan_pro_active_title')}</div>
                        <div className="pro-active-desc">{t('profile.plan_pro_active_desc')}</div>
                      </div>
                    </div>
                    <button className="manage-btn" onClick={handlePortal} disabled={billingLoading} style={{ marginTop: 16 }}>
                      {billingLoading ? t('profile.plan_redirecting') : t('billing.manage_btn')}
                    </button>
                  </>
                ) : (
                  <div className="plan-upgrade-wrap">
                    <div className="plan-headline">{t('profile.plan_headline')}</div>

                    <button
                      type="button"
                      className="plan-preview-link"
                      onClick={() => { setPreviewMode('free'); setShowPreview(true) }}
                    >
                      {t('profile.plan_preview_link')}
                    </button>

                    <ul className="plan-features-list">
                      <li>{t('profile.plan_feat_bento')}</li>
                      <li>{t('profile.plan_feat_theme')}</li>
                    </ul>

                    {/* 月/年切替 */}
                    <div className="plan-toggle">
                      <button
                        type="button"
                        className={`plan-toggle-btn ${planType === 'monthly' ? 'active' : ''}`}
                        onClick={() => setPlanType('monthly')}
                      >
                        <div className="plan-toggle-price">¥500</div>
                        <div className="plan-toggle-period">{t('profile.plan_period_monthly')}</div>
                      </button>
                      <button
                        type="button"
                        className={`plan-toggle-btn ${planType === 'yearly' ? 'active' : ''}`}
                        onClick={() => setPlanType('yearly')}
                      >
                        <div className="plan-toggle-badge">{t('profile.plan_badge_yearly')}</div>
                        <div className="plan-toggle-price">¥5,000</div>
                        <div className="plan-toggle-period">{t('profile.plan_period_yearly')}</div>
                      </button>
                    </div>

                    <button
                      className="upgrade-btn"
                      onClick={() => handleCheckout(planType)}
                      disabled={billingLoading}
                    >
                      {billingLoading ? t('profile.plan_redirecting') : (planType === 'yearly' ? t('profile.plan_upgrade_yearly') : t('profile.plan_upgrade_monthly'))}
                    </button>
                  </div>
                )}
              </div>
            )
          })()}
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

        <nav className="bottom-nav">
          <button className="bn-item" onClick={() => router.push('/')}>
            <div className="bn-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <span className="bn-label">{i18n.language === 'en' ? 'Scan' : 'スキャン'}</span>
          </button>
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
          <div className="bn-item bn-active">
            <div className="bn-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <span className="bn-label">{i18n.language === 'en' ? 'Profile' : 'プロフィール'}</span>
          </div>
        </nav>

        {/* ── 保存FAB ── */}
        {isDirty && (
          <button
            onClick={handleUnifiedSave}
            disabled={isSaving}
            style={{
              position: 'fixed',
              bottom: showCompletionBar ? 200 : 80,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 51,
              background: isSaving ? 'rgba(22,163,74,0.6)' : '#16a34a',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              padding: '14px 36px',
              fontSize: 15,
              fontWeight: 700,
              cursor: isSaving ? 'default' : 'pointer',
              boxShadow: '0 4px 20px rgba(22,163,74,0.4)',
              transition: 'background 0.2s, opacity 0.2s',
              whiteSpace: 'nowrap',
            }}
          >
            {isSaving ? '保存中…' : '💾 変更を保存'}
          </button>
        )}

        {/* ── プレビューFAB ── */}
        {user && (
          <button
            type="button"
            className="preview-fab"
            onClick={() => { setPreviewMode('pro'); setShowPreview(true) }}
            title="プロフィールをプレビュー"
          >
            👁
          </button>
        )}

        {(() => {
          const steps = [
            { id: 'avatar', label: '顔写真',             weight: 15, done: !!avatarUrl },
            { id: 'name',   label: '表示名',             weight: 15, done: !!(localName ?? profile?.name) },
            { id: 'bio',    label: 'ひとこと',           weight: 10, done: !!bio },
            { id: 'affil',  label: t('profile.step_affil'), weight: 15, done: affiliations.filter(a => a.company_name?.trim()).length > 0 },
            { id: 'sns',    label: 'SNSリンク',          weight: 15, done: SNS_CONFIG.some(s => !!profile?.[s.key]) },
            { id: 'email',  label: t('profile.step_email'), weight: 15, done: isConfigured },
            { id: 'pro',    label: t('profile.step_pro'),   weight: 15, done: profile?.plan === 'pro' },
          ]
          if (completionPct === 100) return null
          const incomplete = steps.filter(x => !x.done)
          return (
            <div className="completion-fixed">
              <div className="completion-header">
                <span className="completion-title">{t('profile.completion_title')}</span>
                <span className="completion-pct">{completionPct}%</span>
              </div>
              <div className="completion-bar-bg">
                <div className="completion-bar-fill" style={{ width: `${completionPct}%` }} />
              </div>
              <div className="completion-chips">
                {incomplete.map(s => (
                  <button key={s.id} type="button" className="completion-chip"
                    onClick={() => {
                      if (s.id === 'pro') {
                        setOpenSections(prev => ({ ...prev, plan: true }))
                      } else if (s.id === 'bio') {
                        setNameEdit(true)
                        setTimeout(() => {
                          bioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          bioRef.current?.focus()
                        }, 150)
                      } else if (s.id === 'sns') {
                        setOpenSections(prev => ({ ...prev, sns: true }))
                        setTimeout(() => window.scrollTo({ top: 300, behavior: 'smooth' }), 80)
                      } else if (s.id === 'email') {
                        setOpenSections(prev => ({ ...prev, email: true }))
                        setTimeout(() => window.scrollTo({ top: 300, behavior: 'smooth' }), 80)
                      } else {
                        setOpenSections(prev => ({ ...prev, affil: true }))
                        setTimeout(() => window.scrollTo({ top: 300, behavior: 'smooth' }), 80)
                      }
                    }}>
                    + {s.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}
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
                    <span className="toggle-text">{scanShowPhone ? t('profile.show_public') : t('profile.show_private')}</span>
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
                    <span className="toggle-text">{scanShowWebsite ? t('profile.show_public') : t('profile.show_private')}</span>
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
                    <span className="toggle-text">{scanShowEmail ? t('profile.show_public') : t('profile.show_private')}</span>
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


      {/* ── タイプ選択シート ── */}
      {showTypeSheet && (
        <div className="scan-overlay" onClick={() => setShowTypeSheet(false)}>
          <div className="scan-sheet" style={{ maxHeight: '55vh', minHeight: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="scan-sheet-header">
              <span className="scan-sheet-title">ブロックのタイプを選択</span>
              <button type="button" className="scan-sheet-close" onClick={() => setShowTypeSheet(false)}>✕</button>
            </div>
            <div style={{ padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(() => {
                const hasProfileCard = blocks.some(b => b.type === 'profile_card')
                return [
                  { type: 'profile_card', label: '👤 プロフィールカード', desc: '名前・bio・所属を表示',     constraint: null,                             disabled: hasProfileCard },
                  { type: 'photo',        label: '📷 写真',               desc: '画像とキャプションを表示', constraint: 'Sサイズはキャプションなし' },
                  { type: 'text',         label: '📝 テキスト',           desc: 'タイトルと本文を自由に記述', constraint: 'Sサイズはタイトルのみ表示（入力必須）' },
                  { type: 'link',         label: '🔗 リンク',             desc: 'URLへのリンクカード',       constraint: 'サムネイル / オーバーレイから選択可' },
                  { type: 'sns',          label: '💬 SNS',                desc: 'SNSリンクを大きく表示',    constraint: 'Sサイズはキャプションなし' },
                ].map(({ type, label, desc, constraint, disabled }) => (
                  <button key={type} type="button" className="type-select-btn"
                    disabled={!!disabled}
                    style={disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                    onClick={() => { if (disabled) return; setShowTypeSheet(false); setEditingBlock({ index: null, type, size: 'L', content: {} }) }}>
                    <span className="type-select-label">{label}{disabled ? ' (追加済み)' : ''}</span>
                    <span className="type-select-desc">{desc}</span>
                    {constraint && <span style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{constraint}</span>}
                  </button>
                ))
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── ブロック編集モーダル ── */}
      {editingBlock && (
        <div className="scan-overlay" onClick={() => setEditingBlock(null)}>
          <div className="scan-sheet" onClick={e => e.stopPropagation()}>
            <div className="scan-sheet-header">
              <span className="scan-sheet-title">
                {editingBlock.index !== null ? t('profile.edit_block') : t('profile.add_block')} — {BLOCK_TYPE_LABELS[editingBlock.type]}
              </span>
              <button type="button" className="scan-sheet-close" onClick={() => setEditingBlock(null)}>✕</button>
            </div>
            <div className="scan-sheet-body">

              {/* サイズ選択 */}
              <div>
                <div className="scan-field-label" style={{ marginBottom: 8 }}>サイズ</div>
                <div className="size-select-row">
                  {[
                    ...(editingBlock.type === 'affiliation' ? [{ key: 'XS', desc: 'コンパクト' }] : []),
                    { key: 'S', desc: '正方形' },
                    { key: 'M', desc: '縦長' },
                    { key: 'L', desc: '全幅' },
                    { key: 'XL', desc: '超縦長' },
                  ].map(({ key, desc }) => (
                    <button key={key} type="button"
                      className={`size-select-btn${editingBlock.size === key ? ' active' : ''}`}
                      onClick={() => setEditingBlock(prev => ({ ...prev, size: key }))}>
                      <span className="size-select-key">{key}</span>
                      <span className="size-select-desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* photo */}
              {editingBlock.type === 'photo' && (
                <div
                  onPaste={(e) => {
                    const item = Array.from(e.clipboardData?.items || []).find(i => i.type.startsWith('image/'))
                    if (item) { e.preventDefault(); handleBlockImageFile(item.getAsFile()) }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'))
                    if (file) handleBlockImageFile(file)
                  }}
                >
                  <div className="scan-field-label" style={{ marginBottom: 8 }}>画像</div>
                  {editingBlock.content.image_url && (
                    <img src={editingBlock.content.image_url} alt="block preview"
                      style={{ width: '100%', borderRadius: 10, marginBottom: 8, maxHeight: 160, objectFit: editingBlock.content.fit || 'cover', display: 'block' }} />
                  )}
                  <div
                    style={{
                      border: '1.5px dashed rgba(255,255,255,.2)',
                      borderRadius: 10,
                      padding: '16px 12px',
                      textAlign: 'center',
                      marginBottom: 10,
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,.03)',
                      fontSize: 12,
                      color: 'rgba(255,255,255,.4)',
                      lineHeight: 1.8,
                    }}
                    onClick={() => blockImageRef.current?.click()}
                  >
                    ここにドラッグ or ⌘V でペースト<br />
                    <span style={{ fontSize: 10 }}>スクリーンショットもOK</span>
                  </div>
                  <button type="button" className="qr-scan-btn" style={{ marginBottom: 10 }}
                    onClick={() => blockImageRef.current?.click()}>
                    {blockImageUploading ? 'アップロード中...' : editingBlock.content.image_url ? '画像を変更' : '📷 画像を選択'}
                  </button>
                  <div className="scan-field-label" style={{ marginBottom: 4 }}>キャプション（任意）</div>
                  <input type="text" value={editingBlock.content.caption || ''} maxLength={120}
                    onChange={e => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, caption: e.target.value } }))}
                    placeholder="写真の説明" className="scan-field-input" />
                  <div style={{ marginTop: 12 }}>
                    <div className="scan-field-label" style={{ marginBottom: 8 }}>キャプション文字色</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        { key: 'white', color: '#ffffff', label: '白' },
                        { key: 'black', color: '#111111', label: '黒' },
                        { key: 'gray',  color: '#cccccc', label: 'グレー' },
                        { key: 'yellow', color: '#fde68a', label: '黄' },
                      ].map(({ key, color, label }) => (
                        <button key={key} type="button" title={label}
                          onClick={() => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, caption_color: key } }))}
                          style={{
                            width: 36, height: 36, borderRadius: '50%', background: color, padding: 0, cursor: 'pointer',
                            border: (editingBlock.content.caption_color || 'white') === key ? '3px solid #22c55e' : '2px solid #2a2a3a',
                            outline: (editingBlock.content.caption_color || 'white') === key ? '2px solid #7b9e87' : 'none',
                            outlineOffset: 2,
                          }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div className="scan-field-label" style={{ marginBottom: 8 }}>表示モード</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        { key: 'cover', label: 'カバー', desc: '全体を埋める' },
                        { key: 'contain', label: 'フィット', desc: 'スクショ向き' },
                      ].map(({ key, label, desc }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, fit: key } }))}
                          style={{
                            flex: 1,
                            padding: '8px 0',
                            borderRadius: 10,
                            border: (editingBlock.content.fit || 'cover') === key
                              ? '2px solid #22c55e'
                              : '1px solid #2a2a3a',
                            background: (editingBlock.content.fit || 'cover') === key ? '#0f2a1a' : '#111',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{label}</span>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.45)' }}>{desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* text */}
              {editingBlock.type === 'text' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div className="scan-field-label" style={{ marginBottom: 4 }}>タイトル（任意）</div>
                    <input type="text" value={editingBlock.content.title || ''} maxLength={80}
                      onChange={e => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, title: e.target.value } }))}
                      placeholder="見出し" className="scan-field-input" />
                    {editingBlock.size === 'S' && !editingBlock.content.title?.trim() && (
                      <div style={{ fontSize: 11, color: '#f97316', marginTop: 4, lineHeight: 1.5 }}>
                        ⚠ Sサイズではタイトルのみ表示されます。タイトルを入力してください
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="scan-field-label" style={{ marginBottom: 4 }}>本文</div>
                    <textarea value={editingBlock.content.body || ''} maxLength={600}
                      onChange={e => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, body: e.target.value } }))}
                      onInput={e => autoResize(e.target)}
                      placeholder="テキストを入力..." className="scan-field-input"
                      style={{ resize: 'none', overflow: 'hidden', minHeight: 80, lineHeight: 1.6 }} />
                    <div className="char-count">{(editingBlock.content.body || '').length} / 600</div>
                  </div>
                  <div>
                    <div className="scan-field-label" style={{ marginBottom: 8 }}>背景色</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {TEXT_BG_PRESETS.map(color => (
                        <button key={color} type="button"
                          style={{
                            width: 34, height: 34, borderRadius: '50%', background: color,
                            border: editingBlock.content.bg_color === color ? '3px solid #ffffff' : '2px solid #2a2a3a',
                            cursor: 'pointer',
                            outline: editingBlock.content.bg_color === color ? '2px solid #7b9e87' : 'none',
                            outlineOffset: 2, padding: 0,
                          }}
                          onClick={() => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, bg_color: color } }))} />
                      ))}
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div className="scan-field-label" style={{ marginBottom: 8 }}>
                      背景画像（任意）
                      <span style={{ fontSize: 10, color: '#5a5650', marginLeft: 6 }}>設定すると背景色は無効</span>
                    </div>
                    {editingBlock.content.bg_image_url && (
                      <div style={{ position: 'relative', marginBottom: 8 }}>
                        <img src={editingBlock.content.bg_image_url} alt=""
                          style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                        <button type="button"
                          onClick={() => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, bg_image_url: null } }))}
                          style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: 16, color: '#fff', fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>
                          削除
                        </button>
                      </div>
                    )}
                    <button type="button" className="qr-scan-btn"
                      onClick={() => { blockImageTargetFieldRef.current = 'bg_image_url'; blockImageRef.current?.click() }}
                      disabled={blockImageUploading}>
                      {blockImageUploading ? 'アップロード中...' : editingBlock.content.bg_image_url ? '画像を変更' : '📷 背景画像を追加'}
                    </button>
                  </div>
                </div>
              )}

              {/* link */}
              {editingBlock.type === 'link' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div className="scan-field-label" style={{ marginBottom: 4 }}>タイトル（必須）</div>
                    <input type="text" value={editingBlock.content.title || ''} maxLength={80}
                      onChange={e => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, title: e.target.value } }))}
                      placeholder="リンクのタイトル" className="scan-field-input" />
                  </div>
                  <div>
                    <div className="scan-field-label" style={{ marginBottom: 4 }}>URL（必須）</div>
                    <input type="url" value={editingBlock.content.url || ''}
                      onChange={e => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, url: e.target.value } }))}
                      placeholder="https://..." className="scan-field-input" />
                  </div>
                  <div>
                    <div className="scan-field-label" style={{ marginBottom: 4 }}>説明（任意）</div>
                    <input type="text" value={editingBlock.content.description || ''} maxLength={200}
                      onChange={e => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, description: e.target.value } }))}
                      placeholder="リンクの説明文" className="scan-field-input" />
                  </div>
                  <div>
                    <div className="scan-field-label" style={{ marginBottom: 8 }}>サムネイル画像（任意）</div>
                    {editingBlock.content.image_url && (
                      <div style={{ position: 'relative', marginBottom: 8 }}>
                        <img src={editingBlock.content.image_url} alt=""
                          style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                        <button type="button"
                          onClick={() => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, image_url: null } }))}
                          style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: 16, color: '#fff', fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>
                          削除
                        </button>
                      </div>
                    )}
                    <button type="button" className="qr-scan-btn"
                      onClick={() => { blockImageTargetFieldRef.current = 'image_url'; blockImageRef.current?.click() }}
                      disabled={blockImageUploading}>
                      {blockImageUploading ? 'アップロード中...' : '📷 サムネイルを追加'}
                    </button>
                  </div>
                  <div>
                    <div className="scan-field-label" style={{ marginBottom: 8 }}>表示モード</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        { key: 'thumbnail', label: 'サムネイル', desc: '通常' },
                        { key: 'overlay',   label: 'オーバーレイ', desc: '背景画像に重ねる' },
                      ].map(({ key, label, desc }) => (
                        <button key={key} type="button"
                          onClick={() => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, display_mode: key } }))}
                          style={{
                            flex: 1, padding: '8px 0', borderRadius: 10, cursor: 'pointer',
                            border: (editingBlock.content.display_mode || 'thumbnail') === key ? '2px solid #22c55e' : '1px solid #2a2a3a',
                            background: (editingBlock.content.display_mode || 'thumbnail') === key ? '#0f2a1a' : '#111',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                          }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{label}</span>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,.45)' }}>{desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  {(editingBlock.content.display_mode || 'thumbnail') === 'overlay' && (
                    <div>
                      <div className="scan-field-label" style={{ marginBottom: 8 }}>テキスト色</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[
                          { key: 'white',  color: '#ffffff', label: '白' },
                          { key: 'black',  color: '#111111', label: '黒' },
                          { key: 'gray',   color: '#cccccc', label: 'グレー' },
                          { key: 'yellow', color: '#fde68a', label: '黄' },
                        ].map(({ key, color, label }) => (
                          <button key={key} type="button" title={label}
                            onClick={() => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, text_color: key } }))}
                            style={{
                              width: 36, height: 36, borderRadius: '50%', background: color, padding: 0, cursor: 'pointer',
                              border: (editingBlock.content.text_color || 'white') === key ? '3px solid #22c55e' : '2px solid #2a2a3a',
                              outline: (editingBlock.content.text_color || 'white') === key ? '2px solid #7b9e87' : 'none',
                              outlineOffset: 2,
                            }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* sns */}
              {editingBlock.type === 'sns' && (
                <div>
                  <div className="scan-field-label" style={{ marginBottom: 8 }}>プラットフォーム</div>
                  <select value={editingBlock.content.platform || ''}
                    onChange={e => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, platform: e.target.value } }))}
                    className="scan-field-input" style={{ cursor: 'pointer' }}>
                    <option value="">選択してください</option>
                    {SNS_CONFIG.map(f => (
                      <option key={f.key} value={f.key} disabled={!snsValues[f.key]}>
                        {f.label}{!snsValues[f.key] ? '（未設定）' : ''}
                      </option>
                    ))}
                  </select>
                  <p style={{ fontSize: 11, color: '#5a5650', marginTop: 8, lineHeight: 1.6 }}>
                    ※ SNSタブで設定済みのプラットフォームのみ選択できます
                  </p>

                  {/* ひとこと */}
                  <div style={{ marginTop: 12 }}>
                    <div className="scan-field-label" style={{ marginBottom: 4 }}>ひとこと（任意）</div>
                    <textarea
                      value={editingBlock.content.caption || ''}
                      maxLength={80}
                      placeholder="例: 採用・ビジネス相談はこちら"
                      className="scan-field-input"
                      onChange={e => setEditingBlock(prev => ({
                        ...prev,
                        content: { ...prev.content, caption: e.target.value }
                      }))}
                      onInput={e => autoResize(e.target)}
                      style={{ resize: 'none', overflow: 'hidden', minHeight: '44px' }}
                    />
                    <div style={{ fontSize: 11, color: '#5a5650', marginTop: 4, textAlign: 'right' }}>
                      {(editingBlock.content.caption || '').length} / 80
                    </div>
                  </div>
                </div>
              )}

              {/* profile_card */}
              {editingBlock.type === 'profile_card' && (
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.04)',
                  borderRadius: 10,
                  fontSize: 13,
                  color: '#888',
                  lineHeight: 1.7,
                  textAlign: 'center',
                }}>
                  名前・bio・アバターは<br />
                  「所属・連絡先」セクションで編集できます
                </div>
              )}

              {/* affiliation */}
              {editingBlock.type === 'affiliation' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <div className="scan-field-label" style={{ marginBottom: 4 }}>会社名（必須）</div>
                    <input type="text"
                      value={editingBlock.content.company_name || ''}
                      maxLength={60}
                      onChange={e => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, company_name: e.target.value } }))}
                      placeholder="node-bee合同会社"
                      className="scan-field-input" />
                  </div>
                  <div>
                    <div className="scan-field-label" style={{ marginBottom: 4 }}>肩書き（任意）</div>
                    <input type="text"
                      value={editingBlock.content.title || ''}
                      maxLength={40}
                      onChange={e => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, title: e.target.value } }))}
                      placeholder="代表社員"
                      className="scan-field-input" />
                  </div>
                  <div>
                    <div className="scan-field-label" style={{ marginBottom: 8 }}>
                      ロゴ・背景画像（任意）
                      <span style={{ fontSize: 10, color: '#5a5650', marginLeft: 6 }}>設定すると背景色は無効</span>
                    </div>
                    {editingBlock.content.logo_url && (
                      <div style={{ position: 'relative', marginBottom: 8 }}>
                        <img src={editingBlock.content.logo_url} alt=""
                          style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                        <button type="button"
                          onClick={() => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, logo_url: null } }))}
                          style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.6)', border: 'none', borderRadius: 16, color: '#fff', fontSize: 10, padding: '3px 8px', cursor: 'pointer' }}>
                          削除
                        </button>
                      </div>
                    )}
                    <button type="button" className="qr-scan-btn"
                      onClick={() => { blockImageTargetFieldRef.current = 'logo_url'; blockImageRef.current?.click() }}
                      disabled={blockImageUploading}>
                      {blockImageUploading ? 'アップロード中...' : editingBlock.content.logo_url ? '画像を変更' : '📷 ロゴ・背景画像を追加'}
                    </button>
                  </div>
                  <div>
                    <div className="scan-field-label" style={{ marginBottom: 8 }}>背景色</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {TEXT_BG_PRESETS.map(color => (
                        <button key={color} type="button"
                          style={{
                            width: 34, height: 34, borderRadius: '50%', background: color,
                            border: editingBlock.content.bg_color === color ? '3px solid #ffffff' : '2px solid #2a2a3a',
                            cursor: 'pointer',
                            outline: editingBlock.content.bg_color === color ? '2px solid #7b9e87' : 'none',
                            outlineOffset: 2, padding: 0,
                          }}
                          onClick={() => setEditingBlock(prev => ({ ...prev, content: { ...prev.content, bg_color: color } }))} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <input ref={blockImageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBlockImageUpload} />

            <div className="scan-sheet-actions">
              <button type="button" className="save-btn"
                onClick={() => {
                  if (editingBlock.type === 'link' && (!editingBlock.content.title?.trim() || !editingBlock.content.url?.trim())) {
                    return alert('タイトルとURLは必須です')
                  }
                  if (editingBlock.type === 'sns' && !editingBlock.content.platform) {
                    return alert('プラットフォームを選択してください')
                  }
                  if (editingBlock.type === 'affiliation' && !editingBlock.content.company_name?.trim()) {
                    return alert('会社名を入力してください')
                  }
                  const newBlock = {
                    id: editingBlock.index !== null ? (blocks[editingBlock.index]?.id || `new-${Date.now()}`) : `new-${Date.now()}`,
                    type: editingBlock.type,
                    size: editingBlock.size,
                    content: editingBlock.content,
                  }
                  setBlocks(prev => {
                    if (editingBlock.index !== null) {
                      const next = [...prev]; next[editingBlock.index] = newBlock; return next
                    }
                    return [...prev, newBlock]
                  })
                  setBlocksDirty(true)
                  setEditingBlock(null)
                }}>
                {editingBlock.index !== null ? '更新' : '追加'}
              </button>
              <button type="button" className="name-cancel-btn" onClick={() => setEditingBlock(null)} style={{ marginTop: 10 }}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <div className="preview-overlay" onClick={() => setShowPreview(false)}>
          <div className="preview-sheet" onClick={e => e.stopPropagation()}>
            <div className="preview-sheet-header">
              <span className="preview-sheet-title">プロフィール プレビュー</span>
              <button type="button" className="preview-close-btn" onClick={() => setShowPreview(false)}>✕ 閉じる</button>
            </div>
            <div className="preview-toggle-bar">
              <button
                type="button"
                className={`preview-toggle-btn${previewMode === 'pro' ? ' active' : ''}`}
                onClick={() => setPreviewMode('pro')}
              >
                ✦ Pro
              </button>
              <button
                type="button"
                className={`preview-toggle-btn${previewMode === 'free' ? ' active' : ''}`}
                onClick={() => setPreviewMode('free')}
              >
                無課金
              </button>
            </div>
            <iframe
              key={previewMode}
              src={previewMode === 'pro'
                ? `/p/${user?.id}?preview=1`
                : `/p/${user?.id}?preview=1&simulate_free=1`}
              className="preview-iframe"
              title="プロフィールプレビュー"
            />
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

        /* AffiliationItem inner elements — must be global (separate component) */
        .affil-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .affil-top-left {
          display: flex;
          gap: 6px;
        }
        .affil-reorder-btn {
          background: none;
          border: 1px solid #2a2a3a;
          border-radius: 8px;
          color: #5a5650;
          font-size: 16px;
          width: 44px;
          height: 44px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color .15s, background .15s, border-color .15s;
          padding: 0;
          -webkit-tap-highlight-color: transparent;
        }
        .affil-reorder-btn:hover:not(:disabled) {
          color: #f0ede8;
          background: #1e1e2a;
          border-color: #3a3a4a;
        }
        .affil-reorder-btn:disabled { opacity: .2; cursor: not-allowed; }
        .affil-delete-btn {
          background: none;
          border: 1px solid #2a2a3a;
          border-radius: 8px;
          color: #4a4a5a;
          font-size: 12px;
          cursor: pointer;
          height: 36px;
          padding: 0 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: color .15s, background .15s, border-color .15s;
          -webkit-tap-highlight-color: transparent;
        }
        .affil-delete-btn:hover {
          color: #c08080;
          border-color: #3a1010;
          background: #1a0808;
        }
        .affiliation-body {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .affil-contact-fields {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-top: 8px;
          border-top: 1px solid #1e1e2a;
        }
        .affil-contact-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .affil-contact-input {
          flex: 1;
          min-width: 0;
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
          -webkit-appearance: none;
        }
        .affil-contact-input:focus { border-color: #7b9e87; }
        .affil-contact-input::placeholder { color: #3a3a4a; }
      `}</style>

      <style jsx>{`
        .shell {
          min-height: 100svh;
          max-width: 430px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          padding-bottom: 72px;
        }
        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem 0.5rem;
        }
        .top-logo {
          font-family: 'DM Mono', monospace;
          font-size: 18px;
          font-weight: 500;
          color: #7b9e87;
          letter-spacing: .06em;
        }
        .top-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .user-email {
          font-size: 11px;
          color: #5a5a6a;
          font-family: 'DM Mono', monospace;
          max-width: 130px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .logout-btn {
          background: none;
          border: none;
          color: #5a5a6a;
          font-size: 11px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
        }
        .logout-btn:active { color: #7b9e87; }
        .lang-btn {
          background: none;
          border: 1px solid #3a3a4a;
          border-radius: 4px;
          color: #7a7670;
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          padding: 5px 10px;
          letter-spacing: .06em;
          flex-shrink: 0;
        }
        .lang-btn:hover { color: #7b9e87; border-color: #7b9e87; }
        .page-title {
          font-size: 22px;
          font-weight: 700;
          color: #f0ede8;
          padding: 0.25rem 1.5rem 1rem;
        }
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
          color: #5a5a6a;
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
        .page {
          flex: 1;
          display: flex;
          flex-direction: column;
          padding-bottom: 140px;
        }

        .profile-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 2rem 1.5rem 1.5rem;
          gap: 8px;
        }
        .hero-avatar-wrap {
          position: relative;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          cursor: pointer;
          flex-shrink: 0;
          margin-bottom: 4px;
        }
        .hero-avatar-img {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          object-fit: cover;
        }
        .hero-avatar-overlay {
          position: absolute;
          bottom: -2px;
          right: -2px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #7b9e87;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          border: 2px solid #0a0a0f;
          pointer-events: none;
        }
        .avatar-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin .7s linear infinite;
          display: block;
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
        .bio-display {
          font-size: 13px;
          color: #a0a0b0;
          text-align: center;
          margin-top: 2px;
          cursor: pointer;
          line-height: 1.6;
          max-width: 280px;
          transition: color .15s;
        }
        .bio-display:hover { color: #f0ede8; }
        .affiliation-item {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-bottom: 12px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          padding: 10px 12px;
        }
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

        /* ── サブスクUI ── */
        .pro-active-box {
          display: flex; align-items: center; gap: 14px;
          padding: 16px; background: #0d1f15; border: 1px solid #1a3525;
          border-radius: 14px; margin-bottom: 4px;
        }
        .pro-active-icon { font-size: 22px; color: #7b9e87; flex-shrink: 0; }
        .pro-active-title { font-size: 15px; font-weight: 700; color: #f0ede8; margin-bottom: 2px; }
        .pro-active-desc { font-size: 12px; color: #7b9e87; }

        .plan-upgrade-wrap { padding: 4px 0; }
        .plan-headline {
          font-size: 18px;
          font-weight: 700;
          color: #f0ede8;
          margin-bottom: 14px;
          line-height: 1.4;
        }
        .plan-preview-link {
          display: block;
          width: 100%;
          padding: 11px 14px;
          background: #12121a;
          border: 1px solid #2a2a3a;
          border-radius: 10px;
          color: #7b9e87;
          font-size: 13px;
          text-align: left;
          cursor: pointer;
          margin-bottom: 18px;
          transition: background .15s, border-color .15s;
          -webkit-tap-highlight-color: transparent;
        }
        .plan-preview-link:hover { background: #1a1a2a; border-color: #3a3a5a; }
        .plan-features-list {
          list-style: none;
          padding: 0;
          margin: 0 0 20px 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .plan-features-list li { font-size: 13px; color: #a0a0b0; line-height: 1.5; }
        .pro-features {
          display: flex; flex-direction: column; gap: 10px;
          margin-bottom: 20px;
        }
        .pro-feature-row {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 12px 14px; background: #12121a;
          border: 1px solid #1e1e2a; border-radius: 12px;
        }
        .pro-feature-icon { font-size: 18px; color: #7b9e87; flex-shrink: 0; margin-top: 1px; }
        .pro-feature-label { font-size: 14px; font-weight: 700; color: #f0ede8; margin-bottom: 2px; }
        .pro-feature-desc { font-size: 11px; color: #5a5650; }

        .plan-toggle {
          display: flex; gap: 8px; margin-bottom: 12px;
        }
        .plan-toggle-btn {
          flex: 1; padding: 14px 10px; background: #12121a;
          border: 1px solid #1e1e2a; border-radius: 12px;
          cursor: pointer; transition: border-color .15s, background .15s;
          text-align: center; position: relative;
        }
        .plan-toggle-btn.active {
          border-color: #7b9e87; background: #0d1f15;
        }
        .plan-toggle-badge {
          display: inline-block; font-size: 9px; font-family: 'DM Mono', monospace;
          background: #7b9e87; color: #0a0a0f; padding: 2px 6px;
          border-radius: 999px; margin-bottom: 6px; font-weight: 700;
        }
        .plan-toggle-price {
          font-size: 22px; font-weight: 800; color: #f0ede8;
          font-family: 'DM Mono', monospace; line-height: 1;
        }
        .plan-toggle-period {
          font-size: 10px; color: #5a5650; margin-top: 4px;
          font-family: 'DM Mono', monospace;
        }

        /* ── ペイウォール ── */
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
        .profile-preview-btn {
          width: 100%;
          padding: 12px;
          background: none;
          border: 1px solid #2a2a3a;
          border-radius: 10px;
          color: #7b9e87;
          font-size: 13px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          text-align: center;
          margin-bottom: 1rem;
          transition: border-color .15s, background .15s;
        }
        .profile-preview-btn:hover {
          border-color: #7b9e87;
          background: #0d1f15;
        }
        .acc-section { border-bottom: 1px solid rgba(255,255,255,0.08); }
        .acc-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; cursor: pointer; user-select: none; }
        .acc-title { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.65); letter-spacing: 0.02em; }
        .acc-chevron { font-size: 10px; color: rgba(255,255,255,0.3); }
        .acc-body { padding-bottom: 1.5rem; }
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
        .scan-btn-row {
          display: flex;
          gap: 8px;
          margin-top: 4px;
          width: 100%;
        }
        .card-scan-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 14px;
          background: none;
          border: 1px dashed #2a4a35;
          border-radius: 10px;
          color: #7b9e87;
          font-size: 12px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: background .15s, border-color .15s;
        }
        .card-scan-btn:hover { background: #0d1f15; border-color: #7b9e87; }
        .card-scan-btn.scanning { color: #5a5650; border-color: #1e1e2a; cursor: default; flex: none; width: 100%; margin-top: 4px; }
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

        /* ── トグルスイッチ ── */
        .toggle-label {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .toggle-label.small .toggle-track { width: 28px; height: 16px; }
        .toggle-label.small .toggle-thumb { width: 12px; height: 12px; }
        .toggle-check { display: none; }
        .toggle-track {
          position: relative;
          width: 34px;
          height: 20px;
          background: #2a2a3a;
          border-radius: 999px;
          transition: background .2s;
          flex-shrink: 0;
        }
        .toggle-check:checked + .toggle-track { background: #7b9e87; }
        .toggle-thumb {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #f0ede8;
          transition: transform .2s;
        }
        .toggle-check:checked + .toggle-track .toggle-thumb { transform: translateX(14px); }
        .toggle-label.small .toggle-check:checked + .toggle-track .toggle-thumb { transform: translateX(12px); }
        .toggle-text {
          font-size: 10px;
          color: #5a5650;
          font-family: 'DM Mono', monospace;
        }

        /* ── スキャン確認 連絡先行 ── */
        .scan-contact-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }

        /* ── section-divider ── */
        .section-divider {
          height: 1px;
          background: #1e1e2a;
          margin: 24px 0;
        }

        /* ── scan-section-divider ── */
        .scan-section-divider {
          height: 1px;
          background: #1e1e2a;
          margin: 8px 0;
        }

        /* ── 固定保存バー ── */
        .sticky-save-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 50;
          padding: 12px 16px;
          padding-bottom: calc(12px + env(safe-area-inset-bottom));
          background: rgba(10,10,15,0.95);
          backdrop-filter: blur(8px);
          border-top: 1px solid #1e1e2a;
        }
        .sticky-save-btn {
          width: 100%;
          max-width: 430px;
          margin: 0 auto;
          display: block;
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
        .sticky-save-btn:disabled { opacity: .6; cursor: not-allowed; }
        .sticky-save-btn:not(:disabled):active { opacity: .8; }

        /* ── 完成度バー ── */
        .completion-wrap {
          margin-bottom: 20px;
          padding: 14px 16px;
          background: #0d0d14;
          border: 1px solid #1e1e2a;
          border-radius: 12px;
        }
        .completion-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .completion-title {
          font-size: 11px;
          letter-spacing: .08em;
          color: #5a5650;
          text-transform: uppercase;
          font-family: 'DM Mono', monospace;
        }
        .completion-pct {
          font-size: 13px;
          font-weight: 700;
          font-family: 'DM Mono', monospace;
          color: #f0ede8;
        }
        .completion-bar-bg {
          height: 8px;
          background: #1e1e2a;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 10px;
        }
        .completion-bar-fill {
          height: 100%;
          border-radius: 4px;
          background: linear-gradient(to right, #22c55e, #3b82f6);
          transition: width 0.6s ease;
        }
        .completion-bar-fill.complete {
          background: linear-gradient(to right, #f59e0b, #ef4444);
          animation: shimmer 1.8s ease infinite;
        }
        @keyframes shimmer {
          0%   { filter: brightness(1); }
          50%  { filter: brightness(1.35); }
          100% { filter: brightness(1); }
        }
        .completion-done {
          font-size: 13px;
          color: #f59e0b;
          font-weight: 700;
          text-align: center;
          animation: pop .4s ease;
        }
        @keyframes pop {
          0%   { transform: scale(.85); opacity: 0; }
          60%  { transform: scale(1.08); }
          100% { transform: scale(1); opacity: 1; }
        }
        .completion-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .completion-chip {
          padding: 4px 10px;
          background: none;
          border: 1px solid #2a2a3a;
          border-radius: 999px;
          color: #5a5650;
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          transition: color .15s, border-color .15s;
        }
        .completion-chip:hover { color: #7b9e87; border-color: #7b9e87; }
        .preview-fab {
          position: fixed;
          bottom: calc(130px + env(safe-area-inset-bottom, 0px));
          width: 52px;
          height: 52px;
          border-radius: 50%;
          background: rgba(30, 30, 42, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.12);
          color: #f0ede8;
          font-size: 22px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 48;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4);
          transition: transform .15s, background .15s;
          -webkit-tap-highlight-color: transparent;
          padding: 0;
        }
        .preview-fab:hover {
          background: rgba(42, 42, 58, 0.96);
          transform: scale(1.07);
        }
        .preview-fab:active { transform: scale(0.95); }
        @media (max-width: 430px) {
          .preview-fab { right: 16px; }
        }
        @media (min-width: 431px) {
          .preview-fab { right: calc(50% - 215px + 16px); }
        }
        .completion-fixed {
          position: fixed;
          bottom: calc(60px + env(safe-area-inset-bottom, 0px));
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 430px;
          background: rgba(10,10,15,0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-top: 1px solid rgba(255,255,255,0.07);
          padding: 8px 16px;
          z-index: 49;
        }

        /* ── テーマ選択 ── */
        .theme-section {
          margin-bottom: 4px;
        }
        .theme-swatches {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 10px;
        }
        .theme-swatch {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform .15s, outline .15s;
          outline: 2px solid transparent;
          outline-offset: 3px;
          padding: 0;
          flex-shrink: 0;
        }
        .theme-swatch:hover { transform: scale(1.1); }
        .theme-swatch.selected {
          outline: 2.5px solid #ffffff;
          outline-offset: 3px;
          transform: scale(1.08);
        }
        .theme-swatch-wrap { position: relative; display: inline-block; }
        .photo-swatch {
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #1e1e2a;
          border: 1px dashed #3a3a4a;
        }
        .theme-photo-remove {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #333;
          border: none;
          color: #fff;
          font-size: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        .theme-label-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .theme-current-label {
          font-size: 12px;
          color: #7b9e87;
          font-family: 'DM Mono', monospace;
        }
        .theme-preview-link {
          font-size: 12px;
          color: #5a5650;
          font-family: 'DM Mono', monospace;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          transition: color .15s;
        }
        .theme-preview-link:hover { color: #7b9e87; }

        /* ── プレビューモーダル ── */
        .preview-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          z-index: 1000;
          display: flex;
          align-items: flex-end;
        }
        .preview-sheet {
          width: 100%;
          height: 90vh;
          background: #111;
          border-radius: 16px 16px 0 0;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.3s ease;
        }
        .preview-sheet-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #333;
          flex-shrink: 0;
        }
        .preview-sheet-title {
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          font-family: 'Noto Sans JP', sans-serif;
        }
        .preview-close-btn {
          color: #aaa;
          background: none;
          border: none;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          padding: 4px 8px;
          transition: color .15s;
        }
        .preview-close-btn:hover { color: #fff; }
        .preview-toggle-bar {
          display: flex;
          gap: 6px;
          padding: 8px 16px;
          background: #0d0d14;
          border-bottom: 1px solid #1e1e2a;
          flex-shrink: 0;
        }
        .preview-toggle-btn {
          flex: 1;
          padding: 7px 0;
          border-radius: 8px;
          border: 1px solid #2a2a3a;
          background: none;
          color: #5a5650;
          font-size: 12px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: all .15s;
        }
        .preview-toggle-btn.active {
          background: #1a2e22;
          border-color: #7b9e87;
          color: #7b9e87;
          font-weight: 700;
        }
        .preview-iframe {
          flex: 1;
          border: none;
          width: 100%;
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }

        /* ── ブロック管理UI ── */
        .blocks-empty {
          padding: 28px 20px;
          text-align: center;
          color: #3a3a4a;
          font-size: 13px;
          border: 1px dashed #1e1e2a;
          border-radius: 12px;
          margin-bottom: 12px;
          line-height: 1.7;
        }
        .block-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 12px 12px 12px 14px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          margin-bottom: 8px;
        }
        .block-item-left {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
          min-width: 0;
        }
        .block-item-type-badge {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 999px;
          background: #1e1e2a;
          color: #a0a0b0;
          font-family: 'DM Mono', monospace;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .block-item-size-badge {
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 4px;
          background: #0d1f15;
          color: #7b9e87;
          border: 1px solid #1a3525;
          font-family: 'DM Mono', monospace;
          flex-shrink: 0;
        }
        .block-item-title {
          font-size: 13px;
          color: #f0ede8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .block-item-actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .block-reorder-btn {
          background: none;
          border: 1px solid #1e1e2a;
          border-radius: 6px;
          color: #5a5650;
          font-size: 13px;
          width: 32px;
          height: 32px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color .15s, border-color .15s;
          padding: 0;
        }
        .block-reorder-btn:hover:not(:disabled) { color: #f0ede8; border-color: #3a3a4a; }
        .block-reorder-btn:disabled { opacity: .2; cursor: not-allowed; }
        .block-edit-btn {
          background: none;
          border: 1px solid #2a4a35;
          border-radius: 6px;
          color: #7b9e87;
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          padding: 4px 10px;
          cursor: pointer;
          transition: background .15s;
          height: 32px;
        }
        .block-edit-btn:hover { background: #0d1f15; }
        .block-delete-btn {
          background: none;
          border: 1px solid #1e1e2a;
          border-radius: 6px;
          color: #4a4a5a;
          font-size: 12px;
          width: 32px;
          height: 32px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color .15s, border-color .15s, background .15s;
          padding: 0;
        }
        .block-delete-btn:hover { color: #c08080; border-color: #3a1010; background: #1a0808; }
        .add-block-btn {
          width: 100%;
          padding: 12px;
          background: none;
          border: 1px dashed #2a4a35;
          border-radius: 10px;
          color: #7b9e87;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: background .15s, border-color .15s;
          margin-top: 4px;
        }
        .add-block-btn:hover { background: #0d1f15; border-color: #7b9e87; }

        /* タイプ選択ボタン */
        .type-select-btn {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          padding: 14px 16px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 12px;
          cursor: pointer;
          transition: border-color .15s, background .15s;
          text-align: left;
        }
        .type-select-btn:hover { border-color: #7b9e87; background: #0d0d14; }
        .type-select-label {
          font-size: 15px;
          font-weight: 700;
          color: #f0ede8;
          font-family: 'Noto Sans JP', sans-serif;
        }
        .type-select-desc {
          font-size: 12px;
          color: #5a5650;
          font-family: 'DM Mono', monospace;
        }

        /* サイズ選択ボタン */
        .size-select-row {
          display: flex;
          gap: 8px;
        }
        .size-select-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 8px;
          background: #0d0d14;
          border: 1.5px solid #1e1e2a;
          border-radius: 10px;
          cursor: pointer;
          transition: border-color .15s;
        }
        .size-select-btn.active { border-color: #7b9e87; background: #0d1f15; }
        .size-select-btn:hover:not(.active) { border-color: #3a3a4a; }
        .size-select-key {
          font-size: 18px;
          font-weight: 700;
          font-family: 'DM Mono', monospace;
          color: #f0ede8;
        }
        .size-select-desc {
          font-size: 10px;
          color: #5a5650;
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
