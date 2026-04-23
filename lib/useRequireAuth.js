import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from './supabase'

async function fetchProfileWithOrg(userId) {
  const { data: p } = await supabase
    .from('profiles')
    .select('id, email, name, current_organization_id')
    .eq('id', userId)
    .single()

  if (!p) return null

  if (!p.current_organization_id) {
    return { ...p, organization_id: null, role: null, organizations: null }
  }

  const { data: mem } = await supabase
    .from('user_organizations')
    .select('role, organizations(id, name)')
    .eq('user_id', userId)
    .eq('organization_id', p.current_organization_id)
    .single()

  return {
    ...p,
    organization_id: p.current_organization_id,
    role: mem?.role ?? null,
    organizations: mem?.organizations ?? null,
  }
}

async function ensureProfile(session) {
  const profile = await fetchProfileWithOrg(session.user.id)
  if (profile) return profile

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
