# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start Next.js dev server (localhost:3000)
npm run build    # Build for production
npm start        # Start production server
```

No test framework is configured.

## Architecture

**Koryu（交流）** is a mobile-first app that scans business cards, auto-generates a bento-grid profile page, and connects people via SNS. ドメイン: `koryu.app`。旧名: meishi-mailer。**PWA対応済み**（next-pwa + manifest.json + public/icons/）。**Google OAuth審査申請済み**（gmail.send スコープ、審査中）。**チーム機能は削除済み**（2026-05-09）。個人向けフリーミアムに方向転換。

**Core flow (通常):** Photo capture → `/api/analyze` (Claude Vision OCR + email generation) → `/api/contacts/save` (Supabase Storage + `contacts` table + `encounters` テーブルに初回出会いを自動挿入) → `/api/send` (SendGrid) → mark `mail_sent_at`

**Core flow (重複時):** Photo capture → `/api/analyze` (重複検出: `duplicates` 配列返却) → DUPLICATE画面表示 → 「この交流を記録する」または「この名刺を追加する」 → CONTEXT入力 → `/api/encounters/save` (encountersテーブルに追記、必要に応じてメール送信)

### Data access pattern

**All database writes and cross-user reads go through API routes using `supabaseAdmin` (service role key).** The anon supabase client (`lib/supabase.js`) is used only for auth state management (`supabase.auth.getSession()`, `supabase.auth.onAuthStateChange()`). Direct `supabase.from(...)` queries from the client are avoided due to RLS complexity on `user_organizations`.

### Pages (`pages/`)

| File | Purpose |
|------|---------|
| `index.js` | Main scan flow. State machine: UPLOAD → ANALYZING → CONFIRM → CONTEXT → SENDING → DONE/ERROR/DUPLICATE(7)/USER_QR_SCAN/USER_QR_CONFIRM(10). 重複検出時（`duplicates` 配列あり）はDUPLICATE画面へ遷移しブロック。DUPLICATE画面: 「この交流を記録する」＋「この名刺を追加する」（`/api/contacts/add-card`）のボタンを表示。**QRで繋がる**: UPLOAD画面の「🔗 QRで繋がる →」からUSER_QR_SCANへ遷移、`getUserMedia` ライブカメラ＋`requestAnimationFrame`で毎フレームjsQR解析、meishi-mailerプロフィールURL検出後 `/api/profile/public` でプロフィール取得→USER_QR_CONFIRMで確認→`/api/contacts/save`で `extracted_sns` + `koryu_user_id` を含めて保存→コンタクト詳細へ遷移。**QRスキャン重複チェック**: USER_QR_CONFIRM前に ① `koryu_user_id` で既存contact検索（最優先）→ ② emailでフォールバック検索。emailヒット時に `koryu_user_id` 未設定なら `/api/contacts/update-koryu-user-id` で非同期更新。重複時は「この交流を記録する」「新規コンタクトとして追加」を表示。**koryu_user_id自動セット**: 名刺スキャン保存時（`meishiUser?.user_id`）・QRスキャン保存時（`scannedUserId`）ともに `koryu_user_id` をセット。**自分のプロフィールQR**: UPLOAD画面下部に `api.qrserver.com` を使ったQRコードを常時表示。**meishi-mailerユーザー検出**: `/api/analyze` が `meishi_user` フィールドを返すようになり、CONFIRM画面でバッジ（✓ Koryuユーザーです）＋プロフィールリンクを表示。**統一 top-bar**: Koryuロゴ左・言語切替＋ユーザーメール＋ログアウト右（旧 user-info-row 廃止）。**統一 bottom-nav**: スキャン（`/`・active）/ つながり（`/contacts`）/ プロフィール（`/settings/profile`）を position:fixed で中央固定（max-width:430px）。**テキスト統一**: 「出会い」→「交流」（i18nキー + ハードコード箇所）。 |
| `contacts.js` | 「あなたのつながり一覧」（旧: 保存済み名刺一覧）。Own + team-shared contacts. Shows team name badge for contacts from other orgs. **統一 top-bar**（旧 `<div className="header">` with back-btn を廃止）＋**統一 bottom-nav**（つながり=active）。スキャンタブはカメラ起動ではなく `/` へのリンク。`contacts.header` i18nキー使用。 |
| `contacts/[id].js` | Contact detail — 繋がりハブ。**meishi-mailerユーザー検出**: contact.emailで `/api/profile/find-by-email` を呼び、meishi-mailerユーザーであれば name/company/title/email/phone/avatar/extracted_sns/blocks/profile_theme をライブデータで上書き表示。`displayName`/`displayCompany`/`displayEmail` 等の表示変数は meishiProfile → activeCard → contact の優先順で導出。`displayAvatar` がある場合は丸いアバター画像を表示（名刺サムネイルの代わり）。`MiniBlock` コンポーネントと `THEMES` 定数をファイル冒頭に定義し、meishiProfile.blocks があればベントーグリッドをインライン表示（「今すぐ繋がる」と交流履歴の間）。SNSも meishiProfile.extracted_sns のライブデータを優先。**複数名刺対応**: チップバーで名刺切替（`activeCardIdx` state）。activeCardIdx===0はKoryuライブデータ優先、1以降はカード固有データを表示。「🔄 再スキャン」は複数枚時にカード選択シートを経由。「＋ 名刺を追加」はOCR（preview_only）→確認シート（同メール重複時は「更新」「新規追加」の2択）→`add-card` API追記。**コンタクト・カード削除**: 「削除」ボタンでコンタクト丸ごと削除（一覧へ遷移）。チップバーの×ボタンでカード個別削除（2枚以上の場合のみ）。**重複をマージ**: isOwnerのみ。別contactを検索して選択し1つに統合。**交流履歴セクション**: ヘッダーに「交流を記録」「✉ メールを送る」ボタン（isOwner・displayEmailがある場合のみ）。`event_name === 'メール送信'` のencounterは✉アイコン付き特別表示。**AIメール生成フロー**: 「メールを送る」→ sheet-overlayでシチュエーション選択（5種）+ メモ入力 → `/api/contacts/generate-email` でAI生成 → プレビュー・編集sheet → `/api/send` で送信（encounterに自動記録）。交流履歴は `/api/encounters/list` から取得し `met_at` 降順表示。Send/rescan/add-card buttons shown only to `owner_id === user.id`。i18nはrequire()でJSONをバンドル（Vercel serverless cwd対応）。 |
| `login.js` | Email/password login + signup + password reset (forgot mode). signUp に `emailRedirectTo` を指定して現在のロケールURLへリダイレクト。 |
| `auth/confirm.js` | Password setup page for invited users (handles PKCE + implicit flows). パスワードリセット（type=recovery）も同フォームを再利用。 |
| `auth/gmail-done.js` | Gmail OAuth ポップアップの中継ページ。`postMessage` で親ウィンドウに `{ type: 'gmail-oauth', status, email }` を送信してポップアップを閉じる。`window.opener` がない場合は `/settings/profile?gmail=...` にフォールバック遷移。 |
| `settings/email.js` | メール設定（SendGrid/Gmail/SMTP）— プロフィール設定から独立した無料メニュー。戻るボタンは `/settings/profile` へ遷移。 |
| `settings/profile.js` | Profile settings — **アコーディオンセクション UI**（旧5タブ廃止）。全セクションデフォルト閉じ（`openSections` state + `toggleSection` 関数）。セクション順：SNSリンク / 所属・連絡先 / プロフィールページをデザイン / メール設定 / プラン・サブスクリプション。**FABプレビューボタン**（`position: fixed`、右下・ボトムナブ上）タップでプレビューモーダルを開く。`previewMode`（`'pro'`\|`'free'`）でモーダル内を Pro/無課金プレビューで切り替え可能。**デフォルトは `previewMode='pro'`**（Freeユーザーでもフルプレビュー表示でProへの動機づけ）。**プロフィール完成度バー**（`position: fixed`、ボトムナブ上部）: 7ステップ構成（顔写真15・表示名15・ひとこと10・所属15・SNS15・メール設定15・Proプラン15）合計100%。Proかつ全完了時に非表示。未完ステップをチップで表示しタップで該当セクションへジャンプ（Proチップはプランセクションを開く）。統一 top-bar + bottom-nav（プロフィール=active）。アバター写真アップロード（タップでカメラ選択→即時反映）、display name + bio インライン編集（**bioフィールド下に文字数カウンター表示**: 「XX / 100文字 ※ Sサイズ約20文字・Mサイズ約50文字・L/XLフル表示」）、名刺スキャンによるプロフィール自動入力。**「プロフィールページをデザイン」セクション**：**テーマ選択（6種: dark/light/midnight/sunset/sakura/grape）**クリック時に即時 `/api/profile/update-theme` で自動保存（楽観的更新・失敗時ロールバック）・全ユーザー選択可能（ロック廃止）・背景画像をテーマスウォッチ7枚目（📷スウォッチ）に統合・ベントーブロック管理（追加・編集・削除・↑↓並び替え、ペイウォール廃止・設定は全員可・表示はProのみ）。**ブロックタイプ選択モーダル**に制約テキスト追加（写真「Sサイズはキャプションなし」、テキスト「Sサイズはタイトルのみ表示（入力必須）」、リンク「サムネイル/オーバーレイから選択可」、SNS「Sサイズはキャプションなし」）。**所属・連絡先**：最大5件、ボタン（↑↓・削除）をカード上部横並びに変更、削除ボタンは「○件目を削除」と番号付き。SNS リンク（`lib/snsConfig.js` 定義、personal/business/cardapp の3カテゴリ、QR/username/url の3入力モード）。**プランセクション（Free表示）**：ヘッドライン「Freeで作って、Proで魅せる」・Free/Proプレビューリンク（`previewMode='free'`でモーダルを開く）・機能リスト（ベントーグリッド・テーマ背景画像反映）・月/年トグル・アップグレードボタン。メール署名プレビュー、Stripe Checkout/Portal。未保存変更の離脱防止（`router.events` + `window.onbeforeunload`）。完全i18n対応。|
| `p/[userId].js` | Public profile page — **ベントーグリッド方式**。`profile_blocks` テーブルからブロックを取得してグリッド表示。**ハードコードヘッダー廃止済み**（全要素がブロックとして管理。`profile_card` ブロックがヘッダーの役割を担う）。ブロックタイプ: photo / text / link / sns / profile_card / affiliation。サイズ: **XS**（所属のみ・約80px）/ S / M / L / **XL**（`grid-row: span 2`）、`grid-auto-rows: minmax(144px, auto)`。**ブロックサイズ別アダプティブレイアウト**: 各ブロックタイプがサイズに応じて表示内容・レイアウトを自動変化（詳細は profile_blocks セクション参照）。**bioテキスト改行対応**: `dangerouslySetInnerHTML` で `\n` と `<br>` を改行として描画。**テーマ定数**: dark / light / midnight / sunset / sakura / grape の6種（warm / ocean 廃止）。**テーマ・背景画像**: `isPro` の場合のみ適用（`activeTheme` / `activeBgImage` 変数でガード）。**`?preview=1` クエリ**: isPro に関わらずテーマ・ベントーグリッドをフル表示（設定画面プレビューモーダルから参照）。**無課金ユーザー表示**: テキストのみのシンプルレイアウト（名前+bio+所属テキスト+SNSアイコン+Koryu招待）。変更なし・固定仕様。**フッター所属エリア（Proのみ）**: ベントーグリッド下に `profile_affiliations` 全件を縦並び表示（show_*フラグ尊重）。**`?simulate_free=1` クエリ対応**: Proユーザーでも無課金表示を確認可能（`showAsPro = (isPro || isPreview || isPreviewMode) && !simulateFree` で制御）。No auth。`getServerSideProps` + `supabaseAdmin`（profiles / profile_blocks / profile_affiliations を並列取得）。|
| `_app.js` | Global auth safety net — intercepts `#type=invite` hash on any page |
| `_document.js` | カスタムDocument。PWA manifest / theme-color / apple-touch-icon / `<link rel="icon" href="/favicon.svg" type="image/svg+xml" />`（32×32 SVG、黒丸角背景＋緑の「交」）を設定。 |

