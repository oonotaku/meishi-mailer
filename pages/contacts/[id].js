import { useEffect, useRef, useState } from 'react'
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

const THEMES = [
  { id: 'dark',     bg: '#0a0a0a', card: '#1a1a1a', accent: '#22c55e', text: '#ffffff' },
  { id: 'light',    bg: '#f8f8f8', card: '#ffffff', accent: '#0070f3', text: '#111111' },
  { id: 'midnight', bg: '#0f172a', card: '#1e293b', accent: '#818cf8', text: '#e2e8f0' },
  { id: 'warm',     bg: '#1c1410', card: '#2d2018', accent: '#f59e0b', text: '#fef3c7' },
  { id: 'sakura',   bg: '#fff0f3', card: '#ffffff', accent: '#f43f5e', text: '#1a1a1a' },
  { id: 'ocean',    bg: '#0c1a2e', card: '#0f2744', accent: '#38bdf8', text: '#e0f2fe' },
]

function MiniBlock({ block, theme }) {
  const sizeStyle = block.size === 'L'
    ? { gridColumn: 'span 2', minHeight: 100 }
    : block.size === 'S'
    ? { gridColumn: 'span 1', height: 110 }
    : { gridColumn: 'span 1', minHeight: 150 }

  const baseStyle = {
    borderRadius: 14,
    overflow: 'hidden',
    background: theme.card,
    position: 'relative',
    boxShadow: '0 1px 8px rgba(0,0,0,0.25)',
    ...sizeStyle,
  }

  if (block.type === 'photo') {
    if (!block.content?.image_url) return null
    return (
      <div style={baseStyle}>
        <img src={block.content.image_url} alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {block.content.caption && (
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            padding: '20px 10px 10px',
            background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
            color: '#fff', fontSize: 11, fontWeight: 600,
          }}>{block.content.caption}</div>
        )}
      </div>
    )
  }

  if (block.type === 'text') {
    const bg = block.content?.bg_color || theme.card
    const isLight = ['#ffffff','#fff0f3','#f8f8f8','#fef3c7'].includes(bg)
    return (
      <div style={{ ...baseStyle, background: bg, padding: 14, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4 }}>
        {block.content?.title && <div style={{ fontSize: 13, fontWeight: 800, color: isLight ? '#111' : '#fff' }}>{block.content.title}</div>}
        {block.content?.body && <div style={{ fontSize: 12, color: isLight ? '#111' : '#fff', opacity: 0.75, lineHeight: 1.6 }}>{block.content.body}</div>}
      </div>
    )
  }

  if (block.type === 'link') {
    return (
      <a href={block.content?.url} target="_blank" rel="noopener noreferrer"
        style={{ ...baseStyle, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 14, textDecoration: 'none', gap: 4, border: `1px solid ${theme.text}15` }}>
        <span style={{ position: 'absolute', top: 10, right: 12, color: theme.text, opacity: 0.35, fontSize: 13 }}>↗</span>
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{block.content?.title || block.content?.url}</div>
        {block.content?.description && <div style={{ fontSize: 11, color: theme.text, opacity: 0.55 }}>{block.content.description}</div>}
      </a>
    )
  }

  if (block.type === 'sns') {
    const cfg = SNS_CONFIG.find(s => s.key === block.content?.platform)
    if (!cfg) return null
    const darkBrands = ['#000000','#010101','#24292e','#e7e7e7']
    const bgColor = darkBrands.includes(cfg.color) ? '#1a1a2e' : cfg.color
    return (
      <div style={{ ...baseStyle, background: bgColor, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', padding: 14, gap: 8, cursor: 'default' }}>
        <span style={{ position: 'absolute', top: 10, right: 12, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>↗</span>
        {cfg.icon
          ? <img src={`https://cdn.simpleicons.org/${cfg.icon}/ffffff`} width={28} height={28} alt={cfg.label} />
          : <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#fff' }}>{cfg.label[0]}</div>
        }
        <div>
          <div style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>{cfg.label}</div>
          {block.content?.caption && <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 }}>{block.content.caption}</div>}
        </div>
      </div>
    )
  }

  return null
}

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

const SNS_HINTS = {
  ja: {
    line:      'LINEアプリ → プロフィール → QRコードを表示 → 📸ボタンで読み取れます',
    whatsapp:  'WhatsAppアプリ → 設定 → QRコード、またはwa.me/電話番号の形式で入力',
    instagram: 'プロフィール右上の ⋮ →「リンクをコピー」',
    x:         'プロフィールページのURLバー（x.com/ユーザー名）をコピー',
    facebook:  'プロフィールページのURLバー（facebook.com/ユーザー名）をコピー',
    tiktok:    'プロフィールページのURLバー（tiktok.com/@ユーザー名）をコピー',
    threads:   'プロフィールページのURLバー（threads.net/@ユーザー名）をコピー',
    telegram:  'プロフィールのユーザー名（@名前）またはt.me/ユーザー名をコピー',
    wechat:    'WeChatアプリ → プロフィール → QRコード → 画像保存 → 📸で読み取れます',
    linkedin:  'プロフィールページのURLバー（linkedin.com/in/ユーザー名）をコピー',
    github:    'プロフィールページのURLバー（github.com/ユーザー名）をコピー',
    vercel:    'プロフィールページのURLバー（vercel.com/ユーザー名）をコピー',
    note:      'プロフィールページのURLバー（note.com/ユーザー名）をコピー',
    wantedly:  'プロフィールページのURLバー（wantedly.com/id/ユーザー名）をコピー',
    youtube:   'チャンネルページのURLバー（youtube.com/@チャンネル名）をコピー',
    discord:   'プロフィール右クリック →「ユーザー名をコピー」またはdiscord.com/users/IDをコピー',
    bluesky:   'プロフィールページのURLバー（bsky.app/profile/ユーザー名）をコピー',
    pinterest: 'プロフィールページのURLバー（pinterest.com/ユーザー名）をコピー',
    sansan:    'Sansanアプリ → プロフィール → 共有 → リンクをコピー',
    eight:     'Eightアプリ → プロフィール → 共有 → リンクをコピー',
    mybridge:  'myBridgeアプリ → プロフィール → リンクをコピー',
  },
  en: {
    line:      'LINE app → Profile → Show QR code → scan with 📸 button',
    whatsapp:  'WhatsApp → Settings → QR code, or enter wa.me/phonenumber',
    instagram: 'Profile page → ⋮ → "Copy link"',
    x:         'Copy the URL from the browser bar (x.com/username)',
    facebook:  'Copy the URL from the browser bar (facebook.com/username)',
    tiktok:    'Copy the URL from the browser bar (tiktok.com/@username)',
    threads:   'Copy the URL from the browser bar (threads.net/@username)',
    telegram:  'Copy the username (@name) or t.me/username',
    wechat:    'WeChat app → Profile → QR code → Save image → scan with 📸',
    linkedin:  'Copy the URL from the browser bar (linkedin.com/in/username)',
    github:    'Copy the URL from the browser bar (github.com/username)',
    vercel:    'Copy the URL from the browser bar (vercel.com/username)',
    note:      'Copy the URL from the browser bar (note.com/username)',
    wantedly:  'Copy the URL from the browser bar (wantedly.com/id/username)',
    youtube:   'Copy the URL from the browser bar (youtube.com/@channelname)',
    discord:   'Right-click profile → "Copy Username" or copy discord.com/users/ID',
    bluesky:   'Copy the URL from the browser bar (bsky.app/profile/username)',
    pinterest: 'Copy the URL from the browser bar (pinterest.com/username)',
    sansan:    'Sansan app → Profile → Share → Copy link',
    eight:     'Eight app → Profile → Share → Copy link',
    mybridge:  'myBridge app → Profile → Copy link',
  }
}

// Map QR code URL to SNS platform
function parseQrUrl(url) {
  if (!url) return null
  const u = url.toLowerCase()
  if (u.includes('line.me')) return { platform: 'line', value: url }
  if (u.includes('wa.me') || u.includes('whatsapp.com')) return { platform: 'whatsapp', value: url }
  if (u.includes('instagram.com')) return { platform: 'instagram', value: url }
  if (u.includes('facebook.com') || u.includes('fb.com')) return { platform: 'facebook', value: url }
  if (u.includes('linkedin.com')) return { platform: 'linkedin', value: url }
  if (u.includes('github.com')) return { platform: 'github', value: url }
  if (u.includes('x.com') || u.includes('twitter.com')) return { platform: 'x', value: url }
  if (u.includes('youtube.com') || u.includes('youtu.be')) return { platform: 'youtube', value: url }
  if (u.includes('tiktok.com')) return { platform: 'tiktok', value: url }
  if (u.includes('threads.net')) return { platform: 'threads', value: url }
  if (u.includes('t.me')) return { platform: 'telegram', value: url }
  if (u.includes('bsky.app')) return { platform: 'bluesky', value: url }
  if (u.includes('discord.gg') || u.includes('discord.com')) return { platform: 'discord', value: url }
  if (u.includes('wantedly.com')) return { platform: 'wantedly', value: url }
  if (u.includes('note.com')) return { platform: 'note', value: url }
  if (u.includes('pinterest.com')) return { platform: 'pinterest', value: url }
  if (u.includes('8card.net')) return { platform: 'eight', value: url }
  if (u.includes('sansan.com')) return { platform: 'sansan', value: url }
  if (u.includes('vercel.com')) return { platform: 'vercel', value: url }
  return null
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
  results.sort((a, b) => Number(b.isMatch) - Number(a.isMatch))
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
  const [showCardSelector, setShowCardSelector] = useState(false)
  const [selectedRescanIdx, setSelectedRescanIdx] = useState(0)
  const rescanInputRef = useRef(null)

  // Add card
  const [addingCard, setAddingCard] = useState(false)
  const [pendingAddCard, setPendingAddCard] = useState(null) // { card, imageUrl, base64, mediaType }
  const [addCardChoice, setAddCardChoice] = useState(null) // null | 'add' | 'update'
  const [updatingCard, setUpdatingCard] = useState(false)

  // Contact deletion
  const [showDeleteContactModal, setShowDeleteContactModal] = useState(false)
  const [deletingContact, setDeletingContact] = useState(false)

  // Card deletion
  const [deleteCardConfirmIdx, setDeleteCardConfirmIdx] = useState(null)
  const [deletingCard, setDeletingCard] = useState(false)

  // 複数名刺の表示切替
  const [activeCardIdx, setActiveCardIdx] = useState(0)

  // Screenshot SNS detection
  const [detecting, setDetecting] = useState(false)
  const [detectedSns, setDetectedSns] = useState(null)

  // Email flow
  const [emailStep, setEmailStep] = useState(null) // null | 'situation' | 'preview'
  const [emailSituation, setEmailSituation] = useState('')
  const [emailMemo, setEmailMemo] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailGenerating, setEmailGenerating] = useState(false)
  const [emailSending, setEmailSending] = useState(false)

  // Visibility
  const [visibility, setVisibility] = useState('private')
  const [visSaving, setVisSaving] = useState(false)

  // Add encounter form
  const [showEncForm, setShowEncForm] = useState(false)
  const [encForm, setEncForm] = useState({ event_name: '', location: '', met_at: '', temperature: 'normal', memo: '' })
  const [encSaving, setEncSaving] = useState(false)

  // Expanded card image
  const [expandedImg, setExpandedImg] = useState(null)

  // meishi-mailerユーザー検出
  const [meishiProfile, setMeishiProfile] = useState(null)

  // Merge duplicate
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [mergeSearchQuery, setMergeSearchQuery] = useState('')
  const [mergeContacts, setMergeContacts] = useState([])
  const [mergeTarget, setMergeTarget] = useState(null)
  const [mergeTargetEncCount, setMergeTargetEncCount] = useState(0)
  const [mergePending, setMergePending] = useState(false)

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

  useEffect(() => {
    if (!contact?.email) return
    fetch(`/api/profile/find-by-email?email=${encodeURIComponent(contact.email)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.user_id) setMeishiProfile(data) })
  }, [contact?.email])

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

  async function handleScreenshotDetect(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setDetecting(true)
    setDetectedSns(null)

    const snsMap = {}
    SNS_CONFIG.forEach(s => { snsMap[s.key.replace('sns_', '')] = s })

    try {
      // Step 1: Try jsQR client-side
      const jsQR = (await import('jsqr')).default
      const img = new Image()
      img.src = URL.createObjectURL(file)

      const qrResult = await new Promise((resolve) => {
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0)
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const code = jsQR(imageData.data, imageData.width, imageData.height)
          URL.revokeObjectURL(img.src)
          resolve(code?.data || null)
        }
        img.onerror = () => { URL.revokeObjectURL(img.src); resolve(null) }
      })

      if (qrResult) {
        const parsed = parseQrUrl(qrResult)
        if (parsed && snsMap[parsed.platform]) {
          const cfg = snsMap[parsed.platform]
          setDetectedSns({ platform: parsed.platform, value: parsed.value, label: cfg.label, color: cfg.color, icon: cfg.icon || null })
          setDetecting(false)
          return
        }
      }

      // Step 2: Claude Vision fallback — resize to max 1200px before sending
      const base64 = await new Promise((resolve, reject) => {
        const img2 = new Image()
        img2.src = URL.createObjectURL(file)
        img2.onload = () => {
          const MAX = 1200
          const scale = Math.min(1, MAX / Math.max(img2.width, img2.height))
          const canvas2 = document.createElement('canvas')
          canvas2.width = Math.round(img2.width * scale)
          canvas2.height = Math.round(img2.height * scale)
          canvas2.getContext('2d').drawImage(img2, 0, 0, canvas2.width, canvas2.height)
          URL.revokeObjectURL(img2.src)
          resolve(canvas2.toDataURL('image/jpeg', 0.85).split(',')[1])
        }
        img2.onerror = reject
      })

      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/detect-sns-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ image: base64, mediaType: file.type || 'image/jpeg' }),
      })
      const json = await r.json()

      if (r.ok && json.platform && json.value) {
        const cfg = snsMap[json.platform]
        if (cfg) {
          setDetectedSns({ platform: json.platform, value: json.value, label: cfg.label, color: cfg.color, icon: cfg.icon || null })
        } else {
          alert(t('contact.detect_failed'))
        }
      } else {
        alert(t('contact.detect_failed'))
      }
    } catch (err) {
      console.error('[detect]', err)
      alert(t('contact.detect_failed'))
    } finally {
      setDetecting(false)
    }
  }

  async function confirmDetectedSns() {
    if (!detectedSns) return
    setAddSnsSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/update-manual-sns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contactId: id, platform: detectedSns.platform, value: detectedSns.value }),
      })
      const json = await r.json()
      if (r.ok) {
        setManualSns(json.manual_sns || {})
        setContact(prev => ({ ...prev, manual_sns: json.manual_sns }))
        setDetectedSns(null)
      }
    } catch (e) { console.error(e) }
    finally { setAddSnsSaving(false) }
  }

  function handleCardSelectorOpen() {
    const cards = contact?.cards || []
    if (cards.length <= 1) {
      rescanInputRef.current?.click()
    } else {
      setSelectedRescanIdx(0)
      setShowCardSelector(true)
    }
  }

  async function handleRescan(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setRescanning(true)
    setRescanDone(false)
    setShowCardSelector(false)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Upload new image to cards bucket
      let newImageUrl = null
      try {
        const byteString = atob(base64)
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
        const blob = new Blob([ab], { type: 'image/jpeg' })
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error: upErr } = await supabase.storage.from('cards').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('cards').getPublicUrl(fileName)
          newImageUrl = urlData?.publicUrl || null
        }
      } catch (uploadErr) { console.error('[rescan upload]', uploadErr) }

      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          contactId: id,
          image: base64,
          mediaType: file.type || 'image/jpeg',
          card_index: selectedRescanIdx,
          image_url: newImageUrl,
        }),
      })
      const json = await r.json()
      if (r.ok) {
        setContact(prev => ({ ...prev, ...json.updated }))
        setRescanDone(true)
        setTimeout(() => setRescanDone(false), 3000)
      }
    } catch (e) { console.error(e) }
    finally { setRescanning(false) }
  }

  async function handleAddCard(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setAddingCard(true)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = ev => resolve(ev.target.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      // Upload image to cards bucket
      let imageUrl = null
      try {
        const byteString = atob(base64)
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
        const blob = new Blob([ab], { type: 'image/jpeg' })
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
        const { error: upErr } = await supabase.storage.from('cards').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true })
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('cards').getPublicUrl(fileName)
          imageUrl = urlData?.publicUrl || null
        }
      } catch (uploadErr) { console.error('[add-card upload]', uploadErr) }

      // OCR (preview_only — DBは更新しない)
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ image: base64, mediaType: file.type || 'image/jpeg', preview_only: true }),
      })
      const json = await r.json()
      if (r.ok && json.card) {
        setPendingAddCard({ card: json.card, imageUrl, base64, mediaType: file.type || 'image/jpeg' })
        setAddCardChoice(null)
      } else {
        alert('OCRに失敗しました。もう一度お試しください。')
      }
    } catch (e) { console.error(e) }
    finally { setAddingCard(false) }
  }

  async function confirmAddCard() {
    if (!pendingAddCard) return
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/add-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          contact_id: id,
          card: pendingAddCard.card,
          image_url: pendingAddCard.imageUrl,
        }),
      })
      const json = await r.json()
      if (r.ok) {
        setContact(prev => ({
          ...prev,
          cards: json.cards,
          card_image_urls: json.card_image_urls,
        }))
        setPendingAddCard(null)
        setAddCardChoice(null)
      }
    } catch (e) { console.error(e) }
  }

  async function confirmUpdateCard(cardIdx) {
    if (!pendingAddCard) return
    setUpdatingCard(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/rescan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          contactId: id,
          image: pendingAddCard.base64,
          mediaType: pendingAddCard.mediaType || 'image/jpeg',
          card_index: cardIdx,
          image_url: pendingAddCard.imageUrl,
        }),
      })
      const json = await r.json()
      if (!r.ok) {
        alert(json.error || (i18n.language === 'ja' ? '更新に失敗しました' : 'Update failed'))
        return
      }
      setPendingAddCard(null)
      setAddCardChoice(null)
      router.replace(router.asPath)
    } catch (e) {
      console.error(e)
      alert(i18n.language === 'ja' ? 'エラーが発生しました' : 'An error occurred')
    } finally {
      setUpdatingCard(false)
    }
  }

  async function handleDeleteContact() {
    setDeletingContact(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contact_id: id }),
      })
      const json = await r.json()
      if (!r.ok) {
        alert(json.error || (i18n.language === 'ja' ? '削除に失敗しました' : 'Delete failed'))
        return
      }
      router.push('/contacts')
    } catch (e) {
      console.error(e)
      alert(i18n.language === 'ja' ? 'エラーが発生しました' : 'An error occurred')
    } finally {
      setDeletingContact(false)
    }
  }

  async function handleDeleteCard(cardIdx) {
    setDeletingCard(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/delete-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contact_id: id, card_index: cardIdx }),
      })
      const json = await r.json()
      if (!r.ok) {
        alert(json.error || (i18n.language === 'ja' ? '削除に失敗しました' : 'Delete failed'))
        return
      }
      const newCards = (contact.cards || []).filter((_, i) => i !== cardIdx)
      const newImageUrls = (contact.card_image_urls || []).filter((_, i) => i !== cardIdx)
      setContact(prev => ({ ...prev, cards: newCards, card_image_urls: newImageUrls }))
      setActiveCardIdx(0)
      setDeleteCardConfirmIdx(null)
      router.replace(router.asPath)
    } catch (e) {
      console.error(e)
      alert(i18n.language === 'ja' ? 'エラーが発生しました' : 'An error occurred')
    } finally {
      setDeletingCard(false)
    }
  }

  async function openMergeModal() {
    setShowMergeModal(true)
    setMergeTarget(null)
    setMergeSearchQuery('')
    setMergeContacts([])
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/list', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await r.json()
      setMergeContacts((json.data || []).filter(c => c.id !== id))
    } catch (e) { console.error(e) }
  }

  async function selectMergeTarget(c) {
    setMergeTarget(c)
    setMergeTargetEncCount(0)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch(`/api/encounters/list?contact_id=${c.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await r.json()
      setMergeTargetEncCount((json.data || []).length)
    } catch (e) { setMergeTargetEncCount(0) }
  }

  async function handleMerge() {
    if (!mergeTarget) return
    setMergePending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ keep_id: id, merge_id: mergeTarget.id }),
      })
      if (r.ok) {
        setShowMergeModal(false)
        router.replace(router.asPath)
      } else {
        const json = await r.json()
        alert(json.error || 'マージに失敗しました')
      }
    } catch (e) { console.error(e) }
    finally { setMergePending(false) }
  }

  async function handleGenerateEmail() {
    if (!emailSituation) return
    setEmailGenerating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/contacts/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ contact_id: id, situation: emailSituation, memo: emailMemo }),
      })
      const json = await r.json()
      if (r.ok) {
        setEmailSubject(json.subject || '')
        setEmailBody(json.body || '')
        setEmailStep('preview')
      } else {
        alert(json.error || 'メール生成に失敗しました')
      }
    } catch (e) {
      alert('エラーが発生しました')
    } finally {
      setEmailGenerating(false)
    }
  }

  async function handleEmailSend() {
    const toEmail = displayEmail
    if (!toEmail) { alert(t('contact.no_email_alert')); return }
    setEmailSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ to: toEmail, subject: emailSubject, body: emailBody, contact_id: id }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      const mailEnc = {
        id: `mail-${Date.now()}`,
        contact_id: id,
        met_at: new Date().toISOString(),
        event_name: 'メール送信',
        memo: emailSubject,
        created_at: new Date().toISOString(),
      }
      setEncounters(prev => [mailEnc, ...prev])
      setEmailStep(null)
      setEmailSituation('')
      setEmailMemo('')
      setEmailSubject('')
      setEmailBody('')
    } catch (err) {
      alert(err.message)
    } finally {
      setEmailSending(false)
    }
  }

  const cardImages = (c) => {
    if (c?.card_signed_urls?.length) return c.card_signed_urls
    if (c?.card_image_urls?.length) return c.card_image_urls
    if (c?.card_image_url) return [c.card_image_url]
    return []
  }

  const isOwner = user?.id === contact?.owner_id
  const liveSns = meishiProfile?.extracted_sns
  const snsSource = liveSns && Object.keys(liveSns).length > 0
    ? liveSns
    : contact?.extracted_sns
  const allContactSns = computeAllSns(snsSource, manualSns, profile)

  // 表示中のカードデータ（複数名刺の場合は選択されたカードの情報を表示）
  const cards = contact?.cards || []
  const isMainCard = activeCardIdx === 0
  const activeCard = cards[activeCardIdx] || null
  // メインカード（0枚目）はmeishiProfileライブデータを優先。追加カードはカード自身のデータを使う
  const displayName    = isMainCard ? (meishiProfile?.name    || activeCard?.name    || contact?.name    || '') : (activeCard?.name    || contact?.name    || '')
  const displayCompany = isMainCard ? (meishiProfile?.company || activeCard?.company || contact?.company || '') : (activeCard?.company || contact?.company || '')
  const displayTitle   = isMainCard ? (meishiProfile?.title   || activeCard?.title   || contact?.title   || '') : (activeCard?.title   || contact?.title   || '')
  const displayDept    = activeCard?.department  || contact?.department || ''
  const displayEmail   = isMainCard ? (meishiProfile?.email   || activeCard?.email   || contact?.email   || '') : (activeCard?.email   || contact?.email   || '')
  const displayPhone   = isMainCard ? (meishiProfile?.phone   || activeCard?.phone   || contact?.phone   || '') : (activeCard?.phone   || contact?.phone   || '')
  const displayWebsite = isMainCard ? (meishiProfile?.website || activeCard?.website || contact?.website || '') : (activeCard?.website || contact?.website || '')
  const displayAvatar  = isMainCard ? (meishiProfile?.avatar_url || null) : null

  function linkifyMemo(text) {
    if (!text) return text
    const urlRegex = /(https:\/\/koryu\.app\/p\/[^\s]+)/g
    const parts = text.split(urlRegex)
    return parts.map((part, i) =>
      urlRegex.test(part) ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#22c55e', wordBreak: 'break-all' }}
        >
          {part}
        </a>
      ) : part
    )
  }

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
        <title>{displayName || t('contact.page_title_fallback')} — Koryu</title>
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
        {(detecting || addingCard) && (
          <div className="detecting-overlay">
            <div className="detecting-box">
              <div className="detecting-spinner" />
              <div className="detecting-text">
                {addingCard
                  ? (i18n.language === 'ja' ? '名刺を解析中…' : 'Scanning card…')
                  : t('contact.detecting')}
              </div>
            </div>
          </div>
        )}

        {/* ── カード選択シート（再スキャン用）── */}
        {showCardSelector && (
          <div className="sheet-overlay" onClick={() => setShowCardSelector(false)}>
            <div className="sheet-box" onClick={e => e.stopPropagation()}>
              <div className="sheet-title">{i18n.language === 'ja' ? 'どの名刺を更新しますか？' : 'Which card do you want to update?'}</div>
              {(contact.cards || []).map((c, i) => (
                <button
                  key={i}
                  className={`sheet-card-btn ${selectedRescanIdx === i ? 'selected' : ''}`}
                  onClick={() => setSelectedRescanIdx(i)}
                >
                  <div className="sheet-card-company">{c.company || `Card ${i + 1}`}</div>
                  {c.title && <div className="sheet-card-title">{c.title}</div>}
                </button>
              ))}
              <button
                className="ctx-save-btn"
                style={{ marginTop: 12 }}
                onClick={() => { setShowCardSelector(false); rescanInputRef.current?.click() }}
              >
                {i18n.language === 'ja' ? 'この名刺を再スキャン →' : 'Rescan this card →'}
              </button>
              <button className="ghost-btn" style={{ marginTop: 0 }} onClick={() => setShowCardSelector(false)}>
                {i18n.language === 'ja' ? 'キャンセル' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* ── 名刺追加 確認オーバーレイ ── */}
        {pendingAddCard && (() => {
          const scannedEmail = pendingAddCard.card?.email?.toLowerCase()
          const existingCards = contact?.cards || []
          const conflictIdx = scannedEmail
            ? existingCards.findIndex(c => c?.email?.toLowerCase() === scannedEmail)
            : -1
          const hasConflict = conflictIdx >= 0
          return (
            <div className="sheet-overlay" onClick={() => { if (!updatingCard) { setPendingAddCard(null); setAddCardChoice(null) } }}>
              <div className="sheet-box" onClick={e => e.stopPropagation()}>
                <div className="sheet-title">{i18n.language === 'ja' ? 'この名刺を追加しますか？' : 'Add this card?'}</div>
                {pendingAddCard.imageUrl && (
                  <img src={pendingAddCard.imageUrl} style={{ width: '100%', borderRadius: 8, marginBottom: 12, border: '1px solid #1e1e2a' }} alt="" />
                )}
                <div className="sheet-card-btn selected" style={{ cursor: 'default', marginBottom: 12 }}>
                  <div className="sheet-card-company">{pendingAddCard.card.company || '—'}</div>
                  {pendingAddCard.card.title && <div className="sheet-card-title">{pendingAddCard.card.title}</div>}
                  {pendingAddCard.card.email && <div className="sheet-card-title" style={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}>{pendingAddCard.card.email}</div>}
                </div>

                {hasConflict && addCardChoice === null && (
                  <>
                    <div style={{ background: '#2a1a00', border: '1px solid #6b4000', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#f59e0b', lineHeight: 1.6 }}>
                      ⚠️ {i18n.language === 'ja'
                        ? '同じメールアドレスの名刺が既に登録されています。'
                        : 'A card with this email address is already registered.'}
                    </div>
                    <button className="ctx-save-btn" onClick={() => setAddCardChoice('update')}>
                      {i18n.language === 'ja' ? '既存の名刺を更新する' : 'Update existing card'}
                    </button>
                    <button className="ctx-save-btn" style={{ background: '#1e1e2a', border: '1px solid #2e2e3a', color: '#c0bfbb', marginTop: 8 }} onClick={() => setAddCardChoice('add')}>
                      {i18n.language === 'ja' ? '新しい名刺として追加する' : 'Add as new card'}
                    </button>
                  </>
                )}

                {(!hasConflict || addCardChoice === 'add') && (
                  <button className="ctx-save-btn" onClick={confirmAddCard}>
                    {i18n.language === 'ja'
                      ? (addCardChoice === 'add' ? '新しい名刺として追加する' : '追加する')
                      : (addCardChoice === 'add' ? 'Add as new card' : 'Add')}
                  </button>
                )}

                {addCardChoice === 'update' && (
                  <button className="ctx-save-btn" disabled={updatingCard} onClick={() => confirmUpdateCard(conflictIdx)}>
                    {updatingCard
                      ? (i18n.language === 'ja' ? '更新中…' : 'Updating…')
                      : (i18n.language === 'ja' ? '既存の名刺を更新する' : 'Update existing card')}
                  </button>
                )}

                <button className="ghost-btn" style={{ marginTop: 8 }} disabled={updatingCard} onClick={() => { setPendingAddCard(null); setAddCardChoice(null) }}>
                  {i18n.language === 'ja' ? 'キャンセル' : 'Cancel'}
                </button>
              </div>
            </div>
          )
        })()}

        {/* ── コンタクト削除確認 ── */}
        {showDeleteContactModal && (
          <div className="sheet-overlay" onClick={() => !deletingContact && setShowDeleteContactModal(false)}>
            <div className="sheet-box" onClick={e => e.stopPropagation()}>
              <div className="sheet-title" style={{ color: '#cc4444' }}>
                {i18n.language === 'ja' ? 'コンタクトを削除' : 'Delete Contact'}
              </div>
              <p style={{ fontSize: 13, color: '#8a8680', lineHeight: 1.7, margin: '0 0 16px' }}>
                {i18n.language === 'ja'
                  ? 'このコンタクトを削除しますか？出会いの記録もすべて削除されます。この操作は取り消せません。'
                  : 'Delete this contact? All encounter records will also be deleted. This cannot be undone.'}
              </p>
              <button
                className="ctx-save-btn"
                style={{ background: '#3a0a0a', border: '1px solid #7a2020', color: '#ff6666' }}
                disabled={deletingContact}
                onClick={handleDeleteContact}
              >
                {deletingContact
                  ? (i18n.language === 'ja' ? '削除中…' : 'Deleting…')
                  : (i18n.language === 'ja' ? '削除する' : 'Delete')}
              </button>
              <button
                className="ghost-btn"
                style={{ marginTop: 8 }}
                disabled={deletingContact}
                onClick={() => setShowDeleteContactModal(false)}
              >
                {i18n.language === 'ja' ? 'キャンセル' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* ── カード削除確認 ── */}
        {deleteCardConfirmIdx !== null && (
          <div className="sheet-overlay" onClick={() => !deletingCard && setDeleteCardConfirmIdx(null)}>
            <div className="sheet-box" onClick={e => e.stopPropagation()}>
              <div className="sheet-title" style={{ color: '#cc4444' }}>
                {i18n.language === 'ja' ? 'この名刺を削除' : 'Delete Card'}
              </div>
              <div className="sheet-card-btn selected" style={{ cursor: 'default', marginBottom: 12 }}>
                <div className="sheet-card-company">
                  {cards[deleteCardConfirmIdx]?.company || `Card ${deleteCardConfirmIdx + 1}`}
                </div>
                {cards[deleteCardConfirmIdx]?.title && (
                  <div className="sheet-card-title">{cards[deleteCardConfirmIdx].title}</div>
                )}
              </div>
              <p style={{ fontSize: 13, color: '#8a8680', lineHeight: 1.7, margin: '0 0 16px' }}>
                {i18n.language === 'ja'
                  ? 'この名刺を削除しますか？この操作は取り消せません。'
                  : 'Delete this card? This cannot be undone.'}
              </p>
              <button
                className="ctx-save-btn"
                style={{ background: '#3a0a0a', border: '1px solid #7a2020', color: '#ff6666' }}
                disabled={deletingCard}
                onClick={() => handleDeleteCard(deleteCardConfirmIdx)}
              >
                {deletingCard
                  ? (i18n.language === 'ja' ? '削除中…' : 'Deleting…')
                  : (i18n.language === 'ja' ? '削除する' : 'Delete')}
              </button>
              <button
                className="ghost-btn"
                style={{ marginTop: 8 }}
                disabled={deletingCard}
                onClick={() => setDeleteCardConfirmIdx(null)}
              >
                {i18n.language === 'ja' ? 'キャンセル' : 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* ── マージモーダル ── */}
        {showMergeModal && (
          <div className="sheet-overlay" onClick={() => !mergePending && setShowMergeModal(false)}>
            <div className="sheet-box" onClick={e => e.stopPropagation()} style={{ maxHeight: '80vh', overflowY: 'auto' }}>
              {mergeTarget ? (
                <>
                  <div className="sheet-title">
                    {i18n.language === 'ja' ? 'マージの確認' : 'Confirm Merge'}
                  </div>
                  <div className="sheet-card-btn selected" style={{ cursor: 'default', marginBottom: 8 }}>
                    <div className="sheet-card-company">{mergeTarget.name || (i18n.language === 'ja' ? '（名前なし）' : '(No name)')}</div>
                    {mergeTarget.company && <div className="sheet-card-title">{mergeTarget.company}</div>}
                  </div>
                  <div style={{ fontSize: 12, color: '#5a5650', padding: '4px 0 12px', lineHeight: 2 }}>
                    · {i18n.language === 'ja'
                      ? `名刺 ${mergeTarget.cards?.length || 1}枚 が追加されます`
                      : `${mergeTarget.cards?.length || 1} card(s) will be added`}<br />
                    · {i18n.language === 'ja'
                      ? `出会い記録 ${mergeTargetEncCount}件 が引き継がれます`
                      : `${mergeTargetEncCount} encounter(s) will be moved`}<br />
                    · {i18n.language === 'ja'
                      ? 'このレコードは削除されます'
                      : 'This record will be deleted'}
                  </div>
                  <button className="ctx-save-btn" onClick={handleMerge} disabled={mergePending}>
                    {mergePending
                      ? (i18n.language === 'ja' ? '処理中...' : 'Processing...')
                      : (i18n.language === 'ja' ? 'マージする' : 'Merge')}
                  </button>
                  <button className="ghost-btn" style={{ marginTop: 0 }} onClick={() => setMergeTarget(null)} disabled={mergePending}>
                    {i18n.language === 'ja' ? '戻る' : 'Back'}
                  </button>
                </>
              ) : (
                <>
                  <div className="sheet-title">
                    {i18n.language === 'ja' ? '重複をマージ' : 'Merge Duplicate'}
                  </div>
                  <input
                    type="text"
                    className="text-input"
                    placeholder={i18n.language === 'ja' ? '名前・会社名で検索' : 'Search by name or company'}
                    value={mergeSearchQuery}
                    onChange={e => setMergeSearchQuery(e.target.value)}
                    autoFocus
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                    {mergeContacts.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#3a3a4a', textAlign: 'center', padding: '16px 0' }}>
                        {i18n.language === 'ja' ? '読み込み中...' : 'Loading...'}
                      </div>
                    ) : (
                      mergeContacts
                        .filter(c => {
                          if (!mergeSearchQuery.trim()) return true
                          const q = mergeSearchQuery.toLowerCase()
                          return (c.name || '').toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q)
                        })
                        .map(c => (
                          <button key={c.id} className="sheet-card-btn" onClick={() => selectMergeTarget(c)}>
                            <div className="sheet-card-company">{c.name || (i18n.language === 'ja' ? '（名前なし）' : '(No name)')}</div>
                            {c.company && <div className="sheet-card-title">{c.company}</div>}
                          </button>
                        ))
                    )}
                  </div>
                  <button className="ghost-btn" style={{ marginTop: 8 }} onClick={() => setShowMergeModal(false)}>
                    {i18n.language === 'ja' ? 'キャンセル' : 'Cancel'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

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
          {displayAvatar ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 4px' }}>
              <img
                src={displayAvatar}
                alt=""
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid #22c55e' }}
              />
            </div>
          ) : imgs.length > 0 ? (
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

          {/* ── 名刺操作ボタン ── */}
          {isOwner && (
            <div className="rescan-row">
              {/* 再スキャン — 複数カードがある場合はカード選択シートを経由 */}
              <button
                className="rescan-btn"
                style={{ opacity: rescanning ? 0.6 : 1 }}
                onClick={handleCardSelectorOpen}
                disabled={rescanning}
              >
                {rescanning ? t('contact.rescanning') : rescanDone ? `✓ ${t('contact.rescan_done')}` : `🔄 ${t('contact.rescan_card')}`}
              </button>
              {/* hidden input — プログラムからトリガー */}
              <input
                ref={rescanInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={handleRescan}
              />

              {/* 名刺を追加 */}
              <label className="add-card-btn" style={{ opacity: addingCard ? 0.6 : 1 }}>
                {addingCard ? '…' : `＋ ${i18n.language === 'ja' ? '名刺を追加' : 'Add Card'}`}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={handleAddCard}
                  disabled={addingCard}
                />
              </label>

              {/* 重複をマージ */}
              <button className="rescan-btn" onClick={openMergeModal}>
                {i18n.language === 'ja' ? '重複をマージ' : 'Merge Duplicate'}
              </button>

              {/* コンタクト削除 */}
              <button
                className="rescan-btn"
                style={{ color: '#9b4040', borderColor: '#3a1a1a' }}
                onClick={() => setShowDeleteContactModal(true)}
              >
                {i18n.language === 'ja' ? '削除' : 'Delete'}
              </button>
            </div>
          )}

          {/* ── CONTACT INFO ── */}
          <div className="info-block">
            <div className="info-name">{displayName || t('contact.no_name')}</div>
            {displayCompany && <div className="info-company">{displayCompany}</div>}
            {(displayDept || displayTitle) && (
              <div className="info-sub">{[displayDept, displayTitle].filter(Boolean).join(' · ')}</div>
            )}
            <div className="info-contacts">
              {displayEmail && (
                <a href={`mailto:${displayEmail}`} className="info-row">
                  <span className="info-icon">✉</span>
                  <span className="info-val mono">{displayEmail}</span>
                </a>
              )}
              {displayPhone && (
                <a href={`tel:${displayPhone}`} className="info-row">
                  <span className="info-icon">☎</span>
                  <span className="info-val mono">{displayPhone}</span>
                </a>
              )}
              {displayWebsite && (
                <a href={displayWebsite.startsWith('http') ? displayWebsite : `https://${displayWebsite}`}
                  target="_blank" rel="noopener noreferrer" className="info-row">
                  <span className="info-icon">🌐</span>
                  <span className="info-val mono">{displayWebsite.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
            </div>
          </div>

          {/* ── 複数名刺バッジ（タップで切替）── */}
          {cards.length > 1 && (
            <div className="multi-cards-bar">
              <span className="multi-cards-label">
                {i18n.language === 'ja' ? '名刺' : 'Cards'}
              </span>
              <div className="multi-cards-list">
                {cards.map((c, i) => (
                  <div key={i} className="multi-card-chip-wrap">
                    <button
                      className={`multi-card-chip ${activeCardIdx === i ? 'active' : ''}`}
                      onClick={() => setActiveCardIdx(i)}
                    >
                      <span className="multi-card-company">{c.company || `Card ${i + 1}`}</span>
                      {c.title && <span className="multi-card-title">{c.title}</span>}
                    </button>
                    {isOwner && (
                      <button
                        className="chip-delete-btn"
                        onClick={e => { e.stopPropagation(); setDeleteCardConfirmIdx(i) }}
                        title={i18n.language === 'ja' ? 'この名刺を削除' : 'Delete this card'}
                      >×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Koryuプロフィールボタン */}
          {contact.koryu_user_id && (
            <a
              href={`https://koryu.app/p/${contact.koryu_user_id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#16a34a',
                color: '#ffffff',
                borderRadius: 12,
                padding: '14px 18px',
                textDecoration: 'none',
                fontWeight: 700,
                fontSize: 15,
                margin: '12px 0',
              }}
            >
              <span>✓ Koryuプロフィールを見る</span>
              <span>→</span>
            </a>
          )}

          {/* ── 今すぐ繋がる ── */}
          <div className="section">
            <div className="section-hd">
              <span className="section-label">{t('contact.connect_section')}</span>
              {isOwner && (
                <div className="sns-add-btns">
                  {!showAddSnsForm && !detectedSns && (
                    <>
                      <label className="screenshot-sns-btn" style={{ opacity: detecting ? 0.6 : 1 }}>
                        {detecting ? '…' : '📸'}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleScreenshotDetect}
                          disabled={detecting}
                        />
                      </label>
                      <button className="add-sns-btn" onClick={() => setShowAddSnsForm(true)}>
                        + {t('contact.add_sns')}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* スクショ検出結果の確認UI */}
            {detectedSns && (
              <div className="detected-card">
                <div className="detected-title">{t('contact.detected_title')}</div>
                <div className="detected-item" style={{ borderColor: detectedSns.color }}>
                  {detectedSns.icon ? (
                    <img
                      src={`https://cdn.simpleicons.org/${detectedSns.icon}/ffffff`}
                      alt={detectedSns.label}
                      className="sns-icon-img"
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  ) : (
                    <span className="sns-icon-letter" style={{ background: detectedSns.color }}>{detectedSns.label[0]}</span>
                  )}
                  <div className="detected-info">
                    <div className="detected-platform">{detectedSns.label}</div>
                    <div className="detected-value">{detectedSns.value.replace(/^https?:\/\//, '').slice(0, 40)}</div>
                  </div>
                </div>
                <div className="detected-actions">
                  <button className="ctx-save-btn" onClick={confirmDetectedSns} disabled={addSnsSaving}>
                    {addSnsSaving ? t('contact.saving') : t('contact.detect_confirm')}
                  </button>
                  <button className="ghost-btn" style={{ marginTop: 0 }} onClick={() => setDetectedSns(null)}>
                    {t('contact.cancel')}
                  </button>
                </div>
              </div>
            )}

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
                {addSnsPlatform && SNS_HINTS[i18n.language]?.[addSnsPlatform] && (
                  <div className="sns-hint">
                    💡 {SNS_HINTS[i18n.language][addSnsPlatform]}
                  </div>
                )}
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

          </div>


          {/* ── メール送信シート: シチュエーション選択 ── */}
          {emailStep === 'situation' && (
            <div className="sheet-overlay" onClick={() => !emailGenerating && setEmailStep(null)}>
              <div className="sheet-box" onClick={e => e.stopPropagation()}>
                <div className="sheet-title">{i18n.language === 'ja' ? 'シチュエーションを選んでください' : 'Choose a situation'}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {(i18n.language === 'ja'
                    ? ['初回のお礼', '久しぶりの連絡', 'イベント後のフォロー', '商談後のフォロー', 'その他']
                    : ['First thank-you', 'Reconnecting', 'Post-event follow-up', 'Post-meeting follow-up', 'Other']
                  ).map(s => (
                    <button
                      key={s}
                      className={`situation-chip ${emailSituation === s ? 'active' : ''}`}
                      onClick={() => setEmailSituation(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <label className="field-label">{i18n.language === 'ja' ? '一言メモ（任意）' : 'Note (optional)'}</label>
                <textarea
                  className="textarea"
                  rows={2}
                  placeholder={i18n.language === 'ja' ? '話した内容、次のアクションなど' : 'Topics discussed, next steps, etc.'}
                  value={emailMemo}
                  onChange={e => setEmailMemo(e.target.value)}
                />
                <button
                  className="ctx-save-btn"
                  disabled={!emailSituation || emailGenerating}
                  onClick={handleGenerateEmail}
                >
                  {emailGenerating ? (i18n.language === 'ja' ? '生成中…' : 'Generating…') : (i18n.language === 'ja' ? 'AIでメール文を生成する →' : 'Generate email with AI →')}
                </button>
                <button className="ghost-btn" style={{ marginTop: 0 }} disabled={emailGenerating} onClick={() => setEmailStep(null)}>
                  {t('contact.cancel')}
                </button>
              </div>
            </div>
          )}

          {/* ── メール送信シート: プレビュー・編集 ── */}
          {emailStep === 'preview' && (
            <div className="sheet-overlay" onClick={() => !emailSending && setEmailStep(null)}>
              <div className="sheet-box" onClick={e => e.stopPropagation()} style={{ maxHeight: '82vh', overflowY: 'auto' }}>
                <div className="sheet-title">{i18n.language === 'ja' ? 'メールを確認・編集' : 'Preview & edit'}</div>
                <label className="field-label">{t('contact.subject')}</label>
                <input
                  type="text"
                  className="text-input"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                />
                <label className="field-label" style={{ marginTop: 12 }}>{t('contact.body')}</label>
                <textarea
                  className="textarea"
                  rows={7}
                  value={emailBody}
                  onChange={e => setEmailBody(e.target.value)}
                />
                <button
                  className="ctx-save-btn"
                  style={{ background: '#1e1e2a', border: '1px solid #2e2e3a', color: '#c0bfbb', marginBottom: 8 }}
                  disabled={emailGenerating}
                  onClick={handleGenerateEmail}
                >
                  {emailGenerating ? (i18n.language === 'ja' ? '生成中…' : 'Generating…') : (i18n.language === 'ja' ? '再生成する' : 'Regenerate')}
                </button>
                <button
                  className="ctx-save-btn"
                  disabled={emailSending || !emailSubject || !emailBody}
                  onClick={handleEmailSend}
                >
                  {emailSending ? (i18n.language === 'ja' ? '送信中…' : 'Sending…') : (i18n.language === 'ja' ? '送信して交流を記録する' : 'Send & record interaction')}
                </button>
                <button className="ghost-btn" style={{ marginTop: 0 }} disabled={emailSending} onClick={() => setEmailStep(null)}>
                  {t('contact.cancel')}
                </button>
              </div>
            </div>
          )}

          {/* ── 交流履歴 ── */}
          <div className="section">
            <div className="section-hd">
              <span className="section-label">{t('encounter.section_label')}</span>
              {isOwner && !showEncForm && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="add-enc-btn" onClick={() => setShowEncForm(true)}>
                    + {t('contact.add_encounter')}
                  </button>
                  {displayEmail && (
                    <button
                      className="add-enc-btn"
                      style={{ color: '#7b9e87', borderColor: '#1a3525' }}
                      onClick={() => { setEmailStep('situation'); setEmailSituation(''); setEmailMemo('') }}
                    >
                      ✉ {i18n.language === 'ja' ? 'メールを送る' : 'Send email'}
                    </button>
                  )}
                </div>
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
                  enc.event_name === 'メール送信' ? (
                    <div key={enc.id} className="enc-item">
                      <div className="enc-date">
                        <span style={{ fontSize: 16 }}>✉</span>
                        {i18n.language === 'ja' ? 'メール送信' : 'Email sent'}
                        {i === 0 && <span className="enc-badge">{t('encounter.latest')}</span>}
                      </div>
                      <div className="enc-meta" style={{ fontFamily: 'DM Mono, monospace', fontSize: 11 }}>
                        {formatDate(enc.met_at || enc.created_at)}
                      </div>
                      {enc.memo && <div className="enc-memo">{linkifyMemo(enc.memo)}</div>}
                    </div>
                  ) : (
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
                      {enc.memo && <div className="enc-memo">{linkifyMemo(enc.memo)}</div>}
                      {enc.photo_urls?.length > 0 && (
                        <div className="enc-photos">
                          {enc.photo_urls.map((url, pi) => (
                            <img key={pi} src={url} className="enc-photo" alt=""
                              onClick={() => setExpandedImg(url)} />
                          ))}
                        </div>
                      )}
                    </div>
                  )
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

        /* 名刺操作ボタン行 */
        .rescan-row {
          padding: 8px 14px;
          background: #0d0d14;
          border-bottom: 1px solid #1e1e2a;
          display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap;
        }
        .rescan-btn {
          font-size: 12px; font-family: 'DM Mono', monospace; color: #5a5650;
          background: none; border: 1px solid #2a2a3a; border-radius: 6px;
          padding: 5px 12px; cursor: pointer;
          transition: color .15s, border-color .15s;
        }
        .rescan-btn:hover { color: #7b9e87; border-color: #7b9e87; }
        .add-card-btn {
          font-size: 12px; font-family: 'DM Mono', monospace; color: #7b9e87;
          border: 1px solid #1a3525; background: #0d1f15; border-radius: 6px;
          padding: 5px 12px; cursor: pointer;
          transition: opacity .15s; display: inline-block;
        }
        .add-card-btn:hover { opacity: .8; }

        /* カード選択 / 追加確認シート */
        .sheet-overlay {
          position: fixed; inset: 0; z-index: 300;
          background: rgba(0,0,0,.7);
          display: flex; align-items: flex-end; justify-content: center;
        }
        .sheet-box {
          width: 100%; max-width: 430px;
          background: #12121a; border-top: 1px solid #2a2a3a;
          border-radius: 16px 16px 0 0;
          padding: 20px 20px 32px;
          display: flex; flex-direction: column; gap: 8px;
        }
        .sheet-title {
          font-size: 13px; font-family: 'DM Mono', monospace;
          color: #5a5650; letter-spacing: .06em; text-transform: uppercase;
          margin-bottom: 4px;
        }
        .sheet-card-btn {
          background: #0d0d14; border: 1px solid #1e1e2a;
          border-radius: 10px; padding: 12px 14px;
          text-align: left; cursor: pointer;
          transition: border-color .15s;
        }
        .sheet-card-btn:hover, .sheet-card-btn.selected {
          border-color: #7b9e87;
        }
        .sheet-card-company { font-size: 14px; font-weight: 500; color: #f0ede8; }
        .sheet-card-title { font-size: 12px; color: #5a5650; margin-top: 2px; }

        /* 複数名刺バッジ */
        .multi-cards-bar {
          padding: 8px 14px 10px;
          background: #0d0d14;
          border-bottom: 1px solid #1e1e2a;
          display: flex; align-items: flex-start; gap: 10px;
        }
        .multi-cards-label {
          font-size: 10px; font-family: 'DM Mono', monospace;
          color: #3a3a4a; text-transform: uppercase; letter-spacing: .08em;
          padding-top: 3px; white-space: nowrap;
        }
        .multi-cards-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .multi-card-chip {
          background: #12121a; border: 1px solid #1e1e2a;
          border-radius: 8px; padding: 4px 10px;
          display: flex; flex-direction: column; gap: 1px;
          cursor: pointer; text-align: left;
          transition: border-color .15s, background .15s;
        }
        .multi-card-chip:hover { border-color: #3a3a4a; }
        .multi-card-chip.active {
          border-color: #7b9e87; background: #0d1f15;
        }
        .multi-card-company { font-size: 12px; color: #8a8680; }
        .multi-card-chip.active .multi-card-company { color: #7b9e87; }
        .multi-card-title { font-size: 10px; color: #3a3a4a; }
        .multi-card-chip-wrap { position: relative; display: inline-flex; }
        .chip-delete-btn {
          position: absolute; top: -6px; right: -6px;
          width: 17px; height: 17px; border-radius: 50%;
          background: #2a0a0a; border: 1px solid #5a1a1a;
          color: #cc4444; font-size: 11px; line-height: 1;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          padding: 0; z-index: 1;
          transition: background .15s, color .15s;
        }
        .chip-delete-btn:hover { background: #5a1a1a; color: #ff6666; }

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

        /* 検出中オーバーレイ */
        .detecting-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(10,10,15,0.85);
          display: flex; align-items: center; justify-content: center;
        }
        .detecting-box {
          display: flex; flex-direction: column; align-items: center; gap: 14px;
          background: #12121a; border: 1px solid #2a2a3a;
          border-radius: 16px; padding: 28px 36px;
        }
        .detecting-spinner {
          width: 28px; height: 28px;
          border: 2px solid #1e1e2a; border-top-color: #7b9e87;
          border-radius: 50%; animation: spin .7s linear infinite;
        }
        .detecting-text {
          font-size: 13px; color: #8a8680; font-family: 'Noto Sans JP', sans-serif;
        }

        /* SNS手動追加 / スクショ検出 */
        .sns-add-btns {
          display: flex; align-items: center; gap: 6px;
        }
        .screenshot-sns-btn {
          background: none; border: 1px solid #2a2a3a; border-radius: 6px;
          font-size: 14px; width: 30px; height: 26px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: border-color .15s;
        }
        .screenshot-sns-btn:hover { border-color: #7b9e87; }

        .detected-card {
          background: #0d0d14; border: 1px solid #1e1e2a;
          border-radius: 10px; padding: 12px; margin-bottom: 12px;
        }
        .detected-title {
          font-size: 10px; font-family: 'DM Mono', monospace;
          color: #7b9e87; letter-spacing: .08em; text-transform: uppercase;
          margin-bottom: 10px;
        }
        .detected-item {
          display: flex; align-items: center; gap: 12px;
          padding: 12px; border-radius: 10px;
          border: 1.5px solid; background: #12121a;
          margin-bottom: 10px;
        }
        .detected-info { flex: 1; min-width: 0; }
        .detected-platform { font-size: 14px; font-weight: 500; color: #f0ede8; }
        .detected-value {
          font-size: 11px; font-family: 'DM Mono', monospace;
          color: #5a5650; margin-top: 2px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .detected-actions { display: flex; flex-direction: column; gap: 8px; }

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

        .sns-hint {
          font-size: 12px;
          color: #8a8680;
          background: #0d0d14;
          border: 1px solid #1e1e2a;
          border-radius: 8px;
          padding: 8px 10px;
          margin-top: 8px;
          line-height: 1.6;
        }

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
          width: 100%; padding: 12px 16px; border-radius: 10px;
          border: 1.5px solid rgba(255,255,255,0.2);
          background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7);
          font-size: 14px; font-weight: 600; cursor: pointer; text-align: center;
          margin-top: 6px; transition: background 0.15s, opacity 0.15s;
        }
        .connected-btn:active { opacity: 0.75; }
        .connected-btn.done { background: rgba(22,163,74,0.25); border-color: #16a34a; color: #4ade80; }
        .connected-btn:disabled { opacity: .6; cursor: not-allowed; }

        .sns-empty {
          text-align: center; padding: 1.5rem 1rem; display: flex;
          flex-direction: column; align-items: center; gap: 6px;
        }
        .sns-empty-icon { font-size: 28px; }
        .sns-empty-text { font-size: 13px; color: #5a5650; }
        .sns-empty-hint { font-size: 11px; color: #3a3a4a; line-height: 1.5; }

        /* Situation chips */
        .situation-chip {
          padding: 7px 13px; border-radius: 20px;
          background: #12121a; border: 1px solid #2a2a3a;
          color: #8a8680; font-size: 13px; font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer; transition: all .15s;
        }
        .situation-chip:hover { border-color: #7b9e87; color: #c0bfbb; }
        .situation-chip.active { border-color: #7b9e87; color: #f0ede8; background: #0d1f15; }

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
        .enc-photos { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
        .enc-photo { width: 72px; height: 72px; object-fit: cover; border-radius: 6px; border: 1px solid #1e1e2a; cursor: pointer; }
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
