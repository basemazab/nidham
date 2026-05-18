// ============================================================================
// /dashboard/marketing/[id] — Marketing Project Workspace
// ============================================================================
//
// Single project surface that bundles all 5 tools as cards (analyzer is
// front-and-center because everything downstream depends on it). Each
// card surfaces "ready" status when results exist, and a CTA to run/refresh.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";
import { getProviderStatus } from "@/lib/ai-models";
import { runProductAnalysis, updateMarketingProject } from "../actions";
import { AiErrorBanner } from "@/components/ai-error-banner";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    analyzed?: string;
    error?: string;
    saved?: string;
  }>;
};

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

type Project = {
  id: string;
  name: string;
  product_summary: string | null;
  industry: string | null;
  target_market: string | null;
  ai_analysis: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export default async function MarketingProjectPage({
  params,
  searchParams,
}: PageProps) {
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

  // Scope counts to the caller's company — the project row itself
  // is fetched by unguessable id so RLS handles it.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [projectRes, personasCount, creativesCount, keywordsCount, campaignsCount] =
    await Promise.all([
      supabase
        .from("marketing_projects")
        .select("*")
        .eq("id", id)
        .single<Project>(),
      supabase
        .from("marketing_personas")
        .select("id", { count: "exact", head: true })
        .eq("company_id", callerCompanyId)
        .eq("project_id", id),
      supabase
        .from("marketing_ad_creatives")
        .select("id", { count: "exact", head: true })
        .eq("company_id", callerCompanyId)
        .eq("project_id", id),
      supabase
        .from("marketing_keywords")
        .select("id", { count: "exact", head: true })
        .eq("company_id", callerCompanyId)
        .eq("project_id", id),
      supabase
        .from("marketing_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("company_id", callerCompanyId)
        .eq("project_id", id),
    ]);

  if (!projectRes.data) notFound();
  const project = projectRes.data;

  const hasAnalysis =
    project.ai_analysis && Object.keys(project.ai_analysis).length > 0;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const providers = getProviderStatus();

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-amber-50/20 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link
            href="/dashboard/marketing"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← مشاريع التسويق
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-2.5 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-[10px] font-bold mb-2 font-cairo">
            ✦ مشروع تسويق
          </div>
          <h1 className="text-2xl md:text-3xl font-black font-cairo text-slate-800 mb-1">
            {project.name}
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            {project.industry ?? "—"} · {project.target_market ?? "Egypt"}
          </p>
        </header>

        {sp.analyzed && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-cairo text-sm">
            ✅ تم تحليل المنتج بنجاح. شوف النتيجة تحت.
          </div>
        )}
        {sp.saved && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-cairo text-sm">
            ✅ تم حفظ التعديلات. تقدر دلوقتي تشغّل أي أداة AI.
          </div>
        )}
        <AiErrorBanner message={errorMsg} />

        {/* Single-provider warning — shown when only Gemini OR only
            Groq is configured. Encourages the user to add the second
            free key so fallback can actually fall back. Not blocking —
            just preventative. */}
        {(!providers.groq || !providers.gemini) && (
          <details className="mb-5">
            <summary className="cursor-pointer text-xs text-amber-700 hover:text-amber-900 font-cairo">
              💡 نصيحة: ضيف مفتاح AI ثاني للحماية من انقطاع الخدمة
            </summary>
            <div className="mt-2 p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs font-cairo text-amber-800 leading-relaxed">
              <p className="mb-2">
                دلوقتي شغّال على <strong>provider واحد بس</strong>:
                {providers.groq ? " Groq" : " Gemini"}. لو وصل لحده اليومي، الـ
                Studio هيتوقف لحد بكرة. <strong>ضيف الـ provider التاني</strong>{" "}
                (مجاناً) عشان النظام يـ fallback تلقائياً.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {!providers.groq && (
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition"
                  >
                    Groq — 14,000/يوم مجاناً ↗
                  </a>
                )}
                {!providers.gemini && (
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold transition"
                  >
                    Gemini — 1,500/يوم مجاناً ↗
                  </a>
                )}
              </div>
              <p className="mt-3 text-[11px] opacity-80">
                بعد ما تحصل على المفتاح، ضيفه في Vercel → Settings →
                Environment Variables باسم{" "}
                <code className="bg-amber-100 px-1 rounded font-mono">
                  {providers.groq ? "GEMINI_API_KEY" : "GROQ_API_KEY"}
                </code>
              </p>
            </div>
          </details>
        )}

        {/* Product description card — handles BOTH viewing/editing the
            summary AND triggering the AI analysis. When summary is empty
            the edit form is shown directly so the user can never get stuck
            with a half-created project. */}
        <ProductSummarySection
          projectId={id}
          project={project}
          hasAnalysis={!!hasAnalysis}
        />

        {/* AI Analysis results */}
        {hasAnalysis && (
          <AnalysisCard analysis={project.ai_analysis} />
        )}

        {/* Tool cards */}
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 font-cairo">
          أدوات التسويق
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ToolCard
            href={`/dashboard/marketing/${id}/personas`}
            icon="🎯"
            title="باني الجمهور"
            description="Buyer personas + Targeting parameters"
            count={personasCount.count ?? 0}
            countLabel="persona"
            color="cyan"
          />
          <ToolCard
            href={`/dashboard/marketing/${id}/ads`}
            icon="✍"
            title="كاتب الإعلانات"
            description="Ad copy لـ Meta + Google + TikTok"
            count={creativesCount.count ?? 0}
            countLabel="إعلان"
            color="rose"
          />
          <ToolCard
            href={`/dashboard/marketing/${id}/seo`}
            icon="🔍"
            title="ماستر SEO"
            description="Keywords + Content strategy"
            count={keywordsCount.count ?? 0}
            countLabel="keyword"
            color="emerald"
          />
          <ToolCard
            href={`/dashboard/marketing/${id}/page-doctor`}
            icon="🩺"
            title="Page Doctor"
            description="تشخيص مشاكل الصفحة + خطة إصلاح"
            count={
              (
                project.ai_analysis as {
                  page_doctor?: { issues?: unknown[] };
                } | null
              )?.page_doctor?.issues?.length ?? 0
            }
            countLabel="مشكلة"
            color="rose"
          />
          <ToolCard
            href={`/dashboard/marketing/${id}/campaign`}
            icon="🚀"
            title="معالج الحملات"
            description="استراتيجية + ميزانية + KPIs"
            count={campaignsCount.count ?? 0}
            countLabel="حملة"
            color="violet"
          />
        </div>

        {/* Lead operations — bridges the AI output to actual leads */}
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 mt-8 font-cairo">
          العمليات (Lead capture + متابعة)
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link
            href="/dashboard/marketing/landing-pages"
            className="group bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200 hover:border-cyan-400 rounded-2xl p-5 transition hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">🏠</span>
              <h3 className="text-base font-black font-cairo text-slate-800 group-hover:text-cyan-700">
                صفحات الهبوط
              </h3>
            </div>
            <p className="text-xs text-slate-600 font-cairo">
              ابني صفحة هبوط من الـ ad copy اللي عملته، وحطها في إعلانك.
            </p>
          </Link>
          <Link
            href="/dashboard/marketing/leads"
            className="group bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 hover:border-violet-400 rounded-2xl p-5 transition hover:shadow-lg"
          >
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">📥</span>
              <h3 className="text-base font-black font-cairo text-slate-800 group-hover:text-violet-700">
                Leads Inbox
              </h3>
            </div>
            <p className="text-xs text-slate-600 font-cairo">
              كل lead من الحملة دي بييجي هنا مع مصدره الكامل.
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// ProductSummarySection — view + inline-edit + run-AI-analysis
// ----------------------------------------------------------------------------
// Two modes:
//   1. summary present → show it + "✏ تعديل" details disclosure
//                       + "🔬 حلّل بالـ AI" button
//   2. summary missing → show the edit form directly (no toggle), with
//                       a yellow callout explaining all tools need it
//                       before they can run.
//
// Critical for UX: every AI tool short-circuits with "اكتب وصف المنتج
// أولاً" when summary is empty, and there was no UI to set it after
// creation. Without this section, an empty-summary project was a
// dead-end.
function ProductSummarySection({
  projectId,
  project,
  hasAnalysis,
}: {
  projectId: string;
  project: Project;
  hasAnalysis: boolean;
}) {
  const hasSummary =
    !!project.product_summary && project.product_summary.length > 0;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <h2 className="font-black font-cairo text-slate-800">
          📝 وصف المنتج
        </h2>
        {hasSummary && (
          <form action={runProductAnalysis}>
            <input type="hidden" name="project_id" value={projectId} />
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm font-cairo shadow-md hover:shadow-lg transition"
            >
              <span>🔬</span>
              <span>
                {hasAnalysis ? "إعادة التحليل" : "حلّل المنتج بالـ AI"}
              </span>
            </button>
          </form>
        )}
      </div>

      {hasSummary ? (
        <>
          <p className="text-sm text-slate-700 font-cairo leading-relaxed whitespace-pre-line mb-3">
            {project.product_summary}
          </p>
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-500 hover:text-amber-700 font-cairo">
              ✏ تعديل الوصف أو الصناعة أو السوق
            </summary>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <ProductSummaryForm projectId={projectId} project={project} />
            </div>
          </details>
        </>
      ) : (
        <>
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-cairo leading-relaxed">
            ⚠ المشروع ده معندوش وصف للمنتج. كل أدوات الـ AI (SEO، باني
            الجمهور، كاتب الإعلانات، معالج الحملات، Page Doctor) محتاجة
            الوصف عشان تشتغل. اكتبه دلوقتي:
          </div>
          <ProductSummaryForm projectId={projectId} project={project} />
        </>
      )}
    </section>
  );
}