### API Routes (`pages/api/`)

**Auth**
- `POST /api/auth/ensure-profile` — idempotent profile + org setup. Gets all user memberships; if no `role='owner'` exists: (1) upserts `profiles` first to satisfy FK constraint on `user_organizations.user_id → profiles.id`, (2) registers invited org membership from `user.user_metadata?.organization_id || user.app_metadata?.organization_id` (Supabase may store invite metadata in either field), (3) creates a new owner org. `current_organization_id` always points to the user's own (owner) org. Returns `organizations` array `[{ organization_id, name, role }, ...]`.
- `GET /api/auth/gmail/callback` — Gmail OAuth2 callback. Exchanges authorization code for tokens, fetches Gmail address via userinfo, saves `gmail_refresh_token` + `gmail_email` + `smtp_provider='gmail'` to `profiles`. 成功・エラーともに `/auth/gmail-done?status=...&email=...` にリダイレクト（旧: `/settings/profile?gmail=...`）。ポップアップ経由なのでメインウィンドウのSupabaseセッションを破壊しない。

**Contacts**
- `POST /api/contacts/save` — saves contact; looks up `profiles.current_organization_id` server-side to set `organization_id`. insert成功後、`encounters` テーブルに初回交流を自動挿入。`koryu_user_id` を受け取りinsert時に含める。
- `GET /api/contacts/list` — returns own contacts (all visibility) + team-shared contacts from all orgs the user belongs to. Includes `organization_name` field on each contact.
- `POST /api/contacts/update-visibility` — toggles `private`/`team` on a contact (owner only)
- `POST /api/contacts/rescan` — 名刺画像（base64）をOCRして既存contactを更新。`card_index`（更新対象カード番号、default 0）、`image_url`（Storage URL、card_image_urlsに追記）、`preview_only`（OCRのみ・DB更新なし、add-card確認フローで使用）をサポート。`card_index=0` 時のみ主フィールド（name/company/email等）を更新。`extracted_sns` はマージ（既存SNSを消さない）。
- `POST /api/contacts/add-card` — 新しい名刺データを `contacts.cards` 配列に追記し、`image_url` を `card_image_urls` に追記する。既存Contactに複数社の名刺を紐付けるためのAPI。
- `POST /api/contacts/update-connected-sns` — `contacts.connected_sns` JSONB を PATCH 更新。「✓ 繋がった」ボタンから呼び出し。
- `POST /api/contacts/merge` — 2つのcontactを1つにマージ。keep_id側を残し、merge_id側のcards/card_image_urls/encounters/SNSを統合して削除。トップレベルフィールドはfillEmpty（keep側がnull/空の場合のみmerge側の値を使う）。`koryu_user_id` も fillEmpty で保持。owner_idチェックあり。
- `POST /api/contacts/delete` — contactを削除。encountersはCASCADE DELETEで自動消去。owner_idチェックあり。
- `POST /api/contacts/delete-card` — `contacts.cards[]` から1枚削除。`card_index` を指定。最後の1枚は削除不可（400エラー）。`card_index=0` 削除時はトップレベルフィールドを新 `cards[0]` で更新。`card_image_urls` も同期。
- `POST /api/contacts/update-koryu-user-id` — `contacts.koryu_user_id` を更新。QRスキャン時にemailで既存contactを発見した場合に非同期で紐付け更新する。owner_idチェックあり。
- `POST /api/contacts/generate-email` — Claude APIを使ってメール文を生成。`contact_id`・`situation`・`memo` を受け取り、contacts情報＋直近5件のencounters履歴＋送信者プロフィールをコンテキストとして渡す。`{ subject, body }` を返す。モデル: `claude-opus-4-5`。

