// ============================================================================
// Sentry server config — captures errors from server actions + API routes
// ============================================================================
//
// Loaded by @sentry/nextjs via the project-root `instrumentation.ts`
// hook. Runs in the Node.js runtime (server actions, route handlers,
// background functions).
//
// SENTRY_DSN here is the SECRET form (no NEXT_PUBLIC_ prefix). Yes, the
// DSN is technically the same value as the client one — but keeping
// them separate lets us route server-only errors to a different Sentry
// project later if we need to (e.g. when separating SaaS billing).

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    environment: process.env.VERCEL_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,

    // No tracing by default — saves quota. Flip to 0.1 (10%) once the
    // team is on a paid Sentry plan and wants P95 latency dashboards.
    tracesSampleRate: 0,

    // Server-side errors we don't want paging the team about:
    ignoreErrors: [
      // NEXT_REDIRECT is how Next.js implements server-action redirects.
      // It's thrown deliberately — Sentry sees it as an error otherwise.
      "NEXT_REDIRECT",
      "NEXT_NOT_FOUND",
    ],

    // Hook to redact sensitive fields BEFORE the event leaves our server.
    // PDPL Article 5 says we shouldn't ship PII to a third-party processor
    // without a documented purpose; tax IDs and bank accounts are out.
    beforeSend(event) {
      const SENSITIVE = [
        "national_id",
        "social_insurance_number",
        "bank_account_number",
        "bank_name",
        "password",
        "access_token",
        "refresh_token",
      ];

      // Strip from request body
      if (event.request?.data && typeof event.request.data === "object") {
        const data = event.request.data as Record<string, unknown>;
        for (const key of SENSITIVE) {
          if (key in data) data[key] = "[REDACTED]";
        }
      }

      // Strip from extra context
      if (event.extra) {
        for (const key of SENSITIVE) {
          if (key in event.extra) event.extra[key] = "[REDACTED]";
        }
      }

      return event;
    },
  });
}
