import Head from 'next/head'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { SNS_CONFIG } from '../../lib/snsConfig'

const THEMES = [
  { id: 'dark',     bg: '#0a0a0a', card: '#1a1a1a', accent: '#22c55e', text: '#ffffff' },
  { id: 'light',    bg: '#f8f8f8', card: '#ffffff', accent: '#0070f3', text: '#111111' },
  { id: 'midnight', bg: '#0f172a', card: '#1e293b', accent: '#818cf8', text: '#e2e8f0' },
  { id: 'warm',     bg: '#1c1410', card: '#2d2018', accent: '#f59e0b', text: '#fef3c7' },
  { id: 'sakura',   bg: '#fff0f3', card: '#ffffff', accent: '#f43f5e', text: '#1a1a1a' },
  { id: 'ocean',    bg: '#0c1a2e', card: '#0f2744', accent: '#38bdf8', text: '#e0f2fe' },
]

function initials(name) {
  if (!name) return '?'
  return name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?'
}

function PhotoBlock({ block }) {
  if (!block.content?.image_url) return (
    <div style={{ width: '100%', height: '100%', background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 28, opacity: 0.3 }}>📷</span>
    </div>
  )
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <img
        src={block.content.image_url}
        alt={block.content.caption || ''}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {block.content.caption && (
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '32px 14px 14px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
          color: '#fff', fontSize: 12, fontWeight: 600, lineHeight: 1.5,
        }}>
          {block.content.caption}
        </div>
      )}
    </div>
  )
}

function TextBlock({ block, theme }) {
  const bg = block.content?.bg_color || theme.card
  const lightBgs = ['#ffffff', '#fff0f3', '#f8f8f8', '#fef3c7', '#f0f9ff']
  const isLight = lightBgs.some(c => bg.toLowerCase() === c.toLowerCase())
  const textColor = isLight ? '#111111' : '#ffffff'
  return (
    <div style={{
      background: bg,
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      padding: 18, gap: 6,
    }}>
      {block.content?.title && (
        <div style={{ fontSize: 15, fontWeight: 800, color: textColor, lineHeight: 1.35, letterSpacing: '-0.2px' }}>
          {block.content.title}
        </div>
      )}
      {block.content?.body && (
        <div style={{ fontSize: 13, color: textColor, opacity: 0.75, lineHeight: 1.75 }}>
          {block.content.body}
        </div>
      )}
    </div>
  )
}

function LinkBlock({ block, theme }) {
  if (!block.content?.url) return null
  const displayUrl = block.content.url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return (
    <a
      href={block.content.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', flexDirection: 'column',
        width: '100%', height: '100%',
        padding: 16, gap: 6,
        background: theme.card,
        border: '1px solid rgba(255,255,255,0.1)',
        textDecoration: 'none',
        position: 'relative',
        transition: 'opacity .15s',
      }}
    >
      <span style={{
        position: 'absolute', top: 12, right: 14,
        fontSize: 14, color: theme.text, opacity: 0.35,
      }}>↗</span>
      <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, lineHeight: 1.4, paddingRight: 20 }}>
        {block.content.title || displayUrl}
      </div>
      {block.content.description && (
        <div style={{ fontSize: 14, color: theme.text, opacity: 0.6, lineHeight: 1.6, flex: 1 }}>
          {block.content.description}
        </div>
      )}
      <div style={{
        fontSize: 12, color: theme.text, opacity: 0.4,
        fontFamily: 'DM Mono, monospace',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        marginTop: 'auto',
      }}>
        {displayUrl}
      </div>
    </a>
  )
}

