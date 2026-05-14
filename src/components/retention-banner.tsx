// ============================================================================
// Retention banner — surfaces pending insights on the main dashboard
// ============================================================================
//
// Server component. Reads the count of pending retention_insights for
// the caller's company and renders a CTA card if there are any. Only
// shown to HR (admin/manager).
//
// Renders nothing when:
//   - feature isn't unlocked on the subscription
//   - no pending insights
//
// Why it's not a client component
// -------------------------------
// Pure data-in-and-render-out. Live updates aren't worth the
// bundle weight; the dashboard refresh on navigation is enough.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { canUseFeature } from "@/lib/subscriptions-server";

type InsightCountRow = {
  insight_type: "raise" | "bonus" | "flight_risk" | "anniversary";
};

export async function RetentionBanner() {
  // Gate: feature must be unlocked
  if (!(await canUseFeature("retention_insights"))) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Caller must be HR
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle<{ role: string }>();
  if (!profile || (profile.role !== "admin" && profile.role !== "manager"))
    return null;

  // Pull just the insight_type column so we can count by category
  const { data, error } = await supabase
    .from("employee_retention_insights")
    .select("insight_type")
    .eq("status", "pending")
    .returns<InsightCountRow[]>();
  if (error) return null;

  const rows = data ?? [];
  const total = rows.length;
  if (total === 0) return null;

  const raises = rows.filter((r) => r.insight_type === "raise").length;
  const bonuses = rows.filter((r) => r.insight_type === "bonus").length;
  const risks = rows.filter((r) => r.insight_type === "flight_risk").length;
  const anniversaries = rows.filter(
    (r) => r.insight_type === "anniversary",
  ).length;

  // Severity: any flight risk shows the alarm style; otherwise default
  const hasRisk = risks > 0;

  return (
    <Link
      href="/dashboard/retention"
      className={`block rounded-2xl p-5 mb-6 shadow-md transition hover:shadow-lg hover:-translate-y-0.5 ${
        hasRisk
          ? "bg-gradient-to-r from-rose-50 via-amber-50 to-emerald-50 border-2 border-rose-300"
          : "bg-gradient-to-r from-amber-50 via-yellow-50 to-emerald-50 border-2 border-amber-300"
      }`}
    >
      <div className="flex items-center gap-4 flex-wrap">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 via-rose-500 to-emerald-500 flex items-center justify-center flex-shrink-0 shadow-md text-white text-2xl">
          🎯
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] tracking-[0.3em] text-amber-700 font-bold uppercase font-cairo mb-0.5">
            توصيات الاحتفاظ بالموظفين
          </div>
          <div className="text-lg font-black text-slate-800 font-cairo">
            عندك {total} توصية محتاجة مراجعتك
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-cairo mt-1 text-slate-700">
            {raises > 0 && (
              <span>
                💸 <strong>{raises}</strong> زيادة مقترحة
              </span>
            )}
            {bonuses > 0 && (
              <span>
                🎁 <strong>{bonuses}</strong> مكافأة
              </span>
            )}
            {risks > 0 && (
              <span className="text-rose-700">
                ⚠ <strong>{risks}</strong> إنذار مغادرة
              </span>
            )}
            {anniversaries > 0 && (
              <span>
                🎉 <strong>{anniversaries}</strong> ذكرى تعيين
              </span>
            )}
          </div>
        </div>

        <div className="text-xs text-amber-800 hover:text-amber-900 font-bold font-cairo whitespace-nowrap">
          راجع الكل ↗
        </div>
      </div>
    </Link>
  );
}
