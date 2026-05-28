"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { formatEGP } from "@/lib/payroll";

interface MonthlyRow {
  id: string;
  year: number;
  month: number;
  status: string;
  payroll_entries: {
    gross_salary: number;
    net_salary: number;
    total_deductions: number;
    social_insurance: number;
    income_tax: number;
    bonuses: number;
  }[];
}

interface DeptRow {
  net_salary: number;
  gross_salary: number;
  employees: {
    department: string;
    status: string;
  }[];
}

interface RecentPeriod {
  id: string;
  year: number;
  month: number;
  status: string;
  start_date: string;
  end_date: string;
  working_days: number;
}

interface Props {
  monthlyData: MonthlyRow[];
  deptData: DeptRow[];
  empCount: number;
  recentPeriods: RecentPeriod[];
}

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const COLORS = [
  "#0891b2", "#0e7490", "#0369a1", "#0284c7",
  "#059669", "#65a30d", "#d97706", "#dc2626",
];

export function PayrollAnalyticsClient({
  monthlyData,
  deptData,
  empCount,
  recentPeriods,
}: Props) {
  // Aggregate monthly totals
  const monthlyChart = monthlyData.map((p) => {
    const gross = p.payroll_entries.reduce((s, e) => s + Number(e.gross_salary || 0), 0);
    const net = p.payroll_entries.reduce((s, e) => s + Number(e.net_salary || 0), 0);
    const tax = p.payroll_entries.reduce((s, e) => s + Number(e.income_tax || 0), 0);
    const ins = p.payroll_entries.reduce((s, e) => s + Number(e.social_insurance || 0), 0);
    return {
      name: `${MONTHS[p.month - 1] || p.month} ${p.year}`,
      gross: Math.round(gross),
      net: Math.round(net),
      tax: Math.round(tax),
      insurance: Math.round(ins),
    };
  });

  // Aggregate by department
  const deptMap = new Map<string, { gross: number; net: number; count: number }>();
  for (const row of deptData) {
    const emp = Array.isArray(row.employees) ? row.employees[0] : row.employees;
    const dept = emp?.department || "بدون قسم";
    const cur = deptMap.get(dept) || { gross: 0, net: 0, count: 0 };
    cur.gross += Number(row.gross_salary || 0);
    cur.net += Number(row.net_salary || 0);
    cur.count++;
    deptMap.set(dept, cur);
  }
  const deptChart = Array.from(deptMap.entries())
    .map(([name, data]) => ({
      name,
      value: Math.round(data.gross),
      employees: data.count,
    }))
    .sort((a, b) => b.value - a.value);

  const totalGross = monthlyChart.reduce((s, m) => s + m.gross, 0);
  const totalNet = monthlyChart.reduce((s, m) => s + m.net, 0);
  const totalTax = monthlyChart.reduce((s, m) => s + m.tax, 0);
  const totalIns = monthlyChart.reduce((s, m) => s + m.insurance, 0);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">تحليلات المرتبات</h1>
        <p className="text-muted-foreground text-sm mt-1">
          نظرة شاملة على تكاليف الرواتب والضرائب والتأمينات
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-slate-500">إجمالي المرتبات (آخر 12 شهر)</p>
          <p className="mt-1 text-2xl font-bold text-cyan-600">
            {formatEGP(totalGross)}
          </p>
          <p className="text-xs text-slate-400">{empCount} موظف نشط</p>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-slate-500">صافي المرتبات</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">
            {formatEGP(totalNet)}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-slate-500">خصم الضريبة</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">
            {formatEGP(totalTax)}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-slate-900">
          <p className="text-xs text-slate-500">خصم التأمينات</p>
          <p className="mt-1 text-2xl font-bold text-purple-600">
            {formatEGP(totalIns)}
          </p>
        </div>
      </div>

      {/* Monthly trend chart */}
      <div className="rounded-xl border bg-white p-6 dark:bg-slate-900">
        <h3 className="mb-4 font-semibold">اتجاه المرتبات الشهرية</h3>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={monthlyChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="gross" name="إجمالي" fill="#0891b2" radius={[4, 4, 0, 0]} />
            <Bar dataKey="net" name="صافي" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Department breakdown + Tax/Insurance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900">
          <h3 className="mb-4 font-semibold">توزيع المرتبات حسب القسم</h3>
          {deptChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={deptChart}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                >
                  {deptChart.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">
              لا توجد بيانات أقسام كافية
            </p>
          )}
        </div>

        <div className="rounded-xl border bg-white p-6 dark:bg-slate-900">
          <h3 className="mb-4 font-semibold">الضرائب والتأمينات الشهرية</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="tax"
                name="ضريبة"
                stroke="#d97706"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="insurance"
                name="تأمينات"
                stroke="#7c3aed"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent periods */}
      <div className="rounded-xl border bg-white p-6 dark:bg-slate-900">
        <h3 className="mb-4 font-semibold">آخر فترات المرتبات</h3>
        <div className="divide-y">
          {recentPeriods.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {MONTHS[p.month - 1] || p.month} {p.year}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.status === "paid"
                    ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                    : p.status === "approved"
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                      : p.status === "draft"
                        ? "bg-slate-50 text-slate-600 dark:bg-slate-800"
                        : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                }`}
              >
                {p.status === "paid"
                  ? "تم الصرف"
                  : p.status === "approved"
                    ? "معتمد"
                    : p.status === "draft"
                      ? "مسودة"
                      : "ملغي"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
