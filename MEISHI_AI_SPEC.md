# MeishiAI 仕様書 v2.0

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

**組織（チーム）**
- 1ユーザーは複数組織に所属可能（`user_organizations` 中間テーブル）
- `profiles.current_organization_id` でアクティブ組織を管理
- ロール：オーナー / メンバー
- `/settings/team` でチーム名・メンバー表示名の編集、メンバー招待

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
- 当日送信 → 「先ほどは」、日を跨いだら → 「先日は」で自動切替

**共有範囲（visibility）**
- `private`（自分だけ） / `team`（チーム全体）を後から切り替え可能
- デフォルトは `private`

---

### 3. チーム内引き継ぎ（未実装）

- Contactを別メンバーにアサイン
- 引き継ぎ時にAIが「文脈サマリー」を自動生成
  - 誰が・いつ・どこで会ったか
  - 温度感・メモ
  - 目的・引き継ぎ理由
- 引き継ぎ履歴が時系列で残る
- 引き継がれたメンバーには通知

---

### 4. 組織外共有（未実装）

**A. リンク共有**
- ContactページをURLで共有（期限付きトークン）
- 受け取った人はアプリ未登録でも閲覧可能

**B. AI紹介メール**
- 「AさんをBさんに紹介する」三者間メールをAIが自動生成
- 紹介者・被紹介者・受け取り手の文脈を含めた自然な紹介文

---

### 5. AIフォローサポート（未実装）

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
  - 🔒/👥 バッジ表示
  ↓
Contact詳細（/contacts/[id]）
  - 名刺写真
  - 基本情報
  - 文脈情報・メモ（後から編集可）
  - お礼メール送信状況・再送
  - 共有範囲トグル（オーナーのみ）
  ↓
チーム管理（/settings/team）
  - チーム名編集（オーナーのみ）
  - メンバー一覧・表示名編集（自分のみ）
  - メンバー招待
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
| メール送信 | Nodemailer + Gmail SMTP |
| 通知 | 未実装（将来: Vercel Cron + メール/Push）|

---

## DBスキーマ（実装済み）

```sql
-- 組織
organizations (id, name, created_at)

-- ユーザープロフィール（Supabase auth.users と 1:1）
profiles (id, email, name, current_organization_id → organizations)

-- ユーザー×組織 中間テーブル（多対多）
user_organizations (user_id → profiles, organization_id → organizations, role text, created_at)
-- role: 'owner' | 'member'

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

### Phase 3（次のステップ）
- [ ] 複数チーム対応UI（チーム切替セレクター）
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
