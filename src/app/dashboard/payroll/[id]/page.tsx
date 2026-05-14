import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { approvePayrollPeriod, markPayrollAsPaid, deletePayrollPeriod } from "../actions";
import { formatEGP } from "@/lib/payroll";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { DownloadPdfButton } from "@/components/download-pdf-button";

type PageProps = {
  params: Promise<{ id: string }>;
};

type Period = {
  id: string;
  year: number;
  month: number;
  frequency: "monthly" | "weekly" | null;
  start_date: string | null;
  end_date: string | null;
  status: "draft" | "approved" | "paid" | "cancelled";
  working_days: number;
  approved_at: string | null;
  paid_at: string | null;
};

type Entry = {
  id: string;
  employee_id: string;
  attended_days: number;
  absent_days: number;
  leave_days: number;
  gross_salary: number;
  social_insurance: number;
  income_tax: number;
  total_deductions: number;
  net_salary: number;
  employees: { full_name: string; job_title: string | null; department: string | null } | null;
};

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function PayrollPeriodPage({ params }: PageProps) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [periodRes, entriesRes] = await Promise.all([
    supabase
      .from("payroll_periods")
      .select("*")
      .eq("id", id)
      .single<Period>(),
    supabase
      .from("payroll_entries")
      .select(
        "id, employee_id, attended_days, absent_days, leave_days, gross_salary, social_insurance, income_tax, total_deductions, net_salary, employees(full_name, job_title, department)",
      )
      .eq("period_id", id)
      .order("employee_id")
      .returns<Entry[]>(),
  ]);

  if (!periodRes.data) notFound();
  const period = periodRes.data;
  const entries = entriesRes.data ?? [];

  const totals = entries.reduce(
    (acc, e) => ({
      gross: acc.gross + Number(e.gross_salary),
      insurance: acc.insurance + Number(e.social_insurance),
      tax: acc.tax + Number(e.income_tax),
      deductions: acc.deductions + Number(e.total_deductions),
      net: acc.net + Number(e.net_salary),
    }),
    { gross: 0, insurance: 0, tax: 0, deductions: 0, net: 0 },
  );

  const isLocked = period.status === "paid";
  const isApproved = period.status === "approved" || period.status === "paid";

  return (
    <main className="flex-1 px-6 py-8 bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard/payroll" className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo">
            ← الرجوع لقائمة المرتبات
          </Link>
        </div>

        <header className="flex flex-wrap items-start justify-between gap-3 mb-8">
          <div>
            <h1 className="text-3xl font-black font-cairo text-slate-800 mb-1">
              {period.frequency === "weekly" ? "مرتب أسبوعي" : "مرتب شهري"}
              {period.start_date && period.end_date ? (
                <>
                  {" · "}
                  <span className="text-slate-600">
                    {formatIsoDate(period.start_date)} → {formatIsoDate(period.end_date)}
                  </span>
                </>
              ) : (
                <>
                  {" · "}
                  {ARABIC_MONTHS[period.month - 1]} {period.year}
                </>
              )}
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              {entries.length} موظف · {period.working_days} يوم عمل · حالة: <strong>{period.status === "draft" ? "مسودة" : period.status === "approved" ? "معتمد" : period.status === "paid" ? "مدفوع" : "ملغي"}</strong>
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <DownloadPdfButton
              targetSelector="#payroll-period-pdf"
              filename={`payroll-${period.start_date ?? `${period.year}-${period.month}`}.pdf`}
              label="📥 تنزيل كشف المرتبات PDF"
            />
            <Link
              href={`/print/payroll-summary/${id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold text-sm font-cairo transition"
            >
              🖨 طباعة من المتصفح
            </Link>
            {period.status === "draft" && (
              <form action={async () => { "use server"; await approvePayrollPeriod(id); }}>
                <button type="submit" className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm font-cairo transition">
                  اعتماد المرتبات ✓
                </button>
              </form>
            )}
            {period.status === "approved" && (
              <form action={async () => { "use server"; await markPayrollAsPaid(id); }}>
                <button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm font-cairo transition">
                  تم الدفع 💰
                </button>
              </form>
            )}
            {period.status === "draft" && (
              <form action={async () => { "use server"; await deletePayrollPeriod(id); }}>
                <ConfirmSubmitButton
                  label="حذف"
                  message="هتمسح فترة الرواتب دي وكل entries الموظفين فيها. الحذف ممكن بس على الـ draft."
                  confirmLabel="نعم احذف"
                  className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-bold text-sm font-cairo transition cursor-pointer"
                />
              </form>
            )}
          </div>
        </header>

        {/* Everything inside #payroll-period-pdf is captured by the
            "Download PDF" button above. Action buttons / link cells
            inside this block must carry `pdf-hide` so they're excluded
            from the rendered PDF. */}
        <div id="payroll-period-pdf">

        {/* Summary cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
            <div className="text-xs text-slate-500 mb-1 font-cairo">إجمالي الراتب</div>
            <div className="text-xl font-black text-slate-800 font-cairo">{formatEGP(totals.gross)}</div>
          </div>
          <div className="bg-amber-50 p-5 rounded-xl border border-amber-200">
            <div className="text-xs text-amber-700 mb-1 font-cairo">التأمينات</div>
            <div className="text-xl font-black text-amber-700 font-cairo">{formatEGP(totals.insurance)}</div>
          </div>
          <div className="bg-red-50 p-5 rounded-xl border border-red-200">
            <div className="text-xs text-red-700 mb-1 font-cairo">الضرائب</div>
            <div className="text-xl font-black text-red-700 font-cairo">{formatEGP(totals.tax)}</div>
          </div>
          <div className="bg-emerald-50 p-5 rounded-xl border-2 border-emerald-300">
            <div className="text-xs text-emerald-700 mb-1 font-cairo">الصافي المستحق</div>
            <div className="text-xl font-black text-emerald-700 font-cairo">{formatEGP(totals.net)}</div>
          </div>
        </div>

        {/* Entries table */}
        {entries.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-16 text-center">
            <div className="text-5xl mb-3">📋</div>
            <p className="text-slate-500 font-cairo">مفيش موظفين في الشهر ده. تأكد إن فيه موظفين بحالة «نشط» وعندهم راتب أساسي.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-x-auto">
            <table className="w-full text-right min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الموظف</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">حضور</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">غياب</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">الإجمالي</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">تأمينات</th>
                  <th className="px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider font-cairo">ضريبة</th>
                  <th className="px-4 py-3 text-xs font-bold text-emerald-700 uppercase tracking-wider font-cairo">الصافي</th>
                  <th className="px-4 py-3 pdf-hide"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800 font-cairo">{e.employees?.full_name ?? "—"}</div>
                      {e.employees?.job_title && (
                        <div className="text-xs text-slate-500">{e.employees.job_title}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-emerald-700 font-bold">{e.attended_days}</td>
                    <td className="px-4 py-3 text-red-600 font-bold">{e.absent_days}</td>
                    <td className="px-4 py-3 font-bold text-slate-700 font-cairo">{formatEGP(e.gross_salary)}</td>
                    <td className="px-4 py-3 text-amber-700 font-cairo">{formatEGP(e.social_insurance)}</td>
                    <td className="px-4 py-3 text-red-600 font-cairo">{formatEGP(e.income_tax)}</td>
                    <td className="px-4 py-3 font-black text-emerald-700 font-cairo">{formatEGP(e.net_salary)}</td>
                    <td className="px-4 py-3 whitespace-nowrap pdf-hide">
                      <Link
                        href={`/dashboard/payroll/${id}/${e.id}`}
                        className="text-xs text-brand-cyan-dark hover:text-brand-cyan font-cairo font-bold ml-2"
                      >
                        تعديل
                      </Link>
                      <Link
                        href={`/dashboard/payroll/${id}/${e.id}/payslip`}
                        className="text-xs text-slate-600 hover:text-slate-800 font-cairo font-bold"
                      >
                        قسيمة
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        </div>
        {/* end #payroll-period-pdf */}

        <p className="text-center text-xs text-slate-400 mt-6 font-cairo">
          {isLocked && "🔒 الشهر مقفول — مينفعش يتعدل"}
          {!isLocked && isApproved && "ℹ️ المعتمد قابل للتعديل لحد ما يتم الدفع"}
        </p>
      </div>
    </main>
  );
}
