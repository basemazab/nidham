import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatEGP } from "@/lib/payroll";
import { AutoPrint } from "@/components/auto-print";
import { ClientDate } from "@/components/client-date";
import { PrintAgainButton } from "@/components/print-again-button";

// Printable summary of an entire payroll period -- every active
// employee on one or two A4 pages with totals row. The output a
// company would actually file / sign / hand to the accountant.

type PageProps = {
  params: Promise<{ periodId: string }>;
};

type Period = {
  id: string;
  year: number;
  month: number;
  frequency: "monthly" | "weekly" | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  working_days: number;
};

type Entry = {
  id: string;
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  incentive_allowance: number;
  bonuses: number;
  overtime: number;
  gross_salary: number;
  absence_deduction: number;
  tardiness_deduction: number;
  social_insurance: number;
  income_tax: number;
  loan_deduction: number;
  other_deductions: number;
  total_deductions: number;
  net_salary: number;
  attended_days: number;
  absent_days: number;
  employees: {
    full_name: string;
    employee_code: string | null;
    job_title: string | null;
    department: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
  } | null;
};

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export const metadata = {
  title: "كشف المرتبات | نِظام",
};

export default async function PayrollSummaryPrint({ params }: PageProps) {
  const { periodId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: period } = await supabase
    .from("payroll_periods")
    .select("id, year, month, frequency, start_date, end_date, status, working_days")
    .eq("id", periodId)
    .single<Period>();

  if (!period) notFound();

  const { data: entries } = await supabase
    .from("payroll_entries")
    .select(
      "id, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, bonuses, overtime, gross_salary, absence_deduction, tardiness_deduction, social_insurance, income_tax, loan_deduction, other_deductions, total_deductions, net_salary, attended_days, absent_days, employees(full_name, employee_code, job_title, department, bank_name, bank_account_number)",
    )
    .eq("period_id", periodId)
    .order("employees(full_name)", { ascending: true })
    .returns<Entry[]>();

  // Company header
  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  let companyName = "—";
  if (profile?.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("name")
      .eq("id", profile.company_id)
      .single<{ name: string }>();
    if (company) companyName = company.name;
  }

  const rows = entries ?? [];
  const totals = rows.reduce(
    (acc, r) => {
      acc.gross += Number(r.gross_salary);
      acc.insurance += Number(r.social_insurance);
      acc.tax += Number(r.income_tax);
      acc.loan += Number(r.loan_deduction);
      acc.other += Number(r.other_deductions);
      acc.absence += Number(r.absence_deduction);
      acc.totalDed += Number(r.total_deductions);
      acc.net += Number(r.net_salary);
      return acc;
    },
    {
      gross: 0,
      insurance: 0,
      tax: 0,
      loan: 0,
      other: 0,
      absence: 0,
      totalDed: 0,
      net: 0,
    },
  );

  // Prefer explicit cycle window (migration 026). Fall back to year+month
  // for any pre-026 row that wasn't backfilled for some reason.
  const monthLabel =
    period.start_date && period.end_date
      ? `${formatIsoDate(period.start_date)} → ${formatIsoDate(period.end_date)}`
      : `${ARABIC_MONTHS[period.month - 1]} ${period.year}`;
  const cycleTypeLabel = period.frequency === "weekly" ? "أسبوعي" : "شهري";
  const statusLabel =
    period.status === "paid"
      ? "مدفوع"
      : period.status === "approved"
        ? "معتمد"
        : "مسودة";

  return (
    <main className="min-h-screen bg-slate-100 print:bg-white py-6 px-4 print:p-0" dir="rtl">
      <AutoPrint />

      <div className="max-w-6xl mx-auto mb-4 flex items-center justify-between text-sm font-cairo print:hidden">
        <Link
          href={`/dashboard/payroll/${periodId}`}
          className="text-slate-500 hover:text-brand-cyan-dark"
        >
          ← الرجوع لشهر المرتبات
        </Link>
        <PrintAgainButton />

      </div>

      <article
        className="max-w-6xl mx-auto bg-white print:shadow-none shadow-lg rounded-2xl print:rounded-none border border-slate-200 print:border-0 overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-brand-cyan-dark to-brand-navy text-white px-8 py-5 print:bg-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] tracking-[0.3em] text-cyan-200 mb-1 font-cairo">
                PAYROLL SUMMARY / كشف المرتبات
              </div>
              <h1 className="text-2xl font-black font-cairo">{companyName}</h1>
              <p className="text-xs text-cyan-100 mt-1 font-cairo">
                كشف مرتبات {cycleTypeLabel} · {monthLabel} · {rows.length} موظف ·{" "}
                {period.working_days} يوم عمل
              </p>
            </div>
            <div className="text-left text-xs font-cairo">
              <div className="text-cyan-200 mb-0.5">حالة الشهر</div>
              <div className="font-bold text-sm">{statusLabel}</div>
              <div className="text-cyan-200 mt-2 mb-0.5">تاريخ الإصدار</div>
              <div className="font-bold text-xs">
                <ClientDate
                  options={{
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Totals strip */}
        <section className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-4 gap-4 text-center font-cairo">
          <TotalCell label="إجمالي الراتب" value={formatEGP(totals.gross)} color="slate" />
          <TotalCell label="إجمالي التأمينات" value={formatEGP(totals.insurance)} color="amber" />
          <TotalCell label="إجمالي الضرائب" value={formatEGP(totals.tax)} color="red" />
          <TotalCell label="الصافي المستحق" value={formatEGP(totals.net)} color="emerald" />
        </section>

        {/* Table */}
        <div className="px-4 py-4 print:px-2">
          {rows.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-cairo">
              مفيش entries في الـ period ده
            </div>
          ) : (
            <table className="w-full text-xs font-cairo border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase tracking-wider">
                  <th className="px-2 py-2 text-right border border-slate-200 sticky right-0 bg-slate-100">#</th>
                  <th className="px-2 py-2 text-right border border-slate-200">الاسم</th>
                  <th className="px-2 py-2 text-right border border-slate-200">الوظيفة</th>
                  <th className="px-2 py-2 text-center border border-slate-200">حضور</th>
                  <th className="px-2 py-2 text-center border border-slate-200">غياب</th>
                  <th className="px-2 py-2 text-right border border-slate-200">الأساسي</th>
                  <th className="px-2 py-2 text-right border border-slate-200">بدلات</th>
                  <th className="px-2 py-2 text-right border border-slate-200">إجمالي</th>
                  <th className="px-2 py-2 text-right border border-slate-200">تأمينات</th>
                  <th className="px-2 py-2 text-right border border-slate-200">ضريبة</th>
                  <th className="px-2 py-2 text-right border border-slate-200">قرض/خصم</th>
                  <th className="px-2 py-2 text-right border border-slate-200 font-bold bg-emerald-50">
                    الصافي
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const emp = r.employees;
                  const allowances =
                    Number(r.housing_allowance) +
                    Number(r.transport_allowance) +
                    Number(r.other_allowances) +
                    Number(r.incentive_allowance) +
                    Number(r.bonuses) +
                    Number(r.overtime);
                  const otherDed =
                    Number(r.loan_deduction) +
                    Number(r.other_deductions) +
                    Number(r.absence_deduction) +
                    Number(r.tardiness_deduction ?? 0);
                  return (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-2 py-2 border border-slate-200 text-slate-500">{i + 1}</td>
                      <td className="px-2 py-2 border border-slate-200 font-bold text-slate-800 whitespace-nowrap">
                        {emp?.full_name ?? "—"}
                        {emp?.employee_code && (
                          <span className="font-mono text-[10px] text-slate-400 block">
                            {emp.employee_code}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 border border-slate-200 text-slate-600">
                        {emp?.job_title ?? "—"}
                      </td>
                      <td className="px-2 py-2 border border-slate-200 text-center text-emerald-700">
                        {r.attended_days}
                      </td>
                      <td className="px-2 py-2 border border-slate-200 text-center text-red-700">
                        {r.absent_days}
                      </td>
                      <td className="px-2 py-2 border border-slate-200 font-mono" dir="ltr">
                        {formatEGP(r.basic_salary)}
                      </td>
                      <td className="px-2 py-2 border border-slate-200 font-mono" dir="ltr">
                        {formatEGP(allowances)}
                      </td>
                      <td className="px-2 py-2 border border-slate-200 font-mono font-bold" dir="ltr">
                        {formatEGP(r.gross_salary)}
                      </td>
                      <td className="px-2 py-2 border border-slate-200 font-mono text-red-700" dir="ltr">
                        {formatEGP(r.social_insurance)}
                      </td>
                      <td className="px-2 py-2 border border-slate-200 font-mono text-red-700" dir="ltr">
                        {formatEGP(r.income_tax)}
                      </td>
                      <td className="px-2 py-2 border border-slate-200 font-mono text-red-700" dir="ltr">
                        {formatEGP(otherDed)}
                      </td>
                      <td className="px-2 py-2 border border-slate-200 font-mono font-black text-emerald-700 bg-emerald-50/40" dir="ltr">
                        {formatEGP(r.net_salary)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-black text-slate-800 text-xs">
                  <td colSpan={5} className="px-2 py-2 border border-slate-300 text-right">
                    الإجمالي ({rows.length} موظف)
                  </td>
                  <td className="px-2 py-2 border border-slate-300 font-mono" dir="ltr">—</td>
                  <td className="px-2 py-2 border border-slate-300 font-mono" dir="ltr">—</td>
                  <td className="px-2 py-2 border border-slate-300 font-mono" dir="ltr">
                    {formatEGP(totals.gross)}
                  </td>
                  <td className="px-2 py-2 border border-slate-300 font-mono text-red-700" dir="ltr">
                    {formatEGP(totals.insurance)}
                  </td>
                  <td className="px-2 py-2 border border-slate-300 font-mono text-red-700" dir="ltr">
                    {formatEGP(totals.tax)}
                  </td>
                  <td className="px-2 py-2 border border-slate-300 font-mono text-red-700" dir="ltr">
                    {formatEGP(totals.loan + totals.other + totals.absence)}
                  </td>
                  <td className="px-2 py-2 border border-slate-300 font-mono text-emerald-700 bg-emerald-100" dir="ltr">
                    {formatEGP(totals.net)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* Signatures */}
        <section className="px-8 py-8 grid grid-cols-3 gap-12 print:gap-16 print:break-before-avoid">
          <SignatureBox label="مسؤول الموارد البشرية" />
          <SignatureBox label="المحاسب" />
          <SignatureBox label="المدير العام" />
        </section>

        <footer className="px-8 py-3 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 font-cairo flex flex-wrap items-center justify-between gap-2">
          <div>
            مولّد من Nidham · <ClientDate /> · حالة: {statusLabel}
          </div>
          <div className="font-mono" dir="ltr">
            {periodId}
          </div>
        </footer>
      </article>
    </main>
  );
}

function TotalCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "slate" | "amber" | "red" | "emerald";
}) {
  const colorClasses = {
    slate: "text-slate-700",
    amber: "text-amber-700",
    red: "text-red-700",
    emerald: "text-emerald-700",
  }[color];
  return (
    <div>
      <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-lg font-black ${colorClasses}`} dir="ltr">
        {value}
      </div>
    </div>
  );
}

function SignatureBox({ label }: { label: string }) {
  return (
    <div>
      <div className="border-b-2 border-slate-300 h-10 mb-2" />
      <div className="text-xs text-slate-500 font-cairo text-center">{label}</div>
    </div>
  );
}
