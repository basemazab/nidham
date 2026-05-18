// ============================================================================
// Next.js instrumentation hook — loads Sentry on the server
// ============================================================================
//
// Next.js calls register() once per cold start, BEFORE any route handler
// runs. We branch on the active runtime so we load the right Sentry
// config (the Node + edge runtimes have different supported APIs).
//
// Reference:
//   https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
//   https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Forward request errors raised by Next.js to Sentry. Without this hook,
// errors thrown inside React Server Components or server actions that
// bubble up to Next's error boundary aren't captured by the Sentry SDK.
export const onRequestError = Sentry.captureRequestError;
