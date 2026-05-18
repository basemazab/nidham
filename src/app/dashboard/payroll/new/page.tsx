import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generatePayrollPeriod } from "../actions";
import { NewPayrollForm } from "./form";

type SearchParams = Promise<{ error?: string; freq?: string }>;

type CompanySettings = {
  monthly_cycle_start_day: number | null;
  weekly_cycle_start_dow: number | null;
};

// Form for creating a new payroll period. Now cycle-aware:
//   - User picks frequency (monthly / weekly).
//   - System suggests the most-recently-closed cycle window based on
//     the company's monthly_cycle_start_day + weekly_cycle_start_dow
//     settings (migration 026).
//   - User can adjust start_date; end_date auto-fills.
//   - Only employees whose pay_frequency matches are included.

export default async function NewPayrollPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const error = sp.error;
  const initialFreq =
    sp.freq === "weekly" ? "weekly" : ("monthly" as "monthly" | "weekly");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Resolve the caller's company so we can read cycle settings + count
  // eligible employees per frequency.
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single<{ company_id: string }>();

  const companyId = profile?.company_id ?? null;
  // Used to scope the employee count queries below — a super-admin
  // session would otherwise see employees across every tenant here.
  const callerCompanyId = companyId ?? "";

  const [{ data: settings }, monthlyCountRes, weeklyCountRes, missingSalaryRes] =
    await Promise.all([
      companyId
        ? supabase
            .from("companies")
            .select("monthly_cycle_start_day, weekly_cycle_start_dow")
            .eq("id", companyId)
            .single<CompanySettings>()
        : Promise.resolve({ data: null }),
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", callerCompanyId)
        .eq("status", "active")
        .eq("pay_frequency", "monthly"),
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", callerCompanyId)
        .eq("status", "active")
        .eq("pay_frequency", "weekly"),
      supabase
        .from("employees")
        .select("id", { count: "exact", head: true })
        .eq("company_id", callerCompanyId)
        .eq("status", "active")
        .or("basic_salary.is.null,basic_salary.eq.0"),
    ]);

  const monthlyCount = monthlyCountRes.count ?? 0;
  const weeklyCount = weeklyCountRes.count ?? 0;
  const missingSalaryCount = missingSalaryRes.count ?? 0;

  // Suggest the most-recently-closed cycle for the user's frequency choice.
  // Compute it here on the server so the form opens pre-filled.
  const monthlyStartDay = settings?.monthly_cycle_start_day ?? 1;
  const weeklyStartDow = settings?.weekly_cycle_start_dow ?? 6; // Sat by default

  const suggested = suggestCycle(initialFreq, monthlyStartDay, weeklyStartDow);

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard/payroll"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لقائمة المرتبات
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
            فترة مرتبات جديدة
          </h1>
          <p className="text-sm text-slate-500 font-cairo leading-relaxed">
            اختار التكرار (شهري / أسبوعي) ونطاق الفترة. النظام بيحسب المرتب لكل موظف
            من نوع التكرار اللي اخترته فقط.
          </p>
        </header>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-cairo">
            ⚠ {decodeURIComponent(error)}
          </div>
        )}

        {missingSalaryCount > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm font-cairo text-amber-800">
            ⚠ {missingSalaryCount} موظف لسه بدون راتب أساسي.{" "}
            <Link
              href="/dashboard/employees"
              className="underline font-bold"
            >
              عدّلهم من صفحة الموظفين
            </Link>
            .
          </div>
        )}

        <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
          <NewPayrollForm
            initialFrequency={initialFreq}
            initialStartDate={suggested.startDate}
            initialEndDate={suggested.endDate}
            monthlyStartDay={monthlyStartDay}
            weeklyStartDow={weeklyStartDow}
            monthlyEmployeeCount={monthlyCount}
            weeklyEmployeeCount={weeklyCount}
            action={generatePayrollPeriod}
          />
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/dashboard/payroll/settings"
            className="text-xs text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ⚙ إعدادات دورة الرواتب →
          </Link>
        </div>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Compute the most-recently-closed cycle window. Mirrors the SQL
// suggest_next_payroll_cycle but runs server-side here so the form
// renders without a round-trip.
// ----------------------------------------------------------------------------
function suggestCycle(
  frequency: "monthly" | "weekly",
  monthlyStartDay: number,
  weeklyStartDow: number,
): { startDate: string; endDate: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (frequency === "monthly") {
    // Today is day D. The cycle that just ENDED is the one whose start
    // is the latest start_day on or before (today - 1).
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const d = yesterday.getDate();
    let startMonth = yesterday.getMonth();
    let startYear = yesterday.getFullYear();
    if (d < monthlyStartDay) {
      startMonth -= 1;
      if (startMonth < 0) {
        startMonth = 11;
        startYear -= 1;
      }
    }
    const start = new Date(startYear, startMonth, monthlyStartDay);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1);
    return {
      startDate: toIso(start),
      endDate: toIso(end),
    };
  }

  // Weekly -- the cycle that just ended is the most recent full
  // 7-day window before today.
  const todayDow = today.getDay(); // 0=Sun..6=Sat
  // step back to the most recent (start_dow), then back another 7 days
  // so we land on the start of the JUST-CLOSED cycle.
  const stepBack = ((todayDow - weeklyStartDow + 7) % 7) + 7;
  const start = new Date(today);
  start.setDate(start.getDate() - stepBack);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { startDate: toIso(start), endDate: toIso(end) };
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
