// ============================================================================
// /dashboard/retention — Employee Retention Insights hub
// ============================================================================
//
// Shows up to four groups of insight cards:
//   1) 💸 زيادات مقترحة (raise)
//   2) 🎁 مكافآت مقترحة (bonus)
//   3) ⚠ إنذار مغادرة (flight_risk)
//   4) 🎉 ذكرى تعيين قادمة (anniversary)
//
// Each card has reasoning + actions (approve / dismiss). For raise,
// "approve" actually updates the salary. For bonus, it deep-links to
// the employee's profile so HR can add the bonus to the next payroll.
//
// The page is feature-gated to subscriptions that include retention_insights
// (Basic+ in our matrix — small businesses benefit too).

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireHRPage } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";
import {
  generateRetentionInsights,
  actionRetentionInsight,
  dismissRetentionInsight,
} from "./actions";

type SearchParams = {
  generated?: string;
  actioned?: string;
  dismissed?: string;
  error?: string;
};

type InsightRow = {
  id: string;
  employee_id: string;
  insight_type: "raise" | "bonus" | "flight_risk" | "anniversary";
  score: number;
  reasoning: string;
  suggested_amount: number | null;
  metadata: Record<string, unknown> | null;
  status: string;
  created_at: string;
  employees: {
    full_name: string;
    job_title: string | null;
    department: string | null;
    employee_code: string | null;
  } | null;
};

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { profile } = await requireHRPage();
  const params = await searchParams;

  // Feature gate: retention_insights is Basic+
  if (!(await canUseFeature("retention_insights"))) {
    return <UpgradeRequired feature="retention_insights" />;
  }

  const supabase = await createClient();

  const { data: insights } = await supabase
    .from("employee_retention_insights")
    .select(
      "id, employee_id, insight_type, score, reasoning, suggested_amount, metadata, status, created_at, employees(full_name, job_title, department, employee_code)",
    )
    .eq("company_id", profile.company_id)
    .eq("status", "pending")
    .order("score", { ascending: false })
    .returns<InsightRow[]>();

  const all = insights ?? [];
  const raises = all.filter((i) => i.insight_type === "raise");
  const bonuses = all.filter((i) => i.insight_type === "bonus");
  const risks = all.filter((i) => i.insight_type === "flight_risk");
  const anniversaries = all.filter((i) => i.insight_type === "anniversary");

  const generatedCount = params.generated
    ? parseInt(params.generated, 10)
    : null;

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

        <header className="mb-5 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-rose-50 via-amber-50 to-emerald-50 border border-amber-200 text-amber-800 text-xs font-bold mb-2 font-cairo">
              ✦ احتفاظ بالموظفين
            </div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              توصيات الاحتفاظ بالموظفين
            </h1>
            <p className="text-sm text-slate-500 font-cairo leading-relaxed max-w-2xl">
              النظام بيراقب فريقك بشكل مستمر وبيقترح متى تزود راتب موظف،
              تصرف مكافأة لشاطر، أو تتدخل قبل ما حد يستقيل. الهدف: تقليل
              دوران العمالة وبناء ولاء حقيقي.
            </p>
          </div>

          <form action={generateRetentionInsights}>
            <button
              type="submit"
              className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-bold font-cairo hover:shadow-lg transition shadow-md whitespace-nowrap"
            >
              🔄 حدّث التوصيات
            </button>
          </form>
        </header>

        {/* Status messages */}
        {params.error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {params.error}
          </div>
        )}
        {generatedCount !== null && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-cairo">
            ✅ تم توليد {generatedCount} توصية جديدة
            {generatedCount === 0 ? " — مفيش حاجة محتاجة تدخل دلوقتي 👍" : ""}
          </div>
        )}
        {params.actioned && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-cairo">
            ✅ تم تطبيق التوصية
          </div>
        )}
        {params.dismissed && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-sm font-cairo">
            تم تجاهل التوصية
          </div>
        )}

        {/* Empty state */}
        {all.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-10 text-center">
            <div className="text-5xl mb-3">📊</div>
            <h2 className="text-xl font-black font-cairo text-slate-800 mb-2">
              مفيش توصيات حالياً
            </h2>
            <p className="text-sm text-slate-500 font-cairo max-w-md mx-auto leading-relaxed">
              اضغط <strong>&quot;حدّث التوصيات&quot;</strong> فوق علشان النظام يفحص
              فريقك ويقترح المراجعات اللازمة. هتظهر هنا توصيات الزيادات،
              المكافآت، وإنذارات المغادرة لو في.
            </p>
          </div>
        )}

        {/* Summary chips */}
        {all.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <SummaryChip
              label="زيادات مقترحة"
              count={raises.length}
              icon="💸"
              color="emerald"
            />
            <SummaryChip
              label="مكافآت مقترحة"
              count={bonuses.length}
              icon="🎁"
              color="cyan"
            />
            <SummaryChip
              label="إنذار مغادرة"
              count={risks.length}
              icon="⚠"
              color="rose"
            />
            <SummaryChip
              label="ذكرى تعيين"
              count={anniversaries.length}
              icon="🎉"
              color="amber"
            />
          </div>
        )}

        {/* Raises */}
        {raises.length > 0 && (
          <Section
            title="زيادات مقترحة"
            icon="💸"
            description="موظفين أثبتوا التزامهم وحان وقت مراجعة راتبهم"
            color="emerald"
          >
            <div className="space-y-3">
              {raises.map((i) => (
                <InsightCard
                  key={i.id}
                  insight={i}
                  primaryActionLabel="✓ وافق ومرر الراتب"
                  primaryAction={actionRetentionInsight}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Bonuses */}
        {bonuses.length > 0 && (
          <Section
            title="مكافآت مقترحة"
            icon="🎁"
            description="أداء استثنائي يستحق مكافأة لمرة واحدة"
            color="cyan"
          >
            <div className="space-y-3">
              {bonuses.map((i) => (
                <InsightCard
                  key={i.id}
                  insight={i}
                  primaryActionLabel="✓ موافق — أضف في كشف الراتب"
                  primaryAction={actionRetentionInsight}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Flight risks */}
        {risks.length > 0 && (
          <Section
            title="إنذار مغادرة"
            icon="⚠"
            description="موظفين بيظهروا إشارات تنبيه — اتصرف قبل ما يستقيل"
            color="rose"
          >
            <div className="space-y-3">
              {risks.map((i) => (
                <InsightCard
                  key={i.id}
                  insight={i}
                  primaryActionLabel="✓ هتعمل ١:١ معاه"
                  primaryAction={actionRetentionInsight}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Anniversaries */}
        {anniversaries.length > 0 && (
          <Section
            title="ذكريات تعيين قادمة"
            icon="🎉"
            description="فرصة لإيماءة بسيطة تبني الولاء"
            color="amber"
          >
            <div className="space-y-3">
              {anniversaries.map((i) => (
                <InsightCard
                  key={i.id}
                  insight={i}
                  primaryActionLabel="✓ سجل أنك هنّيته"
                  primaryAction={actionRetentionInsight}
                />
              ))}
            </div>
          </Section>
        )}
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Section
// ----------------------------------------------------------------------------
function Section({
  title,
  icon,
  description,
  color,
  children,
}: {
  title: string;
  icon: string;
  description: string;
  color: "emerald" | "cyan" | "rose" | "amber";
  children: React.ReactNode;
}) {
  const headBg: Record<typeof color, string> = {
    emerald: "from-emerald-50 to-white border-emerald-200",
    cyan: "from-cyan-50 to-white border-cyan-200",
    rose: "from-rose-50 to-white border-rose-200",
    amber: "from-amber-50 to-white border-amber-200",
  };
  return (
    <section className="mb-6">
      <div
        className={`p-4 rounded-2xl bg-gradient-to-l ${headBg[color]} border mb-3`}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <h2 className="text-lg font-black font-cairo text-slate-800">
            {title}
          </h2>
        </div>
        <p className="text-xs text-slate-600 mt-1 font-cairo">{description}</p>
      </div>
      {children}
    </section>
  );
}

// ----------------------------------------------------------------------------
// InsightCard
// ----------------------------------------------------------------------------
function InsightCard({
  insight,
  primaryActionLabel,
  primaryAction,
}: {
  insight: InsightRow;
  primaryActionLabel: string;
  primaryAction: (formData: FormData) => Promise<void> | void;
}) {
  const reasoningLines = insight.reasoning.split("\n").filter(Boolean);
  const scoreColor =
    insight.score >= 85
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : insight.score >= 70
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-slate-600 bg-slate-50 border-slate-200";

  const isRisk = insight.insight_type === "flight_risk";

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border ${isRisk ? "border-rose-200" : "border-slate-100"} p-4 md:p-5`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-black font-cairo text-slate-800">
              {insight.employees?.full_name ?? "—"}
            </h3>
            {insight.employees?.employee_code && (
              <span
                className="text-[10px] text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded"
                dir="ltr"
              >
                #{insight.employees.employee_code}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 font-cairo mt-0.5">
            {insight.employees?.job_title ?? "—"}
            {insight.employees?.department
              ? ` · ${insight.employees.department}`
              : ""}
          </div>
        </div>

        <div
          className={`shrink-0 flex flex-col items-center justify-center px-3 py-1.5 rounded-lg border-2 ${scoreColor}`}
        >
          <div className="text-[10px] font-cairo tracking-wider">النتيجة</div>
          <div className="text-base font-black font-mono">
            {Math.round(insight.score)}
          </div>
        </div>
      </div>

      {/* Reasoning */}
      <ul className="space-y-1 mb-4">
        {reasoningLines.map((line, i) => (
          <li
            key={i}
            className="text-sm text-slate-700 font-cairo leading-relaxed flex gap-2"
          >
            <span className="text-slate-400">•</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {/* Suggested amount highlight */}
      {insight.suggested_amount ? <SuggestedAmount insight={insight} /> : null}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <form action={primaryAction}>
          <input type="hidden" name="insight_id" value={insight.id} />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-bold text-xs font-cairo transition"
          >
            {primaryActionLabel}
          </button>
        </form>

        <form action={dismissRetentionInsight}>
          <input type="hidden" name="insight_id" value={insight.id} />
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs font-cairo transition"
          >
            ✗ تجاهل
          </button>
        </form>

        <Link
          href={`/dashboard/employees/${insight.employee_id}`}
          className="px-3 py-2 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 font-bold text-xs font-cairo transition"
        >
          👤 ملف الموظف
        </Link>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// SuggestedAmount — extracted out of InsightCard so the JSX expression
// chain stays inside a clean component (avoids the ReactNode | unknown
// narrowing issue from chained && on metadata).
// ----------------------------------------------------------------------------
function SuggestedAmount({ insight }: { insight: InsightRow }) {
  if (!insight.suggested_amount) return null;
  const newSalaryRaw = insight.metadata?.newSalary;
  const newSalary =
    typeof newSalaryRaw === "number" ? newSalaryRaw : null;

  return (
    <div
      className={`mb-4 p-3 rounded-xl text-sm font-cairo ${
        insight.insight_type === "raise"
          ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
          : "bg-cyan-50 border border-cyan-200 text-cyan-800"
      }`}
    >
      <span className="font-bold">
        {insight.insight_type === "raise"
          ? "اقتراح الزيادة الشهرية:"
          : "اقتراح المكافأة:"}{" "}
      </span>
      <span className="font-black" dir="ltr">
        {Math.round(insight.suggested_amount).toLocaleString("ar-EG")} ج
      </span>
      {insight.insight_type === "raise" && newSalary !== null ? (
        <span className="text-xs text-emerald-700 mr-2">
          (راتب جديد:{" "}
          <span dir="ltr">
            {Math.round(newSalary).toLocaleString("ar-EG")} ج
          </span>
          )
        </span>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------------
// SummaryChip
// ----------------------------------------------------------------------------
function SummaryChip({
  label,
  count,
  icon,
  color,
}: {
  label: string;
  count: number;
  icon: string;
  color: "emerald" | "cyan" | "rose" | "amber";
}) {
  const bg: Record<typeof color, string> = {
    emerald: "from-emerald-50 to-emerald-100/50 border-emerald-200",
    cyan: "from-cyan-50 to-cyan-100/50 border-cyan-200",
    rose: "from-rose-50 to-rose-100/50 border-rose-200",
    amber: "from-amber-50 to-amber-100/50 border-amber-200",
  };
  const txt: Record<typeof color, string> = {
    emerald: "text-emerald-700",
    cyan: "text-cyan-700",
    rose: "text-rose-700",
    amber: "text-amber-700",
  };
  return (
    <div
      className={`p-3 rounded-2xl bg-gradient-to-br ${bg[color]} border text-center`}
    >
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-black ${txt[color]}`}>{count}</div>
      <div className="text-[11px] text-slate-600 font-cairo">{label}</div>
    </div>
  );
}