function ProductSummaryForm({
  projectId,
  project,
}: {
  projectId: string;
  project: Project;
}) {
  return (
    <form action={updateMarketingProject} className="grid md:grid-cols-2 gap-3">
      <input type="hidden" name="project_id" value={projectId} />

      <div className="md:col-span-2">
        <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
          اسم المشروع <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          name="name"
          required
          minLength={2}
          defaultValue={project.name}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-400 outline-none text-sm font-cairo"
        />
      </div>

      <div className="md:col-span-2">
        <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
          وصف المنتج/الخدمة <span className="text-rose-500">*</span>{" "}
          <span className="text-slate-400">(30 حرف على الأقل)</span>
        </label>
        <textarea
          name="product_summary"
          required
          minLength={30}
          rows={5}
          defaultValue={project.product_summary ?? ""}
          placeholder="اشرح المنتج: إيه هو، عميله المثالي، فايدته الرئيسية، سعره، اللي يميزه عن المنافسين..."
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none text-sm font-cairo resize-y"
        />
        <p className="text-[10px] text-slate-500 font-cairo mt-1">
          💡 كل ما الوصف أوضح، كل ما النتايج أدق.
        </p>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
          الصناعة
        </label>
        <select
          name="industry"
          defaultValue={project.industry ?? ""}
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
          defaultValue={project.target_market ?? "Egypt"}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-amber-400 outline-none text-sm font-cairo"
        />
      </div>

      <div className="md:col-span-2">
        <button
          type="submit"
          className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-black font-cairo shadow-md hover:shadow-lg transition"
        >
          💾 احفظ التعديلات
        </button>
      </div>
    </form>
  );
}

