# Marketing Inbox — Setup & Operations Guide

> Built-in alternative to ManyChat. Auto-replies to Facebook Messenger
> + Instagram DMs with AI, pushes hot leads to your CRM, all inside Nidham HR.

---

## What This Does

When someone messages your Facebook Page or Instagram from an ad (or organic),
Nidham receives the message via Meta webhook, generates an AI reply in Egyptian
Arabic, sends it back, and — if the AI judges the lead as "Hot" or "Warm" — auto-creates a
customer in `/dashboard/customers` with the conversation context attached.

### Why this replaces ManyChat
- ✅ No $15-40/month subscription
- ✅ Lead pipeline integrated with your existing CRM (no double data entry)
- ✅ AI replies are tunable per-tenant (different prompt per company)
- ✅ Multi-tenant — every Nidham customer gets their own inbox
- ✅ Sellable feature: "Marketing Inbox" included with Pro/Business plans

---

## Required Setup (one-time, ~30 minutes)

### 1. Run the database migration

```sql
-- File: db/migrations/070_marketing_inbox.sql
-- Run this in Supabase SQL editor:
\i db/migrations/070_marketing_inbox.sql
```

This creates 4 tables: `marketing_inbox_settings`, `marketing_inbox_conversations`,
`marketing_inbox_messages`, `marketing_inbox_templates`.

### 2. Make sure AI keys are set (.env)

```
GROQ_API_KEY=gsk_...
# AND/OR
GEMINI_API_KEY=AIza...
```

The AI auto-reply uses the existing `pickAgentModel()` which prefers Groq's
`gpt-oss-120b` (free 30 RPM/100k RPD) and falls back to Gemini Flash.
Zero per-request cost on Free tier.

### 3. Create a Facebook App + connect your Page

Walk through these steps from the in-app settings page (`/dashboard/marketing/inbox/settings`):

1. Open https://developers.facebook.com/apps → Create App (type: **Business**)
2. Add Products: **Messenger** (mandatory), **Instagram** (optional)
3. Webhooks → Callback URL: `https://www.nidhamhr.com/api/webhooks/meta-messages`
4. Verify Token: invent any 32-char random string (the settings page has a generator)
5. Subscribe to events: `messages`, `messaging_postbacks`
6. Settings → Basic → Copy **App Secret** into Nidham
7. Messenger → Settings → Select your FB Page → Copy **Page Access Token** + **Page ID**
8. Paste everything into `/dashboard/marketing/inbox/settings`
9. Toggle "AI Auto-Reply" on
10. Save

### 4. Switch your Meta App to **Live mode**

In Meta Developer Portal → App Review → Live mode toggle.

Without this, the webhook will only fire for Page admins (same problem as ManyChat).
Live mode requires Meta to approve your app — usually instant for basic Messenger access.

---

## How It Works (Architecture)

```
┌─────────────────────────────────────────────────────────────┐
│  USER (sends DM from FB ad or Page)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  Meta Servers (HMAC-sign the webhook)                       │
└─────────────────────┬───────────────────────────────────────┘
                      │ POST /api/webhooks/meta-messages
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  route.ts (returns 200 fast, processes async)               │
│  1. Verify HMAC signature                                   │
│  2. Find tenant by meta_page_id                             │
│  3. Upsert conversation (fetch user profile on first sight) │
│  4. Insert inbound message                                  │
│  5. If AI enabled → generateMarketingReply (Claude/Groq)    │
│  6. sendMetaMessage back to user                            │
│  7. If lead = hot/warm → push to customers table            │
└─────────────────────────────────────────────────────────────┘
```

### AI logic

The system prompt makes the AI:
- Write in Egyptian Arabic (عامية)
- Keep replies short (≤ 60 words)
- Always end with a CTA (link to /pricing or /signup)
- Classify intent: `pricing_inquiry`, `demo_request`, `support_request`, etc.
- Classify lead quality: `hot`, `warm`, `cold`, `spam`
- Decide if the conversation needs human handoff

