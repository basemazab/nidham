import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { UpgradeRequired } from "@/components/upgrade-required";

type SearchParams = Promise<{ year?: string; month?: string }>;

type Employee = { id: string; full_name: string; job_title: string | null };
type AttendanceRow = { employee_id: string; status: string };
type InteractionRow = {
  employee_id: string;
  customer_id: string;
  outcome: "positive" | "neutral" | "negative";
};

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function lastDayOfMonth(year: number, month: number): string {
  return new Date(year, month, 0).toISOString().split("T")[0];
}

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

export default async function BridgeReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Bridge Analytics is the Enterprise-tier flagship: it cross-joins
  // HR + CRM data, which only customers running both modules at scale
  // benefit from. Trial sees it; basic/pro hit the upgrade screen.
  if (!(await canUseFeature("bridge_analytics"))) {
    return <UpgradeRequired feature="bridge_analytics" />;
  }

  const now = new Date();
  const params = await searchParams;
  const year = parseInt(params.year ?? String(now.getFullYear()), 10);
  const month = parseInt(params.month ?? String(now.getMonth() + 1), 10);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = lastDayOfMonth(year, month);

  // Scope every tenant-scoped query to the caller's company —
  // otherwise mig 038 lets super-admin sessions read cross-tenant rows
  // and pollutes the Bridge report.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const [employeesRes, attendanceRes, interactionsRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, job_title")
      .eq("company_id", callerCompanyId)
      .eq("status", "active")
      .order("full_name")
      .returns<Employee[]>(),
    supabase
      .from("attendance")
      .select("employee_id, status")
      .eq("company_id", callerCompanyId)
      .gte("date", startDate)
      .lte("date", endDate)
      .returns<AttendanceRow[]>(),
    supabase
      .from("interactions")
      .select("employee_id, customer_id, outcome")
      .eq("company_id", callerCompanyId)
      .gte("date", startDate)
      .lte("date", endDate)
      .returns<InteractionRow[]>(),
  ]);

  const employees = employeesRes.data ?? [];
  const attendance = attendanceRes.data ?? [];
  const interactions = interactionsRes.data ?? [];

  // Compute Bridge metrics per employee
  const stats = employees.map((emp) => {
    const empAttendance = attendance.filter((a) => a.employee_id === emp.id);
    const empInteractions = interactions.filter((i) => i.employee_id === emp.id);

    const present = empAttendance.filter((a) => a.status === "present").length;
    const halfDay = empAttendance.filter((a) => a.status === "half_day").length;
    const totalAttendance = empAttendance.length;
    const attendanceRate =
      totalAttendance === 0
        ? 0
        : ((present + halfDay * 0.5) / totalAttendance) * 100;

    const positive = empInteractions.filter((i) => i.outcome === "positive").length;
    const negative = empInteractions.filter((i) => i.outcome === "negative").length;
    const neutral = empInteractions.filter((i) => i.outcome === "neutral").length;
    const totalInteractions = empInteractions.length;
    const positiveRate =
      totalInteractions === 0 ? 0 : (positive / totalInteractions) * 100;
    const distinctCustomers = new Set(empInteractions.map((i) => i.customer_id)).size;

    let bridgeScore = 0;
    let bridgeStatus: "complete" | "hr-only" | "crm-only" | "empty" = "empty";
    if (totalAttendance > 0 && totalInteractions > 0) {
      bridgeScore = attendanceRate * 0.4 + positiveRate * 0.6;
      bridgeStatus = "complete";
    } else if (totalAttendance > 0) {
      bridgeScore = attendanceRate;
      bridgeStatus = "hr-only";
    } else if (totalInteractions > 0) {
      bridgeScore = positiveRate;
      bridgeStatus = "crm-only";
    }

    // The killer flag: high attendance, weak customer outcomes
    const isComplianceOnly =
      attendanceRate >= 80 && totalInteractions >= 3 && positiveRate < 50;

    // Bridge "star": high attendance + high customer wins
    const isStar =
      attendanceRate >= 80 && totalInteractions >= 3 && positiveRate >= 70;

    return {
      employee: emp,
      attendanceRate: Math.round(attendanceRate),
      totalAttendance,
      present,
      halfDay,
      totalInteractions,
      positive,
      negative,
      neutral,
      positiveRate: Math.round(positiveRate),
      distinctCustomers,
      bridgeScore: Math.round(bridgeScore),
      bridgeStatus,
      isComplianceOnly,
      isStar,
    };
  });

  stats.sort((a, b) => b.bridgeScore - a.bridgeScore);

  const complianceOnly = stats.filter((s) => s.isComplianceOnly);
  const stars = stats.filter((s) => s.isStar);
  const topPerformer = stats[0];
  const totalInteractionsCount = interactions.length;
  const totalPositive = interactions.filter((i) => i.outcome === "positive").length;
  const totalNegative = interactions.filter((i) => i.outcome === "negative").length;

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-8">
          <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-amber-50 to-cyan-50 border border-amber-200 text-amber-700 text-xs font-bold mb-2 font-cairo">
            ✦ Bridge Analytics
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            تقرير Bridge — ربط HR بـ CRM
          </h1>
          <p className="text-sm text-slate-500">
            {ARABIC_MONTHS[month - 1]} {year} · بيجاوبك على السؤال: <strong className="text-slate-700">"مين ملتزم إداريًا وكمان منتج فعليًا؟"</strong>
          </p>
        </header>

        {/* Month/Year selector */}
        <form
          method="get"
          className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 grid grid-cols-3 gap-3 items-end"
        >
          <div>
            <label htmlFor="month" className="block text-xs font-medium text-slate-600 mb-1 font-cairo">الشهر</label>
            <select id="month" name="month" defaultValue={month} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo">
              {ARABIC_MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="year" className="block text-xs font-medium text-slate-600 mb-1 font-cairo">السنة</label>
            <select id="year" name="year" defaultValue={year} className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo">
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button type="submit" className="px-5 py-2 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold text-sm font-cairo transition">تحديث</button>
        </form>

        {/* Top stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
            <div className="text-xs text-slate-500 mb-1 font-cairo">إجمالي التفاعلات</div>
            <div className="text-3xl font-black text-slate-800">{totalInteractionsCount}</div>
          </div>
          <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200">
            <div className="text-xs text-emerald-700 mb-1 font-cairo">نتايج إيجابية</div>
            <div className="text-3xl font-black text-emerald-700">{totalPositive}</div>
          </div>
          <div className="bg-red-50 p-5 rounded-xl border border-red-200">
            <div className="text-xs text-red-700 mb-1 font-cairo">نتايج سلبية</div>
            <div className="text-3xl font-black text-red-700">{totalNegative}</div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-cyan-50 p-5 rounded-xl border-2 border-amber-300">
            <div className="text-xs text-amber-700 mb-1 font-cairo">⭐ نجوم Bridge</div>
            <div className="text-3xl font-black text-amber-700">{stars.length}</div>
          </div>
        </div>

        {/* THE KILLER INSIGHT — compliance-only employees */}
        {complianceOnly.length > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-amber-50 border-2 border-red-300 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">⚠️</div>
              <div className="flex-1">
                <h2 className="text-lg font-black font-cairo text-red-800 mb-1">
                  انتباه: ملتزم إداريًا — مش منتج فعليًا
                </h2>
                <p className="text-sm text-red-700 mb-3 font-cairo">
                  الموظفين دول حضورهم 80%+، بس نتايج تفاعلاتهم مع العملاء أقل من 50%. ده اللي مفيش نظام HR لوحده ولا CRM لوحده يكشفه ليك.
                </p>
                <div className="flex flex-wrap gap-2">
                  {complianceOnly.map((s) => (
                    <div key={s.employee.id} className="bg-white px-3 py-2 rounded-lg border border-red-200">
                      <span className="font-bold text-slate-800 font-cairo">{s.employee.full_name}</span>
                      <span className="text-xs text-slate-500 mx-2">·</span>
                      <span className="text-xs text-emerald-600 font-mono">حضور {s.attendanceRate}%</span>
                      <span className="text-xs text-slate-400 mx-1">vs</span>
                      <span className="text-xs text-red-600 font-mono">إيجابي {s.positiveRate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Star performer */}
        {topPerformer && topPerformer.bridgeStatus === "complete" && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-5 mb-6 flex items-center gap-4">
            <div className="text-5xl">🏆</div>
            <div className="flex-1">
              <div className="text-xs text-amber-700 font-bold mb-1 font-cairo">⭐ Bridge Star — الأعلى تقييمًا</div>
              <div className="text-xl font-black text-slate-800 font-cairo">
                {topPerformer.employee.full_name}
              </div>
              <div className="text-sm text-slate-600 font-cairo">
                Bridge Score: <strong>{topPerformer.bridgeScore}%</strong> ·
                حضور {topPerformer.attendanceRate}% ·
                {topPerformer.positive} نتيجة إيجابية مع {topPerformer.distinctCustomers} عميل
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {stats.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">✦</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">مفيش موظفين</h2>
            <p className="text-slate-500 mb-6">ضيف موظفين الأول</p>
            <Link href="/dashboard/employees/new" className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo">
              ضيف موظف
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
              <h2 className="text-sm font-bold font-cairo text-slate-700">
                Bridge Score لكل موظف (الأعلى أولاً)
              </h2>
            </div>
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الموظف</th>
                  <th className="px-4 py-3 text-xs font-bold text-emerald-700 uppercase tracking-wider font-cairo whitespace-nowrap" title="HR side">📋 حضور</th>
                  <th className="px-4 py-3 text-xs font-bold text-cyan-700 uppercase tracking-wider font-cairo whitespace-nowrap" title="CRM side">💬 تفاعلات</th>
                  <th className="px-4 py-3 text-xs font-bold text-emerald-700 uppercase tracking-wider font-cairo">✓ إيجابي</th>
                  <th className="px-4 py-3 text-xs font-bold text-red-700 uppercase tracking-wider font-cairo">✗ سلبي</th>
                  <th className="px-4 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider font-cairo">🤝 عملاء</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider font-cairo min-w-[200px]">
                    <span className="bg-gradient-to-r from-amber-600 to-cyan-700 bg-clip-text text-transparent">✦ Bridge Score</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.map((s) => (
                  <tr key={s.employee.id} className={`hover:bg-slate-50/50 ${s.isComplianceOnly ? "bg-red-50/30" : ""} ${s.isStar ? "bg-amber-50/30" : ""}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center text-white font-bold text-sm">
                          {s.employee.full_name[0]}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800 font-cairo flex items-center gap-2">
                            {s.employee.full_name}
                            {s.isStar && <span title="Bridge Star">⭐</span>}
                            {s.isComplianceOnly && <span title="ملتزم إداريًا فقط">⚠</span>}
                          </div>
                          {s.employee.job_title && (
                            <div className="text-xs text-slate-500">{s.employee.job_title}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-emerald-700">{s.attendanceRate}%</div>
                      <div className="text-xs text-slate-500">{s.present} يوم</div>
                    </td>
                    <td className="px-4 py-3 font-bold text-cyan-700">{s.totalInteractions}</td>
                    <td className="px-4 py-3 font-bold text-emerald-700">{s.positive}</td>
                    <td className="px-4 py-3 font-bold text-red-700">{s.negative}</td>
                    <td className="px-4 py-3 font-bold text-amber-700">{s.distinctCustomers}</td>
                    <td className="px-4 py-3">
                      {s.bridgeStatus === "empty" ? (
                        <span className="text-xs text-slate-400 font-cairo">مفيش بيانات</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                s.bridgeStatus === "complete"
                                  ? "bg-gradient-to-r from-amber-500 to-cyan-600"
                                  : s.bridgeStatus === "hr-only"
                                  ? "bg-emerald-400"
                                  : "bg-cyan-400"
                              }`}
                              style={{ width: `${s.bridgeScore}%` }}
                            />
                          </div>
                          <span className="text-sm font-black text-slate-800 min-w-[42px] text-left">{s.bridgeScore}%</span>
                        </div>
                      )}
                      {s.bridgeStatus === "hr-only" && (
                        <div className="text-[10px] text-slate-400 mt-1">HR فقط — مفيش تفاعلات</div>
                      )}
                      {s.bridgeStatus === "crm-only" && (
                        <div className="text-[10px] text-slate-400 mt-1">CRM فقط — مفيش حضور</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-6 font-cairo">
          ✦ Bridge Score = (حضور × 40%) + (نتايج إيجابية × 60%) · النظام الوحيد في السوق المصري بيحسبها
        </p>
      </div>
    </main>
  );
}