function SnsBlock({ block, profile }) {
  const platform = block.content?.platform
  const cfg = SNS_CONFIG.find(s => s.key === platform)
  const url = profile[platform]
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

  return (
    <div
      onClick={() => window.open(url, '_blank')}
      style={{
        background: bgColor,
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        padding: 16,
        gap: 10,
        cursor: 'pointer',
        position: 'relative',
        transition: 'opacity 0.15s',
      }}
      onTouchStart={e => e.currentTarget.style.opacity = '0.8'}
      onTouchEnd={e => e.currentTarget.style.opacity = '1'}
    >
      <div style={{ position: 'absolute', top: 14, right: 14, color: 'rgba(255,255,255,0.5)', fontSize: 15 }}>↗</div>

      <div>
        {cfg.icon ? (
          <img
            src={`https://cdn.simpleicons.org/${cfg.icon}/ffffff`}
            width={32} height={32}
            alt={cfg.label}
            style={{ display: 'block' }}
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
          />
        ) : null}
        <div style={{
          display: cfg.icon ? 'none' : 'flex',
          width: 36, height: 36,
          borderRadius: 10,
          background: 'rgba(255,255,255,0.2)',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 900, color: '#fff',
        }}>
          {cfg.label[0]}
        </div>
      </div>

      <div>
        <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, lineHeight: 1.3, marginBottom: 2 }}>
          {cfg.label}
        </div>
        {block.content?.caption ? (
          <div style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: 11,
            lineHeight: 1.5,
            marginTop: 3,
            fontFamily: 'Noto Sans JP, sans-serif',
          }}>
            {block.content.caption}
          </div>
        ) : handleText ? (
          <div style={{
            color: 'rgba(255,255,255,0.55)', fontSize: 11,
            fontFamily: 'DM Mono, monospace',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {handleText}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function PublicProfile({ profile, blocks, affil, showAsPro, activeSns }) {
  const theme = THEMES.find(t => t.id === profile.profile_theme) || THEMES[0]

  return (
    <>
      <Head>
        <title>{profile.name || 'プロフィール'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <div className="card">
          <div className="bento-grid">
            {/* Hero block — 横並びレイアウト */}
            <div className="bento-block block-L" style={{
              background: theme.card,
              padding: '20px',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 16,
              minHeight: 'unset',
              height: 'auto',
            }}>
              <div style={{
                width: 68, height: 68, borderRadius: '50%',
                overflow: 'hidden', flexShrink: 0,
                border: `3px solid ${theme.accent}`,
                boxShadow: `0 0 0 3px ${theme.bg}, 0 0 0 5px ${theme.accent}40`,
              }}>
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: '100%', height: '100%', background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22, fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>{initials(profile.name)}</div>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  color: theme.text, fontSize: 18, fontWeight: 800,
                  lineHeight: 1.3, letterSpacing: '-0.3px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {profile.name || '名前未設定'}
                </div>
                {profile.bio && (
                  <div style={{
                    color: theme.text, opacity: 0.6,
                    fontSize: 12, lineHeight: 1.6, marginTop: 4,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {profile.bio}
                  </div>
                )}
                {affil?.company && (
                  <div style={{ color: theme.text, opacity: 0.75, fontSize: 12, fontWeight: 600, marginTop: 6, lineHeight: 1.4 }}>
                    {affil.company}{affil.title ? ` · ${affil.title}` : ''}
                  </div>
                )}
                {affil?.email && (
                  <a href={`mailto:${affil.email}`} style={{ display: 'block', color: theme.accent, fontSize: 11, marginTop: 4, textDecoration: 'none', opacity: 0.85 }}>
                    {affil.email}
                  </a>
                )}
                {affil?.phone && (
                  <a href={`tel:${affil.phone}`} style={{ display: 'block', color: theme.text, fontSize: 11, marginTop: 2, opacity: 0.5, textDecoration: 'none' }}>
                    {affil.phone}
                  </a>
                )}
                {affil?.website && (
                  <a href={affil.website} target="_blank" rel="noopener noreferrer" style={{ display: 'block', color: theme.text, fontSize: 11, marginTop: 2, opacity: 0.5, textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {affil.website.replace(/^https?:\/\//, '')}
                  </a>
                )}
                <div style={{ marginTop: 8, width: 28, height: 3, borderRadius: 2, background: theme.accent }} />
              </div>
            </div>

            {blocks.map((block, i) => {
              const sizeClass =
                block.size === 'L'  ? 'block-L'  :
                block.size === 'XL' ? 'block-XL' :
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
                  {block.type === 'photo' && <PhotoBlock block={block} theme={theme} />}
                  {block.type === 'text'  && <TextBlock  block={block} theme={theme} />}
                  {block.type === 'link'  && <LinkBlock  block={block} theme={theme} />}
                  {block.type === 'sns'   && <SnsBlock   block={block} profile={profile} theme={theme} />}
                </div>
              )
            })}
          </div>
        </div>


        {/* ── 無課金: SNSバー + アップグレード誘導 ── */}
        {!showAsPro && activeSns.length > 0 && (
          <div style={{
            background: theme.card,
            borderRadius: 20,
            padding: '20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              justifyContent: 'center',
            }}>
              {activeSns.map(({ key, url }) => {
                const cfg = SNS_CONFIG.find(s => s.key === key)
                if (!cfg) return null
                const darkBrands = ['#000000', '#010101', '#24292e', '#e7e7e7']
                const bgColor = darkBrands.includes(cfg.color) ? '#1a1a2e' : cfg.color
                return (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={cfg.label}
                    style={{
                      width: 48, height: 48,
                      borderRadius: 14,
                      background: bgColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textDecoration: 'none',
                      flexShrink: 0,
                    }}
                  >
                    {cfg.icon ? (
                      <img
                        src={`https://cdn.simpleicons.org/${cfg.icon}/ffffff`}
                        width={24} height={24}
                        alt={cfg.label}
                        style={{ display: 'block' }}
                      />
                    ) : (
                      <span style={{ color: '#fff', fontWeight: 800, fontSize: 16 }}>
                        {cfg.label[0]}
                      </span>
                    )}
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* ── 無課金: アップグレード誘導 ── */}
        {!showAsPro && (
          <a
            href="https://koryu.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '18px 20px',
              background: `linear-gradient(135deg, #1a2e22, #0d1f15)`,
              borderRadius: 20,
              textDecoration: 'none',
              border: '1px solid #2a4a34',
            }}
          >
            <span style={{ fontSize: 13, color: '#7b9e87', fontWeight: 700, letterSpacing: '.02em' }}>
              ✦ ベントーグリッドで魅せる
            </span>
            <span style={{ fontSize: 11, color: '#5a7a64', lineHeight: 1.6, textAlign: 'center' }}>
              Koryu Pro にアップグレードして{`\n`}プロフィールを自由にデザインする
            </span>
          </a>
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
          grid-auto-rows: 144px;
          gap: 12px;
        }
        .bento-block {
          position: relative;
          border-radius: 20px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.3);
          overflow: hidden;
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
  const simulateFree = query?.simulate_free === '1'

  const [profileRes, blocksRes, affiliationsRes] = await Promise.all([
    supabaseAdmin.from('profiles')
      .select('name, bio, avatar_url, profile_theme, plan, sns_line, sns_whatsapp, sns_x, sns_instagram, sns_facebook, sns_linkedin, sns_tiktok, sns_youtube, sns_threads, sns_telegram, sns_wechat, sns_discord, sns_github, sns_bluesky, sns_pinterest, sns_sansan, sns_eight, sns_mybridge, sns_vercel, sns_wantedly, sns_note')
      .eq('id', userId).single(),
    supabaseAdmin.from('profile_blocks')
      .select('id, type, size, content, order_index')
      .eq('user_id', userId).order('order_index'),
    supabaseAdmin.from('profile_affiliations')
      .select('company_name, title, phone, contact_email, website, show_phone, show_email, show_website')
      .eq('user_id', userId).order('order_index').limit(1),
  ])

  if (profileRes.error || !profileRes.data) return { notFound: true }

  const isPro = profileRes.data.plan === 'pro'
  // showAsPro: Proレイアウトで表示するか
  // preview=1 → 所有者プレビュー（Proレイアウト表示）
  // simulate_free=1 → 無課金表示を強制（プレビュー比較用）
  const showAsPro = (isPro || isPreview) && !simulateFree

  const profile = { ...profileRes.data }

  if (!showAsPro) {
    profile.avatar_url = null
    profile.profile_theme = 'dark'
  }

  // 有効なSNSリンクを抽出（無課金SNSバー用）
  const SNS_KEYS = ['sns_line','sns_whatsapp','sns_x','sns_instagram','sns_facebook',
    'sns_linkedin','sns_tiktok','sns_youtube','sns_threads','sns_telegram','sns_wechat',
    'sns_discord','sns_github','sns_bluesky','sns_pinterest','sns_sansan','sns_eight',
    'sns_mybridge','sns_vercel','sns_wantedly','sns_note']
  const activeSns = SNS_KEYS
    .filter(k => profile[k])
    .map(k => ({ key: k, url: profile[k] }))

  const primaryAffil = affiliationsRes.data?.[0] || null

  return { props: {
    profile,
    blocks: showAsPro ? (blocksRes.data || []) : [],
    showAsPro,
    activeSns,
    affil: primaryAffil ? {
      company: primaryAffil.company_name || null,
      title: primaryAffil.title || null,
      phone: primaryAffil.show_phone ? (primaryAffil.phone || null) : null,
      email: primaryAffil.show_email ? (primaryAffil.contact_email || null) : null,
      website: primaryAffil.show_website !== false ? (primaryAffil.website || null) : null,
    } : null,
  } }
}
