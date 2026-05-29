import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile } from "@/lib/permissions";
import { auditPayroll } from "@/lib/payroll-audit";
import {
  AlertTriangle,
  CheckCircle,
  Shield,
  DollarSign,
  ArrowLeft,
  BarChart3,
  Users,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "مراجعة المرتبات بالذكاء الاصطناعي | Payroll Audit",
};

export default async function PayrollAuditPage() {
  const { profile } = await getMyProfile();
  if (!profile) redirect("/dashboard");

  const supabase = await createClient();

  const [empRes, entriesRes, periodsRes, attRes] = await Promise.all([
    supabase.from("employees").select("id, full_name, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, pay_frequency, status, department, hire_date"),
    supabase.from("payroll_entries").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("payroll_periods").select("*").order("end_date", { ascending: false }).limit(20),
    supabase.from("attendance").select("employee_id, date, status, tardiness_minutes, early_leave_minutes").gte("date", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]).limit(5000),
  ]);

  const audit = auditPayroll({
    employees: empRes.data ?? [],
    payrollEntries: entriesRes.data ?? [],
    payrollPeriods: periodsRes.data ?? [],
    attendance: attRes.data ?? [],
  });

  return (
    <div className="flex-1 space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/dashboard" className="hover:text-cyan-600">Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/payroll" className="hover:text-cyan-600">المرتبات</Link>
        <span>/</span>
        <span className="text-slate-800 font-medium dark:text-slate-200">مراجعة AI</span>
      </div>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
            audit.health_status === "good" ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800" :
            audit.health_status === "fair" ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800" :
            "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
          }`}>
            <Shield className="h-3.5 w-3.5" />
            {audit.health_status === "good" ? "سليم" : audit.health_status === "fair" ? "تنبيهات" : "مشاكل حرجة"}
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white mt-2">
            مراجعة المرتبات بالذكاء الاصطناعي
          </h1>
          <p className="text-sm text-slate-500">
            تحليل آلي لاكتشاف الأخطاء والأنماط غير المعتادة في المرتبات
          </p>
        </div>
        <Link
          href="/dashboard/payroll"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
          الرجوع للمرتبات
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-50 text-cyan-600 dark:bg-cyan-950 dark:text-cyan-400 mb-2">
            <DollarSign className="h-4.5 w-4.5" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white">
            {Math.round(audit.summary.total_payroll).toLocaleString("ar-EG")} ج
          </div>
          <div className="text-xs text-slate-500">إجمالي المرتبات</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 mb-2">
            <BarChart3 className="h-4.5 w-4.5" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white">{audit.summary.total_entries}</div>
          <div className="text-xs text-slate-500">عدد entries</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg mb-2 ${
            audit.summary.anomalies_count > 0 ? "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          }`}>
            <AlertTriangle className="h-4.5 w-4.5" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white">{audit.summary.anomalies_count}</div>
          <div className="text-xs text-slate-500">ملاحظات</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg mb-2 ${
            audit.summary.critical_count > 0 ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400" : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          }`}>
            <Shield className="h-4.5 w-4.5" />
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white">{audit.summary.critical_count}</div>
          <div className="text-xs text-slate-500">مشاكل حرجة</div>
        </div>
      </div>

      {/* Anomalies */}
      {audit.anomalies.length === 0 ? (
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-12 text-center dark:border-emerald-800 dark:from-emerald-950/30 dark:to-slate-900">
          <CheckCircle className="mx-auto h-12 w-12 text-emerald-500" />
          <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">
            لا توجد مشاكل في المرتبات
          </h2>
          <p className="mt-2 text-slate-500">
            كل الـ entries سليمة. مفيش أخطاء أو أنماط غير معتادة.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {audit.anomalies.map((anomaly, i) => (
            <div
              key={`${anomaly.type}-${i}`}
              className={`rounded-2xl border p-5 ${
                anomaly.severity === "critical"
                  ? "border-red-200 bg-gradient-to-br from-red-50 to-white dark:border-red-800 dark:from-red-950/30 dark:to-slate-900"
                  : anomaly.severity === "high"
                    ? "border-red-100 bg-gradient-to-br from-red-50/50 to-white dark:border-red-800/50 dark:from-red-950/20 dark:to-slate-900"
                    : "border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:border-amber-800 dark:from-amber-950/30 dark:to-slate-900"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  anomaly.severity === "critical"
                    ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400"
                    : anomaly.severity === "high"
                      ? "bg-red-50 text-red-500 dark:bg-red-900/50 dark:text-red-400"
                      : "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-400"
                }`}>
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className={`font-bold ${
                        anomaly.severity === "critical"
                          ? "text-red-800 dark:text-red-300"
                          : anomaly.severity === "high"
                            ? "text-red-700 dark:text-red-300"
                            : "text-amber-800 dark:text-amber-300"
                      }`}>
                        {anomaly.title}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {anomaly.description}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      anomaly.severity === "critical"
                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        : anomaly.severity === "high"
                          ? "bg-red-50 text-red-600 dark:bg-red-900/50 dark:text-red-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                    }`}>
                      {anomaly.severity === "critical" ? "حرج" : anomaly.severity === "high" ? "عالي" : "متوسط"}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <span className="text-xs font-medium text-slate-500">التوصية:</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">{anomaly.recommendation}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="h-4 w-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">المكافآت</h3>
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white">
            {Math.round(audit.summary.total_bonuses).toLocaleString("ar-EG")} ج
          </div>
          <div className="text-xs text-slate-500">إجمالي المكافآت</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">الأوفرتايم</h3>
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white">
            {Math.round(audit.summary.total_overtime).toLocaleString("ar-EG")} ج
          </div>
          <div className="text-xs text-slate-500">إجمالي الأوفرتايم</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-4 w-4 text-purple-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">متوسط الصافي</h3>
          </div>
          <div className="text-lg font-black text-slate-900 dark:text-white">
            {Math.round(audit.summary.avg_net_salary).toLocaleString("ar-EG")} ج
          </div>
          <div className="text-xs text-slate-500">متوسط صافي المرتب</div>
        </div>
      </div>
    </div>
  );
}