**Encounters**
- `POST /api/encounters/save` — encounter 1件保存。`contact_id` の `owner_id === user.id` を確認してからinsert。
- `GET /api/encounters/list` — `contact_id` で encounter一覧取得（`met_at` 降順）。owner または チームメンバー（`visibility='team'`）のみアクセス可。

**Core**
- `POST /api/analyze` — Claude Vision OCR + email generation (two sequential Claude calls). Requires Bearer token. Checks plan limits (Free: 10/mo, Pro: 100/mo), resets `scan_count_month` if new month, increments on success (重複時も increment). OCR後にメアドが抽出できた場合、`owner_id=user.id` の contacts を `.ilike()` で検索し、ヒットすれば `duplicates` 配列をレスポンスに含める。`duplicates` がある場合、クライアントはメール生成結果を捨てて DUPLICATE ステップへ遷移する。**meishi-mailerユーザー検出**: OCR抽出メールアドレスで `profiles` テーブルを検索し、自分以外のユーザーがヒットすれば `meishi_user: { user_id, name, avatar_url, profile_url }` をレスポンスに含める。クライアントはCONFIRM画面にバッジを表示。
- `POST /api/send` — requires Bearer token. Fetches provider config from profile. Delegates to `lib/sendEmail.js` for actual sending. Returns 400 with setup instructions if not configured. `contact_id` が含まれる場合、送信成功後に `encounters` テーブルへ自動insert（`event_name='メール送信'`、`memo=件名`）。既存の動作は変えない（`contact_id` がない場合は従来通り）。

