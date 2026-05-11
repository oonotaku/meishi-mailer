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
  const fit = block.content?.fit || 'cover'
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: fit === 'contain' ? '#0a0a14' : 'transparent' }}>
      <img
        src={block.content.image_url}
        alt={block.content.caption || ''}
        style={{ width: '100%', height: '100%', objectFit: fit, display: 'block' }}
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
  const hasBgImage = !!block.content?.bg_image_url
  const bg = hasBgImage ? 'transparent' : (block.content?.bg_color || theme.card)
  const lightBgs = ['#ffffff', '#fff0f3', '#f8f8f8', '#fef3c7', '#f0f9ff']
  const isLight = lightBgs.some(c => bg.toLowerCase() === c.toLowerCase())
  const textColor = hasBgImage ? '#ffffff' : (isLight ? '#111111' : '#ffffff')
  return (
    <div style={{
      background: bg,
      backgroundImage: hasBgImage ? `url(${block.content.bg_image_url})` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      padding: 18, gap: 6,
      position: 'relative',
    }}>
      {hasBgImage && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.1) 60%)',
          borderRadius: 'inherit',
        }} />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {block.content?.title && (
          <div style={{ fontSize: 15, fontWeight: 800, color: textColor, lineHeight: 1.35, letterSpacing: '-0.2px' }}>
            {block.content.title}
          </div>
        )}
        {block.content?.body && (
          <div style={{ fontSize: 13, color: textColor, opacity: hasBgImage ? 0.9 : 0.75, lineHeight: 1.75 }}>
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
  return (
    <a
      href={block.content.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex', flexDirection: 'column',
        width: '100%', height: '100%',
        background: theme.card,
        border: '1px solid rgba(255,255,255,0.1)',
        textDecoration: 'none',
        position: 'relative',
        transition: 'opacity .15s',
        overflow: 'hidden',
      }}
    >
      {hasImage && (
        <div style={{ width: '100%', height: 90, overflow: 'hidden', flexShrink: 0, borderRadius: '14px 14px 0 0' }}>
          <img src={block.content.image_url} alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}
      <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
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

function ProfileCardBlock({ block, profile, affiliations, theme }) {
  const affs = affiliations || []
  const contacts = affs.flatMap(a => [
    a.show_email && a.contact_email ? { type: 'email', value: a.contact_email } : null,
    a.show_phone && a.phone         ? { type: 'phone', value: a.phone }         : null,
    a.show_website !== false && a.website ? { type: 'web', value: a.website }   : null,
  ]).filter(Boolean).filter((c, i, arr) => arr.findIndex(x => x.value === c.value) === i)

  return (
    <div style={{
      background: theme.card,
      width: '100%', minHeight: '100%',
      padding: '18px 18px 14px',
      display: 'flex', flexDirection: 'row',
      gap: 14, alignItems: 'flex-start',
    }}>
      {/* アバター */}
      <div style={{ flexShrink: 0 }}>
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" style={{
            width: 56, height: 56, borderRadius: '50%',
            objectFit: 'cover',
            border: `2px solid ${theme.accent}`,
          }} />
        ) : (
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: theme.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: '#fff',
          }}>
            {initials(profile.name)}
          </div>
        )}
      </div>

      {/* テキスト */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: theme.text, lineHeight: 1.2 }}>
          {profile.name || '名前未設定'}
        </div>
        {profile.bio && (
          <div style={{ fontSize: 12, color: theme.text, opacity: 0.6, marginTop: 5, lineHeight: 1.6 }}>
            {profile.bio}
          </div>
        )}

        {/* 所属リスト */}
        {affs.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {affs.map((aff, idx) => (
              <div key={idx} style={{
                borderTop: `1px solid ${theme.accent}28`,
                paddingTop: 6,
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.accent, lineHeight: 1.3 }}>
                  {aff.company_name}
                </div>
                {aff.title && (
                  <div style={{ fontSize: 11, color: theme.text, opacity: 0.5, marginTop: 1 }}>
                    {aff.title}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 連絡先 */}
        {contacts.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {contacts.map((c, idx) => {
              const href = c.type === 'email' ? `mailto:${c.value}` : c.type === 'phone' ? `tel:${c.value}` : c.value
              const icon  = c.type === 'email' ? '✉' : c.type === 'phone' ? '☎' : '🔗'
              const label = c.type === 'web' ? c.value.replace(/^https?:\/\//, '').replace(/\/$/, '') : c.value
              return (
                <a key={idx} href={href} target={c.type === 'web' ? '_blank' : undefined}
                  rel={c.type === 'web' ? 'noopener noreferrer' : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 11, color: c.type === 'email' ? theme.accent : theme.text,
                    opacity: c.type === 'email' ? 0.85 : 0.45,
                    textDecoration: 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                  <span style={{ flexShrink: 0 }}>{icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function AffiliationBlock({ block, theme }) {
  const { company_name, title, logo_url, bg_color } = block.content || {}
  const hasLogo = !!logo_url
  const bgColor = bg_color || theme.card
  return (
    <div style={{
      background: hasLogo ? 'transparent' : bgColor,
      backgroundImage: hasLogo ? `url(${logo_url})` : 'none',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      width: '100%', height: '100%',
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      justifyContent: 'flex-end', padding: 16,
    }}>
      {hasLogo && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.08) 65%)',
          borderRadius: 'inherit',
        }} />
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: 14, fontWeight: 800,
          color: hasLogo ? '#fff' : theme.text,
          lineHeight: 1.3,
        }}>
          {company_name || '会社名未設定'}
        </div>
        {title && (
          <div style={{
            fontSize: 11, marginTop: 3,
            color: hasLogo ? 'rgba(255,255,255,0.65)' : theme.text,
            opacity: hasLogo ? 1 : 0.6,
          }}>
            {title}
          </div>
        )}
      </div>
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
          grid-auto-rows: minmax(144px, auto);
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

  return { props: {
    profile,
    blocks: showAsPro ? (blocksRes.data || []) : [],
    affiliations: affiliationsRes.data || [],
    showAsPro,
    activeSns,
  } }
}
