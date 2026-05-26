// ============================================================================
// SmartInsights — proactive HR alerts on the main dashboard
// ============================================================================
//
// Runs ~7 parallel SQL queries against the tables HR cares about and
// surfaces the ones with at least one actionable row. Each card is a
// link straight into the relevant module so the HR can act in one tap.
//
// Why a server component (not server action)? The dashboard is already
// a server component with `dynamic = "force-dynamic"`, so refreshing
// the page refreshes the insights. No client state, no useEffect, no
// JS bundle cost. Pure SSR.
//
// All queries are scoped by company_id (parameter), with RLS as the
// secondary guard. The component renders NOTHING if every query is
// empty — keeps the dashboard clean for tenants with no data yet.

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type Props = {
  companyId: string;
};

type Insight = {
  /** Stable key for React. */
  id: string;
  /** Emoji shown left of the headline. */
  icon: string;
  /** Color palette — drives bg / border / text. */
  tone: "amber" | "rose" | "cyan" | "emerald" | "violet";
  /** Headline metric — usually a count. Rendered very large. */
  headline: string;
  /** One-line context. */
  subline: string;
  /** Up to 3 specific items to make it concrete (names, departments). */
  items?: string[];
  /** Click destination. */
  href: string;
  /** Optional CTA label override (default: "افتح →"). */
  cta?: string;
};

const TONES: Record<
  Insight["tone"],
  { bg: string; border: string; text: string; subtext: string; cta: string }
> = {
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-200 hover:border-amber-400",
    text: "text-amber-900",
    subtext: "text-amber-700",
    cta: "text-amber-700",
  },
  rose: {
    bg: "bg-rose-50",
    border: "border-rose-200 hover:border-rose-400",
    text: "text-rose-900",
    subtext: "text-rose-700",
    cta: "text-rose-700",
  },
  cyan: {
    bg: "bg-cyan-50",
    border: "border-cyan-200 hover:border-cyan-400",
    text: "text-cyan-900",
    subtext: "text-cyan-700",
    cta: "text-cyan-700",
  },
  emerald: {
    bg: "bg-emerald-50",
    border: "border-emerald-200 hover:border-emerald-400",
    text: "text-emerald-900",
    subtext: "text-emerald-700",
    cta: "text-emerald-700",
  },
  violet: {
    bg: "bg-violet-50",
    border: "border-violet-200 hover:border-violet-400",
    text: "text-violet-900",
    subtext: "text-violet-700",
    cta: "text-violet-700",
  },
};

/** ISO date for N days from today, in "YYYY-MM-DD" form. */
function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/** Format the day-of-year for hire_date / end_date comparisons (MM-DD). */
function monthDay(iso: string): string {
  return iso.slice(5, 10);
}

