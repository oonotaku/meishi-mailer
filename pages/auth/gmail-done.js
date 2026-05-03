import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function GmailDone() {
  const router = useRouter()

  useEffect(() => {
    if (!router.isReady) return
    const { status, email } = router.query
    if (!status) return

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(
        { type: 'gmail-oauth', status, email: email || '' },
        window.location.origin
      )
      window.close()
    } else {
      router.replace(`/settings/profile?gmail=${status}`)
    }
  }, [router.isReady, router.query])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', fontFamily: 'sans-serif', color: '#666'
    }}>
      <p>Gmail連携処理中...</p>
    </div>
  )
}
