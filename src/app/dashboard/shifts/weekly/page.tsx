import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";

// ============================================================================
// Weekly shift schedule (جدول الورديات الأسبوعي)
// ============================================================================
//
// Renders a 7-column × N-row matrix: rows = active employees, columns =
// days of the week (Sunday → Saturday, Egypt's work week starts Sunday).
// Each cell shows the employee's assigned shift name + times.
//
// Includes a "Print" button that opens the browser print dialog with
// optimised print CSS — produces a clean A4-landscape printable schedule
// that factory floor managers can pin up.
//
// Three modes:
//   - Fixed-shift employees:        always shows their shift
//   - Rotation-pattern employees:   shows the rotation name (computing
//                                    daily slot per employee per day
//                                    would require the get_todays_roster
//                                    RPC × 7 — that's expensive; we'll
//                                    add it later)
//   - No shift / rotation:           shows "—"
//
// Filter by department to narrow the schedule for one team.

export const dynamic = "force-dynamic";

type Employee = {
  id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  shift_id: string | null;
  rotation_id: string | null;
  shifts: { name: string; start_time: string; end_time: string; color: string | null } | null;
  shift_rotations: { name: string } | null;
};

type SearchParams = Promise<{
  week_start?: string;
  department?: string;
}>;

const DAYS_AR = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

function formatTime(t: string | null | undefined): string {
  if (!t) return "—";
  return t.slice(0, 5);
}

/** Build an array of 7 ISO dates starting from the given Sunday. */
function buildWeek(weekStart: string): string[] {
  const start = new Date(weekStart + "T00:00:00");
  const out: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(d.toISOString().split("T")[0]);
  }
  return out;
}

/** Get this week's Sunday in ISO form. */
function currentWeekStartISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // back up to Sunday (0)
  return d.toISOString().split("T")[0];
}

