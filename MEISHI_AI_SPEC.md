# MeishiAI 仕様書 v2.1

> 「出会いを記録し、関係を動かし、人をつなぐOS」

---

## プロダクトコンセプト

### 原体験
交流会・ビジネスの場で名刺交換しまくると、顔・名前・シチュエーションが一致しなくなる。
結果、また名刺交換するサイクルが繰り返される。これを解決する。

### ポジショニング
- CRMを作らない。CRMの「前」を制する。
- 「出会いの瞬間」から「初動」までを完全にカバー。
- HubSpot / kintone などには「文脈付きで」データを渡す。

### ターゲットユーザー
- 交流会・営業活動を積極的に行う営業マン
- 人脈を資産化したい経営者
- チームで営業する組織

---

## コア機能

### 1. 認証・チーム管理 ✅ 完了

**認証**
- メールアドレス + パスワードでログイン（Supabase Auth）
- オーナーによるメンバー招待（メール + `/auth/confirm` パスワード設定画面）

**組織（チーム）設計**
- 1ユーザーは必ず1つの「自分のチーム（owner org）」を持つ
- 招待で参加したチームは別途 `role='member'` で保持（複数可）
- `profiles.current_organization_id` は常に自分がownerのチームを指す
- `/settings/team` で「自分のチーム」（編集可）と「参加中のチーム」（読み取り専用）を2セクション表示

**送信権限**
- メール送信ボタンは Contact の `owner_id === user.id` のときのみ表示
- チームメンバーが共有Contactを閲覧しても送信・再送はできない

---

### 2. Contact記録（名刺交換の瞬間）✅ 完了

**撮影**
- 名刺写真（最大3枚、圧縮してStorageに保存）
- Claude Vision OCRで基本情報を自動抽出

**基本情報（OCR自動入力）**
- 氏名、会社名、部署・役職、メールアドレス、電話番号

**文脈情報（30秒以内で入力できる設計）**
- 会った場所・イベント名
- 日付（自動）
- 温度感：🔥熱い / 🤝普通 / 👀様子見
- 一言メモ

**初動**
- お礼メール：今すぐ送信 or 保存して後で送る
- SendGrid経由で送信者のアドレスから送信

**共有範囲（visibility）**
- `private`（自分だけ） / `team`（チーム全体）を後から切り替え可能
- デフォルトは `private`
- 一覧画面で他チームのContactにはチーム名バッジを表示

**重複検出（2026-04-26 実装）**
- スキャン時に同じメールアドレスのContactが既存の場合、DUPLICATE画面を表示
- 重複Contactは新規保存しない（上書き・重複防止）
- DUPLICATE画面で過去の全撮影履歴（日付・イベント・場所）を一覧表示
- 「この出会いを記録する」から文脈情報（日付・場所・メモ）を追記可能

**出会い履歴（encounters）**
- 同一人物と複数回会うたびに出会いを追記できる
- Contact詳細ページに出会い履歴セクションを追加（新しい順で表示）
- 初回スキャン時にも encounters テーブルに自動記録される

---

### 3. プロフィール・送信設定・課金 ✅ 完了

**`/settings/profile`**（タブUI: メール設定 / SNS / 所属）
- ログイン中のメールアドレス・表示名 + 一言コメント（bio）を表示（インライン編集可）
- **メール設定タブ**: SendGrid / Gmail OAuth2 / カスタムSMTP を選択して設定。送信プロバイダーごとに設定フォームを切替表示。メール署名プレビュー（QRコード付き）を表示。未設定の場合、メール送信時に設定を促すエラーを返す
- **SNSタブ**: LINE / WhatsApp / X / Instagram / Facebook / LinkedIn / TikTok / YouTube / Threads / Telegram / WeChat / Discord / GitHub / Bluesky / Pinterest の15種のSNSリンクを登録。入力モードは3種：QRスキャン（LINE/WhatsApp）・ユーザー名入力（X/Instagram等）・URLフル入力（Facebook/Discord/WeChat）。各SNSにhelpリンクあり。
- **所属タブ**: 会社名・役職を最大5件登録（ドラッグ&ドロップ並び替え対応）。先頭1件がメール署名・プロフィールページの主所属として使われる
- プランバッジ（Free / Pro）と今月のスキャン使用数バーを表示
- Stripe Checkout（アップグレード）・Stripe Customer Portal（管理）へのボタン
- 全テキストi18n対応（日本語/英語）

