// ============================================================================
// EmployeesAnalytics — server component, computed from the row list
// ============================================================================
//
// Renders the analytics band at the top of /dashboard/employees:
//   1) 4 KPI cards (active count, monthly payroll cost, avg salary,
//      number of departments)
//   2) Top 5 earners + Lowest 5 earners with CSS bar visualisations
//   3) Department distribution (count + total payroll per dept)
//   4) Hiring timeline (count of employees by hire year)
//
// All math is pure: takes the array of EmployeeRow and computes once
// at render. No state, no client JS — keeps the bundle light and
// the analytics SEO-readable (good for screenshots/reports).
//
// Privacy: salaries shown only to HR who already reached this page
// (page-level requireHR enforces it). For multi-tenant SaaS where
// managers shouldn't see other managers' comp, we'd gate this further
// — out of scope for V1 (the owner is HR in Egyptian SMBs).

import { formatEGP, formatNumber } from "@/lib/format";
import type { EmployeeRow } from "./employees-explorer";

const NO_DEPT_LABEL = "بدون قسم";

type DeptRollup = {
  name: string;
  count: number;
  totalPayroll: number;
};

type HireYearRollup = { year: number; count: number };

function totalComp(e: EmployeeRow): number {
  return (
    (e.basic_salary ?? 0) +
    (e.housing_allowance ?? 0) +
    (e.transport_allowance ?? 0) +
    (e.other_allowances ?? 0) +
    (e.incentive_allowance ?? 0)
  );
}

