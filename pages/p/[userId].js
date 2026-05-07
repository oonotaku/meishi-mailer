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
  if (!block.content?.image_url) return null
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
          padding: '20px 12px 10px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.65))',
          color: '#fff',
          fontSize: 11,
          fontWeight: 600,
          lineHeight: 1.4,
        }}>
          {block.content.caption}
        </div>
      )}
    </div>
  )
}

function TextBlock({ block, theme }) {
  const bg = block.content?.bg_color || theme.card
  const isLight = bg === '#ffffff' || bg === '#fff0f3' || bg === '#f8f8f8'
  const textColor = isLight ? '#111111' : '#ffffff'
  return (
    <div style={{
      background: bg,
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      padding: 16, gap: 8,
    }}>
      {block.content?.title && (
        <div style={{ fontSize: 15, fontWeight: 700, color: textColor, lineHeight: 1.4 }}>
          {block.content.title}
        </div>
      )}
      {block.content?.body && (
        <div style={{ fontSize: 13, color: textColor, opacity: 0.75, lineHeight: 1.7 }}>
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
      {/* ↗ アイコン */}
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
  return (
    <div
      onClick={() => window.open(url, '_blank')}
      style={{
        background: cfg.color,
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 8, cursor: 'pointer',
      }}
    >
      {cfg.icon ? (
        <img
          src={`https://cdn.simpleicons.org/${cfg.icon}/ffffff`}
          width={36} height={36}
          alt={cfg.label}
          style={{ display: 'block', filter: 'brightness(0) invert(1)' }}
          onError={e => { e.target.style.display = 'none' }}
        />
      ) : (
        <span style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{cfg.label[0]}</span>
      )}
      <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'Noto Sans JP, sans-serif' }}>
        {cfg.label}
      </span>
    </div>
  )
}

export default function PublicProfile({ profile, blocks }) {
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

          {/* ── Bento Grid ── */}
          <div className="bento-grid">
            {/* ── Hero block (固定・全幅) ── */}
            <div className="bento-block block-L" style={{
              background: theme.card,
              borderRadius: 16,
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
              minHeight: 'unset',
            }}>
              <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${theme.accent}`, flexShrink: 0 }}>
                {profile.avatar_url
                  ? <img src={profile.avatar_url} alt={profile.name || 'avatar'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: '100%', height: '100%', background: theme.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28, fontWeight: 700, fontFamily: 'DM Mono, monospace' }}>{initials(profile.name)}</div>
                }
              </div>
              <div style={{ color: theme.text, fontSize: 20, fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>
                {profile.name || '名前未設定'}
              </div>
              {profile.bio && (
                <div style={{ color: theme.text, opacity: 0.7, fontSize: 14, textAlign: 'center', lineHeight: 1.7, maxWidth: 300 }}>
                  {profile.bio}
                </div>
              )}
            </div>

            {blocks.map((block, i) => {
                const sizeClass = block.size === 'L' ? 'block-L' : block.size === 'S' ? 'block-S' : 'block-M'
                const isSns = block.type === 'sns'
                return (
                  <div
                    key={block.id || i}
                    className={`bento-block ${sizeClass}${isSns ? ' block-sns' : ''}`}
                    style={{ background: theme.card, borderRadius: 16, overflow: 'hidden' }}
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

        {/* ── App banner ── */}
        <div className="app-banner" style={{ background: theme.card }}>
          <div>
            <div className="app-banner-title" style={{ color: theme.text }}>名刺交換、その場でお礼メール。</div>
            <div className="app-banner-desc" style={{ color: theme.text }}>あなたも meishi-mailer で出会いを記録しませんか？</div>
          </div>
          <a
            href="https://www.meishi-mailer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="app-banner-btn"
            style={{ background: theme.accent, color: theme.bg }}
          >
            無料で始める →
          </a>
        </div>

        <div className="footer" style={{ color: theme.text }}>
          このページは{' '}
          <a href="https://www.meishi-mailer.com" target="_blank" rel="noopener noreferrer"
            style={{ color: theme.text, opacity: 0.4, textDecoration: 'none' }}>
            meishi-mailer
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
          padding: 2.5rem 1.25rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        .card {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* ── Bento Grid ── */
        .bento-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .bento-block {
          position: relative;
          box-shadow: 0 2px 12px rgba(0,0,0,0.3);
          overflow: hidden;
        }
        .block-S {
          grid-column: span 1;
          height: 120px;
        }
        .block-M {
          grid-column: span 1;
          min-height: 180px;
        }
        .block-L {
          grid-column: span 2;
          min-height: 120px;
        }
        /* SNSブロックは S/M どちらでも固定高さ */
        .block-sns.block-S,
        .block-sns.block-M {
          height: 120px;
          min-height: unset;
        }
        .block-sns.block-L {
          height: 120px;
          min-height: unset;
        }
        .bento-empty {
          text-align: center;
          font-size: 13px;
          opacity: 0.3;
          padding: 24px;
        }

        /* ── App banner ── */
        .app-banner {
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          box-shadow: 0 1px 6px rgba(0,0,0,0.15);
        }
        .app-banner-title {
          font-size: 15px;
          font-weight: 700;
          margin-bottom: 6px;
        }
        .app-banner-desc {
          font-size: 13px;
          opacity: 0.45;
          line-height: 1.6;
        }
        .app-banner-btn {
          display: block;
          text-align: center;
          font-weight: 700;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          padding: 13px;
          border-radius: 10px;
          text-decoration: none;
          transition: opacity .15s;
        }
        .app-banner-btn:active { opacity: .75; }

        /* ── Footer ── */
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

export async function getServerSideProps({ params }) {
  const { userId } = params

  const [profileRes, blocksRes] = await Promise.all([
    supabaseAdmin.from('profiles')
      .select('name, bio, avatar_url, profile_theme, sns_line, sns_whatsapp, sns_x, sns_instagram, sns_facebook, sns_linkedin, sns_tiktok, sns_youtube, sns_threads, sns_telegram, sns_wechat, sns_discord, sns_github, sns_bluesky, sns_pinterest, sns_sansan, sns_eight, sns_mybridge, sns_vercel, sns_wantedly, sns_note')
      .eq('id', userId).single(),
    supabaseAdmin.from('profile_blocks')
      .select('id, type, size, content, order_index')
      .eq('user_id', userId).order('order_index'),
  ])

  if (profileRes.error || !profileRes.data) return { notFound: true }
  return { props: { profile: profileRes.data, blocks: blocksRes.data || [] } }
}
