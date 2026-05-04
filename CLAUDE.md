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

**meishi-mailer** is a mobile-first business card scanner that OCRs card photos, auto-generates/sends Japanese thank-you emails, and supports team sharing of contacts.

**Core flow (通常):** Photo capture → `/api/analyze` (Claude Vision OCR + email generation) → `/api/contacts/save` (Supabase Storage + `contacts` table + `encounters` テーブルに初回出会いを自動挿入) → `/api/send` (SendGrid) → mark `mail_sent_at`

**Core flow (重複時):** Photo capture → `/api/analyze` (重複検出: `duplicates` 配列返却) → DUPLICATE画面表示 → 「この出会いを記録する」 → CONTEXT入力 → `/api/encounters/save` (encountersテーブルに追記、必要に応じてメール送信)

### Data access pattern

**All database writes and cross-user reads go through API routes using `supabaseAdmin` (service role key).** The anon supabase client (`lib/supabase.js`) is used only for auth state management (`supabase.auth.getSession()`, `supabase.auth.onAuthStateChange()`). Direct `supabase.from(...)` queries from the client are avoided due to RLS complexity on `user_organizations`.

### Pages (`pages/`)

| File | Purpose |
|------|---------|
| `index.js` | Main scan flow. State machine: UPLOAD → ANALYZING → CONFIRM → CONTEXT → SENDING → DONE/ERROR/DUPLICATE(7). 重複検出時（`duplicates` 配列あり）はDUPLICATE画面へ遷移しブロック。DUPLICATE画面から「この出会いを記録する」でCONTEXTへ進み `encounters/save` を呼ぶ。 |
| `contacts.js` | Saved contacts list (own + team-shared). Shows team name badge for contacts from other orgs. |
| `contacts/[id].js` | Contact detail — view, resend email, edit context, toggle visibility. Send/resend buttons shown only to `owner_id === user.id`. 出会い履歴セクション（encounters）を表示。`/api/encounters/list` から取得し新しい順で一覧表示。 |
| `login.js` | Email/password login + signup + password reset (forgot mode). signUp に `emailRedirectTo` を指定して現在のロケールURLへリダイレクト。 |
| `auth/confirm.js` | Password setup page for invited users (handles PKCE + implicit flows). パスワードリセット（type=recovery）も同フォームを再利用。 |
| `auth/gmail-done.js` | Gmail OAuth ポップアップの中継ページ。`postMessage` で親ウィンドウに `{ type: 'gmail-oauth', status, email }` を送信してポップアップを閉じる。`window.opener` がない場合は `/settings/profile?gmail=...` にフォールバック遷移。 |
| `settings/team.js` | Team management — two sections: "自分のチーム" (own org: name edit, members, invite) and "参加中のチーム" (read-only list of orgs user is member of) |
| `settings/profile.js` | Profile settings — tab UI (メール設定 / SNS / 所属). Display name + bio (一言コメント) inline edit, SendGrid/Gmail/SMTP config, SNS links (15 fields, 3 input modes: QR/username/url), affiliations (DnD sortable, max 5), email signature preview, billing plan + Stripe Checkout/Portal. 完全i18n対応。Gmail OAuth は `window.open()` ポップアップ方式で実行し、`postMessage` 受信後に `savedProvider` state を更新してUI即時反映。 |
| `p/[userId].js` | Public profile page — name, bio, affiliations, SNS buttons with simpleicons icons, app invite banner. No auth. `getServerSideProps` + `supabaseAdmin`. |
| `_app.js` | Global auth safety net — intercepts `#type=invite` hash on any page |

### API Routes (`pages/api/`)

**Auth**
- `POST /api/auth/ensure-profile` — idempotent profile + org setup. Gets all user memberships; if no `role='owner'` exists: (1) upserts `profiles` first to satisfy FK constraint on `user_organizations.user_id → profiles.id`, (2) registers invited org membership from `user.user_metadata?.organization_id || user.app_metadata?.organization_id` (Supabase may store invite metadata in either field), (3) creates a new owner org. `current_organization_id` always points to the user's own (owner) org. Returns `organizations` array `[{ organization_id, name, role }, ...]`.
- `GET /api/auth/gmail/callback` — Gmail OAuth2 callback. Exchanges authorization code for tokens, fetches Gmail address via userinfo, saves `gmail_refresh_token` + `gmail_email` + `smtp_provider='gmail'` to `profiles`. 成功・エラーともに `/auth/gmail-done?status=...&email=...` にリダイレクト（旧: `/settings/profile?gmail=...`）。ポップアップ経由なのでメインウィンドウのSupabaseセッションを破壊しない。

**Contacts**
- `POST /api/contacts/save` — saves contact; looks up `profiles.current_organization_id` server-side to set `organization_id`. insert成功後、`encounters` テーブルに初回出会いを自動挿入。
- `GET /api/contacts/list` — returns own contacts (all visibility) + team-shared contacts from all orgs the user belongs to. Includes `organization_name` field on each contact.
- `POST /api/contacts/update-visibility` — toggles `private`/`team` on a contact (owner only)

**Encounters**
- `POST /api/encounters/save` — encounter 1件保存。`contact_id` の `owner_id === user.id` を確認してからinsert。
- `GET /api/encounters/list` — `contact_id` で encounter一覧取得（`met_at` 降順）。owner または チームメンバー（`visibility='team'`）のみアクセス可。

