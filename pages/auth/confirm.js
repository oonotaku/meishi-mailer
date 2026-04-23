import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'

export default function AuthConfirm() {
  const router = useRouter()
  // 'loading' | 'form' | 'error'
  const [stage, setStage] = useState('loading')
  const [initError, setInitError] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    if (!router.isReady) return

    // PKCE フロー: ?code=... がある場合
    const code = router.query.code
    if (code) {
      supabase.auth.exchangeCodeForSession(String(code))
        .then(({ error }) => {
          if (error) {
            setInitError(error.message)
            setStage('error')
          } else {
            setStage('form')
          }
        })
      return
    }

    // Implicit フロー: #access_token=... は supabase-js が自動処理
    // onAuthStateChange で SIGNED_IN を待つ
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        setStage('form')
        subscription.unsubscribe()
      }
    })

    // すでにセッションがある場合（リロード等）
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStage('form')
        subscription.unsubscribe()
      }
    })

    // 30秒待ってもセッションが来なければタイムアウト
    const timeout = setTimeout(() => {
      setInitError('招待リンクが無効か期限切れです。再度招待を依頼してください。')
      setStage('error')
      subscription.unsubscribe()
    }, 30000)

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [router.isReady, router.query.code]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e) {
    e.preventDefault()
    setSaveError('')

    if (password.length < 8) {
      setSaveError('パスワードは8文字以上で入力してください')
      return
    }
    if (password !== passwordConfirm) {
      setSaveError('パスワードが一致しません')
      return
    }

    setSaving(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) throw updateErr

      // プロフィール・チーム所属を確定
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await fetch('/api/auth/ensure-profile', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
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
        <title>パスワード設定 — 名刺メーラー</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        {stage === 'loading' && (
          <div className="center">
            <div className="spinner" />
            <p className="hint">招待を確認しています…</p>
          </div>
        )}

        {stage === 'error' && (
          <div className="center">
            <div className="error-icon">✕</div>
            <p className="error-text">{initError}</p>
            <button className="ghost-btn" onClick={() => router.push('/login')}>ログインへ</button>
          </div>
        )}

        {stage === 'form' && (
          <div className="card">
            <div className="logo">名刺メーラー</div>
            <h1 className="title">パスワードを設定</h1>
            <p className="desc">チームへの参加を完了するため、パスワードを設定してください。</p>

            <form onSubmit={handleSubmit} className="form">
              <label className="label">パスワード</label>
              <input
                type="password"
                className="input"
                placeholder="8文字以上"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />

              <label className="label" style={{ marginTop: 14 }}>パスワード（確認）</label>
              <input
                type="password"
                className="input"
                placeholder="もう一度入力"
                value={passwordConfirm}
                onChange={e => setPasswordConfirm(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />

              {saveError && (
                <div className="error-box">{saveError}</div>
              )}

              <button type="submit" className="submit-btn" disabled={saving}>
                {saving ? '設定中...' : 'パスワードを設定してチームに参加'}
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
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
        }
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
        .hint {
          font-size: 13px;
          color: #5a5650;
          font-family: 'DM Mono', monospace;
        }
        .error-icon {
          width: 48px; height: 48px;
          border-radius: 50%;
          background: #1a0a0a;
          border: 1px solid #2a1010;
          color: #c08080;
          display: flex; align-items: center; justify-content: center;
          font-size: 20px;
        }
        .error-text {
          font-size: 14px;
          color: #c08080;
          max-width: 300px;
          line-height: 1.6;
        }
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
        .title {
          font-size: 22px;
          font-weight: 700;
          color: #f0ede8;
          margin-bottom: 8px;
        }
        .desc {
          font-size: 13px;
          color: #5a5650;
          line-height: 1.7;
          margin-bottom: 1.5rem;
        }
        .form {
          display: flex;
          flex-direction: column;
        }
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
