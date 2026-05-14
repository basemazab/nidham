// Server-only subscription helpers. Pure types + hasFeature live in
// ./subscriptions.ts (client-safe); anything that touches Supabase
// lives here so the supabase/server import never reaches client
// bundles.

import { createClient } from "@/lib/supabase/server";
import { type Feature, type Plan, type Subscription, hasFeature } from "./subscriptions";

/**
 * Fetches the caller's current subscription. RLS scopes to the
 * caller's company. Returns null if not signed in / no subscription
 * row -- treat null as "no access" in feature checks.
 */
export async function getCurrentSubscription(): Promise<Subscription | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, ends_at")
    .single<Subscription>();

  return data;
}

/**
 * Server-side feature check. Combines getCurrentSubscription() +
 * hasFeature(). Returns true if the caller can use the feature.
 *
 * Special cases:
 *   - Expired subscription (ends_at past) -> always false except for
 *     plan='trial' which silently treats expired as 'basic'.
 *   - null subscription -> false (be conservative).
 */
export async function canUseFeature(feature: Feature): Promise<boolean> {
  const sub = await getCurrentSubscription();
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

  return hasFeature(effectivePlan, feature);
}
