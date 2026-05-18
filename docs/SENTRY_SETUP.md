# Sentry — error monitoring setup

The codebase is **already wired up** for Sentry. To start capturing errors
in production, just add the env vars below — no code changes needed.

## 1) Create a Sentry account + project

1. Go to https://sentry.io and sign up (Developer plan is free, 5k events/mo)
2. Create a project: **Platform → Next.js → Project name `nidham`**
3. Copy your DSN from "Settings → Projects → nidham → Client Keys (DSN)"

## 2) Add env vars to Vercel

Project → Settings → Environment Variables. Add for **Production + Preview**:

| Variable | Value | Notes |
| -------- | ----- | ----- |
| `NEXT_PUBLIC_SENTRY_DSN` | `https://...@o....ingest.sentry.io/...` | Public — used by browser bundle |
| `SENTRY_DSN` | Same DSN | Server-side (kept separate so we can split projects later) |
| `SENTRY_ORG` | Your org slug | e.g. `nidham-saas` |
| `SENTRY_PROJECT` | `nidham` | Project slug from step 1 |
| `SENTRY_AUTH_TOKEN` | Org Auth Token | Settings → Auth Tokens → Create — scopes: `project:releases`, `org:read` |

## 3) Verify

After the next Vercel deploy:

1. Go to `/dashboard` while signed in
2. Open browser DevTools console, run:
   ```js
   throw new Error("Sentry test from production");
   ```
3. Within 30 seconds, the error should appear in Sentry under "Issues"

## What gets captured

- **All unhandled exceptions** in client + server runtimes
- **NEXT_REDIRECT** is filtered out (it's not a real error)
- **Sensitive fields** (`national_id`, `bank_account_number`, `password`,
  `access_token`, etc.) are **redacted** by `beforeSend` in
  `sentry.server.config.ts` — PDPL Article 5 compliance.
- **Release tag** = `VERCEL_GIT_COMMIT_SHA` so we can trace an error to
  the exact deploy that introduced it.

## Cost projection

Free Developer plan: **5,000 events / month**. Egyptian SMB scale
(< 200 tenants, < 50 active users / tenant): expect 50-500 events / month
under normal operation — fits comfortably in free tier.

If you hit the quota, the SDK silently drops events past 5k — no app
breakage. Upgrade to Team ($26/mo, 50k events) when traffic warrants.

## Disable for a specific build

Don't set `SENTRY_DSN`. The SDK becomes a no-op — no events sent, no
performance impact. Useful for local dev (you don't want your laptop
crashes filling up the production project).

## Files involved

- `instrumentation.ts` — server-side bootstrap
- `sentry.client.config.ts` — browser SDK init
- `sentry.server.config.ts` — Node.js SDK init + PII redaction
- `sentry.edge.config.ts` — edge runtime SDK init
- `next.config.ts` — wraps the build with `withSentryConfig`
- `src/app/error.tsx` — captures unhandled React errors

## What this does NOT do

- **Performance traces / spans** — disabled by default (`tracesSampleRate: 0`).
  Flip to `0.1` in `sentry.server.config.ts` once on a paid plan.
- **Session replay** — disabled. Same reason.
- **User feedback widget** — not configured; we have our own Arabic
  retry UI in `error.tsx`.
