import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { supabase } from '../../lib/supabase'

export default function AuthConfirm() {
  const { t, i18n } = useTranslation('common')
  const router = useRouter()
  const [stage, setStage] = useState('loading')
  const [initError, setInitError] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function init() {
      if (router.isReady && router.query.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(String(router.query.code))
        if (cancelled) return
        if (error) { setInitError(error.message); setStage('error') }
        else setStage('form')
        return
      }

      if (typeof window !== 'undefined') {
        const hash = window.location.hash.slice(1)
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (cancelled) return
          if (error) { setInitError(error.message); setStage('error') }
          else setStage('form')
          return
        }
      }

      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return
      if (session) { setStage('form'); return }

      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
        if (cancelled) return
        if (event === 'SIGNED_IN' && s) {
          setStage('form')
          subscription.unsubscribe()
        }
      })

      const timeout = setTimeout(() => {
        if (!cancelled) {
          subscription.unsubscribe()
          setInitError(t('auth_confirm.invalid_link'))
          setStage('error')
        }
      }, 20000)

      return () => {
        subscription.unsubscribe()
        clearTimeout(timeout)
      }
    }

    const cleanup = init()
    return () => {
      cancelled = true
      cleanup?.then?.(fn => fn?.())
    }
  }, [router.isReady, router.query.code]) // eslint-disable-line react-hooks/exhaustive-deps

  function switchLocale() {
    const next = i18n.language === 'ja' ? 'en' : 'ja'
    router.push(router.pathname, router.asPath, { locale: next })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaveError('')

    if (password.length < 8) { setSaveError(t('auth_confirm.err_too_short')); return }
    if (password !== passwordConfirm) { setSaveError(t('auth_confirm.err_mismatch')); return }

    setSaving(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw updateErr

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await fetch('/api/auth/ensure-profile', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Accept-Language': i18n.language || 'ja',
          },
        })
      }

      router.replace('/')
    } catch (err) {
      setSaveError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Head>
        <title>{t('auth_confirm.page_title')}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <div className="top-lang">
          <button className="lang-btn" onClick={switchLocale}>{t('lang.switch')}</button>
        </div>

        {stage === 'loading' && (
          <div className="center">
            <div className="spinner" />
            <p className="hint">{t('auth_confirm.loading_hint')}</p>
          </div>
        )}

        {stage === 'error' && (
          <div className="center">
            <div className="error-icon">✕</div>
            <p className="error-text">{initError}</p>
            <button className="ghost-btn" onClick={() => router.push('/login')}>{t('auth_confirm.to_login')}</button>
          </div>
        )}

        {stage === 'form' && (
          <div className="card">
            <div className="logo">{t('auth_confirm.logo')}</div>
            <h1 className="title">{t('auth_confirm.title')}</h1>
            <p className="desc">{t('auth_confirm.desc')}</p>

            <form onSubmit={handleSubmit} className="form">
              <label className="label">{t('auth_confirm.password_label')}</label>
              <input
                type="password"
                className="input"
                placeholder={t('auth_confirm.password_placeholder')}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />

              <label className="label" style={{ marginTop: 14 }}>{t('auth_confirm.password_confirm_label')}</label>
              <input
                type="password"
                className="input"
                placeholder={t('auth_confirm.password_confirm_placeholder')}
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />

              {saveError && <div className="error-box">{saveError}</div>}

              <button type="submit" className="submit-btn" disabled={saving}>
                {saving ? t('auth_confirm.submitting') : t('auth_confirm.submit')}
              </button>
            </form>
          </div>
        )}
      </div>

      <style jsx global>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; background: #0a0a0f; color: #f0ede8; font-family: 'Noto Sans JP', sans-serif; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <style jsx>{`
        .shell {
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          position: relative;
        }
        .top-lang {
          position: absolute;
          top: 1.25rem;
          right: 1.5rem;
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
        .center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          text-align: center;
        }
        .spinner {
          width: 32px; height: 32px;
          border: 2px solid #1e1e2a;
          border-top-color: #7b9e87;
          border-radius: 50%;
          animation: spin .7s linear infinite;
        }
        .hint { font-size: 13px; color: #5a5650; font-family: 'DM Mono', monospace; }
        .error-icon {
          width: 48px; height: 48px;
          border-radius: 50%;
          background: #1a0a0a;
          border: 1px solid #2a1010;
          color: #c08080;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
        }
        .error-text { font-size: 14px; color: #c08080; max-width: 300px; line-height: 1.6; }
        .ghost-btn {
          background: none;
          border: 1px solid #1e1e2a;
          color: #7b9e87;
          padding: 10px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: border-color .15s;
        }
        .ghost-btn:hover { border-color: #7b9e87; }
        .card {
          width: 100%;
          max-width: 400px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 16px;
          padding: 2rem 1.75rem;
        }
        .logo {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          color: #5a5650;
          letter-spacing: .1em;
          text-transform: uppercase;
          margin-bottom: 1.5rem;
        }
        .title { font-size: 22px; font-weight: 700; color: #f0ede8; margin-bottom: 8px; }
        .desc { font-size: 13px; color: #5a5650; line-height: 1.7; margin-bottom: 1.5rem; }
        .form { display: flex; flex-direction: column; }
        .label {
          display: block;
          font-size: 11px;
          color: #5a5650;
          letter-spacing: .06em;
          text-transform: uppercase;
          margin-bottom: 5px;
          font-family: 'DM Mono', monospace;
        }
        .input {
          width: 100%;
          padding: 11px 14px;
          background: #0a0a0f;
          border: 1px solid #1e1e2a;
          border-radius: 10px;
          color: #f0ede8;
          font-size: 15px;
          font-family: 'Noto Sans JP', sans-serif;
          outline: none;
        }
        .input:focus { border-color: #7b9e87; }
        .error-box {
          margin-top: 12px;
          padding: 10px 14px;
          background: #1a0a0a;
          border: 1px solid #2a1010;
          border-radius: 8px;
          font-size: 13px;
          color: #c08080;
          line-height: 1.6;
        }
        .submit-btn {
          margin-top: 20px;
          width: 100%;
          padding: 15px;
          background: #7b9e87;
          color: #0a0a0f;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          transition: opacity .15s;
        }
        .submit-btn:disabled { opacity: .6; cursor: not-allowed; }
        .submit-btn:not(:disabled):active { opacity: .8; }
      `}</style>
    </>
  )
}

export const getStaticProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale, ['common'])),
  },
})
