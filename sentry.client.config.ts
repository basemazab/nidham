// ============================================================================
// Sentry client config — captures browser-side errors
// ============================================================================
//
// This file is auto-loaded by @sentry/nextjs whenever the React bundle
// hydrates in the user's browser. It uses NEXT_PUBLIC_SENTRY_DSN so the
// DSN is inlined at build time (Sentry DSNs are not secrets — they're
// designed to be public, like Mixpanel project tokens).
//
// If NEXT_PUBLIC_SENTRY_DSN is unset (local dev, preview deploys without
// the env var), Sentry.init becomes a no-op. The app keeps working; we
// just lose telemetry. That's the right default — we never want a
// missing key to break the product.

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    // Vercel environment ("production" | "preview" | "development"). Maps
    // straight to Sentry's environment tag so we can filter prod-only
    // alerts from preview noise.
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",

    // Performance / session replay are paid-tier features on Sentry's
    // SaaS plan. Disabled by default; flip these when the team upgrades.
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Don't blast Sentry with every chunk-loading hiccup or extension
    // noise. The denylist mirrors what we see most often in the existing
    // error.tsx console logs.
    ignoreErrors: [
      // Browser extensions spraying console errors
      /^Failed to fetch dynamically imported module/,
      /^ChunkLoadError/,
      // Network blips on flaky mobile connections
      "NetworkError when attempting to fetch resource.",
      // ResizeObserver loop, harmless
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications.",
    ],

    // Tag every event with the Vercel commit SHA — lets us trace a
    // production error back to the exact deploy that caused it.
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  });
}
