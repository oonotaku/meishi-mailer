import Head from 'next/head'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { SNS_CONFIG } from '../../lib/snsConfig'

const THEMES = [
  { id: 'dark',     bg: '#0a0a0a', card: '#1a1a1a', accent: '#22c55e', text: '#ffffff' },
  { id: 'light',    bg: '#f8f8f8', card: '#ffffff', accent: '#0070f3', text: '#111111' },
  { id: 'midnight', bg: '#0f172a', card: '#1e293b', accent: '#818cf8', text: '#e2e8f0' },
  { id: 'sunset',   bg: '#1a0800', card: '#2d1500', accent: '#f97316', text: '#fff7ed' },
  { id: 'sakura',   bg: '#fff0f3', card: '#ffffff', accent: '#f43f5e', text: '#1a1a1a' },
  { id: 'grape',    bg: '#130d1f', card: '#1e1035', accent: '#a855f7', text: '#f3e8ff' },
]

function initials(name) {
  if (!name) return '?'
  return name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?'
}

function renderText(text) {
  if (!text) return null
  return (
    <span dangerouslySetInnerHTML={{
      __html: text.replace(/\n/g, '<br>').replace(/<br\s*\/?>/gi, '<br>')
    }} />
  )
}

function PhotoBlock({ block }) {
  if (!block.content?.image_url) return (
    <div style={{ width: '100%', height: '100%', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 28, opacity: 0.3 }}>📷</span>
    </div>
  )
  const fit = block.content?.fit || 'cover'
  const size = block.size || 'M'
  const captionColorMap = { white: '#ffffff', black: '#111111', gray: '#cccccc', yellow: '#fde68a' }
  const captionColor = captionColorMap[block.content?.caption_color || 'white'] || '#ffffff'
  const showCaption = !!block.content?.caption && size !== 'S'
  const captionLines = size === 'XL' ? 2 : 1
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: fit === 'contain' ? '#0a0a14' : 'transparent' }}>
      <img
        src={block.content.image_url}
        alt={block.content.caption || ''}
        style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }}
      />
      {showCaption && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: captionLines === 2 ? '48px 14px 14px' : '32px 14px 14px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
          color: captionColor, fontSize: 12, fontWeight: 600, lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: captionLines, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', wordBreak: 'break-word',
        }}>
          {block.content.caption}
        </div>
      )}
    </div>
  )
}

function TextBlock({ block, theme }) {
  const size = block.size || 'M'
  const hasBgImage = !!block.content?.bg_image_url
  const bg = hasBgImage ? 'transparent' : (block.content?.bg_color || theme.card)
  const lightBgs = ['#ffffff', '#fff0f3', '#f8f8f8', '#fef3c7', '#f0f9ff']
  const isLight = lightBgs.some(c => bg.toLowerCase() === c.toLowerCase())
  const textColor = hasBgImage ? '#ffffff' : (isLight ? '#111111' : '#ffffff')
  const showBody = size !== 'S'
  const bodyClamp = size === 'M' ? 3 : size === 'L' ? 5 : null
  return (
    <div style={{
      background: bg,
      backgroundImage: hasBgImage ? `url(${block.content.bg_image_url})` : 'none',
      backgroundSize: 'cover', backgroundPosition: 'center',
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      padding: 18, gap: 6, position: 'relative',
    }}>
      {hasBgImage && (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 60%)', borderRadius: 'inherit' }} />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {block.content?.title && (
          <div style={{
            fontSize: 15, fontWeight: 800, color: textColor, lineHeight: 1.35, letterSpacing: '-0.2px',
            ...(size === 'S' ? { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } : {}),
          }}>
            {block.content.title}
          </div>
        )}
        {showBody && block.content?.body && (
          <div style={{
            fontSize: 13, color: textColor, opacity: hasBgImage ? 0.9 : 0.75, lineHeight: 1.75, wordBreak: 'break-word',
            ...(bodyClamp
              ? { display: '-webkit-box', WebkitLineClamp: bodyClamp, WebkitBoxOrient: 'vertical', overflow: 'hidden' }
              : { whiteSpace: 'pre-wrap' }),
          }}>
            {block.content.body}
          </div>
        )}
      </div>
    </div>
  )
}

