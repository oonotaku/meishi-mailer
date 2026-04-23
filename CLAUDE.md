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

**Core flow:** Photo capture → `/api/analyze` (Claude Vision OCR + email generation) → `/api/contacts/save` (Supabase Storage + `contacts` table) → `/api/send` (Nodemailer via Gmail SMTP) → mark `mail_sent_at`

### Data access pattern

**All database writes and cross-user reads go through API routes using `supabaseAdmin` (service role key).** The anon supabase client (`lib/supabase.js`) is used only for auth state management (`supabase.auth.getSession()`, `supabase.auth.onAuthStateChange()`). Direct `supabase.from(...)` queries from the client are avoided due to RLS complexity on `user_organizations`.

### Pages (`pages/`)

| File | Purpose |
|------|---------|
| `index.js` | Main scan flow. State machine: UPLOAD → ANALYZING → CONFIRM → CONTEXT → SENDING → DONE/ERROR |
| `contacts.js` | Saved contacts list (own + team-shared) |
| `contacts/[id].js` | Contact detail — view, resend email, edit context, toggle visibility |
| `login.js` | Email/password login |
| `auth/confirm.js` | Password setup page for invited users (handles PKCE + implicit flows) |
| `settings/team.js` | Team management — org name, member list, invite, display name edit |
| `_app.js` | Global auth safety net — intercepts `#type=invite` hash on any page |

### API Routes (`pages/api/`)

**Auth**
- `POST /api/auth/ensure-profile` — idempotent profile + org setup. Checks `user_organizations` first; upserts `profiles.current_organization_id`. Called on every page load via `useRequireAuth`.

**Contacts**
- `POST /api/contacts/save` — saves contact; looks up `profiles.current_organization_id` server-side to set `organization_id`
- `GET /api/contacts/list` — returns own contacts (all visibility) + same-org contacts with `visibility='team'`
- `POST /api/contacts/update-visibility` — toggles `private`/`team` on a contact (owner only)

**Core**
- `POST /api/analyze` — Claude Vision OCR + email generation (two sequential Claude calls)
- `POST /api/send` — sends email via Gmail SMTP (Nodemailer)

**Team**
- `POST /api/team/invite` — sends Supabase invite email with `organization_id` in user metadata
- `GET /api/team/members` — returns org members via `user_organizations` join

**Profile**
- `POST /api/profile/update-name` — updates `profiles.name` via supabaseAdmin (bypasses missing UPDATE RLS)

### AI model usage

Both API calls in `/api/analyze` use `claude-opus-4-5`. OCR prompt forces JSON-only output. Email template: 100–150 chars, ends with `。`, hardcoded signature `大野 拓（node-bee合同会社）`.

### Database (Supabase)

#### Tables

**`organizations`** — `id, name, created_at`

**`profiles`** — `id, email, name, current_organization_id` (FK → organizations)
- No `organization_id` or `role` columns (those moved to `user_organizations`)

**`user_organizations`** — `user_id, organization_id, role (owner|member), created_at`
- Junction table for many-to-many users ↔ orgs
- RLS has recursion issues — always query via supabaseAdmin in API routes

**`contacts`** — `id, owner_id, organization_id, name, company, department, title, email, phone, card_image_urls (array), subject, body, mail_sent_at, location, event_name, met_at, temperature (hot|normal|watch), memo, visibility (private|team), created_at`
- `owner_id` = auth user UUID (not `user_id`)
- `organization_id` = copied from owner's `profiles.current_organization_id` at save time
- `visibility` defaults to `'private'`

Supabase Storage bucket `cards` holds public card images.

#### Key invariants
- `contacts.owner_id` is always the auth user's UUID — never `user_id`
- `contacts.organization_id` is set at save time from `profiles.current_organization_id`, never from the client
- Contacts with `visibility='team'` are visible to all members of the same org in `/api/contacts/list`

### Auth (`lib/useRequireAuth.js`)

Calls `/api/auth/ensure-profile` on session init and auth state changes. Returns `{ user, profile, loading }` where `profile` includes `organization_id` (alias for `current_organization_id`), `role`, and `organizations`.

## Environment Variables

Required in `.env.local`:

```
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GMAIL_USER=
GMAIL_APP_PASSWORD=
NEXT_PUBLIC_SITE_URL=https://meishi-mailer-mu.vercel.app
```

## Current status

Phase 1 (MVP scan/send) and Phase 2 (auth, multi-image, context form, team management, visibility) are complete. See `MEISHI_AI_SPEC.md` for roadmap.
