import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html>
      <Head>
        <meta name="google-site-verification" content="9QcGs5Vhf17usBlIPeIQ2ufhdYFTrFTGwNqK7cVtlUk" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0070f3" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="名刺メーラー" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
