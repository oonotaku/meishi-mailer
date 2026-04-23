import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from './supabase'

async function ensureProfile(session) {
  // 既存プロファイルを anon クライアントで取得（高速パス）
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, name, role, organization_id, organizations(id, name)')
    .eq('id', session.user.id)
    .single()

  if (profile) return profile

  // プロファイル未作成 → API ルート経由で作成（supabaseAdmin で RLS をバイパス）
  const res = await fetch('/api/auth/ensure-profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || 'ensure-profile failed')
  return json.profile
}

export function useRequireAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let mounted = true

    async function init(session) {
      if (!session) {
        if (mounted) router.replace('/login')
        return
      }
      try {
        const p = await ensureProfile(session)
        if (!mounted) return
        setUser(session.user)
        setProfile(p)
      } catch (e) {
        console.error('[useRequireAuth] ensureProfile failed:', e)
        if (mounted) setUser(session.user)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) init(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) init(session)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { user, profile, loading }
}
