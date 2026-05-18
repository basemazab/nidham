// ============================================================================
// /dashboard/marketing — Marketing Studio Hub (Enterprise only)
// ============================================================================
//
// Lists the user's marketing projects + a CTA to create the first one.
// Each project is a self-contained workspace where the 5 AI tools operate
// (analyzer / personas / ad copy / SEO / campaign wizard).
//
// Hard-gated to the "marketing_studio" feature flag, which is Enterprise-only
// per /lib/subscriptions.ts.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";
import { createMarketingProject, archiveMarketingProject } from "./actions";
import { AiErrorBanner } from "@/components/ai-error-banner";

type Project = {
  id: string;
  name: string;
  product_summary: string | null;
  industry: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
};

type SearchParams = Promise<{ error?: string }>;

const INDUSTRIES = [
  { value: "real_estate", label: "عقارات" },
  { value: "manufacturing", label: "تصنيع" },
  { value: "retail", label: "تجارة وعدد" },
  { value: "services", label: "خدمات" },
  { value: "saas", label: "تكنولوجيا / SaaS" },
  { value: "food", label: "أكل ومشروبات" },
  { value: "education", label: "تعليم" },
  { value: "healthcare", label: "صحة" },
  { value: "fashion", label: "موضة" },
  { value: "automotive", label: "سيارات" },
  { value: "construction", label: "إنشاء ومقاولات" },
  { value: "other", label: "أخرى" },
];

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