export default async function WeeklyShiftPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { profile } = await getMyProfile();
  const companyId = profile?.company_id ?? "";

  const params = await searchParams;
  const weekStart = params.week_start ?? currentWeekStartISO();
  const departmentFilter = params.department ?? "";
  const days = buildWeek(weekStart);

  let query = supabase
    .from("employees")
    .select(
      "id, full_name, job_title, department, shift_id, rotation_id, shifts(name, start_time, end_time, color), shift_rotations(name)",
    )
    .eq("company_id", companyId)
    .eq("status", "active")
    .order("department", { ascending: true })
    .order("full_name", { ascending: true });

  if (departmentFilter) {
    query = query.eq("department", departmentFilter);
  }

  const { data } = await query.returns<Employee[]>();
  const employees = data ?? [];

  // Distinct departments for the filter dropdown
  const allDepartments = Array.from(
    new Set(employees.map((e) => e.department).filter(Boolean) as string[]),
  ).sort();

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen print:bg-white print:px-2">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 print:hidden">
          <Link
            href="/dashboard/shifts"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لإدارة الورديات
          </Link>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-3 mb-5 print:mb-3">
          <div>
            <div className="inline-block px-3 py-1 rounded-full bg-gradient-to-r from-cyan-50 to-amber-50 border border-cyan-200 text-cyan-700 text-xs font-bold mb-2 font-cairo print:hidden">
              🕒 جدول أسبوعي
            </div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              جدول الورديات الأسبوعي
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              {new Date(weekStart + "T00:00:00").toLocaleDateString("ar-EG", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {" → "}
              {new Date(days[6] + "T00:00:00").toLocaleDateString("ar-EG", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm font-cairo transition print:hidden"
             
            data-print="1"
          >
            🖨 طباعة
          </button>
        </header>

        {/* Filters */}
        <form
          method="get"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-wrap items-end gap-3 print:hidden"
        >
          <div>
            <label
              htmlFor="week_start"
              className="block text-xs font-medium text-slate-600 mb-1 font-cairo"
            >
              بداية الأسبوع (الأحد)
            </label>
            <input
              type="date"
              id="week_start"
              name="week_start"
              defaultValue={weekStart}
              className="px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900"
            />
          </div>
          <div>
            <label
              htmlFor="department"
              className="block text-xs font-medium text-slate-600 mb-1 font-cairo"
            >
              القسم
            </label>
            <select
              id="department"
              name="department"
              defaultValue={departmentFilter}
              className="px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo min-w-[160px]"
            >
              <option value="">كل الأقسام</option>
              {allDepartments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-brand-cyan-dark text-white font-bold text-sm font-cairo transition"
          >
            تحديث
          </button>
        </form>

        {/* Empty state */}
        {employees.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
            <div className="text-5xl mb-3">📅</div>
            <h2 className="text-lg font-bold font-cairo text-slate-700 mb-1">
              مفيش موظفين نشطين
              {departmentFilter && ` في قسم "${departmentFilter}"`}
            </h2>
            <p className="text-sm text-slate-500 font-cairo">
              ضيف موظفين أو غيّر فلتر القسم.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-x-auto print:shadow-none print:border-0">
            <table className="w-full text-right border-collapse">
              <thead className="bg-slate-50 border-b-2 border-slate-200 print:bg-slate-100">
                <tr>
                  <th className="sticky right-0 bg-slate-50 z-10 px-3 py-3 text-xs font-bold text-slate-700 font-cairo text-right min-w-[180px]">
                    الموظف
                  </th>
                  {days.map((iso, i) => {
                    const d = new Date(iso + "T00:00:00");
                    const isFriday = d.getDay() === 5;
                    return (
                      <th
                        key={iso}
                        className={`px-3 py-3 text-xs font-bold font-cairo text-center min-w-[100px] ${
                          isFriday
                            ? "bg-amber-50 text-amber-800"
                            : "text-slate-700"
                        }`}
                      >
                        <div>{DAYS_AR[i]}</div>
                        <div className="text-[10px] font-normal text-slate-500 mt-0.5">
                          {d.toLocaleDateString("ar-EG", {
                            day: "numeric",
                            month: "short",
                          })}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 print:hover:bg-transparent">
                    <td className="sticky right-0 bg-white z-10 px-3 py-2 print:bg-white">
                      <div className="font-medium text-slate-800 font-cairo text-sm">
                        {emp.full_name}
                      </div>
                      {emp.department && (
                        <div className="text-[10px] text-slate-500">
                          {emp.department}
                        </div>
                      )}
                    </td>
                    {days.map((iso) => {
                      const d = new Date(iso + "T00:00:00");
                      const isFriday = d.getDay() === 5;
                      const shift = emp.shifts;
                      const rotation = emp.shift_rotations;
                      return (
                        <td
                          key={iso}
                          className={`px-2 py-2 text-center text-xs font-cairo border-r border-slate-100 ${
                            isFriday ? "bg-amber-50/30" : ""
                          }`}
                        >
                          {isFriday ? (
                            <span className="text-amber-700 font-bold">إجازة</span>
                          ) : shift ? (
                            <div
                              className="rounded-md px-2 py-1 inline-block"
                              style={{
                                backgroundColor:
                                  (shift.color ?? "#bae6fd") + "33",
                                color: shift.color ?? "#0891b2",
                              }}
                            >
                              <div className="font-bold">{shift.name}</div>
                              <div className="text-[10px] opacity-80 font-mono" dir="ltr">
                                {formatTime(shift.start_time)} →{" "}
                                {formatTime(shift.end_time)}
                              </div>
                            </div>
                          ) : rotation ? (
                            <span className="text-xs text-slate-500">
                              ↻ {rotation.name}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Print hint */}
        <div className="mt-4 text-xs text-slate-500 font-cairo print:hidden">
          💡 الجدول مصمّم للطباعة على A4 landscape — اضغط Ctrl+P أو اعتمد على
          زرار الطباعة فوق.
        </div>
      </div>

      {/* Print-only client script: hook up the print button */}
      <script
         
        dangerouslySetInnerHTML={{
          __html: `
            document.querySelector('[data-print="1"]')?.addEventListener('click', () => window.print());
          `,
        }}
      />
    </main>
  );
}
