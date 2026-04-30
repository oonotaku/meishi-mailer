import Head from 'next/head'
import { supabaseAdmin } from '../../lib/supabaseAdmin'

const SNS_DEFS = [
  { key: 'sns_line',      label: 'LINE',      color: '#06C755' },
  { key: 'sns_whatsapp',  label: 'WhatsApp',  color: '#25D366' },
  { key: 'sns_x',         label: 'X',         color: '#e7e7e7' },
  { key: 'sns_instagram', label: 'Instagram', color: '#E1306C' },
  { key: 'sns_facebook',  label: 'Facebook',  color: '#1877F2' },
  { key: 'sns_linkedin',  label: 'LinkedIn',  color: '#0A66C2' },
  { key: 'sns_tiktok',    label: 'TikTok',    color: '#e7e7e7' },
  { key: 'sns_youtube',   label: 'YouTube',   color: '#FF0000' },
  { key: 'sns_threads',   label: 'Threads',   color: '#e7e7e7' },
  { key: 'sns_telegram',  label: 'Telegram',  color: '#2AABEE' },
  { key: 'sns_wechat',    label: 'WeChat',    color: '#07C160' },
  { key: 'sns_discord',   label: 'Discord',   color: '#5865F2' },
  { key: 'sns_github',    label: 'GitHub',    color: '#e7e7e7' },
  { key: 'sns_bluesky',   label: 'Bluesky',   color: '#0085FF' },
  { key: 'sns_pinterest', label: 'Pinterest', color: '#E60023' },
]

export default function PublicProfile({ profile, affiliations }) {
  const activeSns = SNS_DEFS.filter(d => profile[d.key])

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
                    {d.label}
                  </button>
                ))}
              </div>
            </>
          )}
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
        .sns-btn {
          height: 72px;
          background: transparent;
          border: 2px solid var(--sns-color);
          border-radius: 12px;
          color: var(--sns-color);
          font-size: 14px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: opacity .15s;
        }
        .sns-btn:active { opacity: .65; }
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
      .select('name, sns_line, sns_whatsapp, sns_x, sns_instagram, sns_facebook, sns_linkedin, sns_tiktok, sns_youtube, sns_threads, sns_telegram, sns_wechat, sns_discord, sns_github, sns_bluesky, sns_pinterest')
      .eq('id', userId).single(),
    supabaseAdmin.from('profile_affiliations')
      .select('company_name, title, order_index')
      .eq('user_id', userId).order('order_index'),
  ])

  if (profileRes.error || !profileRes.data) return { notFound: true }
  return { props: { profile: profileRes.data, affiliations: affilRes.data || [] } }
}