**Billing**
- `POST /api/billing/create-checkout-session` — creates Stripe Checkout session for Pro plan. Reuses existing `stripe_customer_id` if present. `success_url`/`cancel_url` built from request headers.
- `POST /api/billing/portal` — creates Stripe Customer Portal session for subscription management.
- `POST /api/billing/webhook` — Stripe webhook handler (bodyParser: false, raw body). Handles: `checkout.session.completed` (sets customer_id, subscription_id, plan=pro), `customer.subscription.updated`, `customer.subscription.deleted` (plan=free).

**Team**
- `POST /api/team/invite` — 既存ユーザーの場合は `inviteUserByEmail` を使わず `user_organizations` に直接 insert し、招待者のメール設定（`lib/sendEmail.js`）で通知メールを送信（失敗しても招待は成功扱い）。新規ユーザーのみ `inviteUserByEmail`。
- `GET /api/team/members` — returns `{ ownTeam: { organization, members }, memberTeams: [{ organization }] }`
- `POST /api/team/update-name` — updates own org name via supabaseAdmin (bypasses RLS on organizations table)

**Shared Library**
- `lib/sendEmail.js` — sendgrid/gmail/smtp の送信ロジックを共通化。`send.js` と `team/invite.js` から使用。プロバイダー未設定時は Error を throw（呼び出し元でキャッチして 400/500 を返す）。

**Profile**
- `POST /api/profile/update-name` — updates `profiles.name` and `profiles.bio` via supabaseAdmin
- `POST /api/profile/update-email-settings` — updates `profiles.sender_email` and `profiles.sendgrid_api_key` via supabaseAdmin
- `POST /api/profile/update-sns` — updates all SNS link fields on `profiles`; empty/whitespace strings saved as `null`
- `POST /api/profile/update-avatar` — base64画像を受け取り、`avatars` Storageバケットに `{userId}/avatar.jpg` としてアップロード（upsert）、公開URLに `?t=timestamp` を付加してCDNキャッシュ回避、`profiles.avatar_url` に保存してURLを返す
- `POST /api/profile/scan-card` — 名刺画像（base64）をClaude Vision OCRで解析し、name/company/title/phones/website/email/SNSを抽出して返す。プロフィール設定画面の「名刺からプロフィールを入力」機能で使用
- `GET /api/profile/affiliations` — returns `profile_affiliations` (including phone/website/contact_email/show_* fields) ordered by `order_index` ASC
- `POST /api/profile/affiliations` — replaces all affiliations (delete-all + insert); max 5 rows, skips entries with empty `company_name`. phone/website/contact_email/show_* を含む
- `POST /api/profile/update-contact` — 旧: profiles テーブルの連絡先を更新。現在は affiliations 経由のため実質未使用
- `GET /api/profile/blocks` — `profile_blocks` を `?userId` で取得（認証不要）。`order_index` 昇順
- `POST /api/profile/blocks` — Bearer auth。`profile_blocks` を delete-all + insert でバッチ更新。`{ blocks: [{ type, size, content, order_index }] }`
- `POST /api/profile/upload-block-image` — Bearer auth。base64画像を `avatars` バケットに `{userId}/block_{timestamp}.jpg` としてアップロード。公開URLを返す
- `POST /api/profile/update-theme` — Bearer auth。`profiles.profile_theme` を更新（楽観的更新用）
- `POST /api/profile/update-bg-image` — Bearer auth。base64画像を `avatars/{userId}/profile_bg.jpg` にアップロードし `profiles.profile_bg_image_url` を更新。`null` を受け取った場合はファイル削除 + `profile_bg_image_url` を null に更新。Proユーザーの公開プロフィールページ背景画像設定に使用。
- `GET /api/profile/public` — 認証不要。`?userId=` でプロフィールを取得。name/bio/avatar_url/company/title/email（show_email時）/phone（show_phone時）/profile_theme/blocks/extracted_sns（sns_* フィールドを `sns_` プレフィックス除去した形式）を返す。QRスキャンによるコンタクト追加フローで使用。
- `GET /api/profile/find-by-email` — 認証不要。`?email=` でprofilesテーブルを検索しmeishi-mailerユーザー判定。name/avatar_url/bio/profile_theme/extracted_sns/blocks/company/title/email/phone/website（affiliations経由・show_*フラグ尊重）を返す。contacts/[id].js がコンタクト詳細表示時にライブデータ取得に使用。

