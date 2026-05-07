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

function PhotoBlock({ block, theme }) {
  if (!block.content?.image_url) return null
  return (
    <div className="bento-block-inner photo-block">
      <img src={block.content.image_url} alt={block.content.caption || ''} className="photo-img" />
      {block.content.caption && (
        <div className="photo-caption" style={{ color: theme.text }}>{block.content.caption}</div>
      )}
    </div>
  )
}

function TextBlock({ block, theme }) {
  const bg = block.content?.bg_color || theme.card
  const isLight = bg === '#ffffff' || bg === '#fff0f3' || bg === '#f8f8f8'
  const textColor = isLight ? '#111111' : theme.text
  return (
    <div className="bento-block-inner text-block" style={{ background: bg }}>
      {block.content?.title && (
        <div className="text-block-title" style={{ color: textColor }}>{block.content.title}</div>
      )}
      {block.content?.body && (
        <div className="text-block-body" style={{ color: textColor, opacity: 0.75 }}>{block.content.body}</div>
      )}
    </div>
  )
}

function LinkBlock({ block, theme }) {
  if (!block.content?.url) return null
  return (
    <a href={block.content.url} target="_blank" rel="noopener noreferrer" className="bento-block-inner link-block"
      style={{ background: theme.card, borderColor: theme.card, textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="link-block-title" style={{ color: theme.text }}>{block.content.title || block.content.url}</div>
      {block.content.description && (
        <div className="link-block-desc" style={{ color: theme.text, opacity: 0.55 }}>{block.content.description}</div>
      )}
      <div className="link-block-url" style={{ color: theme.accent }}>
        {block.content.url.replace(/^https?:\/\//, '').replace(/\/$/, '')} →
      </div>
    </a>
  )
}

function SnsBlock({ block, profile, theme }) {
  const platform = block.content?.platform
  const cfg = SNS_CONFIG.find(s => s.key === platform)
  const url = profile[platform]
  if (!cfg || !url) return null
  return (
    <button className="bento-block-inner sns-block"
      style={{ background: 'transparent', border: `1.5px solid ${cfg.color}`, color: cfg.color, cursor: 'pointer' }}
      onClick={() => window.open(url, '_blank')}>
      <span className="sns-block-icon">
        {cfg.icon ? (
          <img src={`https://cdn.simpleicons.org/${cfg.icon}/${cfg.color.replace('#','')}`}
            width="24" height="24" alt={cfg.label}
            style={{ display: 'block' }}
            onError={e => { e.target.style.display = 'none' }} />
        ) : (
          <span style={{ fontSize: 16, fontWeight: 700 }}>{cfg.label[0]}</span>
        )}
      </span>
      <span className="sns-block-label">{cfg.label}</span>
      <span className="sns-block-arrow">→</span>
    </button>
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

          {/* ── Hero ── */}
          <div className="hero">
            <div className="avatar-wrap">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.name || 'avatar'} className="avatar-img" />
              ) : (
                <div className="avatar-initials" style={{ color: theme.accent }}>{initials(profile.name)}</div>
              )}
            </div>
            <div className="name" style={{ color: theme.text }}>{profile.name || '名前未設定'}</div>
            {profile.bio && <div className="bio" style={{ color: theme.text }}>{profile.bio}</div>}
          </div>

          {/* ── Bento Grid ── */}
          {blocks.length > 0 ? (
            <div className="bento-grid">
              {blocks.map((block, i) => {
                const sizeClass = block.size === 'L' ? 'block-L' : block.size === 'S' ? 'block-S' : 'block-M'
                return (
                  <div key={block.id || i} className={`bento-block ${sizeClass}`}
                    style={{ background: theme.card, borderRadius: 16, overflow: 'hidden' }}>
                    {block.type === 'photo' && <PhotoBlock block={block} theme={theme} />}
                    {block.type === 'text'  && <TextBlock  block={block} theme={theme} />}
                    {block.type === 'link'  && <LinkBlock  block={block} theme={theme} />}
                    {block.type === 'sns'   && <SnsBlock   block={block} profile={profile} theme={theme} />}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bento-empty" style={{ color: theme.text }}>
              ブロックを追加してプロフィールをカスタマイズしましょう
            </div>
          )}
        </div>

        {/* ── App banner ── */}
        <div className="app-banner" style={{ background: theme.card }}>
          <div className="app-banner-text">
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
          <a href="https://www.meishi-mailer.com" target="_blank" rel="noopener noreferrer" className="footer-link" style={{ color: theme.text }}>
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

        /* ── Hero ── */
        .hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 10px;
        }
        .avatar-wrap {
          width: 96px;
          height: 96px;
          border-radius: 50%;
          overflow: hidden;
          background: ${theme.card};
          flex-shrink: 0;
          margin-bottom: 4px;
        }
        .avatar-img {
          width: 96px;
          height: 96px;
          object-fit: cover;
        }
        .avatar-initials {
          width: 96px;
          height: 96px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
          font-weight: 700;
          font-family: 'DM Mono', monospace;
        }
        .name {
          font-size: 26px;
          font-weight: 700;
          line-height: 1.3;
        }
        .bio {
          font-size: 14px;
          opacity: 0.6;
          line-height: 1.7;
          max-width: 320px;
        }

        /* ── Bento Grid ── */
        .bento-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .bento-block {
          min-height: 120px;
          position: relative;
          box-shadow: 0 1px 6px rgba(0,0,0,0.15);
        }
        .block-S {
          grid-column: span 1;
          aspect-ratio: 1;
        }
        .block-M {
          grid-column: span 1;
          min-height: 200px;
        }
        .block-L {
          grid-column: span 2;
          min-height: 120px;
        }
        .bento-block-inner {
          width: 100%;
          height: 100%;
          min-height: inherit;
          display: flex;
          flex-direction: column;
          padding: 16px;
        }
        .bento-empty {
          text-align: center;
          font-size: 13px;
          opacity: 0.3;
          padding: 24px;
        }

        /* Photo */
        .photo-block {
          padding: 0;
          position: relative;
        }
        .photo-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          flex: 1;
          min-height: 0;
        }
        .photo-caption {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          padding: 8px 12px;
          font-size: 11px;
          font-weight: 600;
          background: linear-gradient(transparent, rgba(0,0,0,0.6));
          color: #fff !important;
        }

        /* Text */
        .text-block {
          gap: 8px;
          padding: 16px;
        }
        .text-block-title {
          font-size: 15px;
          font-weight: 700;
          line-height: 1.4;
        }
        .text-block-body {
          font-size: 13px;
          line-height: 1.7;
        }

        /* Link */
        .link-block {
          padding: 16px;
          gap: 6px;
          transition: opacity .15s;
        }
        .link-block:active { opacity: .7; }
        .link-block-title {
          font-size: 14px;
          font-weight: 700;
          line-height: 1.4;
        }
        .link-block-desc {
          font-size: 12px;
          line-height: 1.6;
          flex: 1;
        }
        .link-block-url {
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: auto;
        }

        /* SNS */
        .sns-block {
          flex-direction: row;
          align-items: center;
          padding: 0 16px;
          gap: 12px;
          border-radius: 12px;
          font-family: 'Noto Sans JP', sans-serif;
          transition: opacity .15s;
        }
        .sns-block:active { opacity: .65; }
        .sns-block-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          flex-shrink: 0;
        }
        .sns-block-label {
          flex: 1;
          text-align: center;
          font-size: 14px;
          font-weight: 700;
        }
        .sns-block-arrow {
          font-size: 12px;
          opacity: .5;
          flex-shrink: 0;
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
        .footer-link {
          opacity: 0.4;
          text-decoration: none;
        }
        .footer-link:hover { opacity: 0.7; }
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