// ----------------------------------------------------------------------------
// AnalysisCard — renders the product-analysis structured output
// ----------------------------------------------------------------------------
function AnalysisCard({
  analysis,
}: {
  analysis: Record<string, unknown> | null;
}) {
  if (!analysis) return null;
  const a = analysis as {
    one_line_pitch?: string;
    unique_value_proposition?: string;
    primary_benefits?: string[];
    competitive_moat?: string;
    market_positioning?: string;
    recommended_channels?: string[];
    pricing_strategy?: string;
    marketing_risks?: string[];
    growth_opportunities?: string[];
  };

  const POSITIONING_LABEL: Record<string, string> = {
    premium: "فاخر",
    value: "قيمة مقابل السعر",
    budget: "اقتصادي",
    specialist: "متخصص",
    "mass-market": "للسوق العام",
  };

  return (
    <section className="bg-gradient-to-br from-cyan-50 via-white to-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">🔬</span>
        <h2 className="font-black font-cairo text-slate-800">
          تحليل AI للمنتج
        </h2>
      </div>

      {a.one_line_pitch && (
        <div className="mb-4 p-4 rounded-xl bg-white border-r-4 border-amber-400">
          <div className="text-[10px] font-bold text-amber-700 mb-1 font-cairo">
            ✦ الجملة الأقوى
          </div>
          <p className="text-base font-bold text-slate-800 font-cairo">
            {a.one_line_pitch}
          </p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {a.unique_value_proposition && (
          <Card title="💎 القيمة الفريدة">
            <p className="text-sm text-slate-700 font-cairo leading-relaxed">
              {a.unique_value_proposition}
            </p>
          </Card>
        )}

        {a.competitive_moat && (
          <Card title="🛡 الحاجز التنافسي">
            <p className="text-sm text-slate-700 font-cairo leading-relaxed">
              {a.competitive_moat}
            </p>
          </Card>
        )}

        {a.primary_benefits && a.primary_benefits.length > 0 && (
          <Card title="✨ أهم الفوائد">
            <ul className="text-sm text-slate-700 font-cairo space-y-1">
              {a.primary_benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 shrink-0">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {a.recommended_channels && a.recommended_channels.length > 0 && (
          <Card title="📡 القنوات الموصى بها">
            <div className="flex flex-wrap gap-1.5">
              {a.recommended_channels.map((c, i) => (
                <span
                  key={i}
                  className={`text-[11px] px-2 py-1 rounded-full font-bold font-cairo ${
                    i === 0
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-slate-100 text-slate-700 border border-slate-200"
                  }`}
                >
                  {i === 0 && "⭐ "}
                  {CHANNEL_LABEL[c] ?? c}
                </span>
              ))}
            </div>
          </Card>
        )}

        {a.market_positioning && (
          <Card title="📍 الموقع التسويقي">
            <div className="text-base font-bold text-amber-700 font-cairo">
              {POSITIONING_LABEL[a.market_positioning] ?? a.market_positioning}
            </div>
          </Card>
        )}

        {a.pricing_strategy && (
          <Card title="💰 استراتيجية التسعير">
            <p className="text-sm text-slate-700 font-cairo leading-relaxed">
              {a.pricing_strategy}
            </p>
          </Card>
        )}

        {a.marketing_risks && a.marketing_risks.length > 0 && (
          <Card title="⚠ مخاطر تسويقية">
            <ul className="text-sm text-slate-700 font-cairo space-y-1">
              {a.marketing_risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-rose-500 shrink-0">⚠</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {a.growth_opportunities && a.growth_opportunities.length > 0 && (
          <Card title="📈 فرص النمو">
            <ul className="text-sm text-slate-700 font-cairo space-y-1">
              {a.growth_opportunities.map((g, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-cyan-500 shrink-0">↗</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </section>
  );
}

const CHANNEL_LABEL: Record<string, string> = {
  facebook_ads: "Facebook Ads",
  instagram_ads: "Instagram Ads",
  tiktok_ads: "TikTok Ads",
  google_search: "Google Search",
  google_display: "Google Display",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  whatsapp_business: "WhatsApp Business",
  snapchat: "Snapchat",
  telegram: "Telegram",
  seo_content: "SEO + Blog",
  influencer: "Influencers",
  email: "Email",
};

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-xs font-bold text-slate-600 mb-2 font-cairo">
        {title}
      </div>
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------------
// ToolCard
// ----------------------------------------------------------------------------
function ToolCard({
  href,
  icon,
  title,
  description,
  count,
  countLabel,
  color,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  count: number;
  countLabel: string;
  color: "cyan" | "rose" | "emerald" | "violet";
}) {
  const cls = {
    cyan: "border-cyan-200 hover:border-cyan-400 from-cyan-50 to-white",
    rose: "border-rose-200 hover:border-rose-400 from-rose-50 to-white",
    emerald: "border-emerald-200 hover:border-emerald-400 from-emerald-50 to-white",
    violet: "border-violet-200 hover:border-violet-400 from-violet-50 to-white",
  }[color];
  const chip = {
    cyan: "bg-cyan-100 text-cyan-800",
    rose: "bg-rose-100 text-rose-800",
    emerald: "bg-emerald-100 text-emerald-800",
    violet: "bg-violet-100 text-violet-800",
  }[color];

  return (
    <Link
      href={href}
      className={`group bg-gradient-to-br border-2 ${cls} rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-3xl">{icon}</div>
        {count > 0 && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-cairo ${chip}`}
          >
            {count} {countLabel}
          </span>
        )}
      </div>
      <h3 className="text-base font-black font-cairo text-slate-800 mb-1">
        {title}
      </h3>
      <p className="text-[12px] text-slate-500 font-cairo mb-3">{description}</p>
      <div className="text-[11px] font-bold text-slate-600 font-cairo">
        افتح الأداة →
      </div>
    </Link>
  );
}
