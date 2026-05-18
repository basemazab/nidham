// ============================================================================
// /api/health — lightweight uptime probe
// ============================================================================
//
// What this is FOR:
//   - External uptime monitors (UptimeRobot, BetterStack, Pingdom) hitting
//     this URL every 30-60s to detect outages.
//   - Internal smoke check after each Vercel deploy ("did the build
//     actually serve traffic?").
//   - Load-balancer health checks if/when we move off Vercel.
//
// What this is NOT FOR:
//   - Replacing real APM (Sentry / Datadog) — this endpoint says "the
//     process is alive", not "all features work".
//   - Confirming auth works (no Supabase call — keeps the probe cheap
//     and avoids creating cookie traffic on every ping).
//
// Response shape (always JSON, always cacheable for ~5s):
//   200 { status: "ok", uptime, version, region, time }   — happy path
//   503 { status: "error", reason }                       — process broken
//
// We intentionally DO NOT ping the database here. A DB outage doesn't mean
// the app is dead — Vercel routes can still return 200 for static assets,
// and we want the probe to track app-process availability separately from
// DB. A future `/api/health/deep` endpoint can do the DB ping when we
// need it.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Don't cache this on Vercel's edge — the whole point is to reflect
// the current state of THIS process.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const body = {
      status: "ok",
      time: new Date().toISOString(),
      uptime_seconds: Math.floor(process.uptime()),
      // Vercel injects these env vars on every deployment.
      // They're undefined in local dev — fall back to "local".
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      region: process.env.VERCEL_REGION ?? "local",
      env: process.env.VERCEL_ENV ?? "development",
    };

    return NextResponse.json(body, {
      status: 200,
      headers: {
        // Tell monitors "you can re-poll every 5 seconds, but don't go
        // mad and request twice per second."
        "Cache-Control": "public, max-age=5, must-revalidate",
      },
    });
  } catch (err) {
    // If process.uptime() somehow throws, we want the probe to fail
    // loudly so the monitor pages us — rather than masking the error.
    return NextResponse.json(
      {
        status: "error",
        reason: err instanceof Error ? err.message : "unknown",
        time: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
