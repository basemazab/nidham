import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatEGP } from "@/lib/payroll";
import { AutoPrint } from "@/components/auto-print";
import { ClientDate } from "@/components/client-date";
import { PrintAgainButton } from "@/components/print-again-button";

// Standalone printable payslip. Same content as the dashboard payslip
// page but free of the dashboard sidebar, so the print preview
// renders cleanly. Auto-fires print() on mount.

type PageProps = {
  params: Promise<{ entryId: string }>;
};

type Entry = {
  id: string;
  attended_days: number;
  half_day_days: number;
  leave_days: number;
  absent_days: number;
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
  notes: string | null;
  employees: {
    full_name: string;
    employee_code: string | null;
    job_title: string | null;
    department: string | null;
    national_id: string | null;
    social_insurance_number: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    hire_date: string | null;
  } | null;
  payroll_periods: {
    year: number;
    month: number;
    frequency: "monthly" | "weekly" | null;
    start_date: string | null;
    end_date: string | null;
    working_days: number;
    status: string;
    paid_at: string | null;
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
  title: "قسيمة راتب | نِظام",
};

export default async function PrintPayslipPage({ params }: PageProps) {
  const { entryId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: entry } = await supabase
    .from("payroll_entries")
    .select(
      // PII fields (national_id, social_insurance_number, bank_*) on the
      // joined employees row are NULL after mig 050 — fetch them
      // separately below from the employees_with_pii view.
      "*, employee_id, employees(full_name, employee_code, job_title, department, hire_date), payroll_periods(year, month, frequency, start_date, end_date, working_days, status, paid_at)",
    )
    .eq("id", entryId)
    .single<Entry & { employee_id: string }>();

  if (!entry) notFound();

  // Splice in decrypted PII for the payslip header. One extra round-trip
  // — acceptable since this is a low-volume print path (one row per print).
  if (entry.employees && entry.employee_id) {
    const { data: pii } = await supabase
      .from("employees_with_pii")
      .select(
        "national_id_dec, social_insurance_number_dec, bank_name_dec, bank_account_number_dec",
      )
      .eq("id", entry.employee_id)
      .maybeSingle<{
        national_id_dec: string | null;
        social_insurance_number_dec: string | null;
        bank_name_dec: string | null;
        bank_account_number_dec: string | null;
      }>();
    if (pii) {
      entry.employees.national_id = pii.national_id_dec;
      entry.employees.social_insurance_number = pii.social_insurance_number_dec;
      entry.employees.bank_name = pii.bank_name_dec;
      entry.employees.bank_account_number = pii.bank_account_number_dec;
    }
  }

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

  const period = entry.payroll_periods;
  const emp = entry.employees;
  const monthLabel = period
    ? period.start_date && period.end_date
      ? `${formatIsoDate(period.start_date)} → ${formatIsoDate(period.end_date)}`
      : `${ARABIC_MONTHS[period.month - 1]} ${period.year}`
    : "—";
  const cycleTypeLabel = period?.frequency === "weekly" ? "أسبوعي" : "شهري";

  return (
    <main className="min-h-screen bg-slate-100 print:bg-white py-6 px-4 print:p-0" dir="rtl">
      <AutoPrint />

      {/* Action bar — hidden on print */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between text-sm font-cairo print:hidden">
        <Link href={`/dashboard/payroll`} className="text-slate-500 hover:text-brand-cyan-dark">
          ← الرجوع لشاشة المرتبات
        </Link>
        <PrintAgainButton />

      </div>

      <article
        className="max-w-3xl mx-auto bg-white shadow-lg print:shadow-none rounded-2xl print:rounded-none border border-slate-200 print:border-0 overflow-hidden"
      >
        {/* Header bar */}
        <div className="bg-gradient-to-l from-brand-cyan-dark to-brand-navy text-white px-8 py-6 print:bg-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] tracking-[0.3em] text-cyan-200 mb-1 font-cairo">
                PAYSLIP / قسيمة راتب
              </div>
              <h1 className="text-2xl font-black font-cairo">{companyName}</h1>
              <p className="text-xs text-cyan-100 mt-1 font-cairo">
                قسيمة راتب {cycleTypeLabel} · {monthLabel}
              </p>
            </div>
            <div className="text-left text-xs font-cairo">
              <div className="text-cyan-200 mb-0.5">رقم القسيمة</div>
              <div className="font-mono font-bold text-sm" dir="ltr">
                {entryId.slice(0, 8).toUpperCase()}
              </div>
              <div className="text-cyan-200 mt-2 mb-0.5">حالة الشهر</div>
              <div className="font-bold">
                {period?.status === "paid"
                  ? "✓ مدفوع"
                  : period?.status === "approved"
                    ? "معتمد"
                    : "مسودة"}
              </div>
            </div>
          </div>
        </div>

        {/* Employee info */}
        <section className="px-8 py-6 border-b border-slate-100">
          <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-3 font-cairo">
            بيانات الموظف
          </h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm font-cairo">
            <Row label="الاسم" value={emp?.full_name ?? "—"} bold />
            <Row label="الوظيفة" value={emp?.job_title ?? "—"} />
            <Row label="القسم" value={emp?.department ?? "—"} />
            <Row label="كود الموظف" value={emp?.employee_code ?? "—"} mono />
            <Row label="الرقم القومي" value={emp?.national_id ?? "—"} mono />
            <Row label="رقم التأمينات" value={emp?.social_insurance_number ?? "—"} mono />
            <Row
              label="تاريخ التعيين"
              value={emp?.hire_date ? formatIsoDate(emp.hire_date) : "—"}
            />
            <Row label="أيام العمل بالشهر" value={`${period?.working_days ?? "—"} يوم`} />
          </div>
        </section>

        {/* Attendance */}
        <section className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-3 font-cairo">
            الحضور والانصراف
          </h2>
          <div className="grid grid-cols-4 gap-3 text-center text-sm font-cairo">
            <Stat label="حضور" value={String(entry.attended_days)} color="emerald" />
            <Stat label="نصف يوم" value={String(entry.half_day_days)} color="amber" />
            <Stat label="إجازة" value={String(entry.leave_days)} color="slate" />
            <Stat label="غياب" value={String(entry.absent_days)} color="red" />
          </div>
        </section>

        {/* Earnings & Deductions */}
        <section className="px-8 py-6 grid md:grid-cols-2 gap-8 border-b border-slate-100">
          <div>
            <h2 className="text-xs font-bold tracking-wider text-emerald-600 uppercase mb-3 font-cairo border-b border-emerald-100 pb-2">
              💵 الإيرادات
            </h2>
            <div className="space-y-2 text-sm font-cairo">
              <LineItem label="الراتب الأساسي" value={entry.basic_salary} />
              <LineItem label="بدل سكن" value={entry.housing_allowance} />
              <LineItem label="بدل انتقال" value={entry.transport_allowance} />
              <LineItem label="بدلات أخرى" value={entry.other_allowances} />
              {entry.incentive_allowance > 0 && (
                <LineItem label="حافز شهري" value={entry.incentive_allowance} />
              )}
              {entry.bonuses > 0 && <LineItem label="مكافأة" value={entry.bonuses} />}
              {entry.overtime > 0 && <LineItem label="أوفر تايم" value={entry.overtime} />}
              <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-emerald-700">
                <span>الإجمالي</span>
                <span>{formatEGP(entry.gross_salary)}</span>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-wider text-red-600 uppercase mb-3 font-cairo border-b border-red-100 pb-2">
              💸 الاستقطاعات
            </h2>
            <div className="space-y-2 text-sm font-cairo">
              {entry.absence_deduction > 0 && (
                <LineItem label="خصم الغياب" value={entry.absence_deduction} />
              )}
              {entry.tardiness_deduction > 0 && (
                <LineItem
                  label="خصم تأخير / انصراف مبكر"
                  value={entry.tardiness_deduction}
                />
              )}
              {entry.social_insurance > 0 && (
                <LineItem label="التأمينات (14%)" value={entry.social_insurance} />
              )}
              {entry.income_tax > 0 && (
                <LineItem label="ضريبة الدخل" value={entry.income_tax} />
              )}
              {entry.loan_deduction > 0 && (
                <LineItem label="قسط قرض" value={entry.loan_deduction} />
              )}
              {entry.other_deductions > 0 && (
                <LineItem label="خصومات أخرى" value={entry.other_deductions} />
              )}
              {entry.total_deductions === 0 && (
                <div className="text-xs text-slate-400 font-cairo">مفيش استقطاعات</div>
              )}
              <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-red-700">
                <span>إجمالي الاستقطاعات</span>
                <span>{formatEGP(entry.total_deductions)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Net salary */}
        <section className="px-8 py-6 bg-gradient-to-l from-emerald-50 to-cyan-50 border-b border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold tracking-wider text-emerald-700 uppercase font-cairo">
                صافي الراتب المستحق
              </div>
              <div className="text-xs text-slate-500 mt-1 font-cairo">
                Net pay · {monthLabel}
              </div>
            </div>
            <div className="text-4xl font-black text-emerald-700 font-cairo">
              {formatEGP(entry.net_salary)}
            </div>
          </div>
        </section>

        {(emp?.bank_name || emp?.bank_account_number) && (
          <section className="px-8 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2 font-cairo">
              بيانات التحويل البنكي
            </h2>
            <div className="grid grid-cols-2 gap-x-6 text-sm font-cairo">
              <Row label="البنك" value={emp.bank_name ?? "—"} />
              <Row label="رقم الحساب" value={emp.bank_account_number ?? "—"} mono />
            </div>
          </section>
        )}

        <section className="px-8 py-8 grid grid-cols-2 gap-12">
          <SignatureBox label="توقيع الموظف" />
          <SignatureBox label="توقيع الإدارة / HR" />
        </section>

        <footer className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 font-cairo flex flex-wrap items-center justify-between gap-2">
          <div>Nidham · <ClientDate /></div>
          <div className="font-mono" dir="ltr">{entryId}</div>
        </footer>
      </article>
    </main>
  );
}

function Row({ label, value, bold, mono }: { label: string; value: string; bold?: boolean; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
      <div className={`text-slate-800 ${bold ? "font-bold" : ""} ${mono ? "font-mono text-right" : ""}`} dir={mono ? "ltr" : undefined}>
        {value}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: "emerald" | "amber" | "slate" | "red" }) {
  const colorClasses = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-slate-100 text-slate-600 border-slate-200",
    red: "bg-red-50 text-red-700 border-red-200",
  }[color];
  return (
    <div className={`p-2 rounded-lg border ${colorClasses}`}>
      <div className="text-xl font-black">{value}</div>
      <div className="text-[10px] font-bold">{label}</div>
    </div>
  );
}

function LineItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-slate-700">
      <span>{label}</span>
      <span className="font-mono" dir="ltr">{formatEGP(value)}</span>
    </div>
  );
}

function SignatureBox({ label }: { label: string }) {
  return (
    <div>
      <div className="border-b-2 border-slate-300 h-12 mb-2" />
      <div className="text-xs text-slate-500 font-cairo text-center">{label}</div>
    </div>
  );
}
