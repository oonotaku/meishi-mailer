# 名刺メーラー

名刺を撮影するだけでお礼メールを自動送信し、出会いの履歴をチームで管理できるWebアプリ。

## 機能

- 名刺撮影（最大3枚）→ Claude Vision OCR → お礼メール自動生成・送信
- 文脈情報（場所・イベント名・温度感・メモ）の記録
- **重複検出**: 同じメールアドレスの名刺は自動検出し、新たな出会いを追記
- **出会い履歴**: 同一人物と複数回会うたびに履歴として蓄積
- **公開プロフィールページ** (`/p/[userId]`): SNSタップボタン・所属情報を表示、QRコードでアクセス可能
- **QRコード付きHTML署名**: 送信メールに自動でQRコード＋プロフィールURLを挿入
- **プロフィール設定**: SNSリンク15種・所属情報（ドラッグ&ドロップ並び替え、最大5件）
- チーム管理・メンバー招待
- 名刺の共有範囲設定（自分だけ / チーム全体）
- Free / Pro プラン（Stripe課金）

## セットアップ

```bash
npm install
```

## 環境変数

`.env.local` を作成して以下を設定：

```
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=https://www.meishi-mailer.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

SendGrid APIキーと送信元メールアドレスはユーザーごとに `/settings/profile` から設定します（環境変数不要）。

## Supabase セットアップ

### テーブル作成

Supabase SQL Editorで実行：

```sql
-- 組織
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

-- プロフィール（auth.usersと1:1）
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  name text,
  current_organization_id uuid references organizations(id),
  sender_email text,
  sendgrid_api_key text,
  plan text default 'free',
  scan_count_month int default 0,
  scan_count_reset_at timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now()
);

-- ユーザー×組織 中間テーブル
create table user_organizations (
  user_id uuid references profiles(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz default now(),
  primary key (user_id, organization_id)
);

-- Contact
create table contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  organization_id uuid references organizations(id),
  name text,
  company text,
  department text,
  title text,
  email text,
  phone text,
  card_image_urls text[],
  subject text,
  body text,
  mail_sent_at timestamptz,
  location text,
  event_name text,
  met_at date,
  temperature text check (temperature in ('hot', 'normal', 'watch')),
  memo text,
  visibility text not null default 'private' check (visibility in ('private', 'team')),
  created_at timestamptz default now()
);

-- 出会い履歴（1 Contact に複数紐付け可）
create table encounters (
  id uuid default gen_random_uuid() primary key,
  contact_id uuid references contacts(id) on delete cascade not null,
  met_at date,
  event_name text,
  location text,
  memo text,
  temperature text default 'normal',
  created_at timestamptz default now()
);
-- ※ encounters は RLS 無効で OK（supabaseAdmin経由のAPI routeのみアクセス）
```

### RLSポリシー

```sql
alter table profiles enable row level security;
alter table contacts enable row level security;
alter table organizations enable row level security;
alter table user_organizations enable row level security;

create policy "select own profile" on profiles for select using (auth.uid() = id);
create policy "insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "update own profile" on profiles for update using (auth.uid() = id);

create policy "select own contacts" on contacts for select using (auth.uid() = owner_id);
create policy "insert own contacts" on contacts for insert with check (auth.uid() = owner_id);
create policy "update own contacts" on contacts for update using (auth.uid() = owner_id);
create policy "delete own contacts" on contacts for delete using (auth.uid() = owner_id);
```

> **注意**: `user_organizations` のRLSにrecursiveなポリシーを設定すると400エラーが発生します。
> チームデータの読み書きはすべて `supabaseAdmin` を使うAPI routeで行い、クライアントから直接クエリしません。

### Storageバケット

Supabase Dashboard → Storage → New bucket で `cards` を作成（Public bucket）。

### 招待メールの設定

Supabase Dashboard → Authentication → URL Configuration → **Additional Redirect URLs** に追加：

```
https://meishi-mailer-mu.vercel.app/auth/confirm
```

## ローカル起動

```bash
npm run dev
```

http://localhost:3000 にアクセス。

## 技術スタック

| 項目 | 技術 |
|---|---|
| フロントエンド | Next.js 14 (Pages Router) |
| デプロイ | Vercel |
| DB / Auth / Storage | Supabase |
| AI | Anthropic Claude API (claude-opus-4-5) |
| メール送信 | SendGrid / Gmail（OAuth2 REST API） / カスタムSMTP（ユーザーごとに選択・設定） |
| 課金 | Stripe（Free/Pro、¥980/月） |
