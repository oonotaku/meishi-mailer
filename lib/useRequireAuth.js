import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from './supabase'

export function useRequireAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    // onAuthStateChange が一度でも init を呼んだら true にして二重呼び出しを防ぐ
    let resolved = false

    async function init(session) {
      if (!session) {
        if (mounted) { setLoading(false); router.replace('/login') }
        return
      }
      try {
        const res = await fetch('/api/auth/ensure-profile', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Accept-Language': router.locale || 'ja',
          },
        })
        const json = await res.json()
        if (!mounted) return
        if (!res.ok) throw new Error(json.error || 'ensure-profile failed')
        setUser(session.user)
        setProfile(json.profile)
      } catch (e) {
        console.error('[useRequireAuth] ensure-profile failed:', e)
        if (mounted) {
          if (e.message && e.message.includes('Invalid token')) {
            await supabase.auth.signOut()
            router.replace('/login')
            return
          }
          setUser(session.user)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    // onAuthStateChange を最優先で登録する（getSession より先）
    // Supabase v2 は登録直後に INITIAL_SESSION を発火するため、
    // これが getSession() より先に解決されることが多い
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (!resolved) {
        // 初回（INITIAL_SESSION / SIGNED_IN）: 確定的に init を呼ぶ
        resolved = true
        init(session)
      } else if (event === 'SIGNED_OUT') {
        // ログアウト後の状態変化のみ対応
        setUser(null)
        setProfile(null)
        setLoading(false)
        router.replace('/login')
      }
    })

    // getSession は onAuthStateChange が来なかった場合のフォールバック
    // session がある場合のみ init し、null でのリダイレクト競合を防ぐ
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted || resolved) return
      if (session) {
        resolved = true
        init(session)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { user, profile, loading }
}