### AI model usage

Both API calls in `/api/analyze` use `claude-opus-4-5`. OCR prompt forces JSON-only output. Email template: 100–150 chars, ends with `。`. No signature in the prompt — signature (QR code + name + affiliation) is added by `send.js` as HTML. Both EN/JA prompts explicitly instruct the model not to include a closing sign-off or signature line.

Email generation language follows the UI locale (`Accept-Language` header from client): EN UI → English email, JA UI → Japanese email.

### Database (Supabase)

#### Tables

**`organizations`** — `id, name, created_at`

**`profiles`** — `id, email, name, bio, avatar_url, current_organization_id (FK → organizations), sender_email, sendgrid_api_key, smtp_provider, smtp_host, smtp_port, smtp_user, smtp_password, gmail_refresh_token, gmail_email, sns_line, sns_whatsapp, sns_x, sns_instagram, sns_facebook, sns_linkedin, sns_tiktok, sns_youtube, sns_threads, sns_telegram, sns_wechat, sns_discord, sns_github, sns_bluesky, sns_pinterest, sns_sansan, sns_eight, sns_mybridge, sns_vercel, sns_wantedly, sns_note, phone, website, contact_email, show_phone, show_website, show_email, plan, scan_count_month, scan_count_reset_at, stripe_customer_id, stripe_subscription_id, profile_theme, profile_bg_image_url`
- `current_organization_id` always points to the org where the user is `owner`
- `sender_email` + `sendgrid_api_key` are set by the user via `/settings/profile`; `sendgrid_api_key` is never returned to the client
- `smtp_provider`: `'sendgrid'` (default) | `'gmail'` | `'smtp'`
- `gmail_refresh_token` / `gmail_email`: set via Gmail OAuth callback; used by `send.js` with googleapis REST API
- `bio`: 一言コメント（最大100文字）; `null` when not set
- `avatar_url`: Supabase Storage `avatars` バケットの公開URL（`?t=timestamp` 付き）; `null` when not set
- `sns_*` (21 fields): SNS link URLs; `null` when not set。`lib/snsConfig.js` の `SNS_CONFIG` 配列で一元管理。LINE/WhatsApp はQRスキャン、X/Instagram等はユーザー名入力→保存時にベースURL補完、Facebook/Discord/WeChatはフルURL入力
- `phone`, `website`, `contact_email`, `show_phone`, `show_website`, `show_email`: 旧トップレベル連絡先フィールド。現在は `profile_affiliations` に移行済みのため実質未使用
- `plan`: `'free'` (default) or `'pro'`; updated by Stripe webhook
- `scan_count_month`: resets when `scan_count_reset_at < startOfMonth`; Free limit=10, Pro limit=100
- `stripe_customer_id` / `stripe_subscription_id`: set on `checkout.session.completed`, cleared on subscription deletion
- `profile_theme`: `'dark'` (default) | `'light'` | `'midnight'` | `'sunset'` | `'sakura'` | `'grape'`。`/p/[userId].js` の背景・カード・アクセント・テキスト色を決定。クリック時に `/api/profile/update-theme` で即時自動保存
- `profile_bg_image_url`: Supabase Storage `avatars` バケットの公開URL（`{userId}/profile_bg.jpg`）。Proユーザーの公開プロフィールページ背景画像。`null` when not set

**`user_organizations`** — `user_id, organization_id, role (owner|member), created_at`
- Junction table for many-to-many users ↔ orgs
- Every user has exactly one `role='owner'` row (their own org) plus zero or more `role='member'` rows
- RLS has recursion issues — always query via supabaseAdmin in API routes

**`contacts`** — `id, owner_id, organization_id, name, company, department, title, email, phone, card_image_urls (text[]), cards (jsonb[]), extracted_sns (jsonb), connected_sns (jsonb DEFAULT '{}'), koryu_user_id (uuid FK → profiles.id ON DELETE SET NULL), subject, body, mail_sent_at, location, event_name, met_at, temperature (hot|normal|watch), memo, visibility (private|team), created_at`
- `owner_id` = auth user UUID (not `user_id`)
- `organization_id` = copied from owner's `profiles.current_organization_id` at save time
- `visibility` defaults to `'private'`
- `cards`: OCR結果を1枚ずつ格納した配列。`cards[0]` が主カード（name/company/email等のトップレベルフィールドと同期）。複数社の名刺を1 Contactに紐付けるために使用。
- `extracted_sns`: 名刺から抽出したSNS情報（プラットフォーム→値のmap）。rescan時にマージ（既存を上書きしない）。
- `connected_sns`: 「✓ 繋がった」済みのSNS（プラットフォーム→値のmap）。
- `koryu_user_id`: Koryuユーザーと紐付けるための外部キー。名刺スキャン時に `meishi_user` が検出された場合、またはQRスキャン時に自動セット。email変更があっても同一人物として追跡できる。nullable。