export async function SmartInsights({ companyId }: Props) {
  if (!companyId) return null;

  const supabase = await createClient();
  const todayIso = new Date().toISOString().split("T")[0];
  const monthAgoIso = addDaysISO(-30);
  const monthAheadIso = addDaysISO(30);

  // Fan out all queries in parallel — they're independent. Failure of
  // any one returns null and the card is silently dropped, so a
  // missing module / migration never breaks the dashboard.
  const [
    tardinessRes,
    contractsRes,
    pendingLeavesRes,
    newHiresRes,
    todayAttendanceRes,
    anniversariesRes,
    activeEmployeesRes,
  ] = await Promise.all([
    // 1) Tardiness offenders — employees late 3+ times this month
    supabase
      .from("attendance")
      .select("employee_id, employees!inner(full_name)")
      .eq("company_id", companyId)
      .eq("status", "present")
      .gt("tardiness_minutes", 0)
      .gte("date", monthAgoIso)
      .returns<
        Array<{ employee_id: string; employees: { full_name: string } | null }>
      >(),

    // 2) Contracts expiring in next 30 days
    supabase
      .from("contracts")
      .select("id, contract_number, service_type, end_date, customer_id, customers(name)")
      .eq("company_id", companyId)
      .eq("status", "active")
      .gte("end_date", todayIso)
      .lte("end_date", monthAheadIso)
      .order("end_date")
      .returns<
        Array<{
          id: string;
          contract_number: string | null;
          service_type: string | null;
          end_date: string;
          customer_id: string;
          customers: { name: string } | null;
        }>
      >(),

    // 3) Pending leave requests
    supabase
      .from("leave_requests")
      .select("id, employee_id, leave_type, days_count, employees!inner(full_name)")
      .eq("company_id", companyId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .returns<
        Array<{
          id: string;
          employee_id: string;
          leave_type: string;
          days_count: number;
          employees: { full_name: string } | null;
        }>
      >(),

    // 4) New hires in last 30 days — onboarding follow-up reminder
    supabase
      .from("employees")
      .select("id, full_name, hire_date, department")
      .eq("company_id", companyId)
      .eq("status", "active")
      .gte("hire_date", monthAgoIso)
      .order("hire_date", { ascending: false })
      .returns<
        Array<{
          id: string;
          full_name: string;
          hire_date: string;
          department: string | null;
        }>
      >(),

    // 5) Today's attendance — count rows already saved
    supabase
      .from("attendance")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("date", todayIso),

    // 6) Work anniversaries this month — milestones (1, 5, 10, 15, 20 yrs)
    supabase
      .from("employees")
      .select("id, full_name, hire_date, department")
      .eq("company_id", companyId)
      .eq("status", "active")
      .not("hire_date", "is", null)
      .returns<
        Array<{
          id: string;
          full_name: string;
          hire_date: string;
          department: string | null;
        }>
      >(),

    // 7) Active employee count — used as denominator for today's attendance card
    supabase
      .from("employees")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "active"),
  ]);

  const insights: Insight[] = [];

  // ── 1) Tardiness pattern detection ──
  if (tardinessRes.data && tardinessRes.data.length > 0) {
    const counts = new Map<string, { count: number; name: string }>();
    for (const r of tardinessRes.data) {
      const cur = counts.get(r.employee_id) ?? {
        count: 0,
        name: r.employees?.full_name ?? "—",
      };
      cur.count += 1;
      cur.name = r.employees?.full_name ?? cur.name;
      counts.set(r.employee_id, cur);
    }
    const offenders = Array.from(counts.values())
      .filter((c) => c.count >= 3)
      .sort((a, b) => b.count - a.count);

    if (offenders.length > 0) {
      insights.push({
        id: "tardiness",
        icon: "⏰",
        tone: "amber",
        headline: `${offenders.length} موظف`,
        subline: `اتأخروا 3 مرات أو أكتر خلال آخر 30 يوم`,
        items: offenders.slice(0, 3).map((o) => `${o.name} — ${o.count}×`),
        href: "/dashboard/attendance/logs",
        cta: "افتح سجلات الحضور →",
      });
    }
  }

  // ── 2) Contracts expiring soon ──
  if (contractsRes.data && contractsRes.data.length > 0) {
    insights.push({
      id: "contracts-expiring",
      icon: "📋",
      tone: "rose",
      headline: `${contractsRes.data.length} عقد`,
      subline: `هينتهي في آخر 30 يوم — جدّد قبل ميعاد الانتهاء`,
      items: contractsRes.data.slice(0, 3).map((c) => {
        const days = Math.ceil(
          (new Date(c.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        const name =
          c.customers?.name ?? c.contract_number ?? c.service_type ?? "عقد";
        return `${name} — خلال ${days} يوم`;
      }),
      href: "/dashboard/contracts",
      cta: "افتح العقود →",
    });
  }

  // ── 3) Pending leave requests ──
  if (pendingLeavesRes.data && pendingLeavesRes.data.length > 0) {
    const leaveLabels: Record<string, string> = {
      annual: "اعتيادية",
      casual: "عارضة",
      sick: "مرضية",
      unpaid: "بدون أجر",
      maternity: "وضع",
      hajj: "حج",
      bereavement: "وفاة",
      other: "أخرى",
    };
    insights.push({
      id: "pending-leaves",
      icon: "🏖",
      tone: "cyan",
      headline: `${pendingLeavesRes.data.length} طلب`,
      subline: `إجازات منتظرة موافقتك`,
      items: pendingLeavesRes.data.slice(0, 3).map(
        (l) =>
          `${l.employees?.full_name ?? "—"} — ${
            leaveLabels[l.leave_type] ?? l.leave_type
          } (${l.days_count} يوم)`,
      ),
      href: "/dashboard/leaves",
      cta: "راجع الطلبات →",
    });
  }

  // ── 4) New hires this month ──
  if (newHiresRes.data && newHiresRes.data.length > 0) {
    insights.push({
      id: "new-hires",
      icon: "🆕",
      tone: "emerald",
      headline: `${newHiresRes.data.length} موظف جديد`,
      subline: `انضموا في آخر 30 يوم — تأكد إن الـ onboarding خلصان`,
      items: newHiresRes.data
        .slice(0, 3)
        .map(
          (e) =>
            `${e.full_name}${
              e.department ? ` · ${e.department}` : ""
            }`,
        ),
      href: "/dashboard/employees?filter=recent",
      cta: "افتح الموظفين →",
    });
  }

  // ── 5) Today's attendance status ──
  const activeCount = activeEmployeesRes.count ?? 0;
  const markedToday = todayAttendanceRes.count ?? 0;
  if (activeCount > 0) {
    const unmarked = Math.max(0, activeCount - markedToday);
    if (unmarked > 0) {
      const percent = Math.round((markedToday / activeCount) * 100);
      insights.push({
        id: "today-attendance",
        icon: "✓",
        tone: "violet",
        headline: `${unmarked} موظف`,
        subline: `لسه ما اتسجّلش حضورهم النهارده (${percent}% مكتمل)`,
        href: "/dashboard/attendance",
        cta: "سجّل الحضور →",
      });
    }
  }

  // ── 6) Work anniversaries this month ──
  if (anniversariesRes.data && anniversariesRes.data.length > 0) {
    const now = new Date();
    const monthOnly = String(now.getMonth() + 1).padStart(2, "0");
    const milestones: Array<{ name: string; years: number }> = [];
    for (const e of anniversariesRes.data) {
      if (!e.hire_date) continue;
      // Same month-day window: hire-month matches current month.
      if (monthDay(e.hire_date).slice(0, 2) !== monthOnly) continue;
      const years =
        now.getFullYear() - new Date(e.hire_date + "T00:00:00").getFullYear();
      if (years >= 1 && (years === 1 || years % 5 === 0)) {
        milestones.push({ name: e.full_name, years });
      }
    }
    if (milestones.length > 0) {
      insights.push({
        id: "anniversaries",
        icon: "🎉",
        tone: "emerald",
        headline: `${milestones.length} ذكرى تعيين`,
        subline: `الشهر ده — وقت تهنّي + (مكافأة لو أمكن)`,
        items: milestones
          .slice(0, 3)
          .map((m) => `${m.name} — ${m.years} ${m.years === 1 ? "سنة" : "سنين"}`),
        href: "/dashboard/employees",
        cta: "افتح الموظفين →",
      });
    }
  }

  if (insights.length === 0) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-cairo">
          ✦ تنبيهات ذكية — اللي محتاج انتباهك
        </h2>
        <span className="text-[10px] text-slate-400 font-cairo">
          {insights.length} تنبيه نشط
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights.map((ins) => {
          const palette = TONES[ins.tone];
          return (
            <Link
              key={ins.id}
              href={ins.href}
              className={`block rounded-2xl border-2 p-4 transition hover:-translate-y-0.5 hover:shadow-md ${palette.bg} ${palette.border}`}
            >
              <div className="flex items-start gap-3 mb-2">
                <span className="text-2xl flex-shrink-0">{ins.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={`text-xl font-black font-cairo ${palette.text}`}>
                    {ins.headline}
                  </div>
                  <div className={`text-xs font-cairo leading-relaxed ${palette.subtext}`}>
                    {ins.subline}
                  </div>
                </div>
              </div>
              {ins.items && ins.items.length > 0 && (
                <ul className="text-[11px] space-y-1 mb-2 font-cairo">
                  {ins.items.map((item, i) => (
                    <li
                      key={i}
                      className={`flex items-start gap-1.5 ${palette.subtext}`}
                    >
                      <span className="opacity-60">•</span>
                      <span className="flex-1">{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div
                className={`text-[11px] font-bold font-cairo ${palette.cta}`}
              >
                {ins.cta ?? "افتح →"}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
