import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from './supabase'

async function ensureProfile(user) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, name, role, organization_id, organizations(id, name)')
    .eq('id', user.id)
    .single()

  if (profile) return profile

  // 招待経由の場合、user_metadata に organization_id が入っている
  const orgId = user.user_metadata?.organization_id
  if (orgId) {
    const { data } = await supabase
      .from('profiles')
      .insert({ id: user.id, email: user.email, name: user.email.split('@')[0], organization_id: orgId, role: 'member' })
      .select('id, email, name, role, organization_id, organizations(id, name)')
      .single()
    return data
  }

  // 初回サインアップ：新規組織を作成してオーナーになる
  const { data: org } = await supabase
    .from('organizations')
    .insert({ name: 'マイチーム' })
    .select()
    .single()

  const { data } = await supabase
    .from('profiles')
    .insert({ id: user.id, email: user.email, name: user.email.split('@')[0], organization_id: org.id, role: 'owner' })
    .select('id, email, name, role, organization_id, organizations(id, name)')
    .single()
  return data
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
        const p = await ensureProfile(session.user)
        if (!mounted) return
        setUser(session.user)
        setProfile(p)
      } catch (e) {
        // profileセットアップ失敗でも認証自体は通す
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
