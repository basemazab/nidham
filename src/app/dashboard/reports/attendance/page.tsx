import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  year?: string;
  month?: string;
}>;

type Employee = { id: string; full_name: string; job_title: string | null };
type AttendanceRow = { employee_id: string; status: string };

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0);
  return d.toISOString().split("T")[0];
}

export default async function AttendanceReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const params = await searchParams;
  const year = parseInt(params.year ?? String(now.getFullYear()), 10);
  const month = parseInt(params.month ?? String(now.getMonth() + 1), 10);

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = lastDayOfMonth(year, month);

  // Fetch in parallel — RLS scopes both to the user's company
  const [employeesRes, attendanceRes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, full_name, job_title")
      .eq("status", "active")
      .order("full_name")
      .returns<Employee[]>(),
    supabase
      .from("attendance")
      .select("employee_id, status")
      .gte("date", startDate)
      .lte("date", endDate)
      .returns<AttendanceRow[]>(),
  ]);

  const employees = employeesRes.data ?? [];
  const attendance = attendanceRes.data ?? [];

  // Aggregate per employee
  const stats = employees.map((emp) => {
    const records = attendance.filter((a) => a.employee_id === emp.id);
    const present = records.filter((r) => r.status === "present").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const halfDay = records.filter((r) => r.status === "half_day").length;
    const leave = records.filter((r) => r.status === "leave").length;
    const total = records.length;
    const presentRate =
      total === 0 ? 0 : Math.round(((present + halfDay * 0.5) / total) * 100);

    return { employee: emp, present, absent, halfDay, leave, total, presentRate };
  });

  // Sort: best presentRate first; ties broken by more present days
  stats.sort((a, b) => {
    if (b.presentRate !== a.presentRate) return b.presentRate - a.presentRate;
    return b.present - a.present;
  });

  // Aggregate company-wide
  const totalRecords = stats.reduce((s, x) => s + x.total, 0);
  const totalPresent = stats.reduce((s, x) => s + x.present, 0);
  const totalAbsent = stats.reduce((s, x) => s + x.absent, 0);
  const avgPresentRate =
    stats.length === 0
      ? 0
      : Math.round(stats.reduce((s, x) => s + x.presentRate, 0) / stats.length);
  const topPerformer = stats[0];

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="mb-8">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold mb-2 font-cairo">
            📊 تقرير
          </div>
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            تقرير الحضور الشهري
          </h1>
          <p className="text-sm text-slate-500">
            {ARABIC_MONTHS[month - 1]} {year} · من {startDate} إلى {endDate}
          </p>
        </header>

        {/* Month/Year selector */}
        <form
          method="get"
          className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-6 grid grid-cols-3 gap-3 items-end"
        >
          <div>
            <label htmlFor="month" className="block text-xs font-medium text-slate-600 mb-1 font-cairo">
              الشهر
            </label>
            <select
              id="month"
              name="month"
              defaultValue={month}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
            >
              {ARABIC_MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="year" className="block text-xs font-medium text-slate-600 mb-1 font-cairo">
              السنة
            </label>
            <select
              id="year"
              name="year"
              defaultValue={year}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/20 outline-none text-slate-900 font-cairo"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-brand-cyan-dark hover:bg-brand-cyan text-white font-bold text-sm font-cairo transition"
          >
            تحديث التقرير
          </button>
        </form>

        {/* Summary cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
            <div className="text-xs text-slate-500 mb-1 font-cairo">إجمالي السجلات</div>
            <div className="text-3xl font-black text-slate-800">{totalRecords}</div>
          </div>
          <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200">
            <div className="text-xs text-emerald-700 mb-1 font-cairo">أيام حضور</div>
            <div className="text-3xl font-black text-emerald-700">{totalPresent}</div>
          </div>
          <div className="bg-red-50 p-5 rounded-xl border border-red-200">
            <div className="text-xs text-red-700 mb-1 font-cairo">أيام غياب</div>
            <div className="text-3xl font-black text-red-700">{totalAbsent}</div>
          </div>
          <div className="bg-gradient-to-br from-cyan-50 to-white p-5 rounded-xl border-2 border-brand-cyan/30">
            <div className="text-xs text-brand-cyan-dark mb-1 font-cairo">متوسط نسبة الحضور</div>
            <div className="text-3xl font-black text-brand-cyan-dark">{avgPresentRate}%</div>
          </div>
        </div>

        {/* Top performer */}
        {topPerformer && topPerformer.total > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-5 mb-6 flex items-center gap-4">
            <div className="text-4xl">🏆</div>
            <div className="flex-1">
              <div className="text-xs text-amber-700 font-bold mb-1 font-cairo">الموظف الأكثر التزامًا في الحضور</div>
              <div className="text-xl font-black text-slate-800 font-cairo">
                {topPerformer.employee.full_name}
              </div>
              <div className="text-sm text-slate-600">
                {topPerformer.present} يوم حاضر · {topPerformer.presentRate}% نسبة حضور
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {stats.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">📊</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
              مفيش بيانات حضور للشهر ده
            </h2>
            <p className="text-slate-500 mb-6">
              سجّل حضور الموظفين الأول، وارجع هنا تشوف التقرير
            </p>
            <Link
              href="/dashboard/attendance"
              className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
            >
              تسجيل حضور
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">#</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الموظف</th>
                  <th className="px-5 py-3 text-xs font-bold text-emerald-700 uppercase tracking-wider font-cairo">حاضر</th>
                  <th className="px-5 py-3 text-xs font-bold text-red-700 uppercase tracking-wider font-cairo">غايب</th>
                  <th className="px-5 py-3 text-xs font-bold text-amber-700 uppercase tracking-wider font-cairo">نص يوم</th>
                  <th className="px-5 py-3 text-xs font-bold text-blue-700 uppercase tracking-wider font-cairo">إجازة</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">إجمالي</th>
                  <th className="px-5 py-3 text-xs font-bold text-brand-cyan-dark uppercase tracking-wider font-cairo min-w-[180px]">
                    نسبة الحضور
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.map((s, i) => (
                  <tr key={s.employee.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3 text-slate-500 font-mono text-sm">{i + 1}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center text-white font-bold text-sm">
                          {s.employee.full_name[0]}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800 font-cairo">
                            {s.employee.full_name}
                          </div>
                          {s.employee.job_title && (
                            <div className="text-xs text-slate-500">{s.employee.job_title}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-bold text-emerald-700">{s.present}</td>
                    <td className="px-5 py-3 font-bold text-red-700">{s.absent}</td>
                    <td className="px-5 py-3 font-bold text-amber-700">{s.halfDay}</td>
                    <td className="px-5 py-3 font-bold text-blue-700">{s.leave}</td>
                    <td className="px-5 py-3 font-bold text-slate-600">{s.total}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-brand-cyan to-brand-cyan-dark rounded-full transition-all"
                            style={{ width: `${s.presentRate}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-brand-cyan-dark min-w-[40px] text-left">
                          {s.presentRate}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
