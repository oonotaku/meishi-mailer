import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function App({ Component, pageProps }) {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Supabase の招待リンクが redirectTo を無視して Site URL へ飛ばした場合に
    // #access_token=...&type=invite を検知して /auth/confirm へ転送する
    const hash = window.location.hash.slice(1)
    if (!hash) return

    const params = new URLSearchParams(hash)
    const type = params.get('type')
    const accessToken = params.get('access_token')

    if ((type === 'invite' || type === 'recovery') && accessToken && router.pathname !== '/auth/confirm') {
      router.replace('/auth/confirm' + window.location.hash)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <Component {...pageProps} />
}
