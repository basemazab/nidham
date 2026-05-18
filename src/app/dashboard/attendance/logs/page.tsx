// ============================================================================
// /dashboard/attendance/logs — Odoo-style attendance records list
// ============================================================================
//
// The existing /dashboard/attendance is the "register today's attendance"
// grid (one row per employee, status dropdown). This page is the opposite
// view: one row per attendance RECORD, sorted by date desc, with computed
// columns and filters. Operators asked for "the Odoo look".
//
// Columns:
//   Avatar+Name · Department · Date · Check-in · Check-out · Worked Hours ·
//   Tardiness (min) · Early Leave (min) · Tardiness Deduction · Early
//   Leave Deduction · Total Deduction · Status
//
// Filters (via search params):
//   from, to (date range)  — defaults to last 30 days
//   dept     (department)
//   status   (present | absent | half_day | leave)
//   q        (free-text search on name + employee_code)
//   page     (zero-indexed, defaults to 0)
//
// Pagination: 100 rows/page. Total count is fetched alongside for
// the "X of N" badge.

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { formatEGP } from "@/lib/format";
import {
  workedHours,
  perMinuteWage,
  formatTime,
  formatHours,
} from "@/lib/attendance";

// Force fresh data — operators expect to see new clock-ins immediately
// after the import flow or after manually registering attendance.
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  from?: string;
  to?: string;
  dept?: string;
  status?: string;
  q?: string;
  page?: string;
}>;

type AttendanceRow = {
  id: string;
  date: string;
  status: "present" | "absent" | "half_day" | "leave";
  check_in: string | null;
  check_out: string | null;
  tardiness_minutes: number | null;
  early_leave_minutes: number | null;
  notes: string | null;
  employees: {
    id: string;
    full_name: string;
    employee_code: string | null;
    job_title: string | null;
    department: string | null;
    avatar_url: string | null;
    basic_salary: number | null;
    pay_frequency: "monthly" | "weekly" | null;
  } | null;
};

const STATUS_META: Record<
  AttendanceRow["status"],
  { label: string; cls: string }
