import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { t, i18n } = useTranslation('common')
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const router = useRouter()

  function switchLocale() {
    const next = i18n.language === 'ja' ? 'en' : 'ja'
    router.push(router.pathname, router.asPath, { locale: next })
  }

  function switchMode(m) {
    setMode(m)
    setError('')
    setInfo('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) {
        setError(err.message)
      } else {
        router.replace('/')
      }
    } else if (mode === 'forgot') {
      const redirectTo = `${window.location.origin}/auth/confirm`
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (err) {
        setError(err.message)
      } else {
        setInfo(t('login.reset_sent'))
      }
    } else {
      const locale = i18n.language || 'ja'
      const baseUrl = window.location.origin
      const redirectTo = locale === 'ja'
        ? `${baseUrl}/`
        : `${baseUrl}/${locale}/`

      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo }
      })
      if (err) {
        setError(err.message)
      } else {
        setInfo(t('login.confirm_sent'))
      }
    }

    setLoading(false)
  }

  return (
    <>
      <Head>
        <title>{t('login.page_title')}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <div className="page">
          <div className="top-lang">
            <button className="lang-btn" onClick={switchLocale}>{t('lang.switch')}</button>
          </div>
          <div className="eyebrow">{t('app.tagline')}</div>
          <h1 className="title">{t('app.name')}</h1>
          <p className="sub">{t('login.sub_line1')}<br/>{t('login.sub_line2')}</p>

          <div className="tab-row">
            <button
              type="button"
              className={`tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
            >
              {t('login.tab_login')}
            </button>
            <button
              type="button"
              className={`tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => switchMode('register')}
            >
              {t('login.tab_register')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="form">
            <label className="field-label">{t('login.email_label')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="text-input"
            />

            {mode !== 'forgot' && (
              <>
                <label className="field-label" style={{ marginTop: 14 }}>{t('login.password_label')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? t('login.password_hint_register') : ''}
                  required
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="text-input"
                />
                {mode === 'login' && (
                  <button
                    type="button"
                    className="forgot-link"
                    onClick={() => switchMode('forgot')}
                  >
                    {t('login.forgot_link')}
                  </button>
                )}
              </>
            )}

            {mode === 'forgot' && (
              <p className="forgot-desc">{t('login.forgot_desc')}</p>
            )}

            {error && (
              <div className="error-box">
                <span className="error-label">{t('error.label')}</span>
                <p className="error-msg">{error}</p>
              </div>
            )}

            {info && (
              <div className="info-box">
                <p className="info-msg">{info}</p>
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading
                ? t('login.loading')
                : mode === 'login'
                  ? t('login.submit_login')
                  : mode === 'forgot'
                    ? t('login.submit_forgot')
                    : t('login.submit_register')}
            </button>

            {info && mode === 'forgot' && (
              <button type="button" className="ghost-link" onClick={() => switchMode('login')}>
                {t('login.back_to_login')}
              </button>
            )}

            {mode === 'register' && (
              <p className="privacy-notice">
                {i18n.language === 'en'
                  ? <>By signing up, you agree to our <a href="/privacy" className="privacy-link">Privacy Policy</a> and <a href="/terms" className="privacy-link">Terms of Service</a>.</>
                  : <>登録することで<a href="/privacy" className="privacy-link">プライバシーポリシー</a>と<a href="/terms" className="privacy-link">利用規約</a>に同意したことになります。</>
                }
              </p>
            )}
          </form>
        </div>

        <div className="page-footer">
          <a href="/privacy" className="footer-link">
            {i18n.language === 'en' ? 'Privacy Policy' : 'プライバシーポリシー'}
          </a>
          <span className="footer-sep">·</span>
          <a href="/terms" className="footer-link">
            {i18n.language === 'en' ? 'Terms of Service' : '利用規約'}
          </a>
        </div>
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0a0a0f; color: #f0ede8; font-family: 'Noto Sans JP', sans-serif; }
      `}</style>

      <style jsx>{`
        .shell {
          min-height: 100svh;
          max-width: 430px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
        }
        .page {
          flex: 1;
          padding: 3rem 1.5rem 2rem;
          display: flex;
          flex-direction: column;
        }
        .top-lang {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 1rem;
        }
        .lang-btn {
          background: none;
          border: 1px solid #2a2a3a;
          border-radius: 4px;
          color: #5a5650;
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          padding: 2px 6px;
          letter-spacing: .06em;
        }
        .lang-btn:hover { color: #7b9e87; border-color: #7b9e87; }
        .eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: .12em;
          color: #7b9e87;
          text-transform: uppercase;
          margin-bottom: .75rem;
        }
        .title {
          font-size: 36px;
          font-weight: 700;
          color: #f0ede8;
          margin-bottom: .5rem;
        }
        .sub {
          font-size: 15px;
          color: #8a8680;
          line-height: 1.7;
          margin-bottom: 2.5rem;
        }
        .tab-row {
          display: flex;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          padding: 3px;
          margin-bottom: 1.75rem;
        }
        .tab {
          flex: 1;
          padding: 9px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: #5a5650;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: all .15s;
        }
        .tab.active {
          background: #1a2e22;
          color: #7b9e87;
          font-weight: 700;
        }
        .form {
          display: flex;
          flex-direction: column;
        }
        .field-label {
          display: block;
          font-size: 11px;
          color: #5a5650;
          letter-spacing: .06em;
          text-transform: uppercase;
          margin-bottom: 6px;
          font-family: 'DM Mono', monospace;
        }
        .text-input {
          width: 100%;
          padding: 12px 14px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          color: #f0ede8;
          font-size: 15px;
          font-family: 'Noto Sans JP', sans-serif;
          outline: none;
          -webkit-appearance: none;
        }
        .text-input:focus { border-color: #7b9e87; }
        .text-input::placeholder { color: #3a3a4a; }
        .error-box {
          background: #1a0a0a;
          border: 1px solid #2a1010;
          border-radius: 10px;
          padding: 12px;
          margin-top: 14px;
        }
        .error-label {
          display: block;
          font-size: 10px;
          font-family: 'DM Mono', monospace;
          color: #e24b4a;
          letter-spacing: .08em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .error-msg { font-size: 13px; color: #c08080; }
        .info-box {
          background: #0d1f15;
          border: 1px solid #1a3525;
          border-radius: 10px;
          padding: 12px;
          margin-top: 14px;
        }
        .info-msg { font-size: 13px; color: #7b9e87; line-height: 1.6; }
        .submit-btn {
          width: 100%;
          padding: 16px;
          background: #7b9e87;
          color: #0a0a0f;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          margin-top: 20px;
          transition: opacity .15s;
        }
        .submit-btn:disabled { opacity: .6; cursor: not-allowed; }
        .submit-btn:not(:disabled):active { opacity: .8; }
        .privacy-notice {
          margin-top: 12px;
          font-size: 11px;
          color: #4a4a5a;
          text-align: center;
          line-height: 1.6;
        }
        .privacy-link {
          color: #5a6a7a;
          text-decoration: underline;
        }
        .privacy-link:hover { color: #7b9e87; }
        .forgot-link {
          background: none;
          border: none;
          color: #5a5650;
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          padding: 4px 0;
          margin-top: 6px;
          text-decoration: underline;
          text-align: right;
          align-self: flex-end;
        }
        .forgot-link:hover { color: #7b9e87; }
        .forgot-desc {
          font-size: 13px;
          color: #5a5650;
          line-height: 1.7;
          margin-bottom: 1.25rem;
          margin-top: 14px;
        }
        .ghost-link {
          background: none;
          border: none;
          color: #7b9e87;
          font-size: 13px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          padding: 8px 0;
          text-decoration: underline;
          margin-top: 8px;
          text-align: center;
        }
        .page-footer {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          padding: 0 1.5rem 2rem;
        }
        .footer-link {
          font-size: 11px;
          color: #3a3a4a;
          font-family: 'DM Mono', monospace;
          text-decoration: none;
          letter-spacing: .04em;
        }
        .footer-link:hover { color: #5a5650; }
        .footer-sep {
          font-size: 11px;
          color: #2a2a3a;
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