The AI **does not reply** when:
- Lead quality = `spam`
- Conversation has reached handoff threshold (complex pricing, complaint)
- A configured "handoff keyword" was matched (e.g., "محامي", "قضية")

---

## Operations

### Inbox UI

**`/dashboard/marketing/inbox`** — list of conversations sorted by newest activity.
Each row shows:
- User name + avatar (fetched from Meta on first message)
- Channel badge (Messenger / Instagram)
- Status (open / ai_replied / human_replied / qualified)
- Lead quality (🔥 Hot / ☀️ Warm / ❄️ Cold)
- Whether the lead is already in CRM (✓ في CRM)

**`/dashboard/marketing/inbox/[conversationId]`** — single thread view.
- Read all messages (inbound + outbound, AI vs human attribution)
- Send manual reply via the composer (Ctrl+Enter to send)
- Click "ملف العميل ↗" to jump to the linked customer in the CRM

### Settings

**`/dashboard/marketing/inbox/settings`** — per-tenant config.
- Channels toggle (Messenger / Instagram)
- Meta credentials (Page ID, Page Token, App Secret, Verify Token)
- AI on/off
- AI business context (optional — feeds the system prompt with your company info)
- AI handoff keywords (regex words that pause AI auto-reply)
- Auto-push to CRM toggle

---

## Sellable Pricing Idea

Add this to your Nidham pricing page as a Pro/Business-tier exclusive:

| Plan | Marketing Inbox |
|---|---|
| Starter (749 EGP) | — |
| Pro (2,430 EGP) | ✓ Included (Messenger + AI replies) |
| Business (5,990 EGP) | ✓ Included (+ Instagram + custom AI prompts) |

This positions Nidham as "ManyChat + ZenHR + Bayzat in one platform" — a strong
differentiator versus any single-purpose tool.

---

## Troubleshooting

### "Meta webhook verification failed"
- The Verify Token in Meta Developer Portal must EXACTLY match the one in Nidham settings.
- After changing it in Nidham, re-trigger the handshake in Meta (Webhooks → Verify).

### "Signature mismatch" in server logs
- The App Secret in Nidham doesn't match Meta's. Settings → Basic in Meta Portal.

### Bot doesn't reply
- Check Meta App is in **Live mode** (not Test).
- Check the page connected in Nidham settings = the page the user messaged.
- Check `ai_enabled` is toggled on in settings.
- Check there's at least one of GROQ_API_KEY or GEMINI_API_KEY in env.

### Bot replies too slowly
- Check Vercel logs — `processEventAsync` should complete in < 5 seconds.
- If consistently slow, the Groq fallback might be rate-limited. Add a paid Groq plan or set `AI_AGENT_MODEL=gemini:gemini-2.5-flash` in env to force a faster path.

### Conversation not creating a customer in CRM
- AI must classify lead as `hot` or `warm` (not `cold` or `spam`).
- `auto_push_to_crm` must be enabled in settings.
- Existing conversations don't re-trigger — only NEW ones do.

---

## File Locations

```
db/migrations/070_marketing_inbox.sql      ← schema
src/lib/marketing-inbox/
  ├── ai-reply.ts                          ← Claude/Groq integration
  └── meta-client.ts                       ← Meta API HTTP wrapper
src/app/api/webhooks/meta-messages/
  └── route.ts                             ← webhook endpoint
src/app/dashboard/marketing/inbox/
  ├── page.tsx                             ← inbox list
  ├── actions.ts                           ← server actions
  ├── [conversationId]/
  │   ├── page.tsx                         ← conversation detail
  │   └── reply-composer.tsx               ← reply UI
  └── settings/
      ├── page.tsx                         ← settings page
      └── settings-form.tsx                ← settings form
src/components/dashboard-sidebar.tsx       ← sidebar entry added
```

---

**Last updated:** 2026-05-27
