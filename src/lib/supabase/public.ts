import { createServerClient } from "@supabase/ssr";

/**
 * Anon Supabase client for public-facing routes (`/jobs`, `/jobs/[slug]`,
 * `/jobs/[slug]/apply`).
 *
 * We deliberately don't pass cookies — that way the request runs as the
 * `anon` Postgres role regardless of whether the visitor is also logged
 * in as an HR user in another tab. RLS sees an anonymous role and only
 * the public policies apply, which keeps tenant data isolated.
 */
export function createPublicClient() {
  // Same dual-URL story as src/lib/supabase/server.ts — server-side code in
  // the Enterprise docker stack reaches Kong via the internal hostname.
  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return createServerClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No-op — we never want to set a session for anon visitors.
        },
      },
    },
  );
}
