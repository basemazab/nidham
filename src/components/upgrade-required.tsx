import Link from "next/link";
import { type Feature, minPlanForFeature, planLabel } from "@/lib/subscriptions";

// Rendered in place of a gated page's content when the caller's
// subscription doesn't include the feature. Server component -- pass
// it the `Feature` and it derives the minimum plan + copy.

type Props = {
  feature: Feature;
  /** Headline (Arabic). Defaults to a feature-derived line. */
  title?: string;
  /** One-line description shown above the upgrade CTA. */
  description?: string;
  /** Icon emoji. Defaults to a lock. */
  icon?: string;
};

const FEATURE_TITLES: Partial<Record<Feature, string>> = {
  ai_assistant: "المساعد الذكي ✦",
  ai_cv_screening: "فحص الـ CVs بالذكاء الاصطناعي",
  bridge_analytics: "Bridge Analytics ✦",
  audit_log: "سجل النشاط",
  shifts_rotations: "الورديات وأنماط التدوير",
  weekly_payroll: "المرتب الأسبوعي",
  crm: "إدارة العملاء (CRM)",
  recruitment: "نظام التوظيف",
  retention_insights: "توصيات الاحتفاظ بالموظفين 🎯",
  marketing_studio: "Marketing Studio ✦",
};

export function UpgradeRequired({
  feature,
  title,
  description,
  icon = "🔒",
}: Props) {
  const minPlan = minPlanForFeature(feature);
  const featureName = title ?? FEATURE_TITLES[feature] ?? "الميزة دي";

  return (
    <main className="flex-1 px-6 py-16 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-100 to-amber-50 border border-amber-200 flex items-center justify-center mb-5">
          <span className="text-4xl">{icon}</span>
        </div>

        <div className="inline-block px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold tracking-wider uppercase mb-3 font-cairo">
          {planLabel(minPlan)} Plan
        </div>

        <h1 className="text-2xl font-black font-cairo text-slate-800 mb-2">
          {featureName} متاحة لخطة {planLabel(minPlan)}
        </h1>

        <p className="text-sm text-slate-500 font-cairo leading-relaxed mb-6">
          {description ??
            `الميزة دي مش متضمنة في اشتراكك الحالي. ارفع اشتراكك لخطة ${planLabel(minPlan)} أو أعلى عشان تشغّلها.`}
        </p>

        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard/subscription"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold font-cairo shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition"
          >
            ✨ ترقية الاشتراك
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold font-cairo hover:bg-slate-50 transition"
          >
            الرجوع للرئيسية
          </Link>
        </div>
      </div>
    </main>
  );
}