export default async function MarketingHubPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await canUseFeature("marketing_studio"))) {
    return <UpgradeRequired feature="marketing_studio" />;
  }

  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  // Scope to the caller's company — mig 038 gives super-admin SELECT on
  // marketing_projects across every tenant.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const { data, error: fetchError } = await supabase
    .from("marketing_projects")
    .select(
      "id, name, product_summary, industry, status, created_at, updated_at",
    )
    .eq("company_id", callerCompanyId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .returns<Project[]>();

  const projects = data ?? [];

  // Detect "table does not exist" so we can render an instructive
  // banner instead of just the empty state. Most common reason is the
  // tenant hasn't applied Migration 037 yet.
  const tableMissing =
    !!fetchError &&
    /relation .* does not exist|42P01|schema cache|PGRST205/i.test(
      fetchError.message ?? "",
    );

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-amber-50/20 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-amber-100 to-amber-50 border border-amber-300 text-amber-800 text-xs font-bold mb-2 font-cairo">
            👑 Enterprise · Marketing Studio
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            استوديو التسويق الذكي
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
            وكالة تسويق رقمي كاملة جواه نظامك. مدير المنتج بيكتب وصف المنتج،
            النظام يحلله، يبني الـ personas، يكتب الإعلانات، يقترح كلمات
            SEO، ويبني استراتيجية الحملة الإعلانية. <strong>كله بالعربي
            المصري وبخبرة وكالة Big4.</strong>
          </p>
        </header>

        <AiErrorBanner message={errorMsg} />

        {/* Quick-access cards — the operational layer (Landing Pages +
            Leads Inbox) lives alongside the AI tool projects. Render
            them up top so they're always reachable, not buried inside
            a specific project. */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Link
            href="/dashboard/marketing/landing-pages"
            className="group bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200 hover:border-cyan-400 rounded-2xl p-4 transition hover:shadow-lg"
          >
            <div className="text-2xl mb-1">🏠</div>
            <h3 className="text-sm font-black font-cairo text-slate-800 group-hover:text-cyan-700 mb-1">
              صفحات الهبوط
            </h3>
            <p className="text-[11px] text-slate-600 font-cairo leading-snug">
              Landing pages + lead capture + UTM tracking
            </p>
          </Link>

          <Link
            href="/dashboard/marketing/leads"
            className="group bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 hover:border-violet-400 rounded-2xl p-4 transition hover:shadow-lg"
          >
            <div className="text-2xl mb-1">📥</div>
            <h3 className="text-sm font-black font-cairo text-slate-800 group-hover:text-violet-700 mb-1">
              Leads Inbox
            </h3>
            <p className="text-[11px] text-slate-600 font-cairo leading-snug">
              صندوق العملاء + Pipeline + متابعة
            </p>
          </Link>

          <Link
            href="/dashboard/marketing/analytics"
            className="group bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 hover:border-emerald-400 rounded-2xl p-4 transition hover:shadow-lg"
          >
            <div className="text-2xl mb-1">📊</div>
            <h3 className="text-sm font-black font-cairo text-slate-800 group-hover:text-emerald-700 mb-1">
              Analytics
            </h3>
            <p className="text-[11px] text-slate-600 font-cairo leading-snug">
              Funnel + sources + ROI per campaign
            </p>
          </Link>

          <Link
            href="/dashboard/marketing/integrations"
            className="group bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 hover:border-blue-400 rounded-2xl p-4 transition hover:shadow-lg"
          >
            <div className="text-2xl mb-1">🔌</div>
            <h3 className="text-sm font-black font-cairo text-slate-800 group-hover:text-blue-700 mb-1">
              Integrations
            </h3>
            <p className="text-[11px] text-slate-600 font-cairo leading-snug">
              Meta Lead Ads webhook (auto-import)
            </p>
          </Link>
        </section>

        {/* Migration not applied warning — the most likely reason for
            "table not found" errors. Tells the operator exactly which
            SQL file to apply where, with a one-click copy path. */}
        {tableMissing && (
          <div className="mb-5 bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 font-cairo">
            <div className="flex items-start gap-3">
              <span className="text-3xl">⚠</span>
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-amber-900 mb-2 text-base">
                  Migration 037 لسه ما اتطبقتش على Supabase
                </h3>
                <p className="text-sm text-amber-800 leading-relaxed mb-3">
                  جداول الـ Marketing Studio (marketing_projects،
                  marketing_personas، marketing_campaigns، marketing_keywords،
                  marketing_ad_creatives) محتاجين Migration 037 يتعمله apply
                  الأول. الـ Studio مش هيشتغل من غيرها.
                </p>
                <div className="bg-white border border-amber-200 rounded-lg p-3 mb-3">
                  <div className="text-[10px] font-bold text-amber-700 mb-1">
                    📋 خطوات التفعيل:
                  </div>
                  <ol className="text-sm text-slate-700 space-y-1.5 list-decimal pr-5">
                    <li>افتح Supabase Dashboard</li>
                    <li>روح على SQL Editor → New query</li>
                    <li>
                      انسخ والصق محتوى الملف:
                      <code className="block bg-slate-100 text-xs font-mono p-2 mt-1 rounded text-slate-800" dir="ltr">
                        db/migrations/037_marketing_studio.sql
                      </code>
                    </li>
                    <li>اضغط Run</li>
                    <li>ارجع هنا وحدّث الصفحة</li>
                  </ol>
                </div>
                <p className="text-xs text-amber-700">
                  💡 الـ Studio بيستخدم Groq Llama 3.3 + Gemini Flash. تأكد إن{" "}
                  <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[11px] font-mono">
                    GROQ_API_KEY
                  </code>{" "}
                  أو{" "}
                  <code className="bg-amber-100 px-1.5 py-0.5 rounded text-[11px] font-mono">
                    GEMINI_API_KEY
                  </code>{" "}
                  متعيّن في Vercel Environment Variables.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tools overview — only when no projects yet */}
        {projects.length === 0 && (
          <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-3">
            <ToolPreview
              icon="🔬"
              title="محلل المنتج"
              text="تحليل عميق: USP، الموقع التسويقي، قنوات أنسب"
            />
            <ToolPreview
              icon="🎯"
              title="باني الجمهور"
              text="2-4 buyer personas مع targeting لـ Facebook/Google"
            />
            <ToolPreview
              icon="✍"
              title="كاتب الإعلانات"
              text="5+ variants لإعلانات Meta/Google/TikTok جاهزة للنشر"
            />
            <ToolPreview
              icon="🔍"
              title="ماستر SEO"
              text="20+ keyword + content strategy + quick wins"
            />
            <ToolPreview
              icon="🚀"
              title="معالج الحملات"
              text="استراتيجية ميزانية + مراحل + توقعات CPA واقعية"
            />
            <ToolPreview
              icon="📊"
              title="تتبع الأداء"
              text="سجّل المؤشرات الفعلية وقارن بالتوقعات"
            />
          </div>
        )}

        {/* Create new project form */}
        <section className="bg-white border-2 border-amber-200 rounded-2xl p-5 mb-6">
          <h2 className="font-black font-cairo text-slate-800 mb-1">
            ✦ مشروع تسويق جديد
          </h2>
          <p className="text-xs text-slate-500 font-cairo mb-4">
            ابدأ بوصف منتج/خدمة جديدة. النظام هيبني التحليل + الـ personas +
            الإعلانات + الـ SEO + الحملة كاملة لمشروع.
          </p>
          <form action={createMarketingProject} className="grid md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                اسم المشروع
              </label>
              <input
                type="text"
                name="name"
                required
                minLength={2}
                placeholder="مثلاً: ألواح WPC - حملة الصيف"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none text-sm font-cairo"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                وصف المنتج/الخدمة <span className="text-rose-500">*</span>{" "}
                <span className="text-slate-400">(الأهم — كل الأدوات هتستخدمه)</span>
              </label>
              <textarea
                name="product_summary"
                required
                minLength={30}
                rows={4}
                placeholder="اشرح المنتج: إيه هو، عميله المثالي، فايدته الرئيسية، سعره، اللي يميزه عن المنافسين..."
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none text-sm font-cairo resize-y"
              />
              <p className="text-[10px] text-slate-500 font-cairo mt-1">
                💡 لازم 30 حرف على الأقل. كل ما الوصف أوضح، كل ما النتايج أدق.
              </p>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                الصناعة
              </label>
              <select
                name="industry"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-400 outline-none text-sm font-cairo"
              >
                <option value="">— اختر —</option>
                {INDUSTRIES.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                السوق المستهدف
              </label>
              <input
                type="text"
                name="target_market"
                defaultValue="Egypt"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-400 outline-none text-sm font-cairo"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-black font-cairo shadow-lg shadow-amber-500/30 hover:shadow-amber-500/50 transition-all"
              >
                ✦ ابدأ المشروع
              </button>
            </div>
          </form>
        </section>

        {/* Projects list */}
        {projects.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 font-cairo">
              مشاريعك ({projects.length})
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/marketing/${p.id}`}
                  className="group bg-white border-2 border-slate-200 rounded-2xl p-5 hover:border-amber-400 hover:shadow-lg hover:-translate-y-0.5 transition-all relative"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 flex items-center justify-center text-xl shrink-0">
                      ✦
                    </div>
                    {p.industry && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200 font-bold font-cairo">
                        {INDUSTRIES.find((i) => i.value === p.industry)?.label ??
                          p.industry}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-black font-cairo text-slate-800 mb-1 group-hover:text-amber-700 transition truncate">
                    {p.name}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-cairo line-clamp-2 mb-3">
                    {p.product_summary ?? "— لسه مفيش وصف —"}
                  </p>
                  <div className="text-[11px] text-slate-500 font-cairo">
                    آخر تحديث:{" "}
                    {new Date(p.updated_at).toLocaleDateString("ar-EG")}
                  </div>
                </Link>
              ))}
            </div>

            {/* Archive option, hidden in details element */}
            <details className="mt-6">
              <summary className="text-xs text-slate-500 hover:text-rose-600 cursor-pointer font-cairo">
                ⋯ أرشفة مشروع
              </summary>
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs font-cairo">
                <p className="text-rose-700 mb-2">
                  لأرشفة مشروع، افتحه واضغط على الزر في صفحته. الأرشفة
                  بتخفي المشروع من القائمة بس بياناته بتفضل محفوظة.
                </p>
                <form action={archiveMarketingProject}>
                  <select
                    name="project_id"
                    required
                    className="px-2 py-1 rounded border border-rose-200 text-xs font-cairo bg-white"
                  >
                    <option value="">اختر مشروع</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="mr-2 px-3 py-1 rounded bg-rose-600 text-white text-xs font-bold font-cairo"
                  >
                    أرشفة
                  </button>
                </form>
              </div>
            </details>
          </section>
        )}
      </div>
    </main>
  );
}

function ToolPreview({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-start gap-2.5">
        <span className="text-xl shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800 font-cairo">
            {title}
          </div>
          <div className="text-[11px] text-slate-500 font-cairo leading-relaxed mt-0.5">
            {text}
          </div>
        </div>
      </div>
    </div>
  );
}
