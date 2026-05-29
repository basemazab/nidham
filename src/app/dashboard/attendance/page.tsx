import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import {
  saveAttendance,
  bulkSaveAttendance,
  bulkDeleteAttendance,
  markAllPresent,
  copyFromYesterday,
} from "./actions";
import { BulkAttendanceModal } from "./bulk-attendance-modal";
import { AttendanceFilters } from "./attendance-filters";
import { AttendanceTimeCell } from "./attendance-time-cell";
import { workedHours, formatHours } from "@/lib/attendance";

type SearchParams = Promise<{
  date?: string;
  error?: string;
  saved?: string;
  bulk?: string;
  deleted?: string;
}>;

type Employee = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
};

function formatArabicDate(isoDate: string): string {
  const date = new Date(isoDate + "T00:00:00");
  return date.toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Force the page to revalidate on every request. Without this, Next.js
// caches the row list + counters between requests, so newly-added rows
// from server actions or import flows take minutes to appear.
export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const todayIso = new Date().toISOString().split("T")[0];
  const selectedDate = params.date ?? todayIso;

  // Scope everything to the caller's company explicitly so super-admin
  // sessions (mig 038) don't bleed rows from other tenants into the grid.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  // Active employees only
  const { data: employeesData } = await supabase
    .from("employees")
    .select("id, full_name, job_title, department")
    .eq("company_id", callerCompanyId)
    .eq("status", "active")
    .order("full_name")
    .returns<Employee[]>();

  const employees = employeesData ?? [];

  // Count of attendance rows imported in the last 24h that haven't
  // been confirmed yet -- drives the review banner below.
  const { data: recentImportCount } = await supabase.rpc(
    "count_recent_import_rows",
  );
  const recentImports =
    typeof recentImportCount === "number" ? recentImportCount : 0;

  // Existing attendance for this date -- pulled with tardiness +
  // early-leave + check_in/check_out so the form defaults reflect
  // everything already saved.
  const { data: existing } = await supabase
    .from("attendance")
    .select(
      "employee_id, status, tardiness_minutes, early_leave_minutes, check_in, check_out, hours_worked",
    )
    .eq("company_id", callerCompanyId)
    .eq("date", selectedDate)
    .returns<
      Array<{
        employee_id: string;
        status: string;
        tardiness_minutes: number | null;
        early_leave_minutes: number | null;
        check_in: string | null;
        check_out: string | null;
        hours_worked: number | null;
      }>
    >();

  const existingMap = new Map<
    string,
    {
      status: string;
      tardiness: number;
      earlyLeave: number;
      checkIn: string | null;
      checkOut: string | null;
      hoursWorked: number | null;
    }
  >(
    existing?.map((r) => [
      r.employee_id,
      {
        status: r.status,
        tardiness: r.tardiness_minutes ?? 0,
        earlyLeave: r.early_leave_minutes ?? 0,
        checkIn: r.check_in,
        checkOut: r.check_out,
        hoursWorked: r.hours_worked,
      },
    ]) ?? [],
  );

  // Live summary counts for today — these power the colored stat cards
  // at the top of the page so HR sees roll-call progress at a glance
  // instead of scrolling through 100+ rows mentally counting.
  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let leaveCount = 0;
  let halfDayCount = 0;
  for (const r of existing ?? []) {
    if (r.status === "present") {
      presentCount += 1;
      if ((r.tardiness_minutes ?? 0) > 0) lateCount += 1;
    } else if (r.status === "absent") {
      absentCount += 1;
    } else if (r.status === "leave") {
      leaveCount += 1;
    } else if (r.status === "half_day") {
      halfDayCount += 1;
    }
  }
  const markedCount = (existing ?? []).length;
  const unmarkedCount = Math.max(0, employees.length - markedCount);
  const completionPercent =
    employees.length > 0
      ? Math.round((markedCount / employees.length) * 100)
      : 0;

  // Tardiness pattern detection — pull last 7 days of late check-ins
  // (status=present AND tardiness > 0) and group by employee. Anyone
  // hitting 3+ late days in a week gets a small amber badge next to
  // their name so HR can flag follow-up. Cheap query — 1 SELECT per
  // page load, scales well to thousands of rows.
  const sevenDaysAgoDt = new Date(selectedDate + "T00:00:00");
  sevenDaysAgoDt.setDate(sevenDaysAgoDt.getDate() - 7);
  const sevenDaysAgoIso = sevenDaysAgoDt.toISOString().split("T")[0];
  const { data: weeklyLate } = await supabase
    .from("attendance")
    .select("employee_id, tardiness_minutes")
    .eq("company_id", callerCompanyId)
    .eq("status", "present")
    .gt("tardiness_minutes", 0)
    .gte("date", sevenDaysAgoIso)
    .lt("date", selectedDate)
    .returns<Array<{ employee_id: string; tardiness_minutes: number | null }>>();

  const tardinessPattern = new Map<string, number>();
  for (const row of weeklyLate ?? []) {
    tardinessPattern.set(
      row.employee_id,
      (tardinessPattern.get(row.employee_id) ?? 0) + 1,
    );
  }

  // Distinct departments — feed the filter dropdown. Sorted for UX.
  const departments = Array.from(
    new Set(
      employees
        .map((e) => e.department)
        .filter((d): d is string => Boolean(d && d.trim())),
    ),
  ).sort();

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              تسجيل الحضور
            </h1>
            <p className="text-sm text-slate-500">
              {formatArabicDate(selectedDate)} · {employees.length} موظف نشط
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/attendance/logs"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border-2 border-brand-cyan/40 text-brand-cyan-dark hover:bg-brand-cyan/5 hover:border-brand-cyan font-bold text-sm shadow-sm font-cairo transition"
            >
              <span>📋</span>
              <span>كل السجلات</span>
            </Link>
            <BulkAttendanceModal
              defaultDate={selectedDate}
              action={bulkSaveAttendance}
              deleteAction={bulkDeleteAttendance}
            />
            <Link
              href="/dashboard/attendance/intelligence"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-l from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600 text-white font-bold text-sm shadow-md font-cairo transition"
            >
              <span>🧠</span>
              <span>ذكاء الحضور</span>
            </Link>
            <Link
              href="/dashboard/attendance/import"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-sm shadow-md font-cairo transition"
            >
              <span>⚡</span>
              <span>استيراد من ZKTeco / Excel</span>
            </Link>
          </div>
        </header>

        {/* Date selector */}
        <form
          method="get"
          className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-4 flex items-end gap-3"
        >
          <div className="flex-1">
            <label htmlFor="date" className="block text-xs font-medium text-slate-600 mb-1 font-cairo">
              التاريخ
            </label>
            <input
              type="date"
              id="date"
              name="date"
              defaultValue={selectedDate}
              max={todayIso}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm font-cairo transition"
          >
            تحميل تاريخ تاني
          </button>
        </form>

        {/* ─── Live summary cards — present / late / absent / leave / unmarked
            with a progress bar at the top. Updates on save (page is
            force-dynamic so the counts are fresh on every navigation). */}
        {employees.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h2 className="text-sm font-bold text-slate-700 font-cairo">
                📊 ملخص اليوم
              </h2>
              <div className="text-xs text-slate-500 font-cairo">
                <span className="font-bold text-slate-700">
                  {completionPercent}%
                </span>{" "}
                مكتمل · {markedCount.toLocaleString("ar-EG")} /{" "}
                {employees.length.toLocaleString("ar-EG")} موظف اتسجّل
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
              <div
                className="h-full bg-gradient-to-r from-brand-cyan to-brand-cyan-dark transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <StatTile
                label="حاضر"
                count={presentCount}
                emoji="✓"
                color="bg-emerald-50 text-emerald-700 border-emerald-200"
              />
              <StatTile
                label="متأخر"
                count={lateCount}
                emoji="⏰"
                color="bg-amber-50 text-amber-700 border-amber-200"
                sub="بعد التأخير"
              />
              <StatTile
                label="غايب"
                count={absentCount}
                emoji="✗"
                color="bg-rose-50 text-rose-700 border-rose-200"
              />
              <StatTile
                label="إجازة / نص يوم"
                count={leaveCount + halfDayCount}
                emoji="🏖"
                color="bg-cyan-50 text-cyan-700 border-cyan-200"
              />
              <StatTile
                label="لم يُسجّل"
                count={unmarkedCount}
                emoji="—"
                color="bg-slate-50 text-slate-600 border-slate-200"
              />
            </div>
          </section>
        )}

        {/* ─── Quick-action buttons — the daily shortcuts that turn 5-min
            roll-call into 5-sec roll-call. Both are server forms so a
            single tap submits + reloads. */}
        {employees.length > 0 && (
          <div className="bg-gradient-to-br from-cyan-50 to-white rounded-2xl border-2 border-cyan-200 p-4 mb-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-800 font-cairo mb-1">
                  ⚡ اختصارات سريعة
                </h3>
                <p className="text-xs text-slate-600 font-cairo">
                  بدل ما تختار حالة كل موظف يدوياً — استخدم زرار واحد + عدّل
                  الاستثناءات بعدها.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <form action={markAllPresent}>
                  <input type="hidden" name="date" value={selectedDate} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm font-cairo transition shadow-sm"
                  >
                    <span>✓</span>
                    <span>علّم الكل حاضر</span>
                  </button>
                </form>
                <form action={copyFromYesterday}>
                  <input type="hidden" name="date" value={selectedDate} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border-2 border-amber-300 text-amber-700 hover:bg-amber-50 font-bold text-sm font-cairo transition"
                  >
                    <span>📋</span>
                    <span>انسخ من امبارح</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Search + department filter (client component) */}
        {employees.length > 0 && (
          <AttendanceFilters
            departments={departments}
            totalCount={employees.length}
          />
        )}

        {/* Success/Error messages */}
        {params.saved && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-cairo">
            ✓ تم حفظ {params.saved} سجل حضور
          </div>
        )}
        {params.bulk && (() => {
          const [insertedStr, daysStr, empStr] = decodeURIComponent(params.bulk).split("|");
          const inserted = parseInt(insertedStr, 10) || 0;
          const days = parseInt(daysStr, 10) || 0;
          const emps = parseInt(empStr, 10) || 0;
          const totalCells = days * emps;
          const skipped = Math.max(0, totalCells - inserted);
          return (
            <div className="mb-4 p-4 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-900 font-cairo">
              <div className="font-bold text-base mb-1">✓ تم التسجيل الجماعي</div>
              <div className="text-sm leading-relaxed">
                اتسجل <b>{inserted.toLocaleString("ar-EG")}</b> حالة حضور
                لـ <b>{emps.toLocaleString("ar-EG")}</b> موظف عبر{" "}
                <b>{days.toLocaleString("ar-EG")}</b> يوم.
                {skipped > 0 && (
                  <>
                    {" "}
                    <span className="text-emerald-700">
                      اتخطّى <b>{skipped.toLocaleString("ar-EG")}</b> سجل
                      كانوا موجودين بالفعل (محدش اتعدّل عليه).
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        })()}
        {params.deleted && (() => {
          const [recordsStr, daysStr] = decodeURIComponent(params.deleted).split("|");
          const records = parseInt(recordsStr, 10) || 0;
          const days = parseInt(daysStr, 10) || 0;
          return (
            <div className="mb-4 p-4 rounded-xl bg-red-50 border-2 border-red-200 text-red-900 font-cairo">
              <div className="font-bold text-base mb-1">🗑 تم الحذف الجماعي</div>
              <div className="text-sm leading-relaxed">
                اتمسح <b>{records.toLocaleString("ar-EG")}</b> سجل حضور عبر{" "}
                <b>{days.toLocaleString("ar-EG")}</b> يوم. الـ payroll و
                التقارير اللي على الفترة دي هتعكس التغيير.
              </div>
            </div>
          );
        })()}
        {params.error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(params.error)}
          </div>
        )}

        {/* Recent-import review banner: shown when fingerprint data was
            imported in the last 24h and HR hasn't clicked "اعتمد" yet. */}
        {recentImports > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 border-2 border-amber-200 font-cairo flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <span className="text-2xl">📥</span>
              <div>
                <div className="font-bold text-amber-900 mb-0.5">
                  {recentImports.toLocaleString("ar-EG")} سجل حضور تم استيراده
                  مؤخرًا — راجعهم قبل اعتماد المرتب
                </div>
                <p className="text-sm text-amber-800 leading-relaxed">
                  لما ترفع شيت من البصمة، السجلات بتظهر هنا كـ "دفعة". افتح
                  المراجعة، عدّل اللي محتاج تعديل، احذف الغلط، واعتمد.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/attendance/review"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition whitespace-nowrap"
            >
              🔍 افتح المراجعة →
            </Link>
          </div>
        )}

        {/* Empty state */}
        {employees.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">👥</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
              مفيش موظفين نشطين
            </h2>
            <p className="text-slate-500 mb-6">
              ضيف موظفين الأول من صفحة الموظفين
            </p>
            <Link
              href="/dashboard/employees/new"
              className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
            >
              ضيف موظف
            </Link>
          </div>
        ) : (
          <form action={saveAttendance}>
            <input type="hidden" name="date" value={selectedDate} />

            <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden mb-4">
              <table className="w-full text-right">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                      الموظف
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                      القسم
                    </th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                      الحالة
                    </th>
                    <th className="px-3 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-emerald-700">دخول</span>
                        <span className="text-rose-700">خروج</span>
                        <span className="text-[9px] font-normal text-slate-400 normal-case">
                          {formatArabicDate(selectedDate)}
                        </span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-xs font-bold text-cyan-700 uppercase tracking-wider font-cairo">
                      ساعات
                    </th>
                    <th className="px-3 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider font-cairo">
                      تأخير (د)
                    </th>
                    <th className="px-3 py-3 text-xs font-bold text-orange-700 uppercase tracking-wider font-cairo">
                      انصراف مبكر (د)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => {
                    const current = existingMap.get(emp.id);
                    const lateThisWeek = tardinessPattern.get(emp.id) ?? 0;
                    return (
                      <tr
                        key={emp.id}
                        className="hover:bg-slate-50/50"
                        // data-* attributes power the client-side filter
                        // component (attendance-filters.tsx).
                        data-employee-row="true"
                        data-name={emp.full_name}
                        data-department={emp.department ?? ""}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {emp.full_name[0]}
                            </div>
                            <div>
                              <div className="font-medium text-slate-800 font-cairo flex items-center gap-2 flex-wrap">
                                <span>{emp.full_name}</span>
                                {lateThisWeek >= 3 && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300"
                                    title={`متأخر ${lateThisWeek} مرات في آخر 7 أيام`}
                                  >
                                    ⚠ متأخر {lateThisWeek}×
                                  </span>
                                )}
                              </div>
                              {emp.job_title && (
                                <div className="text-xs text-slate-500">{emp.job_title}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-600 text-sm">
                          {emp.department ?? "—"}
                        </td>
                        <td className="px-5 py-3">
                          <select
                            name={`status_${emp.id}`}
                            defaultValue={current?.status ?? ""}
                            className="px-4 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo min-w-[140px]"
                          >
                            <option value="">— اختار —</option>
                            <option value="present">✓ حاضر</option>
                            <option value="absent">✗ غايب</option>
                            <option value="half_day">◐ نص يوم</option>
                            <option value="leave">🏖 إجازة</option>
                          </select>
                        </td>
                        <td className="px-3 py-3">
                          <AttendanceTimeCell
                            employeeId={emp.id}
                            defaultCheckIn={current?.checkIn}
                            defaultCheckOut={current?.checkOut}
                          />
                        </td>
                        <td className="px-3 py-3 text-center">
                          {(() => {
                            // Show stored hours if present, else recompute
                            // from the times we just rendered. Same number
                            // either way — but storing lets us skip the
                            // re-derive on every reload.
                            const hrs =
                              current?.hoursWorked ??
                              workedHours(
                                current?.checkIn ?? null,
                                current?.checkOut ?? null,
                              );
                            return (
                              <span className="text-sm font-mono text-cyan-700 font-bold">
                                {hrs > 0 ? formatHours(hrs) : "—"}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            name={`tardiness_${emp.id}`}
                            defaultValue={current?.tardiness ?? 0}
                            min="0"
                            max="720"
                            step="1"
                            className="w-20 px-2 py-2 rounded-lg border border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-200 outline-none text-slate-900 text-center font-mono"
                            dir="ltr"
                          />
                        </td>
                        <td className="px-3 py-3">
                          <input
                            type="number"
                            name={`early_leave_${emp.id}`}
                            defaultValue={current?.earlyLeave ?? 0}
                            min="0"
                            max="720"
                            step="1"
                            className="w-20 px-2 py-2 rounded-lg border border-slate-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-200 outline-none text-slate-900 text-center font-mono"
                            dir="ltr"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-100 sticky bottom-4 shadow-lg gap-3 flex-wrap">
              <p className="text-sm text-slate-600 font-cairo">
                لو موظف ساكت ما عليش — مش هيتسجل ليه حاجة. اضغط{" "}
                <span className="font-bold text-emerald-700">"الآن"</span>{" "}
                علشان تسجّل ساعة الدخول/الخروج بضغطة، وعمود "ساعات" بيتحسب
                تلقائياً.
              </p>
              <button
                type="submit"
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all font-cairo"
              >
                حفظ الحضور
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}

// Stat tile for the summary section. Five of these render side-by-side
// at the top of the page so HR sees the day's roll-call breakdown
// before they scroll. Kept inline (not a separate file) because it's
// only used here.
function StatTile({
  label,
  count,
  emoji,
  color,
  sub,
}: {
  label: string;
  count: number;
  emoji: string;
  color: string;
  sub?: string;
}) {
  return (
    <div className={`p-3 rounded-xl border ${color} font-cairo`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{emoji}</span>
        <span className="text-xs font-bold opacity-80">{label}</span>
      </div>
      <div className="text-2xl font-black font-display">
        {count.toLocaleString("ar-EG")}
      </div>
      {sub && (
        <div className="text-[10px] opacity-70 mt-0.5">{sub}</div>
      )}
    </div>
  );
}
