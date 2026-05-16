// ============================================================================
// /dashboard/marketing/[id]/page-doctor — Page Doctor diagnostic
// ============================================================================
//
// Audits the company's Facebook/Instagram/website for issues that kill
// paid ad performance, then prescribes prioritized fixes. Helps HR /
// marketing owners know what to fix BEFORE they spend on ads.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";
import { runPageDoctor } from "../../actions";
import { AiErrorBanner } from "@/components/ai-error-banner";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ diagnosed?: string; error?: string }>;
};

type PageDoctorIssue = {
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  issue_title: string;
  problem_description: string;
  ad_impact: string;
  fix_steps: string[];
  estimated_effort: string;
  estimated_impact: string;
};

type PageDoctorResult = {
  overall_health_score: number;
  health_summary: string;
  issues: PageDoctorIssue[];
  quick_wins: string[];
  blockers: string[];
  pre_launch_checklist: string[];
};

const CATEGORY_LABEL: Record<string, { label: string; icon: string }> = {
  branding: { label: "الهوية البصرية", icon: "🎨" },
  content: { label: "المحتوى", icon: "📸" },
  trust: { label: "الثقة", icon: "🤝" },
  speed: { label: "السرعة", icon: "⚡" },
  conversion: { label: "التحويل", icon: "🎯" },
  engagement: { label: "التفاعل", icon: "💬" },
  completeness: { label: "اكتمال البيانات", icon: "📋" },
  legal: { label: "قانوني", icon: "⚖" },
};

const SEVERITY: Record<
  string,
  { label: string; cls: string; order: number }
> = {
  critical: {
    label: "حرجة",
    cls: "bg-rose-100 text-rose-800 border-rose-300",
    order: 1,
  },
  high: {
    label: "مرتفعة",
    cls: "bg-orange-100 text-orange-800 border-orange-300",
    order: 2,
  },
  medium: {
    label: "متوسطة",
    cls: "bg-amber-100 text-amber-800 border-amber-300",
    order: 3,
  },
  low: {
    label: "خفيفة",
    cls: "bg-slate-100 text-slate-700 border-slate-300",
    order: 4,
  },
};

const EFFORT_LABEL: Record<string, string> = {
  "5_minutes": "5 دقايق",
  "30_minutes": "نص ساعة",
  "1_hour": "ساعة",
  half_day: "نص يوم",
  "1_day": "يوم",
  "1_week": "أسبوع",
};