**公開プロフィールページ（`/p/[userId]`）**
- 名前・bio（一言コメント）・所属（全件）・SNSタップボタン（simpleiconsアイコン付き）を表示（認証不要）
- メール送信時にQRコードとしてHTMLメール署名に自動挿入
- アプリ招待バナーをフッター上部に表示

**Stripe課金（本番稼働中）**
- Free: 10スキャン/月、Pro: 100スキャン/月（¥980/月）
- 本番APIキー（`sk_live_`, `pk_live_`）をVercelに設定済み
- webhookでDB（`profiles.plan`）を自動更新
- ベータユーザーへのPro付与: Supabase SQL Editor で `UPDATE profiles SET plan = 'pro' WHERE email = 'xxx';`

---

### 4. チーム内引き継ぎ（未実装）

- Contactを別メンバーにアサイン
- 引き継ぎ時にAIが「文脈サマリー」を自動生成
  - 誰が・いつ・どこで会ったか
  - 温度感・メモ
  - 目的・引き継ぎ理由
- 引き継ぎ履歴が時系列で残る
- 引き継がれたメンバーには通知

---

### 5. 組織外共有（未実装）

**A. リンク共有**
- ContactページをURLで共有（期限付きトークン）
- 受け取った人はアプリ未登録でも閲覧可能

**B. AI紹介メール**
- 「AさんをBさんに紹介する」三者間メールをAIが自動生成
- 紹介者・被紹介者・受け取り手の文脈を含めた自然な紹介文

---

### 6. AIフォローサポート（未実装）

**リマインド通知**
- 接触から3日後・1週間後などに通知（設定可能）

**AIアクション提案**
- 温度感・メモ・業種などをもとに「次にすべきアクション」を提案

**フォロー管理**
- フォロー済み / 未フォロー のステータス管理
- フォロー履歴（何をしたか）を記録

---

## 画面構成

```
ログイン
  ↓
ホーム（名刺スキャン）
  - 名刺撮影（最大3枚）
  - OCR結果確認・メール編集
  - 文脈情報入力（場所・温度感・メモ）
  - お礼メール送信 or 後で送る
  ↓
保存済み名刺一覧（/contacts）
  - 自分の名刺（全visibility）
  - チームメンバーのteam共有名刺
  - 他チームのContactにはチーム名バッジ表示
  - 🔒/👥 バッジ表示
  ↓
Contact詳細（/contacts/[id]）
  - 名刺写真
  - 基本情報
  - 文脈情報・メモ（後から編集可）
  - 出会い履歴（encounters）— 新しい順で全件表示
  - お礼メール送信状況・再送（owner_idのユーザーのみ表示）
  - 共有範囲トグル（owner_idのユーザーのみ表示）
  ↓
チーム管理（/settings/team）
  - 自分のチーム: チーム名編集、メンバー一覧、表示名編集、メンバー招待
  - 参加中のチーム: チーム名一覧（読み取り専用）
  ↓
プロフィール設定（/settings/profile）
  - タブUI: メール設定 / SNS / 所属
  - メール設定: SendGrid / Gmail OAuth2 / カスタムSMTP 選択・設定
  - SNS: 15種のSNSリンク登録
  - 所属: 会社名・役職を最大5件（DnD並び替え）
  - プランバッジ・スキャン使用数バー
  - アップグレード（Stripe Checkout）・管理（Stripe Portal）
  ↓
公開プロフィール（/p/[userId]）
  - 認証不要・外部公開
  - 名前・所属・SNSタップボタン
  - メール署名のQRコードからアクセス
  ↓
パスワード設定（/auth/confirm）
  - 招待メール経由のユーザー向け
```

