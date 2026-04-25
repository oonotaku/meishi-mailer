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

**Core flow:** Photo capture → `/api/analyze` (Claude Vision OCR + email generation) → `/api/contacts/save` (Supabase Storage + `contacts` table) → `/api/send` (SendGrid) → mark `mail_sent_at`

### Data access pattern

**All database writes and cross-user reads go through API routes using `supabaseAdmin` (service role key).** The anon supabase client (`lib/supabase.js`) is used only for auth state management (`supabase.auth.getSession()`, `supabase.auth.onAuthStateChange()`). Direct `supabase.from(...)` queries from the client are avoided due to RLS complexity on `user_organizations`.

### Pages (`pages/`)

| File | Purpose |
|------|---------|
| `index.js` | Main scan flow. State machine: UPLOAD → ANALYZING → CONFIRM → CONTEXT → SENDING → DONE/ERROR |
| `contacts.js` | Saved contacts list (own + team-shared). Shows team name badge for contacts from other orgs. |
| `contacts/[id].js` | Contact detail — view, resend email, edit context, toggle visibility. Send/resend buttons shown only to `owner_id === user.id`. |
| `login.js` | Email/password login |
| `auth/confirm.js` | Password setup page for invited users (handles PKCE + implicit flows) |
| `settings/team.js` | Team management — two sections: "自分のチーム" (own org: name edit, members, invite) and "参加中のチーム" (read-only list of orgs user is member of) |
| `settings/profile.js` | Profile settings — display name, SendGrid API key + sender email configuration, billing plan display + Stripe Checkout/Portal |
| `_app.js` | Global auth safety net — intercepts `#type=invite` hash on any page |

### API Routes (`pages/api/`)

**Auth**
- `POST /api/auth/ensure-profile` — idempotent profile + org setup. Gets all user memberships; if no `role='owner'` exists, creates a new org and registers as owner (invited members also get their own owner org). `current_organization_id` always points to the user's own (owner) org. Returns `organizations` array `[{ organization_id, name, role }, ...]`.

**Contacts**
- `POST /api/contacts/save` — saves contact; looks up `profiles.current_organization_id` server-side to set `organization_id`
- `GET /api/contacts/list` — returns own contacts (all visibility) + team-shared contacts from all orgs the user belongs to. Includes `organization_name` field on each contact.
- `POST /api/contacts/update-visibility` — toggles `private`/`team` on a contact (owner only)

**Core**
- `POST /api/analyze` — Claude Vision OCR + email generation (two sequential Claude calls). Requires Bearer token. Checks plan limits (Free: 10/mo, Pro: 100/mo), resets `scan_count_month` if new month, increments on success.
- `POST /api/send` — requires Bearer token. Fetches `sender_email` + `sendgrid_api_key` from sender's profile and sends via SendGrid. Returns 400 with setup instructions if not configured.

**Billing**
- `POST /api/billing/create-checkout-session` — creates Stripe Checkout session for Pro plan. Reuses existing `stripe_customer_id` if present. `success_url`/`cancel_url` built from request headers.
- `POST /api/billing/portal` — creates Stripe Customer Portal session for subscription management.
- `POST /api/billing/webhook` — Stripe webhook handler (bodyParser: false, raw body). Handles: `checkout.session.completed` (sets customer_id, subscription_id, plan=pro), `customer.subscription.updated`, `customer.subscription.deleted` (plan=free).

**Team**
- `POST /api/team/invite` — sends Supabase invite email with `organization_id` in user metadata
- `GET /api/team/members` — returns `{ ownTeam: { organization, members }, memberTeams: [{ organization }] }`
- `POST /api/team/update-name` — updates own org name via supabaseAdmin (bypasses RLS on organizations table)

**Profile**
- `POST /api/profile/update-name` — updates `profiles.name` via supabaseAdmin
- `POST /api/profile/update-email-settings` — updates `profiles.sender_email` and `profiles.sendgrid_api_key` via supabaseAdmin

### AI model usage

Both API calls in `/api/analyze` use `claude-opus-4-5`. OCR prompt forces JSON-only output. Email template: 100–150 chars, ends with `。`, hardcoded signature `大野 拓（node-bee合同会社）`.

Email generation language follows the UI locale (`Accept-Language` header from client): EN UI → English email, JA UI → Japanese email.

### Database (Supabase)

#### Tables

**`organizations`** — `id, name, created_at`

**`profiles`** — `id, email, name, current_organization_id (FK → organizations), sender_email, sendgrid_api_key, plan, scan_count_month, scan_count_reset_at, stripe_customer_id, stripe_subscription_id`
- `current_organization_id` always points to the org where the user is `owner`
- `sender_email` + `sendgrid_api_key` are set by the user via `/settings/profile`; `sendgrid_api_key` is never returned to the client
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
NEXT_PUBLIC_SITE_URL=https://meishi-mailer-mu.vercel.app
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Note: SendGrid API keys and sender emails are stored per-user in `profiles.sendgrid_api_key` / `profiles.sender_email` — no server-level email env vars needed.

### Stripe (billing)
- Live keys (`sk_live_`, `pk_live_`) are active in Vercel production as of 2026-04-25
- `STRIPE_PRO_PRICE_ID` must be a Price ID (`price_...`), NOT a Product ID (`prod_...`)
- Webhook endpoint: `https://meishi-mailer-mu.vercel.app/api/billing/webhook`
- Registered events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- Customer Portal business name: "node-bee"
- To manually grant Pro to a beta user: `UPDATE profiles SET plan = 'pro' WHERE email = 'xxx';` in Supabase SQL Editor

## Current status

Phase 1, 2, and Phase 3 (partial) are complete. Stripe billing is live in production (¥980/mo Pro plan). See `MEISHI_AI_SPEC.md` for roadmap.
