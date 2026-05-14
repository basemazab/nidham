import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatEGP } from "@/lib/payroll";

type Period = {
  id: string;
  year: number;
  month: number;
  status: "draft" | "approved" | "paid" | "cancelled";
  working_days: number;
  approved_at: string | null;
  paid_at: string | null;
  created_at: string;
};

type AggRow = { period_id: string; net_salary: number };

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const STATUS_LABELS: Record<Period["status"], { text: string; classes: string }> = {
  draft: { text: "مسودة", classes: "bg-amber-50 text-amber-700 border-amber-200" },
  approved: { text: "معتمدة", classes: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  paid: { text: "مدفوعة", classes: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { text: "ملغية", classes: "bg-slate-100 text-slate-600 border-slate-200" },
};

export default async function PayrollPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: periods } = await supabase
    .from("payroll_periods")
    .select("id, year, month, status, working_days, approved_at, paid_at, created_at")
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .returns<Period[]>();

  const list = periods ?? [];

  // Aggregate net salary per period
  const { data: entries } = await supabase
    .from("payroll_entries")
    .select("period_id, net_salary")
    .returns<AggRow[]>();

  const totals = new Map<string, { count: number; total: number }>();
  for (const e of entries ?? []) {
    const cur = totals.get(e.period_id) ?? { count: 0, total: 0 };
    cur.count++;
    cur.total += Number(e.net_salary);
    totals.set(e.period_id, cur);
  }

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع للـ Dashboard
          </Link>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              الرواتب والمرتبات
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              {list.length === 0
                ? "ابدأ بإنشاء أول شهر مرتبات"
                : `${list.length} شهر مرتبات`}
              {" · "}
              <span className="text-brand-cyan-dark font-bold">
                مصري — قانون 12/2003 + 148/2019
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/dashboard/payroll/advances"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold text-sm hover:bg-emerald-100 transition font-cairo"
            >
              <span>💵</span>
              <span>صرف سلف (الأربعاء)</span>
            </Link>
            <Link
              href="/dashboard/payroll/settings"
              className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-50 transition font-cairo"
            >
              <span>⚙</span>
              <span>إعدادات الرواتب</span>
            </Link>
            <Link
              href="/dashboard/payroll/new"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo"
            >
              <span className="text-lg leading-none">+</span>
              <span>شهر مرتبات جديد</span>
            </Link>
          </div>
        </header>

        {list.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-6xl mb-4">💰</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
              لسه مفيش مرتبات مسجلة
            </h2>
            <p className="text-slate-500 mb-6 font-cairo leading-relaxed max-w-md mx-auto">
              النظام بيحسبلك المرتب تلقائيًا من راتب الموظف + حضوره خلال الشهر،
              مع تطبيق التأمينات الاجتماعية (14%) وضريبة الدخل المصرية التصاعدية.
            </p>
            <Link
              href="/dashboard/payroll/new"
              className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold hover:bg-brand-cyan transition font-cairo"
            >
              ابدأ بأول شهر
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden">
            <table className="w-full text-right">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الشهر</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">عدد الموظفين</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">إجمالي الصافي</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">أيام العمل</th>
                  <th className="px-5 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الحالة</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((p) => {
                  const status = STATUS_LABELS[p.status];
                  const agg = totals.get(p.id) ?? { count: 0, total: 0 };
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 transition">
                      <td className="px-5 py-4">
                        <Link href={`/dashboard/payroll/${p.id}`} className="font-bold text-brand-cyan-dark hover:text-brand-cyan font-cairo">
                          {ARABIC_MONTHS[p.month - 1]} {p.year}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-slate-700 font-bold">{agg.count}</td>
                      <td className="px-5 py-4 font-bold text-emerald-700 font-cairo">{formatEGP(agg.total)}</td>
                      <td className="px-5 py-4 text-slate-600">{p.working_days} يوم</td>
                      <td className="px-5 py-4">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold border ${status.classes} font-cairo`}>
                          {status.text}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/payroll/${p.id}`}
                          className="text-xs text-brand-cyan-dark hover:text-brand-cyan font-cairo font-bold"
                        >
                          فتح
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
