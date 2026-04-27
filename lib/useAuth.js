import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from './supabase'

// Like useRequireAuth but does NOT redirect on null — shows landing page instead
export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    let resolved = false

    async function init(session) {
      if (!session) {
        if (mounted) setLoading(false)
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
        console.error('[useAuth] ensure-profile failed:', e)
        if (mounted) setUser(session.user)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (!resolved) {
        resolved = true
        init(session)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

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
