// ============================================================================
// Sentry edge config — captures errors from middleware + edge functions
// ============================================================================
//
// Runs inside Vercel's edge runtime (V8 isolates, no Node APIs). The
// surface is tiny — our only edge code is the Supabase auth middleware
// at src/lib/supabase/middleware.ts. Keep this config minimal; the edge
// runtime doesn't support all Sentry features (no replay, no profiling).

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
    ignoreErrors: ["NEXT_REDIRECT", "NEXT_NOT_FOUND"],
  });
}