export default async function PageDoctorPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!(await canUseFeature("marketing_studio"))) {
    return <UpgradeRequired feature="marketing_studio" />;
  }

  const { data: project } = await supabase
    .from("marketing_projects")
    .select("id, name, product_summary, ai_analysis")
    .eq("id", id)
    .single<{
      id: string;
      name: string;
      product_summary: string | null;
      ai_analysis: Record<string, unknown> | null;
    }>();
  if (!project) notFound();

  const analysis =
    (project.ai_analysis as {
      page_doctor?: PageDoctorResult;
      page_doctor_at?: string;
    } | null) ?? null;
  const result = analysis?.page_doctor ?? null;
  const diagnosedAt = analysis?.page_doctor_at;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  // Sort issues by severity
  const sortedIssues = result?.issues
    ? [...result.issues].sort(
        (a, b) => (SEVERITY[a.severity]?.order ?? 5) - (SEVERITY[b.severity]?.order ?? 5),
      )
    : [];

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-4">
          <Link
            href={`/dashboard/marketing/${id}`}
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← مشروع {project.name}
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold mb-2 font-cairo">
            🩺 Page Doctor
          </div>
          <h1 className="text-2xl md:text-3xl font-black font-cairo text-slate-800 mb-1">
            تشخيص الصفحة قبل الإعلان
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
            قبل ما تصرف ولا جنيه على الإعلان الممول، خلي AI يعمل audit شامل
            للصفحة بتاعتك ويكتشف المشاكل اللي ممكن تخسّر إعلانك. هتطلع بـ
            list of fixes مرقّمة ومرتّبة بالأهمية.
          </p>
        </header>

        {sp.diagnosed && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-cairo text-sm">
            ✅ تم تشخيص الصفحة بنجاح. شوف النتيجة تحت.
          </div>
        )}
        <AiErrorBanner message={errorMsg} />

        {/* Diagnosis form */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
          <h2 className="font-black font-cairo text-slate-800 mb-1">
            ✦ ابدأ تشخيص جديد
          </h2>
          <p className="text-xs text-slate-500 font-cairo mb-4">
            اوصف صفحتك بكل تفاصيلها (مين الزوار، إيه المحتوى، إيه المشاكل
            اللي تلاحظها). كل ما الوصف أعمق، كل ما التشخيص أدق.
          </p>
          <form action={runPageDoctor} className="space-y-3">
            <input type="hidden" name="project_id" value={id} />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                وصف الصفحة <span className="text-rose-500">*</span>
              </label>
              <textarea
                name="page_info"
                required
                minLength={30}
                rows={6}
                placeholder="مثلاً: عندي صفحة فيسبوك اسمها 'مصنع الواح PVC الكوري'، عمرها سنتين، حوالي 5000 متابع، بنحط بوست كل أسبوع، فيه 10 صور للمنتج لكن قديمة من 2023، الـ Cover image قديمة، الـ About فيها رقم الموبايل بس مش فيه واتساب، أرقام التواصل مش واضحة، البوستات بياخدها مشاهدات قليلة جداً..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-rose-400 outline-none text-sm font-cairo resize-y"
              />
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  رابط Facebook (اختياري)
                </label>
                <input
                  type="url"
                  name="facebook_url"
                  placeholder="https://facebook.com/yourpage"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-xs font-mono"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  رابط Instagram (اختياري)
                </label>
                <input
                  type="url"
                  name="instagram_url"
                  placeholder="https://instagram.com/yourpage"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-xs font-mono"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                  الموقع (اختياري)
                </label>
                <input
                  type="url"
                  name="website_url"
                  placeholder="https://yoursite.com"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none text-xs font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                مشاكل لاحظتها (اختياري)
              </label>
              <textarea
                name="current_issues"
                rows={2}
                placeholder="مثلاً: 'الإعلان الممول كان CTR بتاعه 0.3% فقط', 'الناس بتسأل في الكومنتات ومحدش بيرد'..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-rose-400 outline-none text-sm font-cairo resize-y"
              />
            </div>

            <button
              type="submit"
              className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black font-cairo shadow-md hover:shadow-lg transition"
            >
              🩺 ابدأ التشخيص بالـ AI
            </button>
          </form>
        </section>

        {/* Results */}
        {result && (
          <>
            {/* Health score */}
            <section className="mb-6 p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
              <div className="flex items-center gap-6 flex-wrap">
                <HealthScore score={result.overall_health_score} />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] tracking-wider text-amber-300 font-bold uppercase mb-1 font-cairo">
                    تقييم الصحة الإجمالي
                  </div>
                  <p className="text-sm text-slate-200 font-cairo leading-relaxed">
                    {result.health_summary}
                  </p>
                  {diagnosedAt && (
                    <p className="text-[11px] text-slate-400 font-cairo mt-2">
                      آخر تشخيص:{" "}
                      {new Date(diagnosedAt).toLocaleString("ar-EG", {
                        dateStyle: "long",
                        timeStyle: "short",
                      })}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Blockers */}
            {result.blockers && result.blockers.length > 0 && (
              <section className="mb-6 p-5 rounded-2xl bg-rose-50 border-2 border-rose-400">
                <h2 className="font-black font-cairo text-rose-900 mb-3 flex items-center gap-2">
                  <span className="text-2xl">🛑</span>
                  <span>مشاكل حرجة — لازم تتحل قبل أي إعلان</span>
                </h2>
                <ul className="space-y-2">
                  {result.blockers.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 p-3 bg-white rounded-lg border border-rose-200"
                    >
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-rose-100 text-rose-700 text-xs font-black shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-slate-800 font-cairo leading-relaxed">
                        {b}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Quick wins */}
            {result.quick_wins && result.quick_wins.length > 0 && (
              <section className="mb-6 p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300">
                <h2 className="font-black font-cairo text-emerald-900 mb-3 flex items-center gap-2">
                  <span className="text-2xl">⚡</span>
                  <span>Quick Wins — تحسينات في 30 دقيقة بتاثير فوري</span>
                </h2>
                <ul className="space-y-2">
                  {result.quick_wins.map((w, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 p-3 bg-white rounded-lg border border-emerald-200"
                    >
                      <span className="text-emerald-600 shrink-0 text-lg">⚡</span>
                      <span className="text-sm text-slate-800 font-cairo leading-relaxed">
                        {w}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* All issues */}
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 font-cairo">
              كل المشاكل المكتشفة ({sortedIssues.length})
            </h2>
            <div className="space-y-3 mb-6">
              {sortedIssues.map((issue, i) => (
                <IssueCard key={i} issue={issue} index={i + 1} />
              ))}
            </div>

            {/* Pre-launch checklist */}
            {result.pre_launch_checklist &&
              result.pre_launch_checklist.length > 0 && (
                <section className="p-5 rounded-2xl bg-gradient-to-l from-amber-50 to-cyan-50 border-2 border-amber-300">
                  <h2 className="font-black font-cairo text-slate-800 mb-3 flex items-center gap-2">
                    <span className="text-2xl">📋</span>
                    <span>شيك ليست قبل إطلاق الإعلان</span>
                  </h2>
                  <ul className="space-y-2">
                    {result.pre_launch_checklist.map((c, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-3 p-2.5 bg-white rounded-lg border border-amber-200"
                      >
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded border-2 border-amber-300 shrink-0 mt-0.5">
                          ☐
                        </span>
                        <span className="text-sm text-slate-800 font-cairo leading-relaxed">
                          {c}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
          </>
        )}
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// HealthScore — circular ring showing the overall score
// ----------------------------------------------------------------------------
function HealthScore({ score }: { score: number }) {
  const color =
    score >= 80
      ? "text-emerald-400"
      : score >= 60
        ? "text-amber-400"
        : score >= 40
          ? "text-orange-400"
          : "text-rose-400";
  const label =
    score >= 80
      ? "ممتاز"
      : score >= 60
        ? "جيد"
        : score >= 40
          ? "محتاج تحسين"
          : "خطير";

  return (
    <div className="text-center shrink-0">
      <div
        className={`w-28 h-28 rounded-full border-4 border-white/20 flex items-center justify-center ${color}`}
      >
        <div>
          <div className="text-4xl font-black font-cairo leading-none">
            {score}
          </div>
          <div className="text-[10px] text-slate-300 font-cairo mt-0.5">
            من 100
          </div>
        </div>
      </div>
      <div className={`text-xs font-bold mt-2 font-cairo ${color}`}>
        {label}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// IssueCard — one issue with fix steps
// ----------------------------------------------------------------------------
function IssueCard({ issue, index }: { issue: PageDoctorIssue; index: number }) {
  const sev = SEVERITY[issue.severity] ?? SEVERITY.medium;
  const cat = CATEGORY_LABEL[issue.category] ?? {
    label: issue.category,
    icon: "📌",
  };

  return (
    <details className="bg-white border-2 border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition group">
      <summary className="cursor-pointer flex items-start gap-3 list-none">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-700 text-sm font-black shrink-0">
          {index}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-base font-black font-cairo text-slate-800">
              {issue.issue_title}
            </h3>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border font-bold font-cairo ${sev.cls}`}
            >
              {sev.label}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 font-bold font-cairo">
              {cat.icon} {cat.label}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 font-bold font-cairo">
              ⏱ {EFFORT_LABEL[issue.estimated_effort] ?? issue.estimated_effort}
            </span>
          </div>
          <p className="text-sm text-slate-600 font-cairo leading-relaxed">
            {issue.problem_description}
          </p>
        </div>
        <span className="text-slate-400 text-xl group-open:rotate-180 transition">
          ▼
        </span>
      </summary>

      <div className="mt-4 pt-4 border-t border-slate-100">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200">
            <div className="text-[11px] font-black text-rose-700 mb-1 font-cairo">
              ❌ تأثيرها على الإعلان
            </div>
            <p className="text-sm text-slate-800 font-cairo leading-relaxed">
              {issue.ad_impact}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="text-[11px] font-black text-emerald-700 mb-1 font-cairo">
              ✅ تأثير الإصلاح المتوقع
            </div>
            <p className="text-sm text-slate-800 font-cairo leading-relaxed">
              {issue.estimated_impact}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="text-[11px] font-black text-slate-700 mb-2 font-cairo">
            🔧 خطوات الإصلاح
          </div>
          <ol className="space-y-2">
            {issue.fix_steps.map((step, i) => (
              <li
                key={i}
                className="flex items-start gap-3 p-2.5 bg-slate-50 rounded-lg"
              >
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-black shrink-0">
                  {i + 1}
                </span>
                <span className="text-sm text-slate-800 font-cairo leading-relaxed">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </details>
  );
}
