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

export default function PublicProfile({ profile, affiliations }) {
  const theme = THEMES.find(t => t.id === profile.profile_theme) || THEMES[0]
  const activeSns = SNS_CONFIG.filter(d => profile[d.key])

  return (
    <>
      <Head>
        <title>{profile.name || 'プロフィール'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <div className="card">

          {/* ── Avatar + Name + Bio ── */}
          <div className="hero">
            <div className="avatar-wrap">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.name || 'avatar'} className="avatar-img" />
              ) : (
                <div className="avatar-initials">{initials(profile.name)}</div>
              )}
            </div>
            <div className="name">{profile.name || '名前未設定'}</div>
            {profile.bio && <div className="bio">{profile.bio}</div>}
          </div>

          {/* ── Affiliation cards ── */}
          {affiliations.length > 0 && (
            <div className="affiliations">
              {affiliations.map((a, i) => (
                <div key={i} className="affil-card">
                  <div className="affil-company">{a.company_name}</div>
                  {a.title && <div className="affil-title">{a.title}</div>}
                  {((a.show_website && a.website) || (a.show_phone && a.phone) || (a.show_email && a.contact_email)) && (
                    <div className="contact-links">
                      {a.show_website && a.website && (
                        <a href={a.website} target="_blank" rel="noopener noreferrer" className="contact-link">
                          <span className="contact-icon">🌐</span>
                          <span>{a.website.replace(/^https?:\/\//, '')}</span>
                        </a>
                      )}
                      {a.show_phone && a.phone && (
                        <a href={`tel:${a.phone}`} className="contact-link">
                          <span className="contact-icon">📞</span>
                          <span>{a.phone}</span>
                        </a>
                      )}
                      {a.show_email && a.contact_email && (
                        <a href={`mailto:${a.contact_email}`} className="contact-link">
                          <span className="contact-icon">✉</span>
                          <span>{a.contact_email}</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── SNS buttons ── */}
          {activeSns.length > 0 && (
            <div className="sns-section">
              <div className="sns-heading">SNSで繋がる</div>
              <div className="sns-list">
                {activeSns.map(d => (
                  <button
                    key={d.key}
                    className="sns-btn"
                    style={{ '--sns-color': d.color }}
                    onClick={() => window.open(profile[d.key], '_blank')}
                  >
                    <span className="sns-icon-wrap">
                      {d.icon ? (
                        <img
                          src={`https://cdn.simpleicons.org/${d.icon}/${d.color.replace('#','')}`}
                          width="20" height="20"
                          alt={d.label}
                          style={{ display: 'block' }}
                          onError={e => { e.target.style.display = 'none' }}
                        />
                      ) : (
                        <div style={{ width: 20, height: 20, borderRadius: 4, background: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>
                          {d.label[0]}
                        </div>
                      )}
                    </span>
                    <span className="sns-label">{d.label}</span>
                    <span className="sns-arrow">→</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── App banner ── */}
        <div className="app-banner">
          <div className="app-banner-text">
            <div className="app-banner-title">名刺交換、その場でお礼メール。</div>
            <div className="app-banner-desc">あなたも meishi-mailer で出会いを記録しませんか？</div>
          </div>
          <a
            href="https://www.meishi-mailer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="app-banner-btn"
          >
            無料で始める →
          </a>
        </div>

        <div className="footer">
          このページは{' '}
          <a href="https://www.meishi-mailer.com" target="_blank" rel="noopener noreferrer" className="footer-link">
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
          padding: 2.5rem 1.5rem 2rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        .card {
          display: flex;
          flex-direction: column;
          gap: 2rem;
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
          color: ${theme.accent};
        }
        .name {
          font-size: 26px;
          font-weight: 700;
          color: ${theme.text};
          line-height: 1.3;
        }
        .bio {
          font-size: 14px;
          color: ${theme.text};
          opacity: 0.6;
          line-height: 1.7;
          max-width: 320px;
        }

        /* ── Affiliations ── */
        .affiliations {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .affil-card {
          border: 1px solid ${theme.card};
          border-radius: 14px;
          padding: 16px 18px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          background: ${theme.card};
          box-shadow: 0 1px 6px rgba(0,0,0,0.15);
        }
        .affil-company {
          font-size: 15px;
          font-weight: 700;
          color: ${theme.text};
        }
        .affil-title {
          font-size: 13px;
          color: ${theme.text};
          opacity: 0.5;
        }
        .contact-links {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 10px;
        }
        .contact-link {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
          color: ${theme.text};
          opacity: 0.6;
          text-decoration: none;
          transition: opacity .15s;
          word-break: break-all;
        }
        .contact-link:hover { opacity: 1; }
        .contact-icon {
          font-size: 15px;
          flex-shrink: 0;
          width: 20px;
          text-align: center;
        }

        /* ── SNS ── */
        .sns-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .sns-heading {
          font-size: 11px;
          letter-spacing: .1em;
          color: ${theme.text};
          opacity: 0.35;
          text-transform: uppercase;
          font-family: 'DM Mono', monospace;
        }
        .sns-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .sns-btn {
          width: 100%;
          height: 56px;
          background: transparent;
          border: 1.5px solid var(--sns-color);
          border-radius: 12px;
          color: var(--sns-color);
          font-size: 14px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: opacity .15s;
          display: flex;
          align-items: center;
          padding: 0 16px;
          position: relative;
        }
        .sns-btn:active { opacity: .65; }
        .sns-icon-wrap {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          flex-shrink: 0;
        }
        .sns-label {
          flex: 1;
          text-align: center;
        }
        .sns-arrow {
          font-size: 12px;
          opacity: .5;
          flex-shrink: 0;
        }

        /* ── App banner ── */
        .app-banner {
          border: 1px solid ${theme.card};
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: ${theme.card};
          box-shadow: 0 1px 6px rgba(0,0,0,0.15);
        }
        .app-banner-title {
          font-size: 15px;
          font-weight: 700;
          color: ${theme.text};
          margin-bottom: 6px;
        }
        .app-banner-desc {
          font-size: 13px;
          color: ${theme.text};
          opacity: 0.45;
          line-height: 1.6;
        }
        .app-banner-btn {
          display: block;
          text-align: center;
          background: ${theme.accent};
          color: ${theme.bg};
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
          color: ${theme.text};
          opacity: 0.25;
          text-align: center;
          margin-top: auto;
          padding-top: 1rem;
        }
        .footer-link {
          color: ${theme.text};
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

  const [profileRes, affilRes] = await Promise.all([
    supabaseAdmin.from('profiles')
      .select('name, bio, avatar_url, profile_theme, sns_line, sns_whatsapp, sns_x, sns_instagram, sns_facebook, sns_linkedin, sns_tiktok, sns_youtube, sns_threads, sns_telegram, sns_wechat, sns_discord, sns_github, sns_bluesky, sns_pinterest, sns_sansan, sns_eight, sns_mybridge, sns_vercel, sns_wantedly, sns_note')
      .eq('id', userId).single(),
    supabaseAdmin.from('profile_affiliations')
      .select('company_name, title, order_index, phone, website, contact_email, show_phone, show_website, show_email')
      .eq('user_id', userId).order('order_index'),
  ])

  if (profileRes.error || !profileRes.data) return { notFound: true }
  return { props: { profile: profileRes.data, affiliations: affilRes.data || [] } }
}
