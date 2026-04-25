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

---

### 3. プロフィール・送信設定・課金 ✅ 完了

**`/settings/profile`**
- ログイン中のメールアドレス・表示名を表示（インライン編集可）
- SendGrid APIキーと送信元メールアドレスを設定
- 設定済み/未設定バッジ表示
- 未設定の場合、メール送信時に設定を促すエラーを返す
- プランバッジ（Free / Pro）と今月のスキャン使用数バーを表示
- Stripe Checkout（アップグレード）・Stripe Customer Portal（管理）へのボタン

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
  - お礼メール送信状況・再送（owner_idのユーザーのみ表示）
  - 共有範囲トグル（owner_idのユーザーのみ表示）
  ↓
チーム管理（/settings/team）
  - 自分のチーム: チーム名編集、メンバー一覧、表示名編集、メンバー招待
  - 参加中のチーム: チーム名一覧（読み取り専用）
  ↓
プロフィール設定（/settings/profile）
  - ログイン中のメールアドレス・表示名（インライン編集）
  - SendGrid APIキー・送信元メールアドレス設定
  - プランバッジ・スキャン使用数バー
  - アップグレード（Stripe Checkout）・管理（Stripe Portal）
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
| メール送信 | SendGrid (`@sendgrid/mail`、APIキーはDBにユーザーごとに保存） |
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
  current_organization_id → organizations,  -- 常に自分がownerのorg
  sender_email,              -- SendGrid送信元アドレス
  sendgrid_api_key,          -- SendGrid APIキー（クライアントには返さない）
  plan text,                 -- 'free' | 'pro'  default: 'free'
  scan_count_month int,      -- 今月のスキャン数（月初リセット）
  scan_count_reset_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text
)

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
  card_image_urls text[],   -- max 3
  subject, body,
  mail_sent_at,
  location, event_name, met_at date,
  temperature text,      -- 'hot' | 'normal' | 'watch'
  memo,
  visibility text,       -- 'private' | 'team'  default: 'private'
  created_at
)
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
https://meishi-mailer-mu.vercel.app

## ローカル開発
```
C:\Users\taku_\Desktop\dev\meishi-mailer
```
