// ============================================================================
// /dashboard/marketing/[id]/campaign — Campaign Wizard
// ============================================================================

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";
import { runCampaignWizard } from "../../actions";
import { AiErrorBanner } from "@/components/ai-error-banner";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generated?: string; error?: string }>;
};

type Campaign = {
  id: string;
  name: string;
  goal: string;
  platforms: string[];
  budget_total: number;
  budget_daily: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  ai_strategy: AiStrategy | null;
  created_at: string;
};

type AiStrategy = {
  campaign_name?: string;
  recommended_goal?: string;
  budget_allocation?: { platform: string; percentage: number; rationale: string }[];
  daily_budget_recommendation?: {
    minimum_to_learn?: number;
    recommended_daily?: number;
    ideal_test_period_days?: number;
  };
  phases?: {
    phase_name: string;
    duration_days: number;
    goal: string;
    tactics: string[];
    kpis: string[];
  }[];
  expected_outcomes?: {
    impressions_range?: string;
    clicks_range?: string;
    leads_or_sales_range?: string;
    expected_cpa_egp?: string;
  };
  risks_to_watch?: string[];
  next_steps?: string[];
};

export default async function CampaignPage({ params, searchParams }: PageProps) {
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

  // Scope campaigns to caller's company.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [projectRes, campaignsRes] = await Promise.all([
    supabase
      .from("marketing_projects")
      .select("id, name")
      .eq("id", id)
      .single<{ id: string; name: string }>(),
    supabase
      .from("marketing_campaigns")
      .select("*")
      .eq("company_id", callerCompanyId)
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .returns<Campaign[]>(),
  ]);

  if (!projectRes.data) notFound();
  const project = projectRes.data;
  const campaigns = campaignsRes.data ?? [];
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link
            href={`/dashboard/marketing/${id}`}
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← مشروع {project.name}
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 border border-violet-300 text-[10px] font-bold mb-2 font-cairo">
            🚀 معالج الحملات
          </div>
          <h1 className="text-2xl md:text-3xl font-black font-cairo text-slate-800 mb-1">
            استراتيجية الحملة الإعلانية
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            {campaigns.length} حملة · توقعات CPA + budget breakdown + KPIs
          </p>
        </header>

        {sp.generated && (
          <div className="mb-5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-cairo text-sm">
            ✅ تم بناء استراتيجية الحملة. شوف التفاصيل تحت + ابدأ التنفيذ.
          </div>
        )}
        <AiErrorBanner message={errorMsg} />

        {/* Wizard form */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 mb-6">
          <h2 className="font-black font-cairo text-slate-800 mb-3">
            ✦ ابني حملة جديدة
          </h2>
          <form action={runCampaignWizard} className="grid md:grid-cols-3 gap-3">
            <input type="hidden" name="project_id" value={id} />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                هدف الحملة
              </label>
              <select
                name="goal"
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-cairo outline-none focus:border-violet-400"
                defaultValue="sales"
              >
                <option value="awareness">Awareness — انتشار العلامة</option>
                <option value="engagement">Engagement — تفاعل</option>
                <option value="leads">Leads — عملاء محتملين</option>
                <option value="sales">Sales — مبيعات مباشرة</option>
                <option value="traffic">Traffic — زيارات الموقع</option>
                <option value="messages">Messages — رسائل واتساب</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                إجمالي الميزانية (ج)
              </label>
              <input
                type="number"
                name="total_budget"
                required
                min="500"
                step="100"
                placeholder="5000"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-cairo outline-none focus:border-violet-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 font-cairo">
                المدة (يوم)
              </label>
              <input
                type="number"
                name="duration_days"
                required
                min="7"
                max="180"
                defaultValue="30"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-cairo outline-none focus:border-violet-400"
              />
            </div>

            <div className="md:col-span-3">
              <button
                type="submit"
                className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-black font-cairo shadow-md hover:shadow-lg transition"
              >
                ✦ ابني الاستراتيجية بالـ AI
              </button>
              <p className="text-[10px] text-slate-500 font-cairo mt-2 text-center">
                💡 لو في personas + SEO keywords في المشروع، الـ AI هيستفيد منهم.
              </p>
            </div>
          </form>
        </section>

        {/* Campaigns list */}
        {campaigns.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
            <div className="text-5xl mb-3">🚀</div>
            <p className="text-sm text-slate-500 font-cairo">
              مفيش حملات لسه. عبّى الفورم فوق.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const s = campaign.ai_strategy;
  if (!s) return null;

  const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    draft: { label: "مسودة", cls: "bg-amber-100 text-amber-800 border-amber-300" },
    launched: { label: "نشطة", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
    paused: { label: "متوقفة", cls: "bg-slate-100 text-slate-700 border-slate-300" },
    completed: { label: "منتهية", cls: "bg-blue-100 text-blue-800 border-blue-300" },
  };
  const stat = STATUS_LABEL[campaign.status] ?? STATUS_LABEL.draft;

  return (
    <div className="bg-white border-2 border-violet-200 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="text-lg font-black font-cairo text-slate-800 mb-1">
            {campaign.name}
          </h3>
          <p className="text-xs text-slate-500 font-cairo">
            ميزانية {Number(campaign.budget_total).toLocaleString("ar-EG")} ج ·{" "}
            {campaign.start_date} → {campaign.end_date}
          </p>
        </div>
        <span
          className={`text-[10px] px-2 py-1 rounded-full border font-bold font-cairo ${stat.cls}`}
        >
          {stat.label}
        </span>
      </div>

      {/* Budget allocation */}
      {s.budget_allocation && s.budget_allocation.length > 0 && (
        <div className="mb-4 p-4 rounded-xl bg-violet-50 border border-violet-200">
          <h4 className="text-xs font-black text-violet-800 mb-3 font-cairo">
            💰 توزيع الميزانية بين المنصات
          </h4>
          <div className="space-y-2">
            {s.budget_allocation.map((b, i) => {
              const amount = (Number(campaign.budget_total) * b.percentage) / 100;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1 text-xs font-cairo">
                    <span className="font-bold text-slate-800">
                      {b.platform}
                    </span>
                    <span className="text-violet-700 font-bold">
                      {b.percentage}% — {amount.toLocaleString("ar-EG")} ج
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-500"
                      style={{ width: `${b.percentage}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-cairo">
                    {b.rationale}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Daily budget */}
      {s.daily_budget_recommendation && (
        <div className="mb-4 grid grid-cols-3 gap-2 text-center">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="text-[10px] text-slate-500 font-bold mb-1 font-cairo">
              الحد الأدنى/يوم
            </div>
            <div className="text-base font-black text-slate-800 font-cairo">
              {s.daily_budget_recommendation.minimum_to_learn} ج
            </div>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="text-[10px] text-emerald-700 font-bold mb-1 font-cairo">
              الموصى به/يوم
            </div>
            <div className="text-base font-black text-emerald-800 font-cairo">
              {s.daily_budget_recommendation.recommended_daily} ج
            </div>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="text-[10px] text-amber-700 font-bold mb-1 font-cairo">
              فترة Test
            </div>
            <div className="text-base font-black text-amber-800 font-cairo">
              {s.daily_budget_recommendation.ideal_test_period_days} يوم
            </div>
          </div>
        </div>
      )}

      {/* Phases */}
      {s.phases && s.phases.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-black text-slate-700 mb-2 font-cairo">
            📋 مراحل الحملة
          </h4>
          <div className="space-y-2">
            {s.phases.map((p, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-slate-50 border border-slate-200"
              >
                <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                  <div className="font-bold text-slate-800 font-cairo text-sm">
                    {i + 1}. {p.phase_name}
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold font-cairo">
                    {p.duration_days} يوم
                  </span>
                </div>
                <p className="text-[12px] text-slate-600 font-cairo mb-2">
                  {p.goal}
                </p>
                {p.tactics && p.tactics.length > 0 && (
                  <div className="text-[11px] text-slate-700 font-cairo">
                    <strong>أساليب:</strong> {p.tactics.join("، ")}
                  </div>
                )}
                {p.kpis && p.kpis.length > 0 && (
                  <div className="text-[11px] text-slate-700 font-cairo mt-1">
                    <strong>KPIs:</strong> {p.kpis.join("، ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expected outcomes */}
      {s.expected_outcomes && (
        <div className="mb-4 p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200">
          <h4 className="text-xs font-black text-emerald-800 mb-2 font-cairo">
            📊 توقعات الأداء
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs font-cairo">
            <Outcome
              label="مشاهدات"
              value={s.expected_outcomes.impressions_range}
            />
            <Outcome
              label="نقرات"
              value={s.expected_outcomes.clicks_range}
            />
            <Outcome
              label="عملاء/مبيعات"
              value={s.expected_outcomes.leads_or_sales_range}
            />
            <Outcome
              label="تكلفة العميل (CPA)"
              value={s.expected_outcomes.expected_cpa_egp}
            />
          </div>
        </div>
      )}

      {/* Risks */}
      {s.risks_to_watch && s.risks_to_watch.length > 0 && (
        <div className="mb-3 p-3 rounded-lg bg-rose-50 border border-rose-200">
          <h4 className="text-xs font-black text-rose-800 mb-2 font-cairo">
            ⚠ مخاطر للمراقبة
          </h4>
          <ul className="text-sm text-slate-700 font-cairo space-y-1">
            {s.risks_to_watch.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-rose-500 shrink-0">▪</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next steps */}
      {s.next_steps && s.next_steps.length > 0 && (
        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
          <h4 className="text-xs font-black text-blue-800 mb-2 font-cairo">
            🎬 الخطوات القادمة
          </h4>
          <ol className="text-sm text-slate-700 font-cairo space-y-1 list-decimal pr-5">
            {s.next_steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function Outcome({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-[10px] text-emerald-700 font-bold font-cairo">
        {label}
      </div>
      <div className="text-sm font-black text-slate-800 font-cairo">
        {value ?? "—"}
      </div>
    </div>
  );
}
