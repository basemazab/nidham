// ============================================================================
// Service-role Supabase client — bypasses RLS
// ============================================================================
//
// Use ONLY for trusted server-side operations that legitimately need to
// read/write across tenants (cron jobs, OTP storage, webhook handlers).
// Every call site MUST do its own authentication / tenant scoping —
// service role disables RLS, so RLS-protected tables become wide open.
//
// Never use this in a route that returns its result to the user without
// filtering by their company_id explicitly.

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// We don't have generated Database types — return the client as an
// untyped surface so `.from("any_table")` doesn't get narrowed to
// `never`. Each call site uses `.returns<T>()` to type its own reads.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ServiceClient = ReturnType<typeof createSupabaseClient<any, "public">>;

let cached: ServiceClient | null = null;

export function createServiceClient(): ServiceClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Service client missing env vars: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required",
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cached = createSupabaseClient<any, "public">(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
