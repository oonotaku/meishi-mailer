import Head from 'next/head'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { SNS_CONFIG } from '../../lib/snsConfig'

export default function PublicProfile({ profile, affiliations }) {
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
          <div className="name">{profile.name || '名前未設定'}</div>

          {profile.bio && (
            <div className="bio">{profile.bio}</div>
          )}

          {affiliations.length > 0 && (
            <div className="affiliations">
              {affiliations.map((a, i) => (
                <div key={i} className="affil-row">
                  <span className="affil-company">{a.company_name}</span>
                  {a.title && <span className="affil-title">{a.title}</span>}
                </div>
              ))}
            </div>
          )}

          {activeSns.length > 0 && (
            <>
              <div className="sns-heading">SNSで繋がる</div>
              <div className="sns-grid">
                {activeSns.map(d => (
                  <button
                    key={d.key}
                    className="sns-btn"
                    style={{ '--sns-color': d.color }}
                    onClick={() => window.open(profile[d.key], '_blank')}
                  >
                    {d.icon ? (
                      <img
                        src={`https://cdn.simpleicons.org/${d.icon}/${d.color.replace('#','')}`}
                        width="22" height="22"
                        alt={d.label}
                        style={{ display: 'block', margin: '0 auto 6px' }}
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    ) : (
                      <div style={{ width: 22, height: 22, borderRadius: 4, background: d.color, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                        {d.label[0]}
                      </div>
                    )}
                    <span>{d.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

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
        html, body { min-height: 100%; background: #0a0a0f; color: #f0ede8; font-family: 'Noto Sans JP', sans-serif; }
      `}</style>

      <style jsx>{`
        .shell {
          min-height: 100svh;
          max-width: 430px;
          margin: 0 auto;
          padding: 2rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }
        .card {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
        .name {
          font-size: 28px;
          font-weight: 700;
          color: #f0ede8;
          line-height: 1.3;
        }
        .affiliations {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .affil-row {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .affil-company {
          font-size: 14px;
          color: #a0a0b0;
        }
        .affil-title {
          font-size: 13px;
          color: #6a6a7a;
        }
        .sns-heading {
          font-size: 11px;
          letter-spacing: .1em;
          color: #5a5650;
          text-transform: uppercase;
          font-family: 'DM Mono', monospace;
        }
        .sns-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .bio {
          font-size: 14px;
          color: #a0a0b0;
          line-height: 1.7;
        }
        .sns-btn {
          height: 80px;
          background: transparent;
          border: 2px solid var(--sns-color);
          border-radius: 12px;
          color: var(--sns-color);
          font-size: 11px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: opacity .15s;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 8px 4px;
        }
        .sns-btn:active { opacity: .65; }
        .app-banner {
          border: 1px solid #1e1e2a;
          border-radius: 16px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #0d0d14;
        }
        .app-banner-title {
          font-size: 15px;
          font-weight: 700;
          color: #f0ede8;
          margin-bottom: 6px;
        }
        .app-banner-desc {
          font-size: 13px;
          color: #5a5650;
          line-height: 1.6;
        }
        .app-banner-btn {
          display: block;
          text-align: center;
          background: #7b9e87;
          color: #0a0a0f;
          font-weight: 700;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          padding: 13px;
          border-radius: 10px;
          text-decoration: none;
          transition: opacity .15s;
        }
        .app-banner-btn:active { opacity: .75; }
        .footer {
          font-size: 11px;
          color: #3a3a4a;
          text-align: center;
          margin-top: auto;
          padding-top: 2rem;
        }
        .footer-link {
          color: #5a5650;
          text-decoration: none;
        }
        .footer-link:hover { color: #7b9e87; }
      `}</style>
    </>
  )
}

export async function getServerSideProps({ params }) {
  const { userId } = params

  const [profileRes, affilRes] = await Promise.all([
    supabaseAdmin.from('profiles')
      .select('name, bio, sns_line, sns_whatsapp, sns_x, sns_instagram, sns_facebook, sns_linkedin, sns_tiktok, sns_youtube, sns_threads, sns_telegram, sns_wechat, sns_discord, sns_github, sns_bluesky, sns_pinterest, sns_sansan, sns_eight, sns_mybridge, sns_vercel, sns_wantedly, sns_note')
      .eq('id', userId).single(),
    supabaseAdmin.from('profile_affiliations')
      .select('company_name, title, order_index')
      .eq('user_id', userId).order('order_index'),
  ])

  if (profileRes.error || !profileRes.data) return { notFound: true }
  return { props: { profile: profileRes.data, affiliations: affilRes.data || [] } }
}