**Core**
- `POST /api/analyze` — Claude Vision OCR + email generation (two sequential Claude calls). Requires Bearer token. Checks plan limits (Free: 10/mo, Pro: 100/mo), resets `scan_count_month` if new month, increments on success (重複時も increment). OCR後にメアドが抽出できた場合、`owner_id=user.id` の contacts を `.ilike()` で検索し、ヒットすれば `duplicates` 配列をレスポンスに含める。`duplicates` がある場合、クライアントはメール生成結果を捨てて DUPLICATE ステップへ遷移する。
- `POST /api/send` — requires Bearer token. Fetches provider config from profile. Delegates to `lib/sendEmail.js` for actual sending. Returns 400 with setup instructions if not configured.

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
- `POST /api/profile/update-sns` — updates 15 SNS link fields on `profiles`; empty/whitespace strings saved as `null`
- `GET /api/profile/affiliations` — returns `profile_affiliations` ordered by `order_index` ASC
- `POST /api/profile/affiliations` — replaces all affiliations (delete-all + insert); max 5 rows, skips entries with empty `company_name`

### AI model usage

Both API calls in `/api/analyze` use `claude-opus-4-5`. OCR prompt forces JSON-only output. Email template: 100–150 chars, ends with `。`. No signature in the prompt — signature (QR code + name + affiliation) is added by `send.js` as HTML. Both EN/JA prompts explicitly instruct the model not to include a closing sign-off or signature line.

Email generation language follows the UI locale (`Accept-Language` header from client): EN UI → English email, JA UI → Japanese email.

### Database (Supabase)

#### Tables

**`organizations`** — `id, name, created_at`

**`profiles`** — `id, email, name, bio, current_organization_id (FK → organizations), sender_email, sendgrid_api_key, smtp_provider, smtp_host, smtp_port, smtp_user, smtp_password, gmail_refresh_token, gmail_email, sns_line, sns_whatsapp, sns_x, sns_instagram, sns_facebook, sns_linkedin, sns_tiktok, sns_youtube, sns_threads, sns_telegram, sns_wechat, sns_discord, sns_github, sns_bluesky, sns_pinterest, plan, scan_count_month, scan_count_reset_at, stripe_customer_id, stripe_subscription_id`
- `current_organization_id` always points to the org where the user is `owner`
- `sender_email` + `sendgrid_api_key` are set by the user via `/settings/profile`; `sendgrid_api_key` is never returned to the client
- `smtp_provider`: `'sendgrid'` (default) | `'gmail'` | `'smtp'`
- `gmail_refresh_token` / `gmail_email`: set via Gmail OAuth callback; used by `send.js` with googleapis REST API
- `bio`: 一言コメント（最大100文字）; `null` when not set
- `sns_*` (15 fields): SNS link URLs; `null` when not set. LINE/WhatsApp はQRスキャンで設定、X/Instagram等はユーザー名入力→保存時にベースURL補完、Facebook/Discord/WeChatはフルURL入力
- `plan`: `'free'` (default) or `'pro'`; updated by Stripe webhook
- `scan_count_month`: resets when `scan_count_reset_at < startOfMonth`; Free limit=10, Pro limit=100
- `stripe_customer_id` / `stripe_subscription_id`: set on `checkout.session.completed`, cleared on subscription deletion

**`user_organizations`** — `user_id, organization_id, role (owner|member), created_at`
- Junction table for many-to-many users ↔ orgs
- Every user has exactly one `role='owner'` row (their own org) plus zero or more `role='member'` rows
- RLS has recursion issues — always query via supabaseAdmin in API routes

**`contacts`** — `id, owner_id, organization_id, name, company, department, title, email, phone, card_image_urls (array), subject, body, mail_sent_at, location, event_name, met_at, temperature (hot|normal|watch), memo, visibility (private|team), created_at`
- `owner_id` = auth user UUID (not `user_id`)
- `organization_id` = copied from owner's `profiles.current_organization_id` at save time
- `visibility` defaults to `'private'`

**`encounters`** — `id, contact_id (FK → contacts.id, CASCADE DELETE), met_at, event_name, location, memo, temperature (hot|normal|watch), created_at`
- RLS無効（supabaseAdmin経由のみアクセス）
- `contacts/save` 実行時に初回出会いとして自動挿入される
- 重複名刺撮影時にDUPLICATE画面から「この出会いを記録する」で追記可能
- `contacts/[id].js` の出会い履歴セクションで `met_at` 降順表示

**`profile_affiliations`** — `id, user_id (FK → profiles.id), company_name, title, order_index, created_at`
- RLS無効（supabaseAdmin経由のみアクセス）
- `order_index` で表示順管理（最大5件）
- `/api/profile/affiliations` POST は delete-all + insert のバッチ更新
- `send.js` と `p/[userId].js` が `order_index ASC` の先頭1件または全件を参照

Supabase Storage bucket `cards` holds public card images.

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
STRIPE_PRO_PRICE_ID=price_...
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
- `STRIPE_PRO_PRICE_ID` must be a Price ID (`price_...`), NOT a Product ID (`prod_...`)
- Webhook endpoint: `https://meishi-mailer-mu.vercel.app/api/billing/webhook`
- Registered events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Customer Portal business name: "node-bee"
- To manually grant Pro to a beta user: `UPDATE profiles SET plan = 'pro' WHERE email = 'xxx';` in Supabase SQL Editor

## Dependencies (notable)

- `jsqr` — QRコード解析（クライアントサイド動的import）。LINE/WhatsAppのQRスクショ読み取りに使用。

## Current status

Phase 1, 2, and Phase 3 (partial) are complete. Stripe billing is live in production (¥980/mo Pro plan). See `MEISHI_AI_SPEC.md` for roadmap.