**`encounters`** — `id, contact_id (FK → contacts.id, CASCADE DELETE), met_at, event_name, location, memo, temperature (hot|normal|watch), photo_urls (text[]), created_at`
- RLS無効（supabaseAdmin経由のみアクセス）
- `contacts/save` 実行時に初回交流として自動挿入される
- 重複名刺撮影時にDUPLICATE画面から「この交流を記録する」で追記可能
- メール送信時（`/api/send` に `contact_id` を渡した場合）に `event_name='メール送信'`、`memo=件名` で自動挿入される
- `photo_urls`: 交流時の写真URLの配列（Supabase Storage `encounters` バケット）
- `contacts/[id].js` の交流履歴セクションで `met_at` 降順表示。`event_name === 'メール送信'` のencounterは✉アイコン付きで特別表示

**`profile_affiliations`** — `id, user_id (FK → profiles.id), company_name, title, order_index, phone, website, contact_email, show_phone (DEFAULT false), show_website (DEFAULT true), show_email (DEFAULT false), created_at`
- RLS無効（supabaseAdmin経由のみアクセス）
- `order_index` で表示順管理（最大5件）
- `/api/profile/affiliations` POST は delete-all + insert のバッチ更新。保存完了後に `profile_blocks` の affiliation ブロックを全削除→再insertで自動同期（`show_*` フラグを反映した contact 情報付き、`order_index: 100 + i`）
- `send.js` がメール署名の所属として `order_index ASC` の先頭1件を参照
- 公開プロフィール（`p/[userId].js`）は `profile_blocks` 経由で表示（affiliations テーブルは直接参照しない）

**`profile_blocks`** — `id, user_id (FK → profiles.id), type, size, content (jsonb), order_index, created_at`
- RLS無効（supabaseAdmin経由のみアクセス）
- `type`: `'photo'` | `'text'` | `'link'` | `'sns'` | `'profile_card'` | `'affiliation'`
- `size`: `'XS'`（所属ブロックのみ・約80px）| `'S'`（1列・高さ固定120px）| `'M'`（1列・縦長180px+）| `'L'`（全幅）| `'XL'`（1列・縦長300px）
- **ブロックサイズ別アダプティブレイアウト**（`p/[userId].js` で自動適用）:
  - profile_card: S=写真+名前のみ / M=写真+名前+bio2行 / L=写真左・名前bio右横並び3行 / XL=写真上・名前・bioフル
  - affiliation: XS=会社名+役職のみ / S=会社名+役職 / M=+website / L=全情報横並び / XL=全情報縦並び
  - sns: S=アイコン+名前のみ（caption非表示）/ M=+caption2行 / L=アイコン左・caption右横並び3行 / XL=captionフル
  - photo: S=画像のみ（caption非表示）/ M=+captionオーバーレイ1行 / L=全幅+captionオーバーレイ1行 / XL=+captionオーバーレイ2行
  - text: S=タイトルのみ1行（title必須）/ M=+body3行 / L=+body5行 / XL=bodyフル（pre-wrap）
  - link（thumbnailモード）: S=サムネ+タイトル1行 / M=+説明2行 / L=サムネ左・説明右横並び / XL=サムネ上+説明フル
  - link（overlayモード）: 画像を背景にタイトル+URLをオーバーレイ。line-clamp: S=タイトル2行 / M=タイトル2行+説明2行 / L=タイトル2行+説明3行 / XL=タイトル3行+説明4行
- `content` JSONB スキーマ:
  - photo: `{ image_url, caption, fit, caption_color }` — `fit` は `'cover'`|`'contain'`、`caption_color` は `'white'`（デフォルト）|`'black'`|`'gray'`|`'yellow'`
  - text: `{ title, body, bg_color, bg_image_url }` — `bg_image_url` は背景画像URL（グラデーションオーバーレイ付き）。bodyは改行対応（pre-wrap）
  - link: `{ title, url, description, image_url, display_mode, text_color }` — `display_mode` は `'thumbnail'`（デフォルト）|`'overlay'`、`text_color` は `'white'`|`'black'`|`'gray'`|`'yellow'`
  - sns: `{ platform, caption? }` — `platform` は `SNS_CONFIG` の `key`（例: `'sns_x'`）、`caption` はひとこと（最大80文字、省略可）
  - profile_card: `{}` （空。アバター・名前・bioはprofilesテーブルから自動取得。各ユーザーに1つのみ）
  - affiliation: `{ company_name, title, website, contact_email, phone }` — `profile_affiliations` 保存時に自動同期。手動追加不可
- `/api/profile/blocks` POST は delete-all + insert のバッチ更新（affiliation ブロックは含まない。affiliations API 経由で管理）
- `p/[userId].js` が `order_index ASC` で全件取得してベントーグリッドに表示

Supabase Storage:
- `cards` バケット — 公開バケット。名刺画像を保存
- `avatars` バケット — 公開バケット。顔写真を `{userId}/avatar.jpg`、ブロック画像を `{userId}/block_{timestamp}.jpg` で保存
- `encounters` バケット — 公開バケット。出会い写真を保存。RLSポリシー: authenticated INSERT + public SELECT

#### Key invariants
- `contacts.owner_id` is always the auth user's UUID — never `user_id`
- `contacts.organization_id` is set at save time from `profiles.current_organization_id`, never from the client
- `profiles.current_organization_id` always points to the user's own org (where `role='owner'`)
- Contacts with `visibility='team'` are visible to all members of the same org in `/api/contacts/list`
- Every user always has exactly one owner org — ensure-profile creates one if missing

### Auth (`lib/useRequireAuth.js`)

