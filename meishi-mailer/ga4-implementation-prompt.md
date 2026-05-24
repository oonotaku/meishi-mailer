# GA4実装タスク（Claude Code用プロンプト）

以下の作業をお願いします。

---

## 概要
Google Analytics 4（測定ID: `G-9W53T4FRK9`）をNext.jsアプリに実装する。
ページビュー自動計測 + サインアップのコンバージョンイベント送信が目標。

---

## 作業内容

### 1. `lib/gtag.js` を新規作成

```js
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID

export const pageview = (url) => {
  if (!GA_ID || typeof window === 'undefined') return
  window.gtag('config', GA_ID, { page_path: url })
}

export const event = ({ action, category, label, value }) => {
  if (!GA_ID || typeof window === 'undefined') return
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value: value,
  })
}
```

---

### 2. `pages/_document.js` を編集

`<Head>` 内に以下を追加（既存のmeta/linkタグの後）:

```jsx
{/* Google Analytics */}
<script
  async
  src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
/>
<script
  dangerouslySetInnerHTML={{
    __html: `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', { page_path: window.location.pathname });
    `,
  }}
/>
```

`_document.js` は現在 `process.env` を直接使えないので、ハードコードで `G-9W53T4FRK9` を使ってもOK。

---

### 3. `pages/_app.js` を編集

ルート変更時に pageview を送信するよう更新:

```jsx
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { appWithTranslation } from 'next-i18next/pages'
import * as gtag from '../lib/gtag'

function App({ Component, pageProps }) {
  const router = useRouter()

  // GA4 ページビュー計測
  useEffect(() => {
    const handleRouteChange = (url) => {
      gtag.pageview(url)
    }
    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router.events])

  // 既存の invite/recovery hash 処理
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
```

---

### 4. `pages/login.js` を編集

サインアップ成功時にGA4コンバージョンイベントを送信する。

`login.js` の先頭付近に import を追加:
```js
import * as gtag from '../lib/gtag'
```

サインアップ成功箇所（`setInfo(t('login.confirm_sent'))` の直前）に以下を追加:
```js
gtag.event({
  action: 'sign_up',
  category: 'engagement',
  label: 'email',
})
```

---

### 5. `.env.local` に追記

```
NEXT_PUBLIC_GA_ID=G-9W53T4FRK9
```

また、Vercel の環境変数にも同じキーを追加すること（Production / Preview / Development 全て）:
- Key: `NEXT_PUBLIC_GA_ID`
- Value: `G-9W53T4FRK9`

---

## 確認方法

1. `npm run dev` で起動
2. Chrome で `https://analytics.google.com` → リアルタイム → 概要 を開く
3. `localhost:3000` にアクセスしてページビューが届くか確認
4. サインアップフォームを送信して `sign_up` イベントが届くか確認

---

## 注意事項
- `_document.js` の `<script>` タグは `<Head>` の中に入れること（`<body>` ではない）
- `NEXT_PUBLIC_` プレフィックスがないと클라이언트サイドで読めないので必ず付ける
- 既存の `_document.js` の google-site-verification meta タグは消さないこと