---

## 技術スタック

| 項目 | 技術 |
|---|---|
| フロントエンド | Next.js 14 (Pages Router) |
| デプロイ | Vercel |
| DB | Supabase (PostgreSQL) |
| 認証 | Supabase Auth |
| ストレージ | Supabase Storage (`cards` bucket) |
| AI | Anthropic Claude API (claude-opus-4-5, Vision + Text) |
| メール送信 | SendGrid / Gmail（`googleapis` REST API）/ カスタムSMTP（ユーザーごとに選択・設定）|
| 課金 | Stripe（本番 sk_live_ / pk_live_、Checkout + Customer Portal + Webhook）|
| 通知 | 未実装（将来: Vercel Cron + メール/Push）|

---

## DBスキーマ（実装済み）

```sql
-- 組織
organizations (id, name, created_at)

-- ユーザープロフィール（Supabase auth.users と 1:1）
profiles (
  id,
  email,
  name,
  bio text,                  -- 一言コメント（最大100文字）2026-05-03追加
  current_organization_id → organizations,  -- 常に自分がownerのorg
  sender_email,              -- 送信元アドレス（SendGrid/SMTP用）
  sendgrid_api_key,          -- SendGrid APIキー（クライアントには返さない）
  smtp_provider text,        -- 'sendgrid' | 'gmail' | 'smtp'
  smtp_host, smtp_port, smtp_user, smtp_password,  -- カスタムSMTP用
  gmail_refresh_token, gmail_email,                -- Gmail OAuth2用
  sns_line, sns_whatsapp, sns_x, sns_instagram, sns_facebook,
  sns_linkedin, sns_tiktok, sns_youtube, sns_threads, sns_telegram,
  sns_wechat, sns_discord, sns_github, sns_bluesky, sns_pinterest,
  plan text,                 -- 'free' | 'pro'  default: 'free'
  scan_count_month int,      -- 今月のスキャン数（月初リセット）
  scan_count_reset_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text
)

-- 所属情報（1ユーザーに最大5件）
profile_affiliations (
  id,
  user_id → profiles,
  company_name text,
  title text,
  order_index int,           -- 表示順（0始まり）
  created_at
)
-- RLS無効。supabaseAdmin経由のAPI routeのみアクセス

-- ユーザー×組織 中間テーブル（多対多）
user_organizations (user_id → profiles, organization_id → organizations, role text, created_at)
-- role: 'owner' | 'member'
-- 各ユーザーは必ず1件のrole='owner'レコードを持つ

-- Contact
contacts (
  id,
  owner_id,              -- auth.uid() (≠ user_id)
  organization_id,       -- profiles.current_organization_id at save time
  name, company, department, title, email, phone,
  card_image_urls text[],   -- 全名刺画像URLの配列
  cards jsonb[],            -- OCR結果の配列（cards[0]が主カード、複数社対応）
  extracted_sns jsonb,      -- 名刺から抽出したSNS情報（マージ方式で蓄積）
  connected_sns jsonb,      -- 「✓ 繋がった」済みのSNS  DEFAULT '{}'
  subject, body,
  mail_sent_at,
  location, event_name, met_at date,
  temperature text,      -- 'hot' | 'normal' | 'watch'
  memo,
  visibility text,       -- 'private' | 'team'  default: 'private'
  created_at
)

-- 出会い履歴（1 Contact に複数紐付け可）
encounters (
  id,
  contact_id → contacts,  -- ON DELETE CASCADE
  met_at date,
  event_name, location, memo,
  temperature text,        -- 'hot' | 'normal' | 'watch'
  photo_urls text[],       -- 出会い時の写真URL（encountersバケット）
  created_at
)
-- RLS無効。supabaseAdmin経由のAPI routeのみアクセス
```

