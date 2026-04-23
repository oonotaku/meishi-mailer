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

**meishi-mailer** is a mobile-first business card scanner that OCRs card photos and auto-generates/sends Japanese thank-you emails.

**Core flow:** Photo capture → `/api/analyze` (Claude Vision OCR + email generation) → Supabase Storage (card image) + `contacts` table → `/api/send` (Nodemailer via Gmail SMTP) → mark `mail_sent_at`

### Pages (`pages/`)

| File | Purpose |
|------|---------|
| `index.js` | Main scan flow. 6-state machine: UPLOAD → ANALYZING → CONFIRM → SENDING → DONE/ERROR |
| `contacts.js` | All saved contacts list |
| `contacts/[id].js` | Contact detail, view/resend email |

### API Routes (`pages/api/`)

**POST `/api/analyze`** — accepts `{ image: base64, mediaType, capturedAt }`, runs two sequential Claude calls:
1. Vision OCR → extracts `{ name, company, department, title, email, phone }` as JSON
2. Text → generates Japanese thank-you email (subject + body), auto-detects same-day greeting

**POST `/api/send`** — accepts `{ to, subject, body }`, sends via Gmail SMTP (plain text)

### AI model usage

Both API calls use `claude-opus-4-5`. OCR prompt forces JSON-only output. Email template: 100–150 chars, ends with `。`, hardcoded signature `大野 拓（node-bee合同会社）`.

### Database (Supabase)

Core MVP table: **`contacts`** — stores OCR results, generated email subject/body, card image URL, and `mail_sent_at` timestamp.

Supabase Storage bucket `cards` holds public card images. Client initialized in `lib/supabase.js`.

## Environment Variables

Required in `.env.local`:

```
ANTHROPIC_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GMAIL_USER=
GMAIL_APP_PASSWORD=
```

## Roadmap context

This is Phase 1 of a 4-phase plan documented in `MEISHI_AI_SPEC.md`. Phases 2–4 add auth, team management, multi-user orgs, handoff workflows, and CRM integrations. The DB schema in the spec (`organizations`, `users`, `handoffs`, etc.) is not yet implemented.
