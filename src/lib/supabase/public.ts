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
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
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
