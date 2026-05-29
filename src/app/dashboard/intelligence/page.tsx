import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { calculateHealthScore } from "@/lib/health-score";
import {
  TrendingUp,
  Users,
  DollarSign,
  CalendarCheck,
  AlertTriangle,
  Lightbulb,
  ArrowLeft,
  Target,
  Activity,
  BarChart3,
  Clock,
  UserCheck,
  FileText,
  Zap,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ذكاء الأعمال | Executive Intelligence",
};

export default async function IntelligencePage() {
  const { profile } = await getMyProfile();
  if (!profile) redirect("/dashboard");

  const supabase = await createClient();
  const today = new Date();
  const ninetyAgo = new Date(today);
  ninetyAgo.setDate(today.getDate() - 90);
  const thirtyAgo = new Date(today);
  thirtyAgo.setDate(today.getDate() - 30);
  const ninetyIso = ninetyAgo.toISOString().split("T")[0];
  const thirtyIso = thirtyAgo.toISOString().split("T")[0];
  const todayIso = today.toISOString().split("T")[0];

  const [empRes, attRes, leaveRes, advRes, payrollRes, salaryRes, profilesRes] = await Promise.all([
    supabase.from("employees").select("id, full_name, status, department, hire_date, termination_date, basic_salary, employee_code, national_id, gender, pay_frequency"),
    supabase.from("attendance").select("employee_id, date, status, tardiness_minutes").gte("date", thirtyIso).lte("date", todayIso),
    supabase.from("leave_requests").select("id, status").eq("status", "pending"),
    supabase.from("advance_requests").select("id, status").eq("status", "pending"),
    supabase.from("payroll_periods").select("id, status"),
    supabase.from("salary_history").select("employee_id, change_date").order("change_date", { ascending: false }),
    supabase.from("profiles").select("id, company_id"),
  ]);

  const employees = empRes.data ?? [];
  const attendance = attRes.data ?? [];
  const pendLeaves = leaveRes.data?.length ?? 0;
  const pendAdvances = advRes.data?.length ?? 0;
  const payrollPeriods = payrollRes.data ?? [];
  const salaryHistory = salaryRes.data ?? [];

  const active = employees.filter((e) => e.status === "active");
  const terminated = employees.filter((e) => e.status === "terminated");
  const terminated90 = terminated.filter((e) => e.termination_date && e.termination_date >= ninetyIso);
  const turnoverRate = active.length > 0 ? terminated90.length / active.length : 0;

  const attDays = attendance.filter((a) => a.status === "present").length;
  const attTotal = attendance.length || 1;
  const attendanceRate = attDays / attTotal;
  const tardinessAvg = attendance.reduce((s, a) => s + (a.tardiness_minutes ?? 0), 0) / Math.max(attendance.length, 1);

  const avgSalary = active.length > 0
    ? active.reduce((s, e) => s + (e.basic_salary ?? 0), 0) / active.length
    : 0;

  const deptCount = new Set(active.map((e) => e.department).filter(Boolean)).size;
  const withCode = active.filter((e) => e.employee_code).length;
  const withNid = active.filter((e) => e.national_id).length;
  const femaleCount = active.filter((e) => e.gender === "female").length;

  const healthScore = calculateHealthScore({
    totalEmployees: employees.length,
    activeEmployees: active.length,
    terminatedLast90Days: terminated90.length,
    attendanceRate,
    tardinessAvgMinutes: tardinessAvg,
    avgTenureMonths: active.reduce((s, e) => {
      if (!e.hire_date) return s;
      const months = (today.getTime() - new Date(e.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
      return s + months;
    }, 0) / Math.max(active.length, 1),
    pendingLeaveRequests: pendLeaves,
    pendingAdvanceRequests: pendAdvances,
    completedPayrollPeriods: payrollPeriods.filter((p) => p.status === "closed" || p.status === "approved").length,
    avgBasicSalary: avgSalary,
    turnoverRate,
    femaleRatio: active.length > 0 ? femaleCount / active.length : 0,
    departmentsCount: deptCount,
    employeesWithCode: withCode,
    employeesWithNationalId: withNid,
  });

  const monthlyPayrollTotal = active.filter((e) => e.pay_frequency === "monthly").length * avgSalary;
  const weeklyPayrollTotal = active.filter((e) => e.pay_frequency === "weekly").length * avgSalary;

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard" className="hover:text-cyan-600">Dashboard</Link>
        <span>/</span>
        <span className="text-slate-800 font-medium dark:text-slate-200">ذكاء الأعمال</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-50 to-cyan-50 border border-purple-200 px-3 py-1 text-xs font-bold text-purple-700 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-300">
            <BarChart3 className="h-3.5 w-3.5" />
            Executive Intelligence
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            ذكاء الأعمال
          </h1>
          <p className="text-sm text-slate-500">
            تحليلات تنفيذية ذكية لقيادة الشركة — لحظية، دقيقة، قابلة للتنفيذ
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/analytics"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Activity className="h-4 w-4" />
            التحليلات
          </Link>
          <Link
            href="/dashboard/retention"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:from-cyan-600 hover:to-cyan-700"
          >
            <Target className="h-4 w-4" />
            الاحتفاظ
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Health Score Card */}
        <div className="lg:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-cyan-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">HR Health Score</h2>
            </div>
            <div className="text-center">
              <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
                <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="54"
                    fill="none"
                    stroke={healthScore.overall >= 70 ? "#22d3ee" : healthScore.overall >= 50 ? "#f59e0b" : "#ef4444"}
                    strokeWidth="8"
                    strokeDasharray={`${(healthScore.overall / 100) * 339.29} 339.29`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <span className={`absolute text-3xl font-black ${healthScore.gradeColor}`}>
                  {healthScore.grade}
                </span>
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {healthScore.overall}/100
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {healthScore.dimensions.map((d) => (
                <div key={d.key}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{d.name}</span>
                    <span className="text-slate-500">{d.score}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        d.status === "excellent" ? "bg-emerald-500" :
                        d.status === "good" ? "bg-cyan-500" :
                        d.status === "fair" ? "bg-amber-500" : "bg-red-500"
                      }`}
                      style={{ width: `${d.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Executive Summary */}
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5 text-cyan-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">الملخص التنفيذي</h2>
            </div>
            <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
              {[
                { icon: Users, label: "إجمالي الموظفين", value: `${employees.length}`, sub: `${active.length} نشط · ${terminated.length} منتهي` },
                { icon: DollarSign, label: "كتلة المرتبات الشهرية", value: `${Math.round(monthlyPayrollTotal).toLocaleString("ar-EG")} ج`, sub: `${active.filter(e => e.pay_frequency === "monthly").length} شهري · ${active.filter(e => e.pay_frequency === "weekly").length} أسبوعي` },
                { icon: CalendarCheck, label: "نسبة الحضور", value: `${Math.round(attendanceRate * 100)}%`, sub: `متوسط التأخير ${Math.round(tardinessAvg)} دقيقة` },
                { icon: AlertTriangle, label: "معدل الدوران", value: `${(turnoverRate * 100).toFixed(1)}%`, sub: `${terminated90.length} مغادرين آخر ٣ شهور` },
                { icon: TrendingUp, label: "متوسط الراتب", value: `${Math.round(avgSalary).toLocaleString("ar-EG")} ج`, sub: `${deptCount} أقسام` },
                { icon: Clock, label: "الطلبات المعلقة", value: `${pendLeaves + pendAdvances}`, sub: `${pendLeaves} إجازة · ${pendAdvances} سلفة` },
              ].map((s) => (
                <div key={s.label} className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400">
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">{s.label}</div>
                    <div className="font-bold text-slate-900 dark:text-white">{s.value}</div>
                    <div className="text-xs text-slate-400">{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "إجمالي المرتبات", value: `${Math.round(monthlyPayrollTotal).toLocaleString("ar-EG")} ج`, icon: DollarSign, color: "from-emerald-500 to-emerald-600" },
              { label: "الموظفين النشطين", value: `${active.length}`, icon: Users, color: "from-cyan-500 to-cyan-600" },
              { label: "التقييم الصحي", value: `${healthScore.overall}%`, icon: Activity, color: healthScore.overall >= 70 ? "from-emerald-500 to-emerald-600" : "from-amber-500 to-amber-600" },
              { label: "دورات المرتبات", value: `${payrollPeriods.length}`, icon: BarChart3, color: "from-purple-500 to-purple-600" },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${kpi.color} text-white shadow-sm`}>
                  <kpi.icon className="h-4.5 w-4.5" />
                </div>
                <div className="text-lg font-black text-slate-900 dark:text-white">{kpi.value}</div>
                <div className="text-xs text-slate-500">{kpi.label}</div>
              </div>
            ))}
          </div>

          {/* AI Insights */}
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-6 dark:border-amber-800 dark:from-amber-950/30 dark:to-slate-900">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400">
                <Lightbulb className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                الرؤى الذكية
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Turnover Risk */}
              <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-400">مخاطر الدوران</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {turnoverRate > 0.15
                    ? `⚠️ معدل دوران مرتفع (${(turnoverRate * 100).toFixed(1)}%) — ${terminated90.length} موظف غادروا آخر ٣ شهور. راجع أسباب ترك الخدمة.`
                    : `✅ معدل الدوران مستقر عند ${(turnoverRate * 100).toFixed(1)}% — أداء جيد في الاحتفاظ.`}
                </p>
                <Link href="/dashboard/retention" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
                  عرض تحليل الاحتفاظ <ArrowLeft className="h-3 w-3" />
                </Link>
              </div>

              {/* Attendance Alert */}
              <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-cyan-500" />
                  <span className="text-xs font-bold text-cyan-700 dark:text-cyan-400">تحليل الحضور</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {attendanceRate < 0.85
                    ? `⚠️ نسبة الحضور ${Math.round(attendanceRate * 100)}% — أقل من المستهدف (٨٥٪). متوسط التأخير ${Math.round(tardinessAvg)} دقيقة.`
                    : `✅ نسبة الحضور ${Math.round(attendanceRate * 100)}% — ضمن المستهدف.`}
                </p>
                <Link href="/dashboard/attendance" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
                  عرض تقارير الحضور <ArrowLeft className="h-3 w-3" />
                </Link>
              </div>

              {/* Payroll Insight */}
              <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-emerald-500" />
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">تحليل المرتبات</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  إجمالي المرتبات الشهرية {Math.round(monthlyPayrollTotal).toLocaleString("ar-EG")} ج
                  لـ {active.length} موظف. مكتمل {payrollPeriods.filter((p) => p.status !== "draft").length} دورة مرتبات.
                </p>
                <Link href="/dashboard/payroll/analytics" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
                  تحليلات المرتبات <ArrowLeft className="h-3 w-3" />
                </Link>
              </div>

              {/* Data Quality */}
              <div className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-800">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="h-4 w-4 text-purple-500" />
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-400">جودة البيانات</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {withCode}/{active.length} موظف بكود بصمة · {withNid}/{active.length} برقم قومي · {deptCount} قسم.
                </p>
                <Link href="/dashboard/employees" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700 dark:text-cyan-400">
                  إدارة الموظفين <ArrowLeft className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-5 w-5 text-cyan-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">التوصيات الذكية</h2>
            </div>
            {healthScore.recommendations.length === 0 ? (
              <p className="text-sm text-slate-500">لا توجد توصيات — كل المؤشرات إيجابية.</p>
            ) : (
              <div className="space-y-3">
                {healthScore.recommendations.map((r) => (
                  <div
                    key={r.title}
                    className={`flex items-start gap-3 rounded-xl p-4 ${
                      r.priority === "critical" || r.priority === "high"
                        ? "bg-red-50 dark:bg-red-950/30"
                        : "bg-amber-50 dark:bg-amber-950/30"
                    }`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      r.priority === "critical" || r.priority === "high"
                        ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400"
                        : "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400"
                    }`}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div>
                      <div className={`font-bold text-sm ${
                        r.priority === "critical" || r.priority === "high" ? "text-red-800 dark:text-red-300" : "text-amber-800 dark:text-amber-300"
                      }`}>
                        {r.title}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{r.description}</div>
                      <div className="text-xs text-slate-500 mt-1">{r.impact}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "إضافة موظف", href: "/dashboard/employees/new", icon: Users },
              { label: "قفل مرتبات", href: "/dashboard/payroll/new", icon: DollarSign },
              { label: "تقرير حضور", href: "/dashboard/reports/attendance", icon: CalendarCheck },
              { label: "الموافقة على طلبات", href: "/dashboard/requests", icon: FileText },
            ].map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 transition-all hover:border-cyan-200 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-cyan-700"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400">
                  <a.icon className="h-4 w-4" />
                </div>
                {a.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
