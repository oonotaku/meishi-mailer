# 名刺メーラー

名刺を撮影するだけでお礼メールを自動送信し、チームで共有できるWebアプリ。

## 機能

- 名刺撮影（最大3枚）→ Claude Vision OCR → お礼メール自動生成・送信
- 文脈情報（場所・温度感・メモ）の記録
- チーム管理・メンバー招待
- 名刺の共有範囲設定（自分だけ / チーム全体）

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
GMAIL_USER=
GMAIL_APP_PASSWORD=
NEXT_PUBLIC_SITE_URL=https://meishi-mailer-mu.vercel.app
```

- `SUPABASE_SERVICE_ROLE_KEY` — Supabase Dashboard → Settings → API → service_role key
- `GMAIL_APP_PASSWORD` — Googleアカウント → セキュリティ → アプリパスワード で発行
- `NEXT_PUBLIC_SITE_URL` — Vercelデプロイ後の本番URL（招待メールのリンクに使用）

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
```

### RLSポリシー

```sql
-- RLS有効化
alter table profiles enable row level security;
alter table contacts enable row level security;
alter table organizations enable row level security;
alter table user_organizations enable row level security;

-- profiles: 自分のプロフィールのみ読み書き可
create policy "select own profile"
  on profiles for select using (auth.uid() = id);

create policy "insert own profile"
  on profiles for insert with check (auth.uid() = id);

create policy "update own profile"
  on profiles for update using (auth.uid() = id);

-- contacts: 自分のContactのみ読み書き可（チーム共有はAPI route経由）
create policy "select own contacts"
  on contacts for select using (auth.uid() = owner_id);

create policy "insert own contacts"
  on contacts for insert with check (auth.uid() = owner_id);

create policy "update own contacts"
  on contacts for update using (auth.uid() = owner_id);

create policy "delete own contacts"
  on contacts for delete using (auth.uid() = owner_id);

-- organizations / user_organizations はsupabaseAdmin（API route）経由のみ操作
-- クライアントからのアクセスは不要なのでポリシー不要（またはdenyのまま）
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

スマホ（同じWi-Fi）からアクセスする場合：
```
http://<PCのIPアドレス>:3000
```

## Vercelデプロイ

```bash
npm i -g vercel
vercel --prod
```

Vercel環境変数に上記の環境変数をすべて設定する（`vercel env add` または Dashboard）。

## 技術スタック

- **フロントエンド**: Next.js 14 (Pages Router)
- **デプロイ**: Vercel
- **DB / Auth / Storage**: Supabase
- **AI**: Anthropic Claude API (claude-opus-4-5)
- **メール送信**: Nodemailer + Gmail SMTP
