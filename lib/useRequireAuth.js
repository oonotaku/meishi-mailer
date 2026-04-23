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

    async function init(session) {
      if (!session) {
        if (mounted) { setLoading(false); router.replace('/login') }
        return
      }
      try {
        const res = await fetch('/api/auth/ensure-profile', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json()
        if (!mounted) return
        if (!res.ok) throw new Error(json.error || 'ensure-profile failed')
        setUser(session.user)
        setProfile(json.profile)
      } catch (e) {
        console.error('[useRequireAuth] ensure-profile failed:', e)
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
