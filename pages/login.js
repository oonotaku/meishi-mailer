import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const router = useRouter()

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
    } else {
      const { error: err } = await supabase.auth.signUp({ email, password })
      if (err) {
        setError(err.message)
      } else {
        setInfo('確認メールを送りました。受信トレイをご確認ください。')
      }
    }

    setLoading(false)
  }

  return (
    <>
      <Head>
        <title>ログイン — 名刺メーラー</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <div className="page">
          <div className="eyebrow">AI名刺スキャナー</div>
          <h1 className="title">名刺メーラー</h1>
          <p className="sub">出会いを記録し、<br/>関係を動かす</p>

          <div className="tab-row">
            <button
              type="button"
              className={`tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
            >
              ログイン
            </button>
            <button
              type="button"
              className={`tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => switchMode('register')}
            >
              新規登録
            </button>
          </div>

          <form onSubmit={handleSubmit} className="form">
            <label className="field-label">メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="text-input"
            />

            <label className="field-label" style={{ marginTop: 14 }}>パスワード</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '6文字以上' : ''}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="text-input"
            />

            {error && (
              <div className="error-box">
                <span className="error-label">エラー</span>
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
                ? '処理中...'
                : mode === 'login' ? 'ログイン →' : 'アカウントを作成 →'}
            </button>
          </form>
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
          padding: 4rem 1.5rem 2rem;
          display: flex;
          flex-direction: column;
        }
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
      `}</style>
    </>
  )
}