**将来追加予定テーブル：**
```sql
handoffs (id, contact_id, from_user_id, to_user_id, summary, reason, created_at)
follow_logs (id, contact_id, user_id, action, note, created_at)
reminders (id, contact_id, user_id, remind_at, done, created_at)
```

---

## 開発フェーズ

### Phase 1 ✅ 完了
- [x] 名刺撮影 → OCR → お礼メール送信
- [x] 今すぐ送信 / 保存して後で送る
- [x] Contact一覧・詳細画面
- [x] Supabase Storage画像保存（最大3枚・圧縮）

### Phase 2 ✅ 完了
- [x] ログイン・認証（Supabase Auth）
- [x] 名刺複数枚（最大3枚）対応・画像圧縮
- [x] 文脈情報入力（場所・温度感・メモ）
- [x] チーム管理・メンバー招待（`/settings/team`）
- [x] 招待メール + `/auth/confirm` パスワード設定フロー
- [x] チーム内visibility機能（private / team）
- [x] 全DB操作をsupabaseAdmin経由のAPI routeに統一

### Phase 3 ✅ 完了（一部）
- [x] チーム設計簡略化（1ユーザー = 1 owner org、複数チーム切替UIは廃止）
- [x] 全ユーザーが必ず自分のowner orgを持つ（招待メンバーも自動作成）
- [x] チーム管理画面を「自分のチーム」「参加中のチーム」2セクションに分離
- [x] 他チームのContactに組織名バッジを表示
- [x] 送信権限制御（owner_idのユーザーのみ送信・再送ボタンを表示）
- [x] メール送信をGmail SMTPからSendGridに切り替え
- [x] プロフィール設定画面（`/settings/profile`）— SendGrid APIキー・送信元アドレス設定、表示名インライン編集
- [x] Stripe課金実装・本番稼働（Free/Pro、¥980/月、Checkout + Portal + Webhook）
- [x] スキャン上限チェック（Free: 10/月、Pro: 100/月）+ 月次リセット
- [x] UIロケールとメール生成言語の連動（EN UI → 英語メール、JA UI → 日本語メール）
- [x] `useRequireAuth` 認証レースコンディション修正（`onAuthStateChange` 優先 + `resolved` フラグ）
- [x] メアド重複検出・DUPLICATE画面表示・保存ブロック
- [x] encounters テーブルで複数出会い履歴を管理
- [x] Contact詳細に出会い履歴セクション追加
- [x] SNSリンク登録（15種）＋公開プロフィールページ（`/p/[userId]`）
- [x] 所属管理（ドラッグ&ドロップ、最大5件）
- [x] プロフィール設定タブUI（メール設定 / SNS / 所属）
- [x] メール署名をQRコード付きHTMLに変更（`buildHtmlEmail` + `api.qrserver.com`）
- [x] Gmail送信をSMTP → REST API（`googleapis` `gmail.users.messages.send`）に変更
- [x] 招待ユーザーのチームメンバー登録漏れ修正（`app_metadata` フォールバック追加、`profiles` 先行upsertでFK制約23503を解消）
- [x] Gmail OAuthコールバックのリダイレクトを絶対URLに変更（Vercelプレビュードメインからカスタムドメインのセッションを引き継げなかった問題を修正）
- [x] Supabase Auth カスタムSMTP設定（smtp.gmail.com）でデフォルトレート制限を回避
- [x] チーム招待の既存ユーザー対応（`user_organizations` 直接insert + 通知メール送信）（2026-05-03）
- [x] メール送信共通ユーティリティ（`lib/sendEmail.js`）— send.js と invite.js で共用（2026-05-03）
- [x] 公開プロフィールページ強化（SNSアイコン・bio・アプリ招待バナー）（2026-05-03）
- [x] SNS入力UX改善（QRスキャン・ユーザー名入力・helpリンク）（2026-05-03）
- [x] bio（一言コメント）フィールド追加（`profiles.bio`）（2026-05-03）
- [x] メール署名プレビュー（プロフィール設定メール設定タブ内）（2026-05-03）
- [x] プロフィール設定の多言語対応完備（全テキストi18n化）（2026-05-03）
- [x] 名刺一覧の空状態ボタン修正（`/?scan=1` でホーム遷移時にファイル選択を自動起動）（2026-05-03）
- [x] Gmail OAuth後のログアウト問題修正（`window.open()` ポップアップ方式 + `pages/auth/gmail-done.js` 新設 + `postMessage` でUI即時更新）（2026-05-04）
- [x] Gmail OAuth完了後のUI即時更新（`savedProvider` state追加、`postMessage` origin不一致修正）（2026-05-04）
- [x] メール本文末尾の署名行バグ修正（EN/JAプロンプトに「署名は自動付与されるので本文に含めない」指示を追加）（2026-05-04）
- [x] パスワードリセット機能追加（`login.js` に forgot モード、`resetPasswordForEmail` + `/auth/confirm` 再利用）（2026-05-04）
- [x] サインアップ後の言語維持（`signUp` に `emailRedirectTo` でロケール付きURLを渡す、Supabase Redirect URLs に `/en/` 追加）（2026-05-04）
- [x] SNSカテゴリ再編（personal/business/cardapp）・新SNS追加（Sansan, Eight, myBridge, Vercel, note, Wantedly）・`lib/snsConfig.js` 新設（2026-05-05）
- [x] プロフィール画面全面リデザイン（3セクションスクロール、プリセットプレビューパネル、顔写真アップロード）（2026-05-05）
- [x] 名刺スキャンからプロフィール自動入力（「📷 名刺からプロフィールを入力」、OCR→CONFIRM画面→保存）（2026-05-05）
- [x] 公開プロフィールページ全面リデザイン（Linktreeライク、96px丸アバター、bio、所属カード、SNSフル幅ボタン）（2026-05-05）
- [x] profile_affiliations に phone/website/contact_email/show_* 追加（所属+連絡先一体化）（2026-05-05）
- [x] contacts/[id].js 繋がりハブ化（extracted_sns × プロフィールSNSマッチング、「✓ 繋がった」ボタン、connected_sns記録）（2026-05-06）
- [x] contacts/[id].js i18n完全修正（require()でJSONをwebpackバンドル、_nextI18Next手動構築でVercel対応）（2026-05-06）
- [x] 複数名刺対応（contacts.cardsにOCR結果を配列保存、チップバーで名刺切替、activeCardIdxによる表示制御）（2026-05-06）
- [x] 「🔄 再スキャン」複数枚対応（カード選択シート、card_index指定でrescan API呼び出し）（2026-05-06）
- [x] 「＋ 名刺を追加」機能（preview_onlyでOCR→確認シート→add-card APIで追記、addingCardスピナー表示）（2026-05-06）
- [x] メールボタンに送信先アドレス表示（選択中カードの email を displayEmail として使用）（2026-05-06）
- [x] encountersバケットRLSポリシー追加（authenticated INSERT + public SELECT）（2026-05-06）
- [ ] Contact引き継ぎ機能（アサイン + AIサマリー生成）
- [ ] AIフォローアップ提案
- [ ] フォローリマインダー（Vercel Cron）

### Phase 4
- [ ] 組織外共有（リンク / AI紹介メール）
- [ ] フォロー履歴管理
- [ ] CRM連携（HubSpot / kintone）

---

## リポジトリ
https://github.com/oonotaku/meishi-mailer

## 本番URL
https://www.meishi-mailer.com

## ローカル開発
```
C:\Users\taku_\Desktop\dev\meishi-mailer
```
