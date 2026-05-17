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
  // Retention insights — available on every paid tier so even small
  // shops get the "deserves a raise" / "flight risk" nudges. The whole
  // point is to reduce turnover for Egyptian SMBs who can't afford it.
  | "retention_insights"
  // Enterprise-only
  | "bridge_analytics"
  | "audit_log"
  | "custom_branding"
  | "premium_support"
  // Enterprise-only marketing suite — AI-powered digital marketing
  // agency-in-a-box: product analyzer, audience builder, ad copy
  // generator, SEO master, campaign wizard. The "wow" feature that
  // earns the enterprise tier upgrade.
  | "marketing_studio";

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
  retention_insights: 1, // basic+ — too valuable to lock out small shops
  bridge_analytics: 3,
  audit_log: 3,
  custom_branding: 3,
  premium_support: 3,
  marketing_studio: 3, // enterprise-only — the AI marketing agency
};

// ----------------------------------------------------------------------------
// Public helpers
// ----------------------------------------------------------------------------

/**
 * Per-tenant feature override map. Set by super-admin in /admin to force
 * features ON or OFF regardless of the tier-based default.
 *   - undefined / missing → fall back to tier check
 *   - true                → forced ON
 *   - false               → forced OFF
 */
export type FeatureOverrides = Partial<Record<Feature, boolean>>;

/**
 * Does the given plan unlock the feature? Synchronous, used in JSX
 * to decide whether to render a button or a lock icon.
 *
 * The optional `overrides` argument lets super-admin overrides take
 * precedence over the tier-based default. Pass undefined or {} to
 * skip the override layer.
 */
export function hasFeature(
  plan: Plan | null | undefined,
  feature: Feature,
  overrides?: FeatureOverrides,
): boolean {
  // Override takes priority — explicit true/false, in that order.
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, feature)) {
    return overrides[feature] === true;
  }
  if (!plan) return false;
  return PLAN_RANK[plan] >= FEATURE_RANK[feature];
}

/**
 * Catalogue of feature keys grouped by category — drives the super-admin
 * UI so it can show toggles per feature without hard-coding the list
 * twice.
 */
export const FEATURE_CATALOGUE: {
  category: string;
  icon: string;
  features: { key: Feature; label: string; description: string }[];
}[] = [
  {
    category: "HR الأساسية",
    icon: "👥",
    features: [
      {
        key: "employees",
        label: "إدارة الموظفين",
        description: "بيانات + رفع Excel + استيراد PDF",
      },
      {
        key: "attendance",
        label: "الحضور والانصراف",
        description: "GPS / يدوي / بصمة",
      },
      {
        key: "payroll",
        label: "الرواتب",
        description: "تأمينات + ضرائب + قسائم",
      },
      {
        key: "requests",
        label: "طلبات الموظفين",
        description: "إجازات + سلف + استئذانات",
      },
    ],
  },
  {
    category: "HR المتقدمة",
    icon: "⚙",
    features: [
      { key: "weekly_payroll", label: "رواتب أسبوعية", description: "" },
      { key: "shifts_rotations", label: "ورديات + روتيشن", description: "" },
      { key: "tardiness_tracking", label: "تتبع التأخير", description: "" },
      { key: "bulk_attendance", label: "رفع حضور جماعي", description: "" },
      { key: "mobile_app", label: "تطبيق الموبايل", description: "للموظفين" },
      { key: "retention_insights", label: "Retention Insights", description: "تنبيهات الاستقالة" },
    ],
  },
  {
    category: "CRM + التوظيف",
    icon: "💼",
    features: [
      { key: "crm", label: "CRM (العملاء)", description: "Pipeline + Interactions" },
      { key: "recruitment", label: "التوظيف", description: "Jobs + Candidates" },
    ],
  },
  {
    category: "AI",
    icon: "🤖",
    features: [
      {
        key: "ai_assistant",
        label: "مساعد AI",
        description: "اسأل بالعربي عن أي حاجة",
      },
      {
        key: "ai_cv_screening",
        label: "فحص CVs بالـ AI",
        description: "Score + أسئلة مقابلة",
      },
    ],
  },
  {
    category: "استوديو التسويق",
    icon: "✦",
    features: [
      {
        key: "marketing_studio",
        label: "استوديو التسويق الكامل",
        description: "6 أدوات AI + Landing Pages + Leads + Analytics + Meta",
      },
    ],
  },
  {
    category: "Enterprise",
    icon: "👑",
    features: [
      {
        key: "bridge_analytics",
        label: "Bridge Analytics",
        description: "ربط الـ HR بالـ CRM",
      },
      { key: "audit_log", label: "Audit Log", description: "سجل كل التعديلات" },
      { key: "custom_branding", label: "Branding مخصص", description: "" },
      { key: "premium_support", label: "Premium Support", description: "" },
    ],
  },
];

/**
 * Preset packages that the super-admin can apply with one click to
 * configure a tenant's feature set quickly. Each preset is a full
 * map: features NOT listed default to enabled=false (so the preset
 * fully describes the visible feature surface).
 */
export const FEATURE_PRESETS: {
  key: string;
  label: string;
  icon: string;
  description: string;
  enabledFeatures: Feature[];
}[] = [
  {
    key: "marketing_only",
    label: "Marketing فقط",
    icon: "✦",
    description: "العميل اشترى استوديو التسويق بس — مفيش HR ولا CRM ولا توظيف",
    enabledFeatures: ["marketing_studio"],
  },
  {
    key: "hr_only",
    label: "HR فقط",
    icon: "👥",
    description: "العميل اشترى موديولات HR بس — مفيش CRM ولا تسويق ولا توظيف",
    enabledFeatures: [
      "employees",
      "attendance",
      "payroll",
      "requests",
      "weekly_payroll",
      "shifts_rotations",
      "tardiness_tracking",
      "bulk_attendance",
      "mobile_app",
      "retention_insights",
      "ai_assistant",
    ],
  },
  {
    key: "hr_plus_crm",
    label: "HR + CRM (بدون تسويق)",
    icon: "💼",
    description: "العميل عايز HR كامل + CRM، لكن مش عايز استوديو التسويق",
    enabledFeatures: [
      "employees",
      "attendance",
      "payroll",
      "requests",
      "weekly_payroll",
      "shifts_rotations",
      "tardiness_tracking",
      "bulk_attendance",
      "mobile_app",
      "retention_insights",
      "crm",
      "recruitment",
      "ai_assistant",
      "ai_cv_screening",
      "bridge_analytics",
      "audit_log",
    ],
  },
  {
    key: "everything",
    label: "كل حاجة (Full Enterprise)",
    icon: "👑",
    description: "كل الموديولات شغّالة — الباقة الكاملة",
    enabledFeatures: [
      "employees",
      "attendance",
      "payroll",
      "requests",
      "weekly_payroll",
      "shifts_rotations",
      "tardiness_tracking",
      "bulk_attendance",
      "mobile_app",
      "retention_insights",
      "crm",
      "recruitment",
      "ai_assistant",
      "ai_cv_screening",
      "marketing_studio",
      "bridge_analytics",
      "audit_log",
      "custom_branding",
      "premium_support",
    ],
  },
];

/**
 * All known feature keys as a flat array — useful for the super-admin
 * UI to render every toggle.
 */
export const ALL_FEATURES: Feature[] = FEATURE_CATALOGUE.flatMap((cat) =>
  cat.features.map((f) => f.key),
);

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
