# 実装タスク：公開プロフィールページに「つながりましょう」バーを追加

## 対象ファイル
`pages/p/[userId].js`

## 背景・目的
公開プロフィールページ（`koryu.app/p/[userId]`）を受け取った側が訪問したとき、
LINEやWhatsAppのブロックは「情報」に見えて「アクション」に見えない問題がある。
ディープリンクを使った明確なCTAボタンを持つ固定セクションを追加し、
訪問者がワンタップでSNS接続を完了できるようにする。

## 実装内容

### 1. `ConnectBar` コンポーネントを追加

ファイル上部（`AffiliationBlock` 関数の後、`export default function PublicProfile` の前）に
以下のコンポーネントを追加する。

```jsx
function ConnectBar({ profile, theme }) {
  // LINEディープリンク生成
  // sns_lineがURLでない場合は line.me/ti/p/~{id} 形式に変換
  const lineUrl = (() => {
    const raw = profile.sns_line
    if (!raw) return null
    if (raw.startsWith('http')) return raw
    return `https://line.me/ti/p/~${raw}`
  })()

  // WhatsAppディープリンク生成
  // sns_whatsappがURLでない場合は wa.me/{number} 形式に変換
  const waUrl = (() => {
    const raw = profile.sns_whatsapp
    if (!raw) return null
    if (raw.startsWith('http')) return raw
    const digits = raw.replace(/\D/g, '')
    return `https://wa.me/${digits}`
  })()

  // どちらも未設定なら何も表示しない
  if (!lineUrl && !waUrl) return null

  return (
    <div style={{
      background: '#16a34a',
      borderRadius: 20,
      padding: '16px 16px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.7)',
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
      }}>
        つながりましょう
      </div>

      {lineUrl && (
        <a
          href={lineUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
            borderRadius: 12,
            padding: '13px 16px',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 14,
            color: '#06C755',
          }}
          onTouchStart={e => e.currentTarget.style.opacity = '0.85'}
          onTouchEnd={e => e.currentTarget.style.opacity = '1'}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="https://cdn.simpleicons.org/line/06C755"
              width={20} height={20} alt="LINE"
              style={{ display: 'block', flexShrink: 0 }}
            />
            LINEで友達追加
          </span>
          <span style={{ fontSize: 16 }}>→</span>
        </a>
      )}

      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.18)',
            borderRadius: 12,
            padding: '13px 16px',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: 14,
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.25)',
          }}
          onTouchStart={e => e.currentTarget.style.opacity = '0.85'}
          onTouchEnd={e => e.currentTarget.style.opacity = '1'}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img
              src="https://cdn.simpleicons.org/whatsapp/ffffff"
              width={20} height={20} alt="WhatsApp"
              style={{ display: 'block', flexShrink: 0 }}
            />
            WhatsAppでつながる
          </span>
          <span style={{ fontSize: 16 }}>→</span>
        </a>
      )}
    </div>
  )
}
```

### 2. JSX に ConnectBar を挿入

`export default function PublicProfile` の return 内、
**ベントーグリッドの直後（Proの所属フッターの前）** に挿入する。

**挿入位置：**
```jsx
{/* ── Pro: 所属フッター ── */}
{showAsPro && affiliations.length > 0 && (
```
この行の**直前**に以下を追加：

```jsx
{/* ── SNS接続バー（全ユーザー共通・LINE/WhatsApp設定時のみ表示） ── */}
<ConnectBar profile={profile} theme={theme} />
```

### 3. 無課金ビューにも ConnectBar を挿入

`{!showAsPro && (` ブロック内の、名前/bioセクションと所属セクションの間にも同じ ConnectBar を追加する。

具体的には、名前+bioの `<div>` の閉じタグ直後：
```jsx
{/* 1. 名前 + bio のdiv直後 */}
<ConnectBar profile={profile} theme={theme} />
```

## 期待する動作

- `profile.sns_line` が設定されている場合のみ「LINEで友達追加」ボタンを表示
- `profile.sns_whatsapp` が設定されている場合のみ「WhatsAppでつながる」ボタンを表示
- どちらも未設定の場合はバー自体を非表示
- タップするとLINE/WhatsAppアプリが直接起動し、相手の追加/チャット画面が開く
- Pro/無課金ユーザーどちらの画面でも表示される（SNS接続機能は全員共通）

## 注意事項

- 既存のSNSブロック（ベントーグリッド内のLINE/WhatsAppタイル）はそのまま残す
- `ConnectBar` はあくまで追加セクションで、既存機能には手を加えない
- テーマカラー（`theme.bg`, `theme.card` 等）は使わず、緑系固定色（`#16a34a`）で統一する
  （どのテーマでも視認性を確保するため）
