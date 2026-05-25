import { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useTranslation } from 'next-i18next/pages'
import { serverSideTranslations } from 'next-i18next/pages/serverSideTranslations'
import { supabase } from '../lib/supabase'
import { useRequireAuth } from '../lib/useRequireAuth'

function ConnectionBadge({ contact }) {
  const { t } = useTranslation('common')
  const snsConnected = Object.keys(contact.connected_sns || {}).length > 0
  const encounterCount = contact.encounter_count || 0

  if (!snsConnected && encounterCount === 0) return null

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      fontSize: 12, color: 'rgba(255,255,255,0.55)', flexShrink: 0,
    }}>
      {snsConnected && <span style={{ fontSize: 13 }}>🔗</span>}
      {encounterCount > 1 && <span>{t('contacts.encounter_count', { count: encounterCount })}</span>}
    </div>
  )
}

export default function Contacts() {
  const { t, i18n } = useTranslation('common')
  const { user, profile, loading: authLoading } = useRequireAuth()
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null) // null = 検索未実行
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    if (!user) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch('/api/contacts/list', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(({ data }) => {
          setContacts(data || [])
          setLoading(false)
        })
    })
  }, [user])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) {
      setSearchResults(null)
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      try {
        const r = await fetch(`/api/contacts/search?q=${encodeURIComponent(q)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await r.json()
        setSearchResults(json.data || [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  function switchLocale() {
    const next = i18n.language === 'ja' ? 'en' : 'ja'
    router.push(router.pathname, router.asPath, { locale: next })
  }

  const initials = (name) => {
    if (!name) return '?'
    return name.split(/\s+/).map(w => w[0] || '').slice(0, 2).join('').toUpperCase() || '?'
  }

  if (authLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #1e1e2a', borderTopColor: '#7b9e87', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <>
      <Head>
        <title>{t('contacts.page_title')}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <div className="shell">
        <div className="top-bar">
          <span className="top-logo">Koryu</span>
          <div className="top-right">
            {user && <span className="user-email">{user.email}</span>}
            {user && (
              <button className="logout-btn" onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/login'
              }}>{t('nav.logout')}</button>
            )}
            <button className="lang-btn" onClick={switchLocale}>{t('lang.switch')}</button>
          </div>
        </div>
        <div className="page-title">{t('contacts.header')}</div>

        <div className="search-wrap">
          <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder={t('contacts.search_placeholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="search-input"
          />
          {searching && <div className="search-spinner" />}
        </div>

        {(loading || (query.trim() && searching)) && (
          <div className="center">
            <div className="spinner" />
          </div>
        )}

        {!loading && !searching && (() => {
          const isSearchActive = query.trim() !== ''
          const displayContacts = searchResults !== null ? searchResults : contacts
          if (displayContacts.length === 0 && !isSearchActive) return (
            <div className="empty">
              <p>{t('contacts.empty')}</p>
              <button className="upload-btn" onClick={() => router.push('/?scan=1')}>{t('contacts.capture')}</button>
            </div>
          )
          if (displayContacts.length === 0 && isSearchActive) return (
            <div className="empty">
              <p>{t('contacts.no_results')}</p>
            </div>
          )
          return (
            <div className="list">
              {displayContacts.map(c => {
                const isSnsConnected = Object.keys(c.connected_sns || {}).length > 0
                return (
                  <button
                    key={c.id}
                    className="card"
                    onClick={() => router.push(`/contacts/${c.id}`)}
                    style={{
                      background: isSnsConnected ? 'rgba(22,163,74,0.1)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isSnsConnected ? 'rgba(22,163,74,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      ...(isSnsConnected && { boxShadow: 'inset 3px 0 0 #16a34a' }),
                    }}
                  >
                    <div className="avatar">{initials(c.name)}</div>
                    <div className="info">
                      <div className="name">{c.name || t('contacts.no_name')}</div>
                      <div className="meta">{c.company || '—'}</div>
                    </div>
                    <ConnectionBadge contact={c} />
                  </button>
                )
              })}
            </div>
          )
        })()}
        <nav className="bottom-nav">
          <button className="bn-item" onClick={() => router.push('/')}>
            <div className="bn-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <span className="bn-label">{t('nav.scan')}</span>
          </button>
          <div className="bn-item bn-active">
            <div className="bn-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <span className="bn-label">{t('nav.contacts')}</span>
          </div>
          <button className="bn-item" onClick={() => router.push('/settings/profile')}>
            <div className="bn-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            </div>
            <span className="bn-label">{t('nav.profile')}</span>
          </button>
        </nav>
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
          padding-bottom: 72px;
        }
        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem 0.5rem;
        }
        .top-logo {
          font-family: 'DM Mono', monospace;
          font-size: 18px;
          font-weight: 500;
          color: #7b9e87;
          letter-spacing: .06em;
        }
        .top-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .user-email {
          font-size: 11px;
          color: #5a5a6a;
          font-family: 'DM Mono', monospace;
          max-width: 130px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .logout-btn {
          background: none;
          border: none;
          color: #5a5a6a;
          font-size: 11px;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
        }
        .logout-btn:active { color: #7b9e87; }
        .lang-btn {
          background: none;
          border: 1px solid #3a3a4a;
          border-radius: 4px;
          color: #7a7670;
          font-size: 12px;
          font-family: 'DM Mono', monospace;
          cursor: pointer;
          padding: 5px 10px;
          letter-spacing: .06em;
          flex-shrink: 0;
        }
        .lang-btn:hover { color: #7b9e87; border-color: #7b9e87; }
        .page-title {
          font-size: 22px;
          font-weight: 700;
          color: #f0ede8;
          padding: 0.25rem 1.5rem 1rem;
        }
        .bottom-nav {
          position: fixed;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 100%;
          max-width: 430px;
          display: flex;
          align-items: stretch;
          background: rgba(10,10,15,0.94);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-top: 1px solid rgba(255,255,255,0.07);
          padding: 8px 0;
          padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
          z-index: 50;
        }
        .bn-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          padding: 4px 0;
          background: none;
          border: none;
          cursor: pointer;
          color: #5a5a6a;
          font-family: 'Noto Sans JP', sans-serif;
          transition: color .15s;
        }
        .bn-item:active { opacity: .7; }
        .bn-icon {
          display: flex; align-items: center; justify-content: center;
        }
        .bn-label {
          font-size: 10px;
          letter-spacing: .02em;
        }
        .bn-active { color: #7b9e87; cursor: default; }
        .center {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .spinner {
          width: 32px; height: 32px;
          border: 2px solid #1e1e2a;
          border-top-color: #7b9e87;
          border-radius: 50%;
          animation: spin .7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          padding: 2rem;
          color: #5a5650;
          font-size: 14px;
        }
        .upload-btn {
          padding: 14px 28px;
          background: #7b9e87;
          color: #0a0a0f;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          font-family: 'Noto Sans JP', sans-serif;
          cursor: pointer;
        }
        .list {
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 14px;
          padding: 1rem;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: border-color .15s;
        }
        .card:active { border-color: #7b9e87; }
        .avatar {
          width: 42px; height: 42px;
          border-radius: 50%;
          background: #1a2e22;
          color: #7b9e87;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; font-weight: 700;
          flex-shrink: 0;
          font-family: 'DM Mono', monospace;
        }
        .info { flex: 1; min-width: 0; }
        .name { font-size: 15px; font-weight: 700; color: #f0ede8; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .meta { font-size: 12px; color: #5a5650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .badge {
          font-size: 11px;
          font-family: 'DM Mono', monospace;
          padding: 3px 8px;
          border-radius: 999px;
          flex-shrink: 0;
        }
        .badge.sent { background: #0d1f15; color: #7b9e87; border: 1px solid #1a3525; }
        .badge.unsent { background: #1a1408; color: #8a6a30; border: 1px solid #2a2010; }
        .badges {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
          flex-shrink: 0;
        }
        .search-wrap {
          position: relative;
          display: flex;
          align-items: center;
          padding: 0.75rem 1.5rem;
          border-bottom: 1px solid #1e1e2a;
          gap: 10px;
        }
        .search-icon {
          color: #3a3a4a;
          flex-shrink: 0;
        }
        .search-input {
          flex: 1;
          padding: 8px 10px;
          background: #12121a;
          border: 1px solid #1e1e2a;
          border-radius: 8px;
          color: #f0ede8;
          font-size: 14px;
          font-family: 'Noto Sans JP', sans-serif;
          outline: none;
          -webkit-appearance: none;
        }
        .search-input:focus { border-color: #7b9e87; }
        .search-input::placeholder { color: #3a3a4a; }
        .search-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid #1e1e2a;
          border-top-color: #7b9e87;
          border-radius: 50%;
          animation: spin .7s linear infinite;
          flex-shrink: 0;
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
