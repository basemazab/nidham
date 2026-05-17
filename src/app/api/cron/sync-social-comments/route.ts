// ============================================================================
// /api/cron/sync-social-comments — periodic comment ingestion
// ============================================================================
//
// Called by Vercel Cron (every 15 min) OR by an external scheduler that
// hits this URL with the CRON_SECRET. Pulls new Facebook comments on
// every published post and upserts them into social_comments. The inbox
// UI then surfaces unreplied ones to the operator.
//
// Vercel Cron setup (vercel.json):
//   {
//     "crons": [{
//       "path": "/api/cron/sync-social-comments",
//       "schedule": "*/15 * * * *"
//     }]
//   }
//
// Security: Vercel Cron requests carry a special header that includes
// the CRON_SECRET we set in env. We reject anything that doesn't match
// so this route can't be hit by drive-by traffic.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncFacebookCommentsForAllTargets } from "@/lib/social-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Extends Vercel's default 10s function timeout. Comment sync scans
// every published target sequentially (one Graph API call each) and
// 100 targets at ~500ms each would blow the default. 60s is the
// Hobby-plan ceiling.
export const maxDuration = 60;

// Vercel Cron sets this header on every cron invocation. Locally / from
// curl we accept x-cron-secret too as a developer-friendly alternative.
function isAuthorized(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // No secret configured → only allow Vercel's cron header
    return req.headers.get("user-agent")?.includes("vercel-cron") ?? false;
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader === `Bearer ${cronSecret}`) return true;
  if (req.headers.get("x-cron-secret") === cronSecret) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const encKey = process.env.META_ENCRYPTION_KEY;

  if (!supabaseUrl || !serviceKey || !encKey) {
    return NextResponse.json(
      {
        error:
          "Missing env: need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, META_ENCRYPTION_KEY",
      },
      { status: 500 },
    );
  }

  // Service-role client bypasses RLS — required because cron is unauthed
  // (no user session), and social_comments/social_post_targets are
  // gated to super-admins via RLS on mig 043.
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const result = await syncFacebookCommentsForAllTargets({
      supabase,
      encryptionKey: encKey,
      maxTargets: 100, // cron has a bigger budget than the manual button
    });
    return NextResponse.json({
      ok: true,
      ...result,
      ranAt: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