export function EmployeesAnalytics({
  employees,
}: {
  employees: EmployeeRow[];
}) {
  const active = employees.filter((e) => e.status === "active");
  const monthlyActive = active.filter(
    (e) => (e.pay_frequency ?? "monthly") === "monthly",
  );
  const weeklyActive = active.filter((e) => e.pay_frequency === "weekly");

  // Monthly payroll cost = sum of total comp for the monthly cohort.
  // The weekly cohort is reported in its own KPI below, so we don't
  // mix the two anymore (mixing made the "monthly" total feel
  // fictional — operators kept asking "what's the weekly figure?").
  const monthlyPayroll = monthlyActive.reduce(
    (s, e) => s + totalComp(e),
    0,
  );

  // Weekly payroll cost = sum of total comp for the weekly cohort per
  // pay cycle (i.e., what goes out THIS week, not the monthly
  // equivalent). The user asked for this as a separate KPI.
  const weeklyPayroll = weeklyActive.reduce(
    (s, e) => s + totalComp(e),
    0,
  );

  const avgSalary =
    active.length === 0
      ? 0
      : active.reduce((s, e) => s + totalComp(e), 0) / active.length;

  // ----- Top + Bottom earners (only employees with basic_salary > 0) -----
  const withSalary = active.filter((e) => (e.basic_salary ?? 0) > 0);
  const sortedDesc = [...withSalary].sort((a, b) => totalComp(b) - totalComp(a));
  const topEarners = sortedDesc.slice(0, 5);
  const bottomEarners = sortedDesc.slice(-5).reverse(); // 5 lowest, sorted asc
  const maxComp = topEarners[0] ? totalComp(topEarners[0]) : 1;

  // ----- Department rollup -----
  const deptMap = new Map<string, DeptRollup>();
  for (const e of active) {
    const name = (e.department && e.department.trim()) || NO_DEPT_LABEL;
    if (!deptMap.has(name)) {
      deptMap.set(name, { name, count: 0, totalPayroll: 0 });
    }
    const d = deptMap.get(name)!;
    d.count += 1;
    d.totalPayroll += totalComp(e);
  }
  const departments = Array.from(deptMap.values()).sort(
    (a, b) => b.count - a.count,
  );
  const deptCountForKPI = departments.filter(
    (d) => d.name !== NO_DEPT_LABEL,
  ).length;
  const maxDeptPayroll =
    departments[0]?.totalPayroll ?? 1;

  // ----- Hiring timeline (last 5 years) -----
  const hireMap = new Map<number, number>();
  for (const e of employees) {
    if (!e.hire_date) continue;
    const yr = parseInt(e.hire_date.slice(0, 4), 10);
    if (!Number.isFinite(yr)) continue;
    hireMap.set(yr, (hireMap.get(yr) ?? 0) + 1);
  }
  const allYears: HireYearRollup[] = Array.from(hireMap.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);
  const recentYears = allYears.slice(-5);
  const maxYearCount = recentYears.reduce(
    (m, r) => Math.max(m, r.count),
    1,
  );

  return (
    <section className="mb-6 space-y-4">
      {/* ===== KPI Cards ===== */}
      {/* 5-card KPI strip: 2 columns on mobile, 3 on tablet, 5 on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard
          icon="👥"
          label="موظفين نشطين"
          value={formatNumber(active.length)}
          subtext={`${monthlyActive.length} شهري · ${weeklyActive.length} أسبوعي`}
          color="cyan"
        />
        <KpiCard
          icon="💰"
          label="إجمالي الرواتب الشهري"
          value={formatEGP(Math.round(monthlyPayroll))}
          subtext={
            monthlyActive.length === 0
              ? "مفيش موظفين شهريين"
              : `${monthlyActive.length} موظف · يشمل البدلات`
          }
          color="emerald"
        />
        <KpiCard
          icon="📆"
          label="إجمالي الرواتب الأسبوعي"
          value={formatEGP(Math.round(weeklyPayroll))}
          subtext={
            weeklyActive.length === 0
              ? "مفيش موظفين أسبوعيين"
              : `${weeklyActive.length} موظف · لكل دورة صرف`
          }
          color="sky"
        />
        <KpiCard
          icon="📊"
          label="متوسط الراتب"
          value={formatEGP(Math.round(avgSalary))}
          subtext="على الموظفين النشطين"
          color="amber"
        />
        <KpiCard
          icon="🏢"
          label="عدد الأقسام"
          value={formatNumber(deptCountForKPI)}
          subtext={
            departments.find((d) => d.name === NO_DEPT_LABEL)
              ? `+${departments.find((d) => d.name === NO_DEPT_LABEL)?.count} بدون قسم`
              : "كل موظف عنده قسم 👍"
          }
          color="violet"
        />
      </div>

      {/* ===== Top + Bottom earners ===== */}
      {withSalary.length > 0 && (
        <div className="grid md:grid-cols-2 gap-4">
          <EarnerCard
            title="أعلى ٥ في الأجور"
            subtitle="بناءً على إجمالي الراتب الأساسي + البدلات"
            icon="🏆"
            tone="emerald"
            employees={topEarners}
            maxComp={maxComp}
            barDirection="desc"
          />
          <EarnerCard
            title="أقل ٥ في الأجور"
            subtitle="مرشحين محتملين لمراجعة الراتب"
            icon="📉"
            tone="amber"
            employees={bottomEarners}
            maxComp={maxComp}
            barDirection="asc"
          />
        </div>
      )}

      {/* ===== Department distribution ===== */}
      {departments.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏢</span>
              <h2 className="text-base font-black font-cairo text-slate-800">
                توزيع الأقسام
              </h2>
            </div>
            <span className="text-[11px] text-slate-500 font-cairo">
              مرتبة حسب عدد الموظفين
            </span>
          </div>
          <div className="space-y-2">
            {departments.map((d, idx) => {
              const pct = (d.totalPayroll / maxDeptPayroll) * 100;
              return (
                <div
                  key={d.name}
                  className="flex items-center gap-3 py-1.5 border-b last:border-0 border-slate-100"
                >
                  {/* Color swatch — cyles through 6 hues so visualizers
                      stay distinguishable even when there are many depts */}
                  <span
                    className={`w-2 h-8 rounded-full flex-shrink-0 ${deptHueClass(idx)}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-sm font-bold font-cairo text-slate-800 truncate">
                        {d.name}
                      </div>
                      <div className="text-xs text-slate-500 font-cairo whitespace-nowrap">
                        <span className="font-bold text-slate-700">
                          {d.count}
                        </span>{" "}
                        موظف ·{" "}
                        <span className="font-bold text-emerald-700">
                          {formatEGP(Math.round(d.totalPayroll))}
                        </span>
                      </div>
                    </div>
                    {/* Bar */}
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${deptBarClass(idx)} rounded-full transition-all`}
                        style={{ width: `${Math.max(4, pct)}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Hiring timeline ===== */}
      {recentYears.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">📅</span>
              <h2 className="text-base font-black font-cairo text-slate-800">
                توقيت التعيينات
              </h2>
            </div>
            <span className="text-[11px] text-slate-500 font-cairo">
              عدد الموظفين بحسب سنة التعيين
            </span>
          </div>
          {/* Bars as vertical columns */}
          <div className="flex items-end gap-3 h-32">
            {recentYears.map((r) => {
              const heightPct = (r.count / maxYearCount) * 100;
              return (
                <div
                  key={r.year}
                  className="flex-1 flex flex-col items-center justify-end gap-1.5"
                >
                  <div className="text-xs font-bold text-slate-700 font-mono">
                    {r.count}
                  </div>
                  <div
                    className="w-full bg-gradient-to-t from-brand-cyan-dark to-brand-cyan rounded-t-lg transition-all min-h-[8px]"
                    style={{ height: `${Math.max(8, heightPct)}%` }}
                  />
                  <div
                    className="text-[10px] text-slate-500 font-cairo"
                    dir="ltr"
                  >
                    {r.year}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

// ----------------------------------------------------------------------------
// KpiCard
// ----------------------------------------------------------------------------
function KpiCard({
  icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  subtext: string;
  color: "cyan" | "emerald" | "amber" | "violet" | "sky";
}) {
  const bgs: Record<typeof color, string> = {
    cyan: "from-cyan-50 to-white border-cyan-200",
    emerald: "from-emerald-50 to-white border-emerald-200",
    amber: "from-amber-50 to-white border-amber-200",
    violet: "from-violet-50 to-white border-violet-200",
    sky: "from-sky-50 to-white border-sky-200",
  };
  const txts: Record<typeof color, string> = {
    cyan: "text-cyan-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    violet: "text-violet-700",
    sky: "text-sky-700",
  };
  return (
    <div
      className={`bg-gradient-to-br ${bgs[color]} rounded-2xl border p-4 shadow-sm`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
        <span
          className={`text-[10px] tracking-[0.2em] font-bold uppercase font-cairo ${txts[color]}`}
        >
          {label}
        </span>
      </div>
      <div className="text-2xl md:text-3xl font-black text-slate-800 font-cairo leading-tight">
        {value}
      </div>
      <div className="text-[11px] text-slate-500 font-cairo mt-1 truncate">
        {subtext}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// EarnerCard
// ----------------------------------------------------------------------------
function EarnerCard({
  title,
  subtitle,
  icon,
  tone,
  employees,
  maxComp,
  barDirection,
}: {
  title: string;
  subtitle: string;
  icon: string;
  tone: "emerald" | "amber";
  employees: EmployeeRow[];
  maxComp: number;
  barDirection: "asc" | "desc";
}) {
  const headBg = {
    emerald: "from-emerald-50 to-white border-emerald-200",
    amber: "from-amber-50 to-white border-amber-200",
  }[tone];
  const barColor = {
    emerald: "from-emerald-400 to-emerald-600",
    amber: "from-amber-400 to-orange-500",
  }[tone];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div
        className={`px-5 py-3 bg-gradient-to-l ${headBg} border-b flex items-center justify-between flex-wrap gap-2`}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h2 className="text-base font-black font-cairo text-slate-800">
            {title}
          </h2>
        </div>
        <span className="text-[11px] text-slate-500 font-cairo">{subtitle}</span>
      </div>
      <div className="p-4 space-y-3">
        {employees.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-6 font-cairo">
            مفيش بيانات
          </div>
        ) : (
          employees.map((e, idx) => {
            const comp = totalComp(e);
            const pct = (comp / maxComp) * 100;
            return (
              <div key={e.id} className="flex items-center gap-3">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    idx === 0
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="text-sm font-bold font-cairo text-slate-800 truncate">
                      {e.full_name}
                      {e.job_title && (
                        <span className="text-[11px] text-slate-500 font-normal mr-1.5">
                          · {e.job_title}
                        </span>
                      )}
                    </div>
                    <div
                      className="text-xs font-bold text-slate-700 whitespace-nowrap"
                      dir="ltr"
                    >
                      {formatEGP(Math.round(comp))}
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${barColor} rounded-full transition-all`}
                      style={{
                        width: `${Math.max(
                          4,
                          barDirection === "desc" ? pct : pct,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Hue helpers for department visualisation
// ----------------------------------------------------------------------------
const DEPT_SWATCH = [
  "bg-cyan-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-sky-500",
  "bg-lime-500",
  "bg-fuchsia-500",
];
const DEPT_BAR = [
  "bg-gradient-to-r from-cyan-400 to-cyan-600",
  "bg-gradient-to-r from-emerald-400 to-emerald-600",
  "bg-gradient-to-r from-amber-400 to-amber-600",
  "bg-gradient-to-r from-violet-400 to-violet-600",
  "bg-gradient-to-r from-rose-400 to-rose-600",
  "bg-gradient-to-r from-sky-400 to-sky-600",
  "bg-gradient-to-r from-lime-400 to-lime-600",
  "bg-gradient-to-r from-fuchsia-400 to-fuchsia-600",
];

function deptHueClass(i: number): string {
  return DEPT_SWATCH[i % DEPT_SWATCH.length];
}
function deptBarClass(i: number): string {
  return DEPT_BAR[i % DEPT_BAR.length];
}