function LinkBlock({ block, theme }) {
  if (!block.content?.url) return null
  const displayUrl = block.content.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  const hasImage = !!block.content?.image_url
  const size = block.size || 'M'
  const displayMode = block.content?.display_mode || 'thumbnail'
  const textColorMap = { white: '#ffffff', black: '#111111', gray: '#cccccc', yellow: '#fde68a' }
  const overlayTextColor = textColorMap[block.content?.text_color || 'white'] || '#ffffff'

  if (displayMode === 'overlay') {
    const titleClamp = size === 'XL' ? 3 : 2
    const descClamp  = size === 'M' ? 2 : size === 'L' ? 3 : size === 'XL' ? 4 : 0
    const showDesc   = descClamp > 0 && !!block.content?.description
    const clampStyle = (lines) => ({
      display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical',
      overflow: 'hidden', wordBreak: 'break-word',
    })
    return (
      <a href={block.content.url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'block', width: '100%', height: '100%', position: 'relative', overflow: 'hidden', textDecoration: 'none', background: theme.card }}>
        {hasImage && (
          <img src={block.content.image_url} alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.08) 55%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 14px 14px', paddingRight: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: overlayTextColor, lineHeight: 1.35, ...clampStyle(titleClamp) }}>
            {block.content.title || displayUrl}
          </div>
          {showDesc && (
            <div style={{ fontSize: 12, color: overlayTextColor, opacity: 0.75, lineHeight: 1.55, marginTop: 4, ...clampStyle(descClamp) }}>
              {block.content.description}
            </div>
          )}
        </div>
        <span style={{ position: 'absolute', top: 10, right: 12, fontSize: 14, color: overlayTextColor, opacity: 0.7 }}>↗</span>
      </a>
    )
  }

  if (size === 'S') {
    return (
      <a href={block.content.url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', background: theme.card, border: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none', overflow: 'hidden', position: 'relative', alignItems: 'center' }}>
        {hasImage && (
          <div style={{ width: 72, height: '100%', flexShrink: 0, overflow: 'hidden' }}>
            <img src={block.content.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
        <div style={{ padding: '10px 12px', flex: 1, minWidth: 0 }}>
          <span style={{ position: 'absolute', top: 10, right: 12, fontSize: 12, color: theme.text, opacity: 0.35 }}>↗</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 18 }}>
            {block.content.title || displayUrl}
          </div>
        </div>
      </a>
    )
  }

  if (size === 'L') {
    return (
      <a href={block.content.url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', flexDirection: 'row', width: '100%', height: '100%', background: theme.card, border: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none', overflow: 'hidden', position: 'relative' }}>
        {hasImage && (
          <div style={{ width: 120, flexShrink: 0, overflow: 'hidden' }}>
            <img src={block.content.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
        <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, position: 'relative' }}>
          <span style={{ position: 'absolute', top: 12, right: 14, fontSize: 14, color: theme.text, opacity: 0.35 }}>↗</span>
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.text, lineHeight: 1.4, paddingRight: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {block.content.title || displayUrl}
          </div>
          {block.content.description && (
            <div style={{ fontSize: 13, color: theme.text, opacity: 0.6, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
              {block.content.description}
            </div>
          )}
          <div style={{ fontSize: 11, color: theme.text, opacity: 0.35, fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 'auto' }}>
            {displayUrl}
          </div>
        </div>
      </a>
    )
  }

  if (size === 'XL') {
    return (
      <a href={block.content.url} target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: theme.card, border: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none', overflow: 'hidden', position: 'relative' }}>
        {hasImage && (
          <div style={{ width: '100%', height: 140, overflow: 'hidden', flexShrink: 0 }}>
            <img src={block.content.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
        <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
          <span style={{ position: 'absolute', top: 12, right: 14, fontSize: 14, color: theme.text, opacity: 0.35 }}>↗</span>
          <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, lineHeight: 1.4, paddingRight: 20 }}>
            {block.content.title || displayUrl}
          </div>
          {block.content.description && (
            <div style={{ fontSize: 13, color: theme.text, opacity: 0.6, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {block.content.description}
            </div>
          )}
          <div style={{ fontSize: 11, color: theme.text, opacity: 0.35, fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 'auto' }}>
            {displayUrl}
          </div>
        </div>
      </a>
    )
  }

  // M (default): thumbnail + title + description 2-line
  return (
    <a href={block.content.url} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: theme.card, border: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none', position: 'relative', transition: 'opacity .15s', overflow: 'hidden' }}>
      {hasImage && (
        <div style={{ width: '100%', height: 90, overflow: 'hidden', flexShrink: 0, borderRadius: '14px 14px 0 0' }}>
          <img src={block.content.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}
      <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
        <span style={{ position: 'absolute', top: 12, right: 14, fontSize: 14, color: theme.text, opacity: 0.35 }}>↗</span>
        <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, lineHeight: 1.4, paddingRight: 20 }}>
          {block.content.title || displayUrl}
        </div>
        {block.content.description && (
          <div style={{ fontSize: 14, color: theme.text, opacity: 0.6, lineHeight: 1.6, flex: 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
            {block.content.description}
          </div>
        )}
        <div style={{ fontSize: 12, color: theme.text, opacity: 0.4, fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 'auto' }}>
          {displayUrl}
        </div>
      </div>
    </a>
  )
}

function SnsBlock({ block, profile }) {
  const platform = block.content?.platform
  const cfg = SNS_CONFIG.find(s => s.key === platform)
  const url = profile[platform]
  const size = block.size || 'M'
  if (!cfg || !url) return null

  const darkBrands = ['#000000', '#010101', '#24292e', '#e7e7e7']
  const bgColor = darkBrands.includes(cfg.color) ? '#1a1a2e' : cfg.color

  const handleText = (() => {
    if (cfg.inputMode === 'qr') return ''
    if (cfg.inputMode === 'url') return ''
    try {
      const u = new URL(url)
      const parts = u.pathname.replace(/\/$/, '').split('/')
      const handle = parts[parts.length - 1]
      return handle ? '@' + handle : ''
    } catch { return '' }
  })()

  const iconSize = size === 'S' ? 40 : 32
  const iconBlock = (
    <div>
      {cfg.icon ? (
        <img
          src={`https://cdn.simpleicons.org/${cfg.icon}/ffffff`}
          width={iconSize} height={iconSize}
          alt={cfg.label}
          style={{ display: 'block' }}
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
        />
      ) : null}
      <div style={{
        display: cfg.icon ? 'none' : 'flex',
        width: iconSize + 4, height: iconSize + 4,
        borderRadius: 10, background: 'rgba(255,255,255,0.2)',
        alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(iconSize / 2), fontWeight: 900, color: '#fff',
      }}>
        {cfg.label[0]}
      </div>
    </div>
  )

  if (size === 'S') {
    return (
      <div
        onClick={() => window.open(url, '_blank')}
        style={{ background: bgColor, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 12, gap: 8, cursor: 'pointer', position: 'relative' }}
        onTouchStart={e => e.currentTarget.style.opacity = '0.8'}
        onTouchEnd={e => e.currentTarget.style.opacity = '1'}
      >
        <div style={{ position: 'absolute', top: 8, right: 10, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>↗</div>
        {iconBlock}
        <div style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1.2, textAlign: 'center' }}>{cfg.label}</div>
      </div>
    )
  }

  if (size === 'L') {
    return (
      <div
        onClick={() => window.open(url, '_blank')}
        style={{ background: bgColor, width: '100%', height: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '14px 18px', gap: 16, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
        onTouchStart={e => e.currentTarget.style.opacity = '0.8'}
        onTouchEnd={e => e.currentTarget.style.opacity = '1'}
      >
        <div style={{ position: 'absolute', top: 12, right: 14, color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>↗</div>
        <div style={{ flexShrink: 0 }}>{iconBlock}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontSize: 14, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>{cfg.label}</div>
          {block.content?.caption ? (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 1.5, fontFamily: 'Noto Sans JP, sans-serif', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {block.content.caption}
            </div>
          ) : handleText ? (
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: 'DM Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {handleText}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  if (size === 'XL') {
    return (
      <div
        onClick={() => window.open(url, '_blank')}
        style={{ background: bgColor, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', padding: 16, gap: 10, cursor: 'pointer', position: 'relative' }}
        onTouchStart={e => e.currentTarget.style.opacity = '0.8'}
        onTouchEnd={e => e.currentTarget.style.opacity = '1'}
      >
        <div style={{ position: 'absolute', top: 14, right: 14, color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>↗</div>
        {iconBlock}
        <div>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>{cfg.label}</div>
          {block.content?.caption ? (
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.5, marginTop: 3, fontFamily: 'Noto Sans JP, sans-serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {block.content.caption}
            </div>
          ) : handleText ? (
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: 'DM Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {handleText}
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  // M (default): icon + name + caption 2-line
  return (
    <div
      onClick={() => window.open(url, '_blank')}
      style={{ background: bgColor, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', padding: 16, gap: 10, cursor: 'pointer', position: 'relative', transition: 'opacity 0.15s' }}
      onTouchStart={e => e.currentTarget.style.opacity = '0.8'}
      onTouchEnd={e => e.currentTarget.style.opacity = '1'}
    >
      <div style={{ position: 'absolute', top: 14, right: 14, color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>↗</div>
      {iconBlock}
      <div>
        <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>{cfg.label}</div>
        {block.content?.caption ? (
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 1.5, marginTop: 3, fontFamily: 'Noto Sans JP, sans-serif', whiteSpace: 'pre-wrap', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {block.content.caption}
          </div>
        ) : handleText ? (
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: 'DM Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {handleText}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ProfileCardBlock({ block, profile, theme }) {
  const size = block.size || 'M'
  const Avatar = ({ sz }) => profile.avatar_url ? (
    <img src={profile.avatar_url} alt="" style={{ width: sz, height: sz, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${theme.accent}`, flexShrink: 0 }} />
  ) : (
    <div style={{ width: sz, height: sz, borderRadius: '50%', background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(sz * 0.36), fontWeight: 800, color: '#fff', flexShrink: 0 }}>
      {initials(profile.name)}
    </div>
  )

  if (size === 'S') {
    return (
      <div style={{ background: theme.card, width: '100%', height: '100%', padding: '12px 14px', display: 'flex', flexDirection: 'row', gap: 10, alignItems: 'center', overflow: 'hidden' }}>
        <Avatar sz={40} />
        <div style={{ fontSize: 15, fontWeight: 800, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {profile.name || '名前未設定'}
        </div>
      </div>
    )
  }

  if (size === 'L') {
    return (
      <div style={{ background: theme.card, width: '100%', height: '100%', padding: '16px 18px', display: 'flex', flexDirection: 'row', gap: 16, alignItems: 'center', overflow: 'hidden' }}>
        <Avatar sz={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: theme.text, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {renderText(profile.name) || '名前未設定'}
          </div>
          {profile.bio && (
            <div style={{ fontSize: 12, color: theme.text, opacity: 0.6, marginTop: 6, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {renderText(profile.bio)}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (size === 'XL') {
    return (
      <div style={{ background: theme.card, width: '100%', minHeight: '100%', padding: '28px 18px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, overflow: 'hidden' }}>
        <Avatar sz={80} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: theme.text, lineHeight: 1.2 }}>
            {renderText(profile.name) || '名前未設定'}
          </div>
          {profile.bio && (
            <div style={{ fontSize: 13, color: theme.text, opacity: 0.7, marginTop: 8, lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {renderText(profile.bio)}
            </div>
          )}
        </div>
      </div>
    )
  }

  // M (default): photo(left) + name + bio 2-line
  return (
    <div style={{ background: theme.card, width: '100%', minHeight: '100%', padding: '18px 18px 14px', display: 'flex', flexDirection: 'row', gap: 14, alignItems: 'flex-start', overflow: 'hidden' }}>
      <Avatar sz={56} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: theme.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {renderText(profile.name) || '名前未設定'}
        </div>
        {profile.bio && (
          <div style={{ fontSize: 12, color: theme.text, opacity: 0.6, marginTop: 5, lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {renderText(profile.bio)}
          </div>
        )}
      </div>
    </div>
  )
}

function AffiliationBlock({ block, theme }) {
  const { company_name, title, website, contact_email, phone } = block.content || {}
  const size = block.size || 'M'

  if (size === 'XS') {
    return (
      <div style={{ background: theme.card, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '8px 14px', gap: 2, overflow: 'hidden' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: theme.text, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {company_name || '会社名未設定'}
        </div>
        {title && (
          <div style={{ fontSize: 11, color: theme.text, opacity: 0.55, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
        )}
      </div>
    )
  }

  if (size === 'S') {
    return (
      <div style={{ background: theme.card, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 14, gap: 3, overflow: 'hidden' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: theme.text, lineHeight: 1.3 }}>
          {company_name || '会社名未設定'}
        </div>
        {title && (
          <div style={{ fontSize: 12, color: theme.text, opacity: 0.6, lineHeight: 1.4 }}>
            {title}
          </div>
        )}
      </div>
    )
  }

  if (size === 'L') {
    return (
      <div style={{ background: theme.card, width: '100%', height: '100%', display: 'flex', flexDirection: 'row', alignItems: 'center', padding: '14px 18px', gap: 20, overflow: 'hidden' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: theme.text, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {company_name || '会社名未設定'}
          </div>
          {title && (
            <div style={{ fontSize: 12, color: theme.text, opacity: 0.6, lineHeight: 1.4, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {title}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 160 }}>
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: theme.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>
              🔗 {website.replace(/^https?:\/\//, '')}
            </a>
          )}
          {contact_email && (
            <div style={{ fontSize: 11, color: theme.text, opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              ✉ {contact_email}
            </div>
          )}
        </div>
      </div>
    )
  }

  if (size === 'XL') {
    return (
      <div style={{ background: theme.card, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 20px', gap: 10, overflow: 'hidden' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: theme.text, lineHeight: 1.3 }}>
          {company_name || '会社名未設定'}
        </div>
        {title && <div style={{ fontSize: 13, color: theme.text, opacity: 0.7, lineHeight: 1.5 }}>{title}</div>}
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: theme.accent, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textDecoration: 'none', marginTop: 6 }}>
            🔗 {website.replace(/^https?:\/\//, '')}
          </a>
        )}
        {contact_email && <div style={{ fontSize: 12, color: theme.text, opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✉ {contact_email}</div>}
        {phone && <div style={{ fontSize: 12, color: theme.text, opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📞 {phone}</div>}
      </div>
    )
  }

  // M (default): company + title + website
  return (
    <div style={{ background: theme.card, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 16, gap: 4, overflow: 'hidden' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: theme.text, lineHeight: 1.3 }}>
        {company_name || '会社名未設定'}
      </div>
      {title && <div style={{ fontSize: 12, color: theme.text, opacity: 0.6, lineHeight: 1.4 }}>{title}</div>}
      {website && (
        <a href={website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: theme.accent, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textDecoration: 'none' }}>
          🔗 {website.replace(/^https?:\/\//, '')}
        </a>
      )}
    </div>
  )
}

function ConnectBar({ profile }) {
  const lineUrl = (() => {
    const raw = profile.sns_line
    if (!raw) return null
    if (raw.startsWith('http')) return raw
    return `https://line.me/ti/p/~${raw}`
  })()

  const waUrl = (() => {
    const raw = profile.sns_whatsapp
    if (!raw) return null
    if (raw.startsWith('http')) return raw
    const digits = raw.replace(/\D/g, '')
    return `https://wa.me/${digits}`
  })()

  if (!lineUrl && !waUrl) return null

  return (
    <div style={{
      background: '#16a34a',
      borderRadius: 20,
      padding: '16px 16px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        つながりましょう
      </div>

      {lineUrl && (
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
            borderRadius: 12,
            padding: '13px 16px',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 14,
            color: '#06C755',
          }}
          onTouchStart={e => e.currentTarget.style.opacity = '0.85'}
          onTouchEnd={e => e.currentTarget.style.opacity = '1'}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="https://cdn.simpleicons.org/line/06C755"
              width={20} height={20} alt="LINE"
              style={{ display: 'block', flexShrink: 0 }}
            />
            LINEで友達追加
          </span>
          <span style={{ fontSize: 16 }}>→</span>
        </a>
      )}

      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.18)',
            borderRadius: 12,
            padding: '13px 16px',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 14,
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.25)',
          }}
          onTouchStart={e => e.currentTarget.style.opacity = '0.85'}
          onTouchEnd={e => e.currentTarget.style.opacity = '1'}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="https://cdn.simpleicons.org/whatsapp/ffffff"
              width={20} height={20} alt="WhatsApp"
              style={{ display: 'block', flexShrink: 0 }}
            />
            WhatsAppでつながる
          </span>
          <span style={{ fontSize: 16 }}>→</span>
        </a>
      )}
    </div>
  )
}

export default function PublicProfile({ profile, blocks, affiliations, showAsPro, activeSns }) {
  const theme = THEMES.find(t => t.id === profile.profile_theme) || THEMES[0]

  return (
    <>
      <Head>
        <title>{profile.name || 'プロフィール'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell" style={profile.profile_bg_image_url ? {
        backgroundImage: `url(${profile.profile_bg_image_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      } : {}}>
        <div className="card">
          <div className="bento-grid">
            {blocks.map((block, i) => {
              const sizeClass =
                block.size === 'L'  ? 'block-L'  :
                block.size === 'XL' ? 'block-XL' :
                block.size === 'XS' ? 'block-XS' :
                block.size === 'S'  ? 'block-S'  : 'block-M'
              const isSns = block.type === 'sns'
              return (
                <div
                  key={block.id || i}
                  className={`bento-block ${sizeClass}${isSns ? ' block-sns' : ''}`}
                  style={{ background: theme.card, overflow: 'hidden' }}
                  onTouchStart={e => { e.currentTarget.style.transform = 'scale(0.97)'; e.currentTarget.style.transition = 'transform 0.1s' }}
                  onTouchEnd={e => { e.currentTarget.style.transform = 'scale(1)' }}
                >
                  {block.type === 'photo'        && <PhotoBlock        block={block} theme={theme} />}
                  {block.type === 'text'         && <TextBlock         block={block} theme={theme} />}
                  {block.type === 'link'         && <LinkBlock         block={block} theme={theme} />}
                  {block.type === 'sns'          && <SnsBlock          block={block} profile={profile} theme={theme} />}
                  {block.type === 'profile_card' && <ProfileCardBlock  block={block} profile={profile} affiliations={affiliations} theme={theme} />}
                  {block.type === 'affiliation'  && <AffiliationBlock  block={block} theme={theme} />}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── SNS接続バー（全ユーザー共通・LINE/WhatsApp設定時のみ表示） ── */}
        <ConnectBar profile={profile} theme={theme} />

        {/* ── Pro: 所属フッター ── */}
        {showAsPro && affiliations.length > 0 && (
          <div style={{ borderTop: `1px solid ${theme.text}18`, padding: '20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {affiliations.map((aff, i) => (
              <div key={i}>
                <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{aff.company_name}</div>
                {aff.title && <div style={{ fontSize: 12, color: theme.text, opacity: 0.6, marginTop: 2 }}>{aff.title}</div>}
                <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {aff.show_website && aff.website && (
                    <a href={aff.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: theme.accent, textDecoration: 'none' }}>
                      🔗 {aff.website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                  {aff.show_email && aff.contact_email && (
                    <div style={{ fontSize: 12, color: theme.text, opacity: 0.5 }}>✉ {aff.contact_email}</div>
                  )}
                  {aff.show_phone && aff.phone && (
                    <div style={{ fontSize: 12, color: theme.text, opacity: 0.5 }}>📞 {aff.phone}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 無課金ビュー ── */}
        {!showAsPro && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '0 4px' }}>

            {/* 1. 名前 + bio（カードなし・センタリング） */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 16px 24px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: theme.text }}>{renderText(profile.name) || '名前未設定'}</div>
                {profile.bio && (
                  <div style={{ fontSize: 13, color: theme.text, opacity: 0.6, marginTop: 6, lineHeight: 1.7 }}>
                    {renderText(profile.bio)}
                  </div>
                )}
              </div>
            </div>

            {/* 1b. SNS接続バー */}
            <ConnectBar profile={profile} theme={theme} />

            {/* 2. 所属一覧（カードなし・テキストのみ） */}
            {affiliations.length > 0 && (
              <div style={{ borderTop: `1px solid ${theme.text}18`, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {affiliations.map((aff, i) => (
                  <div key={i}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{aff.company_name}</div>
                    {aff.title && <div style={{ fontSize: 12, color: theme.text, opacity: 0.5, marginTop: 2 }}>{aff.title}</div>}
                    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {aff.show_website && aff.website && (
                        <a href={aff.website} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: 12, color: theme.accent, textDecoration: 'none' }}>
                          🔗 {aff.website.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                      {aff.show_email && aff.contact_email && (
                        <div style={{ fontSize: 12, color: theme.text, opacity: 0.5 }}>✉ {aff.contact_email}</div>
                      )}
                      {aff.show_phone && aff.phone && (
                        <div style={{ fontSize: 12, color: theme.text, opacity: 0.5 }}>📞 {aff.phone}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 3. SNSアイコン（カードなし・センタリング） */}
            {SNS_CONFIG.some(cfg => profile[cfg.key]) && (
              <div style={{ borderTop: `1px solid ${theme.text}18`, padding: '20px 16px',
                display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
                {SNS_CONFIG.filter(cfg => profile[cfg.key]).map(cfg => {
                  const darkBrands = ['#000000', '#010101', '#24292e', '#e7e7e7']
                  const bgColor = darkBrands.includes(cfg.color) ? '#1a1a2e' : cfg.color
                  return (
                    <a key={cfg.key} href={profile[cfg.key]} target="_blank" rel="noopener noreferrer" title={cfg.label}
                      style={{ width: 48, height: 48, borderRadius: 12, background: bgColor, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                      {cfg.icon ? (
                        <img src={`https://cdn.simpleicons.org/${cfg.icon}/ffffff`} width={24} height={24} alt={cfg.label}
                          style={{ display: 'block' }} onError={e => { e.target.style.display = 'none' }} />
                      ) : (
                        <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>{cfg.label[0]}</span>
                      )}
                    </a>
                  )
                })}
              </div>
            )}

            {/* 4. Koryu訴求（訪問者向け） */}
            <a href="https://koryu.app" target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', margin: '8px 0 0', borderTop: `1px solid ${theme.text}18`,
                padding: '24px 16px', textDecoration: 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.accent, marginBottom: 6 }}>
                名刺を受け取ったら、Koryuで繋がろう
              </div>
              <div style={{ fontSize: 12, color: theme.text, opacity: 0.5, lineHeight: 1.7 }}>
                名刺をスキャンするだけで、相手のSNSに自動でつながれるアプリです。無料で始められます。
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: theme.accent, fontWeight: 600 }}>
                Koryuを試してみる →
              </div>
            </a>

          </div>
        )}

        {/* App banner */}
        <a
          href="https://koryu.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '14px 20px',
            background: `${theme.card}99`,
            borderRadius: 14,
            textDecoration: 'none',
            border: `1px solid ${theme.text}10`,
          }}
        >
          <span style={{ fontSize: 13, color: theme.text, opacity: 0.5, lineHeight: 1.5 }}>
            名刺から、SNSでつながる。
          </span>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: theme.accent,
            fontFamily: 'DM Mono, monospace',
            opacity: 0.8,
          }}>
            Koryu ↗
          </span>
        </a>

        <div className="footer" style={{ color: theme.text }}>
          このページは{' '}
          <a href="https://koryu.app" target="_blank" rel="noopener noreferrer"
            style={{ color: theme.text, opacity: 0.4, textDecoration: 'none' }}>
            Koryu
          </a>
          {' '}で作成されました
        </div>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { min-height: 100%; background: ${theme.bg}; color: ${theme.text}; font-family: 'Noto Sans JP', sans-serif; }
      `}</style>

      <style jsx>{`
        .shell {
          min-height: 100svh;
          max-width: 480px;
          margin: 0 auto;
          padding: 1.5rem 1rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        .card {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .bento-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-auto-rows: minmax(144px, auto);
          gap: 12px;
        }
        .bento-block {
          position: relative;
          border-radius: 20px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.3);
          overflow: hidden;
        }
        .block-XS {
          grid-column: span 1;
          align-self: start;
          height: 80px;
        }
        .block-S {
          grid-column: span 1;
          grid-row: span 1;
        }
        .block-M {
          grid-column: span 1;
          grid-row: span 1;
          min-height: 180px;
        }
        .block-L {
          grid-column: span 2;
          grid-row: span 1;
          min-height: 120px;
        }
        .block-XL {
          grid-column: span 1;
          grid-row: span 2;
        }
        .block-sns.block-L {
          min-height: unset;
        }
        .bento-empty {
          text-align: center;
          font-size: 13px;
          opacity: 0.3;
          padding: 24px;
        }

        .footer {
          font-size: 11px;
          opacity: 0.25;
          text-align: center;
          margin-top: auto;
          padding-top: 1rem;
        }
      `}</style>
    </>
  )
}

export async function getServerSideProps({ params, query }) {
  const { userId } = params
  const isPreview = query?.preview === '1'
  const isPreviewMode = !!query.preview
  const simulateFree = query?.simulate_free === '1'

  const [profileRes, blocksRes, affiliationsRes] = await Promise.all([
    supabaseAdmin.from('profiles')
      .select('name, bio, avatar_url, profile_theme, plan, profile_bg_image_url, sns_line, sns_whatsapp, sns_x, sns_instagram, sns_facebook, sns_linkedin, sns_tiktok, sns_youtube, sns_threads, sns_telegram, sns_wechat, sns_discord, sns_github, sns_bluesky, sns_pinterest, sns_sansan, sns_eight, sns_mybridge, sns_vercel, sns_wantedly, sns_note')
      .eq('id', userId).single(),
    supabaseAdmin.from('profile_blocks')
      .select('id, type, size, content, order_index')
      .eq('user_id', userId).order('order_index'),
    supabaseAdmin.from('profile_affiliations')
      .select('company_name, title, phone, contact_email, website, show_phone, show_email, show_website')
      .eq('user_id', userId).order('order_index'),
  ])

  if (profileRes.error || !profileRes.data) return { notFound: true }

  const isPro = profileRes.data.plan === 'pro'
  // showAsPro: Proレイアウトで表示するか
  // preview=1 → 所有者プレビュー（Proレイアウト表示）
  // simulate_free=1 → 無課金表示を強制（プレビュー比較用）
  const showAsPro = (isPro || isPreview || isPreviewMode) && !simulateFree

  const activeTheme = showAsPro ? (profileRes.data.profile_theme || 'dark') : 'dark'
  const activeBgImage = showAsPro ? profileRes.data.profile_bg_image_url : null
  const profile = { ...profileRes.data, profile_theme: activeTheme, profile_bg_image_url: activeBgImage }

  // 有効なSNSリンクを抽出（無課金SNSバー用）
  const SNS_KEYS = ['sns_line','sns_whatsapp','sns_x','sns_instagram','sns_facebook',
    'sns_linkedin','sns_tiktok','sns_youtube','sns_threads','sns_telegram','sns_wechat',
    'sns_discord','sns_github','sns_bluesky','sns_pinterest','sns_sansan','sns_eight',
    'sns_mybridge','sns_vercel','sns_wantedly','sns_note']
  const activeSns = SNS_KEYS
    .filter(k => profile[k])
    .map(k => ({ key: k, url: profile[k] }))

  return { props: {
    profile,
    blocks: showAsPro ? (blocksRes.data || []) : [],
    affiliations: affiliationsRes.data || [],
    showAsPro,
    activeSns,
  } }
}