`onAuthStateChange` is registered before `getSession()` to avoid Vercel production race condition. A `resolved` flag ensures `init()` is called exactly once. `getSession()` acts as fallback only when a session exists (never redirects on null).

Calls `/api/auth/ensure-profile` on session init. Returns `{ user, profile, loading }` where `profile` includes:
- `organization_id` — alias for `current_organization_id` (user's own owner org)
- `role` — always `'owner'` (reflects ownership of `current_organization_id`)
- `organizations` — array of all memberships: `[{ organization_id, name, role }, ...]`
- `sender_email` — configured sender address (or null if not set)
- `plan` — `'free'` or `'pro'`
- `scan_count_month` — scans used this month
- `avatar_url` — Supabase Storage 公開URL（or null）
- `sns_*` (21 fields) — SNS link URLs
- `gmail_email`, `smtp_provider`, etc. — email config fields

## Environment Variables

Required in `.env.local`:

```
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=https://www.meishi-mailer.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRO_PRICE_ID_MONTHLY=price_...
STRIPE_PRO_PRICE_ID_YEARLY=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Note: SendGrid API keys and sender emails are stored per-user in `profiles.sendgrid_api_key` / `profiles.sender_email` — no server-level email env vars needed.

### Supabase Auth SMTP (インフラ設定)
Supabase Auth → Email → SMTP Settings にカスタムSMTPを設定済み（2026-05-01）。
- Host: `smtp.gmail.com` / Port: `587`
- Username: `taku_oono@node-bee.com`（Gmailアプリパスワード）
- Sender: `info@node-bee.com`
- 目的: Supabaseデフォルトのメール送信レート制限（招待メールなど）を回避するため。アプリのメール送信（SendGrid/Gmail/SMTP）とは別設定。

### Stripe (billing)
- Live keys (`sk_live_`, `pk_live_`) are active in Vercel production as of 2026-04-25
- `STRIPE_PRO_PRICE_ID_MONTHLY` / `STRIPE_PRO_PRICE_ID_YEARLY` must be Price IDs (`price_...`), NOT Product IDs (`prod_...`)
- Webhook endpoint: `https://meishi-mailer-mu.vercel.app/api/billing/webhook`
- Registered events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Customer Portal business name: "node-bee"
- To manually grant Pro to a beta user: `UPDATE profiles SET plan = 'pro' WHERE email = 'xxx';` in Supabase SQL Editor

## Shared Library

- `lib/snsConfig.js` — 全SNSの設定を一元管理。`SNS_CONFIG` 配列（各エントリに `key`, `label`, `category`, `inputMode`, `baseUrl`, `icon`, `color`, `prefix`, `placeholder`, `helpUrl` を定義）と `PRESET_CATEGORIES` オブジェクト（`business`/`personal`/`all` のカテゴリ分類）をエクスポート。
  - `personal` カテゴリ: LINE, WhatsApp, Instagram, X, Facebook, TikTok, Threads, Telegram, WeChat
  - `business` カテゴリ: LinkedIn, GitHub, Vercel, note, Wantedly, YouTube, Discord, Bluesky, Pinterest
  - `cardapp` カテゴリ: Sansan, Eight, myBridge
  - `inputMode`: `'qr'`（LINE/WhatsApp）、`'username'`（X/Instagram等）、`'url'`（Facebook/Discord/WeChat等）
  - `color` フィールドの黒系SNS修正済み: X→`#000000`、TikTok→`#010101`、Threads→`#000000`、GitHub→`#24292e`、Vercel→`#000000`（ベントーSNSブロック背景色として使用）

## Dependencies (notable)

- `jsqr` — QRコード解析（クライアントサイド動的import）。LINE/WhatsAppのQRスクショ読み取りに使用。

## Current status

**2026-05-09 大規模リブランディング・機能整理完了。**

- アプリ名: meishi-mailer → **Koryu（交流）**
- ドメイン: meishi-mailer.com → **koryu.app**（Squarespace取得、Vercel接続済み）
- チーム機能完全削除（settings/team.js、team API群、visibility、organization関連）
- フリーミアム課金: Free（基本機能）/ Pro ¥500/月 or ¥5,000/年
- Proゲート実装: ベントーグリッド編集、6種テーマ、QRコード発行
- メール設定を `/settings/email` に独立ページ化
- LP全面リデザイン（ブライトテーマ、日英併記、ベントーデモ付き）
- Stripe live稼働中（月払い・年払い Price ID両方設定済み）
- Google OAuth審査申請中（gmail.send スコープ）
- PWA対応済み（koryu-icon.png追加）

**2026-05-11 UI統一・プロフィール画面大幅改善完了。**

- 全3ページ（index/contacts/profile設定）で top-bar + bottom-nav を統一
- プロフィール設定: タブUI廃止 → アコーディオン1スクロール化（全セクションデフォルト閉じ）
- プロフィール設定に常時表示のプレビューボタン追加（Pro/無課金プレビュー比較対応）
- 公開プロフィール: 無課金ユーザー向けSNSアイコンバー表示 + `simulate_free=1` クエリ対応
- ベントーグリッドCSS修正: `grid-auto-rows:144px`、XLブロック=`grid-row: span 2`、SNS高さオーバーライド削除
- i18n: `nav.scan` / `nav.contacts` / `nav.profile` / `contacts.header` キー追加（ja/en両方）

次の候補: LP微調整・スクロールアニメーション、SEO（canonical/OGP）、公開プロフィールのSNSシェア最適化、プロフィール設定UIの細部調整。See `MEISHI_AI_SPEC.md` for roadmap.

**2026-05-11 ベントーグリッド大幅強化完了。**

- profile_card / affiliation の新ブロック型追加
- ハードコードヘッダー廃止 → 全要素ブロック化
- 所属ブロックは profile_affiliations 保存時に自動同期
- 写真ブロックに cover/contain 表示モード追加
- テキスト・リンクブロックに背景画像対応
- リンクブロックにサムネイル画像対応
- プロフィールページ背景画像（`profile_bg_image_url`、Proのみ）
- SNS caption 文字数上限 40 → 80 文字に拡張
- textarea auto-resize + white-space: pre-wrap 対応
- CSS grid-auto-rows を `minmax(144px, auto)` に修正
- 無課金ユーザービューを再設計（プロフィール + 所属一覧 + SNSバー + CTA）

次の候補: 所属ブロックへのロゴ画像設定UI、ブロック背景色の拡充（LinkBlock/ProfileCardBlock）、テーマ選択のPro解放。

**2026-05-12 プロフィール設定UX大幅改善・公開プロフィール無課金表示刷新完了。**

- 完成度バー固定化（ボトムナブ上部、`position: fixed`）＋Proステップ追加（7ステップ100%制）、合計100%でProかつ全完了時に非表示
- FABプレビューボタン追加（`position: fixed` 右下、`z-index: 48`）タップでプレビューモーダルを開く
- テーマ選択を「プロフィールページをデザイン」セクションへ移動、全ユーザー自由選択（ロック廃止）
- テーマ6色刷新: warm / ocean 廃止 → sunset（#1a0800, オレンジ）/ grape（#130d1f, 紫）追加
- 背景画像をテーマスウォッチ7枚目（📷スウォッチ）に統合、独立セクション廃止
- blocksセクションのペイウォール削除（設定は全員可・公開プロフィールへの反映はProのみ）
- 所属アイテムのボタンをカード上部横並びに変更、削除ボタンは「○件目を削除」と番号付き
- プランセクション刷新: ヘッドライン「Freeで作って、Proで魅せる」＋Free/Proプレビューリンク
- 無課金プロフィール（p/[userId].js）をテキストのみのシンプルレイアウトに刷新（アバター非表示・カード廃止・セクション区切り線のみ）
- CTAを「ベントーグリッドで魅せる（Pro誘導）」→「名刺を受け取ったら、Koryuで繋がろう（訪問者招待）」に転換
- ファビコン追加（`/favicon.svg`、32×32 黒丸角背景＋緑の「交」）
- メール設定の戻るボタン遷移先を `/` → `/settings/profile` に修正

**2026-05-13 プロフィールページ・ブロックUX全面ブラッシュアップ完了。**

- プロフィール設定の未翻訳箇所を全てi18n対応（SNSリンク・所属・デザイン・プランセクション等）
- テーマ選択をクリック時に即時自動保存（`/api/profile/update-theme`、楽観的更新）
- FABプレビューのデフォルトを `previewMode='pro'` に変更（Freeユーザーでもフルプレビュー確認可）
- `?preview=1` クエリで isPro に関わらずテーマ・ベントーをフル表示（プレビューモーダル用）
- bioテキスト改行対応（設定画面ヘッダー・ベントーカードブロック両方）
- **ブロックサイズ別アダプティブレイアウト全面実装**: 全6ブロック種がサイズに応じてレイアウト・表示内容を自動変化
- 所属ブロックに XS サイズ追加（会社名+役職のみ・約80px）
- 写真ブロック: captionオーバーレイ表示 + `caption_color` 選択（4色プリセット）
- リンクブロック: `display_mode`（thumbnail/overlay）+ `text_color` 選択。overlayは line-clamp でサイズ別省略
- **フッター所属エリア追加（Proのみ）**: ベントーグリッド下に profile_affiliations 全件表示
- ブロックタイプ選択モーダルに制約テキスト追加（サイズ別の表示制限を事前告知）
- bioフィールドに文字数カウンター追加（XX/100文字・サイズ別目安表示）
- Vercel Preview環境に環境変数（NEXT_PUBLIC_SUPABASE_URL等）を追加しPreviewビルド修正

**2026-05-19 コンタクト管理・交流フロー大幅強化完了。**

- contactsテーブルに `koryu_user_id` カラム追加（Koryuユーザーとの安定した紐付け。email変更に強い）
- コンタクトマージ機能（手動マージ + DUPLICATE画面からの名刺追加）
- カード個別削除・コンタクト丸ごと削除（UIの即時反映対応）
- 名刺追加時の重複選択UI（同メールアドレス時に「更新」「新規追加」の2択）
- チップ切替の表示優先順修正（activeCardIdx===0はKoryuライブデータ優先、別会社カードは固有データ表示）
- QRスキャン時の重複チェック（koryu_user_id優先→emailフォールバック、emailヒット時は非同期でkoryu_user_id紐付け更新）
- 「出会い」→「交流」へテキスト統一（i18n + ハードコード箇所。アプリ名Koryuと一致）
- メール送信を交流履歴セクションに統合・旧collapsibleメールUIを削除
- AIメール生成フロー実装（シチュエーション選択→`/api/contacts/generate-email`→プレビュー編集→送信）
- メール送信後にencountersへ自動記録（`event_name='メール送信'`、✉アイコン付き特別表示）