> = {
  present: {
    label: "حاضر",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  absent: { label: "غائب", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  half_day: {
    label: "نصف يوم",
    cls: "bg-amber-50 text-amber-700 border-amber-200",
  },
  leave: { label: "إجازة", cls: "bg-violet-50 text-violet-700 border-violet-200" },
};

const PAGE_SIZE = 100;

// Pure helpers (workedHours, perMinuteWage, formatTime, formatHours) live
// in src/lib/attendance.ts so they can be unit-tested in isolation and
// reused by /dashboard/reports/attendance.

// ----------------------------------------------------------------------------
// Main page
// ----------------------------------------------------------------------------
export default async function AttendanceLogsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  // ----- Resolve filter state from URL -----
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000)
    .toISOString()
    .split("T")[0];
  const from = (sp.from ?? thirtyDaysAgo).slice(0, 10);
  const to = (sp.to ?? today).slice(0, 10);
  const dept = sp.dept ?? "";
  const statusFilter = sp.status ?? "";
  const q = (sp.q ?? "").trim();
  const page = Math.max(0, Number(sp.page ?? 0) || 0);

  // ----- Build the query -----
  // We fetch both count and data in one parallel batch. The employees
  // join uses !inner so a dropped employee row doesn't break the page;
  // those orphaned attendance rows would be invisible by design.
  let dataQ = supabase
    .from("attendance")
    .select(
      "id, date, status, check_in, check_out, tardiness_minutes, early_leave_minutes, notes, employees!inner(id, full_name, employee_code, job_title, department, avatar_url, basic_salary, pay_frequency)",
    )
    .eq("company_id", callerCompanyId)
    .gte("date", from)
    .lte("date", to)
    .order("date", { ascending: false })
    .order("check_in", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  let countQ = supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("company_id", callerCompanyId)
    .gte("date", from)
    .lte("date", to);

  if (statusFilter) {
    dataQ = dataQ.eq("status", statusFilter);
    countQ = countQ.eq("status", statusFilter);
  }

  const [dataRes, countRes, deptsRes] = await Promise.all([
    dataQ.returns<AttendanceRow[]>(),
    countQ,
    supabase
      .from("employees")
      .select("department")
      .eq("company_id", callerCompanyId)
      .not("department", "is", null)
      .returns<{ department: string }[]>(),
  ]);

  let rows = dataRes.data ?? [];
  const total = countRes.count ?? 0;

  // Department + name filters can't run cleanly on Supabase via .or()
  // chains because we'd need a join filter. Filter in-memory for now —
  // PAGE_SIZE * worst-case is small (100 rows). When the dataset grows
  // past 10k rows / month per tenant we'll revisit with an RPC.
  if (dept) {
    rows = rows.filter((r) => r.employees?.department === dept);
  }
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((r) => {
      const name = r.employees?.full_name?.toLowerCase() ?? "";
      const code = r.employees?.employee_code?.toLowerCase() ?? "";
      return name.includes(needle) || code.includes(needle);
    });
  }

  // Build sorted dept list for the dropdown — distinct + alphabetical
  const allDepts = Array.from(
    new Set((deptsRes.data ?? []).map((d) => d.department)),
  ).sort((a, b) => a.localeCompare(b, "ar"));

  // Hidden helper to build the "next/prev page" URLs preserving filters
  const params = new URLSearchParams();
  if (sp.from) params.set("from", from);
  if (sp.to) params.set("to", to);
  if (dept) params.set("dept", dept);
  if (statusFilter) params.set("status", statusFilter);
  if (q) params.set("q", q);
  const pageUrl = (p: number) => {
    const np = new URLSearchParams(params);
    if (p > 0) np.set("page", String(p));
    return `/dashboard/attendance/logs?${np.toString()}`;
  };

  // ----- KPIs at the top -----
  // Totals across the loaded rows (not the entire result set — that
  // would need another query). Good enough for the visible window.
  const totals = rows.reduce(
    (acc, r) => {
      const hrs = workedHours(r.check_in, r.check_out);
      const pmw = perMinuteWage(
        r.employees?.basic_salary,
        r.employees?.pay_frequency ?? "monthly",
      );
      const tardy = (r.tardiness_minutes ?? 0) * pmw;
      const early = (r.early_leave_minutes ?? 0) * pmw;
      acc.hours += hrs;
      acc.tardyDed += tardy;
      acc.earlyDed += early;
      acc.tardyMin += r.tardiness_minutes ?? 0;
      acc.earlyMin += r.early_leave_minutes ?? 0;
      return acc;
    },
    { hours: 0, tardyDed: 0, earlyDed: 0, tardyMin: 0, earlyMin: 0 },
  );

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-slate-50 dark:bg-slate-950 min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        {/* Breadcrumb */}
        <div className="mb-3">
          <Link
            href="/dashboard"
            className="text-xs text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الـ Dashboard
          </Link>
        </div>

        {/* Header + toolbar */}
        <header className="mb-5 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-black font-cairo text-slate-800 dark:text-slate-100 mb-1">
              📋 سجلات الحضور
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-cairo">
              كل تسجيلات الحضور + الانصراف · مع حساب التأخيرات والخصومات تلقائياً
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/dashboard/attendance"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-brand-cyan/30 bg-brand-cyan/5 text-brand-cyan-dark font-bold text-sm hover:bg-brand-cyan/10 transition font-cairo"
            >
              <span>✍</span>
              <span>تسجيل اليوم</span>
            </Link>
            <Link
              href="/dashboard/attendance/import"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-amber-300 bg-amber-50 text-amber-800 font-bold text-sm hover:bg-amber-100 transition font-cairo"
            >
              <span>📂</span>
              <span>استيراد من Excel / بصمة</span>
            </Link>
            <Link
              href="/dashboard/attendance/review"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-violet-300 bg-violet-50 text-violet-800 font-bold text-sm hover:bg-violet-100 transition font-cairo"
            >
              <span>👁</span>
              <span>مراجعة الدفعات</span>
            </Link>
          </div>
        </header>

        {/* KPI strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <Kpi
            icon="📋"
            label="السجلات المعروضة"
            value={`${rows.length} / ${total}`}
            color="cyan"
          />
          <Kpi
            icon="⏱"
            label="إجمالي ساعات العمل"
            value={`${totals.hours.toFixed(1)} س`}
            color="emerald"
          />
          <Kpi
            icon="⚠"
            label="إجمالي التأخيرات"
            value={`${totals.tardyMin} د`}
            color="amber"
          />
          <Kpi
            icon="💸"
            label="خصومات تقديرية"
            value={formatEGP(Math.round(totals.tardyDed + totals.earlyDed))}
            color="rose"
          />
        </section>

        {/* Filter bar — GET form so filters become bookmarkable URLs */}
        <form
          method="GET"
          className="mb-4 grid grid-cols-2 md:grid-cols-6 gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-sm"
        >
          <div className="col-span-2 md:col-span-2">
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 font-cairo">
              بحث (اسم / كود)
            </label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="مثلاً: أحمد، 1023"
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-brand-cyan outline-none text-sm font-cairo"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 font-cairo">
              من تاريخ
            </label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-brand-cyan outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 font-cairo">
              إلى تاريخ
            </label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-brand-cyan outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 font-cairo">
              القسم
            </label>
            <select
              name="dept"
              defaultValue={dept}
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-brand-cyan outline-none text-sm font-cairo"
            >
              <option value="">كل الأقسام</option>
              {allDepts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 font-cairo">
              الحالة
            </label>
            <select
              name="status"
              defaultValue={statusFilter}
              className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-brand-cyan outline-none text-sm font-cairo"
            >
              <option value="">الكل</option>
              <option value="present">حاضر</option>
              <option value="absent">غائب</option>
              <option value="half_day">نصف يوم</option>
              <option value="leave">إجازة</option>
            </select>
          </div>
          <div className="col-span-2 md:col-span-6 flex items-center gap-2 justify-end">
            <Link
              href="/dashboard/attendance/logs"
              className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold font-cairo hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              مسح
            </Link>
            <button
              type="submit"
              className="px-5 py-1.5 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white text-xs font-black font-cairo shadow"
            >
              🔍 تصفية
            </button>
          </div>
        </form>

        {/* Table */}
        {rows.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
            <div className="text-5xl mb-3">📭</div>
            <h2 className="text-base font-black text-slate-700 dark:text-slate-200 font-cairo mb-1">
              مفيش سجلات في النطاق ده
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-cairo">
              غيّر التاريخ أو الفلاتر، أو سجّل حضور جديد من{" "}
              <Link
                href="/dashboard/attendance"
                className="text-brand-cyan-dark font-bold hover:underline"
              >
                صفحة التسجيل
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
            <div className="table-scroll">
              <table className="w-full text-right text-sm" dir="rtl">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                  <tr>
                    <Th>الموظف</Th>
                    <Th>التاريخ</Th>
                    <Th>تسجيل الحضور</Th>
                    <Th>تسجيل الخروج</Th>
                    <Th>ساعات العمل</Th>
                    <Th>التأخير</Th>
                    <Th>الانصراف المبكر</Th>
                    <Th>خصم التأخير</Th>
                    <Th>خصم الانصراف</Th>
                    <Th>إجمالي الخصم</Th>
                    <Th>الحالة</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map((r) => {
                    const emp = r.employees;
                    const hrs = workedHours(r.check_in, r.check_out);
                    const pmw = perMinuteWage(
                      emp?.basic_salary,
                      emp?.pay_frequency ?? "monthly",
                    );
                    const tardyMins = r.tardiness_minutes ?? 0;
                    const earlyMins = r.early_leave_minutes ?? 0;
                    const tardyDed = tardyMins * pmw;
                    const earlyDed = earlyMins * pmw;
                    const totalDed = tardyDed + earlyDed;
                    const status = STATUS_META[r.status];

                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/employees/${emp?.id ?? ""}`}
                            className="flex items-center gap-3 group"
                          >
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center text-white text-sm font-black shrink-0 overflow-hidden">
                              {emp?.avatar_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={emp.avatar_url}
                                  alt={emp.full_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span>{emp?.full_name?.[0] ?? "?"}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 dark:text-slate-100 font-cairo truncate group-hover:text-brand-cyan-dark transition">
                                {emp?.full_name ?? "—"}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-cairo truncate">
                                {emp?.department ?? ""}
                                {emp?.employee_code ? (
                                  <span dir="ltr" className="mx-1 font-mono">
                                    · #{emp.employee_code}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200 font-cairo whitespace-nowrap">
                          {new Date(r.date + "T00:00:00").toLocaleDateString(
                            "ar-EG",
                            { dateStyle: "short" },
                          )}
                        </td>
                        <td
                          className="px-4 py-3 text-slate-700 dark:text-slate-200 font-mono"
                          dir="ltr"
                        >
                          {formatTime(r.check_in)}
                        </td>
                        <td
                          className="px-4 py-3 text-slate-700 dark:text-slate-200 font-mono"
                          dir="ltr"
                        >
                          {formatTime(r.check_out)}
                        </td>
                        <td
                          className="px-4 py-3 font-bold text-emerald-700 dark:text-emerald-400 font-mono"
                          dir="ltr"
                        >
                          {formatHours(hrs)}
                        </td>
                        <td
                          className={`px-4 py-3 font-mono ${
                            tardyMins > 0
                              ? "text-amber-700 dark:text-amber-400 font-bold"
                              : "text-slate-400"
                          }`}
                          dir="ltr"
                        >
                          {tardyMins > 0 ? `${tardyMins} د` : "—"}
                        </td>
                        <td
                          className={`px-4 py-3 font-mono ${
                            earlyMins > 0
                              ? "text-amber-700 dark:text-amber-400 font-bold"
                              : "text-slate-400"
                          }`}
                          dir="ltr"
                        >
                          {earlyMins > 0 ? `${earlyMins} د` : "—"}
                        </td>
                        <td
                          className={`px-4 py-3 font-mono ${
                            tardyDed > 0
                              ? "text-rose-700 dark:text-rose-400"
                              : "text-slate-400"
                          }`}
                          dir="ltr"
                        >
                          {tardyDed > 0
                            ? formatEGP(Math.round(tardyDed * 100) / 100)
                            : "—"}
                        </td>
                        <td
                          className={`px-4 py-3 font-mono ${
                            earlyDed > 0
                              ? "text-rose-700 dark:text-rose-400"
                              : "text-slate-400"
                          }`}
                          dir="ltr"
                        >
                          {earlyDed > 0
                            ? formatEGP(Math.round(earlyDed * 100) / 100)
                            : "—"}
                        </td>
                        <td
                          className={`px-4 py-3 font-mono font-bold ${
                            totalDed > 0
                              ? "text-rose-800 dark:text-rose-300"
                              : "text-slate-400"
                          }`}
                          dir="ltr"
                        >
                          {totalDed > 0
                            ? formatEGP(Math.round(totalDed * 100) / 100)
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] font-bold font-cairo ${status.cls}`}
                          >
                            {status.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 font-cairo">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  صفحة {page + 1} من{" "}
                  {Math.max(1, Math.ceil(total / PAGE_SIZE))}
                </div>
                <div className="flex items-center gap-2">
                  {page > 0 ? (
                    <Link
                      href={pageUrl(page - 1)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      ← السابقة
                    </Link>
                  ) : (
                    <span className="px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 text-xs font-bold cursor-not-allowed">
                      ← السابقة
                    </span>
                  )}
                  {page < Math.ceil(total / PAGE_SIZE) - 1 ? (
                    <Link
                      href={pageUrl(page + 1)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      التالية →
                    </Link>
                  ) : (
                    <span className="px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600 text-xs font-bold cursor-not-allowed">
                      التالية →
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Help footer */}
        <div className="mt-6 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 font-cairo">
          💡 <strong>ملاحظة عن الخصومات:</strong> الأرقام دي تقديرية بناءً على
          الراتب الأساسي (الراتب ÷ 30 يوم ÷ 8 ساعات ÷ 60 دقيقة). الـ payroll
          engine بيحسب القيمة الفعلية بدقة أكتر عند قفل دورة المرتبات (بيشمل
          البدلات والتأمينات والضرائب).
        </div>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-right font-bold whitespace-nowrap">
      {children}
    </th>
  );
}

function Kpi({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: "cyan" | "emerald" | "amber" | "rose";
}) {
  const cls: Record<typeof color, string> = {
    cyan: "from-cyan-50 to-white dark:from-cyan-900/20 dark:to-slate-900 border-cyan-200 dark:border-cyan-800",
    emerald:
      "from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900 border-emerald-200 dark:border-emerald-800",
    amber:
      "from-amber-50 to-white dark:from-amber-900/20 dark:to-slate-900 border-amber-200 dark:border-amber-800",
    rose: "from-rose-50 to-white dark:from-rose-900/20 dark:to-slate-900 border-rose-200 dark:border-rose-800",
  };
  return (
    <div
      className={`p-3 rounded-xl bg-gradient-to-br ${cls[color]} border shadow-sm`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xl">{icon}</span>
      </div>
      <div className="text-base font-black font-display text-slate-800 dark:text-slate-100">
        {value}
      </div>
      <div className="text-[10px] opacity-80 font-cairo mt-1 text-slate-600 dark:text-slate-400">
        {label}
      </div>
    </div>
  );
}
