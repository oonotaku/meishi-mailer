import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { appWithTranslation } from 'next-i18next/pages'

function App({ Component, pageProps }) {
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return

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

export default appWithTranslation(App)
