// Server-only subscription helpers. Pure types + hasFeature live in
// ./subscriptions.ts (client-safe); anything that touches Supabase
// lives here so the supabase/server import never reaches client
// bundles.

import { createClient } from "@/lib/supabase/server";
import {
  type Feature,
  type FeatureOverrides,
  type Plan,
  type Subscription,
  hasFeature,
} from "./subscriptions";

/**
 * Fetches the caller's current subscription.
 *
 * IMPORTANT: super_admin's RLS bypass returns rows for EVERY tenant,
 * so a bare `.single()` blows up with PGRST116. We explicitly scope
 * by the caller's profile.company_id (mirrors the pattern used by
 * /dashboard/subscription/page.tsx) and use `.maybeSingle()` so a
 * tenant with no subscription row degrades to null instead of an
 * exception.
 */
export async function getCurrentSubscription(): Promise<Subscription | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .maybeSingle<{ company_id: string }>();
  if (!profile?.company_id) return null;

  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, ends_at")
    .eq("company_id", profile.company_id)
    .maybeSingle<Subscription>();

  return data;
}

/**
 * Fetch the caller's per-tenant feature overrides (set by super-admin
 * from /admin/subscriptions/[id]). Returns {} when nothing is overridden
 * (the common case for most tenants).
 *
 * Read uses the standard supabase client — RLS on tenant_feature_overrides
 * (mig 041) lets authenticated users see their own company's rows.
 */
export async function getMyFeatureOverrides(): Promise<FeatureOverrides> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from("tenant_feature_overrides")
    .select("feature_key, enabled")
    .returns<{ feature_key: string; enabled: boolean }[]>();

  // If the table doesn't exist yet (mig 041 not applied) just degrade
  // silently — the caller falls back to tier-based defaults.
  if (error || !data) return {};

  const map: FeatureOverrides = {};
  for (const row of data) {
    map[row.feature_key as Feature] = row.enabled;
  }
  return map;
}

/**
 * Same as getMyFeatureOverrides() but scoped to a specific company.
 * Only useful when called by a super-admin (RLS gates non-supers to
 * their own company anyway).
 */
export async function getCompanyFeatureOverrides(
  companyId: string,
): Promise<FeatureOverrides> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_feature_overrides")
    .select("feature_key, enabled")
    .eq("company_id", companyId)
    .returns<{ feature_key: string; enabled: boolean }[]>();

  if (error || !data) return {};

  const map: FeatureOverrides = {};
  for (const row of data) {
    map[row.feature_key as Feature] = row.enabled;
  }
  return map;
}

/**
 * Server-side feature check. Combines getCurrentSubscription() +
 * per-tenant overrides + hasFeature(). Returns true if the caller can
 * use the feature.
 *
 * Decision order:
 *   1. If the super-admin set an explicit override (true/false), honor it.
 *   2. Otherwise, fall back to the tier-based rank check.
 *
 * Special cases:
 *   - Expired subscription (ends_at past) → tier collapses to 'basic'
 *     for trial users, or the previous paid tier for others (so they
 *     don't suddenly lose access to data they entered).
 *   - null subscription → false (be conservative).
 *   - Override of false overrides ANY tier — even Enterprise — so the
 *     super-admin can fully disable a module for a custom package.
 */
export async function canUseFeature(feature: Feature): Promise<boolean> {
  const [sub, overrides] = await Promise.all([
    getCurrentSubscription(),
    getMyFeatureOverrides(),
  ]);
  if (!sub) return false;

  // Trial expires gracefully to basic-tier features so the company
  // doesn't lose access to the core HR data they entered.
  const isExpired =
    new Date(sub.ends_at + "T23:59:59").getTime() < Date.now() ||
    sub.status === "expired" ||
    sub.status === "cancelled";
  const effectivePlan: Plan = isExpired
    ? sub.plan === "trial"
      ? "basic"
      : sub.plan
    : sub.plan;

  return hasFeature(effectivePlan, feature, overrides);
}

/**
 * Bulk feature snapshot for nav rendering. One round-trip to Supabase
 * gives the caller a `(feature) => boolean` map covering every known
 * feature, with overrides applied. Cache this at the top of a server
 * component instead of calling canUseFeature() N times.
 */
export async function getEnabledFeatures(): Promise<Record<Feature, boolean>> {
  const [sub, overrides] = await Promise.all([
    getCurrentSubscription(),
    getMyFeatureOverrides(),
  ]);

  // Build the same effectivePlan derivation as canUseFeature
  let effectivePlan: Plan | null = null;
  if (sub) {
    const isExpired =
      new Date(sub.ends_at + "T23:59:59").getTime() < Date.now() ||
      sub.status === "expired" ||
      sub.status === "cancelled";
    effectivePlan = isExpired
      ? sub.plan === "trial"
        ? "basic"
        : sub.plan
      : sub.plan;
  }

  // Iterate every known feature via the static list in subscriptions.ts
  // and reuse hasFeature for consistency.
  const { ALL_FEATURES } = await import("./subscriptions");
  const result: Partial<Record<Feature, boolean>> = {};
  for (const f of ALL_FEATURES) {
    result[f] = hasFeature(effectivePlan, f, overrides);
  }
  return result as Record<Feature, boolean>;
}
