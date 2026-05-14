// Subscription tier system -- pure types + helpers, SAFE FOR CLIENT.
//
// Source of truth for "what can this customer do?" Every gated feature
// reads from FEATURE_RANK so a single edit changes the offer across
// the entire product. Client components import { hasFeature, Plan,
// Feature, planLabel } from here; server-only fetchers
// (getCurrentSubscription / canUseFeature) live in ./subscriptions-server.ts
// so the supabase/server import doesn't leak into the client bundle.
//
// Tiers:
//   trial      — 14 days from signup, full access to evaluate
//   basic      — small businesses (<10 employees), HR essentials only
//   pro        — growing teams, full HR + CRM + Recruitment + AI
//   enterprise — premium tier, everything + Bridge Analytics +
//                premium support + audit log + branded experience

export type Plan = "trial" | "basic" | "pro" | "enterprise";

export type Subscription = {
  plan: Plan;
  status: "trial" | "active" | "past_due" | "cancelled" | "expired";
  ends_at: string;
};

// ----------------------------------------------------------------------------
// Feature catalogue
// ----------------------------------------------------------------------------
// Each key is a "feature flag" referenced anywhere in the app. The
// rank value is the minimum plan tier that unlocks it. Trial sees
// everything (rank 0) since the goal is evaluation.

const PLAN_RANK: Record<Plan, number> = {
  trial: 100, // trial sees everything so evaluation works
  basic: 1,
  pro: 2,
  enterprise: 3,
};

export type Feature =
  // Core HR (always available on paid plans)
  | "employees"
  | "attendance"
  | "payroll"
  | "requests"
  // Growing-team features
  | "weekly_payroll"
  | "shifts_rotations"
  | "tardiness_tracking"
  | "bulk_attendance"
  | "mobile_app"
  | "crm"
  | "recruitment"
  // Pro+ AI features
  | "ai_assistant"
  | "ai_cv_screening"
  // Enterprise-only
  | "bridge_analytics"
  | "audit_log"
  | "custom_branding"
  | "premium_support";

// Minimum tier (by rank) that unlocks the feature. trial bypasses
// all gates because trial rank is 100.
const FEATURE_RANK: Record<Feature, number> = {
  employees: 1,
  attendance: 1,
  payroll: 1,
  requests: 1,
  weekly_payroll: 2,
  shifts_rotations: 2,
  tardiness_tracking: 2,
  bulk_attendance: 2,
  mobile_app: 2,
  crm: 2,
  recruitment: 2,
  ai_assistant: 2,
  ai_cv_screening: 2,
  bridge_analytics: 3,
  audit_log: 3,
  custom_branding: 3,
  premium_support: 3,
};

// ----------------------------------------------------------------------------
// Public helpers
// ----------------------------------------------------------------------------

/**
 * Does the given plan unlock the feature? Synchronous, used in JSX
 * to decide whether to render a button or a lock icon.
 */
export function hasFeature(plan: Plan | null | undefined, feature: Feature): boolean {
  if (!plan) return false;
  return PLAN_RANK[plan] >= FEATURE_RANK[feature];
}

/**
 * Human-readable Arabic label for each plan, used in badges +
 * upgrade prompts.
 */
export function planLabel(plan: Plan): string {
  return {
    trial: "تجريبية",
    basic: "Basic",
    pro: "Pro",
    enterprise: "Enterprise",
  }[plan];
}

/**
 * Returns the LOWEST plan tier (by rank) that unlocks the feature.
 * "Pro" or "Enterprise" -- used in the upgrade prompt copy.
 */
export function minPlanForFeature(feature: Feature): Plan {
  const rank = FEATURE_RANK[feature];
  if (rank >= 3) return "enterprise";
  if (rank >= 2) return "pro";
  return "basic";
}

// Server-side `getCurrentSubscription()` / `canUseFeature()` live in
// `./subscriptions-server.ts` so the Supabase server import doesn't
// poison the client bundle.
