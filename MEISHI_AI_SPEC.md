# MeishiAI 仕様書 v1.0

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

### 1. 認証・チーム管理

**認証**
- メールアドレス + パスワードでログイン（Supabase Auth）
- 新規登録 / ログイン / パスワードリセット

**組織（チーム）**
- 1ユーザーは1組織に所属（将来的に複数対応）
- ロール：オーナー / メンバー
- オーナーはメンバーを招待できる

---

### 2. Contact記録（名刺交換の瞬間）

**撮影**
- 名刺写真（最大3枚、圧縮してStorageに保存）
- 顔写真（1枚）
- Claude Vision OCRで基本情報を自動抽出

**基本情報（OCR自動入力 + 手動修正可）**
- 氏名
- 会社名
- 部署・役職
- メールアドレス
- 電話番号

**文脈情報（30秒以内で入力できる設計）**
- 会った場所・イベント名（テキスト入力 or 選択式）
- 日付（自動）
- 温度感：🔥熱い / 🤝普通 / 👀様子見
- 一言メモ（テキスト or 音声入力）

**初動**
- お礼メール：今すぐ送信 or 保存して後で送る
- 当日送信 → 「先ほどは」、日を跨いだら → 「先日は」で自動切替

---

### 3. チーム内引き継ぎ

- Contactを別メンバーにアサイン
- 引き継ぎ時にAIが「文脈サマリー」を自動生成
  - 誰が・いつ・どこで会ったか
  - 温度感・メモ
  - 目的・引き継ぎ理由
- 引き継ぎ履歴が時系列で残る
- 引き継がれたメンバーには通知

---

### 4. 組織外共有（2パターン）

**A. リンク共有**
- ContactページをURLで共有（期限付きトークン）
- 受け取った人はアプリ未登録でも閲覧可能
- 「このContactを自分のアプリに取り込む」ボタンで自分のDBに追加

**B. AI紹介メール**
- 「AさんをBさんに紹介する」三者間メールをAIが自動生成
- 紹介者・被紹介者・受け取り手の文脈を含めた自然な紹介文
- 送信前に編集可能

---

### 5. AIフォローサポート

**リマインド通知**
- 接触から3日後・1週間後などに通知（設定可能）
- 「そろそろフォローしては？」

**AIアクション提案**
- 温度感・メモ・業種などをもとに「次にすべきアクション」を提案
- 例：「採用課題ありとのことで、〇〇の情報を送ると刺さりそうです」

**フォロー管理**
- フォロー済み / 未フォロー のステータス管理
- フォロー履歴（何をしたか）を記録

---

## 画面構成

```
ログイン / 新規登録
  ↓
ホーム
  - Contact一覧（新しい順）
  - フォロー待ちバッジ
  - チームメンバーのContact表示切替
  - 新規撮影ボタン（FAB）
  ↓
新規登録フロー
  1. 名刺撮影（最大3枚）
  2. 顔写真撮影（1枚）
  3. OCR結果確認・修正
  4. 文脈情報入力（場所・温度感・メモ）
  5. お礼メール送信 or 後で送る
  ↓
Contact詳細
  - 名刺写真・顔写真
  - 基本情報
  - 文脈情報・メモ
  - お礼メール送信状況
  - フォロー履歴
  - AIアクション提案
  - 引き継ぎボタン
  - 共有ボタン（リンク / 紹介メール）
  ↓
引き継ぎ画面
  - 引き継ぎ先メンバー選択
  - AIサマリー確認・編集
  - 引き継ぎ理由・目的入力
  ↓
共有画面
  - リンク生成・コピー
  - 紹介メール生成・編集・送信
  ↓
チーム管理画面
  - メンバー一覧
  - 招待リンク発行
  ↓
設定
  - プロフィール
  - フォローリマインド設定
  - メール署名設定
```

---

## 技術スタック

| 項目 | 技術 |
|---|---|
| フロントエンド | Next.js 14 |
| デプロイ | Vercel |
| DB | Supabase (PostgreSQL) |
| 認証 | Supabase Auth |
| ストレージ | Supabase Storage |
| AI | Anthropic Claude API (Vision + Text) |
| メール送信 | Nodemailer + Gmail SMTP |
| 通知 | Vercel Cron + メール通知（将来: Push通知） |

---

## DBスキーマ（概略）

```sql
-- 組織
organizations (id, name, created_at)

-- ユーザー
users (id, email, name, organization_id, role, created_at)

-- Contact
contacts (
  id, owner_id, organization_id,
  name, company, department, title, email, phone,
  card_image_urls (array, max3),
  face_image_url,
  location, event_name, met_at,
  temperature (hot/normal/watch),
  memo, voice_memo_url,
  subject, body,
  mail_sent_at,
  assigned_to,
  shared_token, shared_expires_at,
  created_at
)

-- 引き継ぎ履歴
handoffs (id, contact_id, from_user_id, to_user_id, summary, reason, created_at)

-- フォロー履歴
follow_logs (id, contact_id, user_id, action, note, created_at)

-- フォローリマインド
reminders (id, contact_id, user_id, remind_at, done, created_at)
```

---

## 開発フェーズ

### Phase 1（現在完了）
- [x] 名刺撮影 → OCR → お礼メール送信
- [x] 今すぐ送信 / 保存して後で送る
- [x] Contact一覧・詳細画面
- [x] Supabase Storage画像保存

### Phase 2（次のステップ）
- [ ] ログイン・認証（Supabase Auth）
- [ ] 顔写真 + 名刺複数枚（最大3枚）対応
- [ ] 文脈情報入力（場所・温度感・音声メモ）
- [ ] 画像圧縮処理

### Phase 3
- [ ] チーム管理・メンバー招待
- [ ] Contact引き継ぎ機能
- [ ] AIフォローサポート・リマインド

### Phase 4
- [ ] 組織外共有（リンク / 紹介メール）
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
