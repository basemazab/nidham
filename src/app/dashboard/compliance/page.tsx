import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthorities, getUpcomingDeadlines, getPenaltiesSummary, computeComplianceScore } from "@/lib/compliance-engine";

const AUTHORITY_COLORS: Record<string, { border: string; bg: string; chip: string; text: string }> = {
  labor_office: { border: "border-cyan-200 hover:border-cyan-400", bg: "bg-cyan-50", chip: "bg-cyan-50 text-cyan-700 border-cyan-200", text: "text-cyan-700" },
  social_insurance: { border: "border-emerald-200 hover:border-emerald-400", bg: "bg-emerald-50", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", text: "text-emerald-700" },
  tax_authority: { border: "border-amber-200 hover:border-amber-400", bg: "bg-amber-50", chip: "bg-amber-50 text-amber-700 border-amber-200", text: "text-amber-700" },
  health_safety: { border: "border-rose-200 hover:border-rose-400", bg: "bg-rose-50", chip: "bg-rose-50 text-rose-700 border-rose-200", text: "text-rose-700" },
  civil_defense: { border: "border-violet-200 hover:border-violet-400", bg: "bg-violet-50", chip: "bg-violet-50 text-violet-700 border-violet-200", text: "text-violet-700" },
  pdpl: { border: "border-slate-200 hover:border-slate-400", bg: "bg-slate-50", chip: "bg-slate-50 text-slate-700 border-slate-200", text: "text-slate-700" },
};

export default async function ComplianceHubPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id, role")
    .eq("id", user.id)
    .single();

  const authorities = getAuthorities();
  const penalties = getPenaltiesSummary(authorities);

  // Load compliance tracking from DB
  let completedIds = new Set<string>();
  if (profile?.company_id) {
    const { data: statuses } = await supabase
      .from("compliance_status")
      .select("item_id, completed")
      .eq("company_id", profile.company_id);
    if (statuses) {
      completedIds = new Set(statuses.filter((s) => s.completed).map((s) => s.item_id));
    }
  }

  const allItems = authorities.flatMap((a) => a.items);
  const overallScore = computeComplianceScore(allItems, completedIds);

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white to-amber-50/20 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-6">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-rose-50 via-amber-50 to-emerald-50 border border-amber-200 text-amber-700 text-xs font-bold mb-2 font-cairo">
            ✦ محرك الامتثال الذكي
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
                محرك الامتثال الذكي
              </h1>
              <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
                متابعة ذكية للامتثال القانوني — ٦ جهات تفتيش، {overallScore.totalCount} بند امتثال،
                تتبع تلقائي للحالة والمواعيد النهائية.
              </p>
            </div>
          </div>
        </header>

        {/* Overall Compliance Score */}
        <div className="mb-6 p-5 rounded-2xl bg-white border-2 border-slate-200">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42"
                  fill="none"
                  stroke={overallScore.score >= 80 ? "#10b981" : overallScore.score >= 50 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="8"
                  strokeDasharray={`${(overallScore.score / 100) * 264} 264`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-black font-cairo ${overallScore.score >= 80 ? "text-emerald-600" : overallScore.score >= 50 ? "text-amber-600" : "text-red-600"}`}>
                  {overallScore.score}%
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black font-cairo text-slate-800 mb-1">مؤشر الامتثال العام</h3>
              <p className="text-sm text-slate-500 font-cairo mb-2">
                {overallScore.completedCount} من {overallScore.totalCount} بند مكتمل
              </p>
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    overallScore.score >= 80 ? "bg-emerald-500" : overallScore.score >= 50 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${overallScore.score}%` }}
                />
              </div>
            </div>
            <div className="text-center">
              <div className={`px-4 py-2 rounded-xl font-bold text-sm font-cairo ${
                overallScore.risk === "low" ? "bg-emerald-100 text-emerald-700" :
                overallScore.risk === "medium" ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-700"
              }`}>
                {overallScore.risk === "low" ? "🟢 امتثال جيد" :
                 overallScore.risk === "medium" ? "🟡 يحتاج تحسين" :
                 "🔴 خطر مرتفع"}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryCard label="جهات التفتيش" value={String(authorities.length)} icon="🏛" color="cyan" />
          <SummaryCard label="إجمالي البنود" value={String(overallScore.totalCount)} icon="📋" color="amber" />
          <SummaryCard label="البند المكتملة" value={String(overallScore.completedCount)} icon="✅" color="emerald" />
          <SummaryCard label="الحد الأدنى للغرامات" value={penalties.minPenalty} icon="⚖" color="violet" />
        </div>

        {/* Authority Cards */}
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 font-cairo">
          جهات التفتيش
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {authorities.map((a) => {
            const color = AUTHORITY_COLORS[a.id] || AUTHORITY_COLORS.labor_office;
            const score = computeComplianceScore(a.items, completedIds);
            return (
              <Link
                key={a.id}
                href={`/dashboard/compliance/${a.id}`}
                className={`group bg-white border-2 ${color.border} rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-xl ${color.bg} ${color.chip.split(" ")[0]} border flex items-center justify-center text-2xl shrink-0`}>
                    {a.icon}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold font-cairo ${color.chip}`}>
                      {a.items.length} بند
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold font-cairo ${
                      score.risk === "low" ? "bg-emerald-100 text-emerald-700" :
                      score.risk === "medium" ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-700"
                    }`}>
                      {score.score}%
                    </span>
                  </div>
                </div>
                <h3 className="text-base font-black font-cairo text-slate-800 mb-1 group-hover:text-amber-700 transition">
                  {a.name}
                </h3>
                <p className="text-[11px] text-slate-500 font-cairo leading-relaxed line-clamp-2 mb-3">
                  {a.description}
                </p>
                <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      score.risk === "low" ? "bg-emerald-500" :
                      score.risk === "medium" ? "bg-amber-500" : "bg-red-500"
                    }`}
                    style={{ width: `${score.score}%` }}
                  />
                </div>
                <div className="mt-2 text-[11px] text-slate-500 font-cairo">
                  الموعد النهائي: {a.frequency === "monthly" ? "شهري" : a.frequency === "quarterly" ? "ربع سنوي" : a.frequency === "yearly" ? "سنوي" : "حسب الحدث"}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Tips */}
        <div className="mt-8 grid md:grid-cols-3 gap-3">
          <Tip icon="📝" title="تجهيز قبل التفتيش" text="افتح كل جهة + تأكد إن كل المستندات جاهزة — الدليل يوريك كل المطلوب" />
          <Tip icon="📅" title="مواعيد تسليم" text="المواعيد النهائية للبنود — تقديم إقرارات، سداد اشتراكات، تجديد تراخيص" />
          <Tip icon="🔄" title="تحديث دوري" text="القوانين بتتغير. راجع حالة الامتثال كل شهر + تابع وزارة العمل والضرائب" />
        </div>
      </div>
    </main>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  const bg: Record<string, string> = { cyan: "from-cyan-50 to-white border-cyan-200", amber: "from-amber-50 to-white border-amber-200", violet: "from-violet-50 to-white border-violet-200", emerald: "from-emerald-50 to-white border-emerald-200" };
  const txt: Record<string, string> = { cyan: "text-cyan-700", amber: "text-amber-700", violet: "text-violet-700", emerald: "text-emerald-700" };
  return (
    <div className={`p-4 rounded-2xl bg-gradient-to-br ${bg[color] || bg.cyan} border shadow-sm`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        <span className={`text-[10px] font-bold uppercase font-cairo ${txt[color] || txt.cyan} tracking-wider`}>{label}</span>
      </div>
      <div className="text-2xl md:text-3xl font-black text-slate-800 font-cairo">{value}</div>
    </div>
  );
}

function Tip({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-start gap-2.5">
        <span className="text-xl shrink-0">{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-bold text-slate-800 font-cairo">{title}</div>
          <div className="text-[11px] text-slate-500 font-cairo leading-relaxed mt-0.5">{text}</div>
        </div>
      </div>
    </div>
  );
}
