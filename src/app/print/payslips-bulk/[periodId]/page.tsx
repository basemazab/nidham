// ============================================================================
// /print/payslips-bulk/[periodId] — All payslips in one document
// ============================================================================
//
// Renders every employee's payslip for the period back-to-back in a
// single printable document. Each payslip starts on its own A4 page
// via page-break-before so the printer / PDF engine emits one paper
// per employee.
//
// One-click flow:
//   1) HR opens the period
//   2) Clicks "🧾 طباعة كل القسائم"
//   3) This page auto-loads with all payslips rendered
//   4) Browser print dialog fires automatically (via AutoPrint)
//   5) User picks "Save as PDF" or prints to paper
//
// Saves HR from clicking 50 payslip links one-by-one.

import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatEGP } from "@/lib/payroll";
import { AutoPrint } from "@/components/auto-print";
import { PrintAgainButton } from "@/components/print-again-button";

type PageProps = { params: Promise<{ periodId: string }> };

type Period = {
  id: string;
  year: number;
  month: number;
  frequency: "monthly" | "weekly" | null;
  start_date: string | null;
  end_date: string | null;
  working_days: number;
  status: string;
  paid_at: string | null;
};

type Employee = {
  full_name: string;
  employee_code: string | null;
  job_title: string | null;
  department: string | null;
  national_id: string | null;
  social_insurance_number: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  hire_date: string | null;
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
  bonus_reason: string | null;
  overtime: number;
  gross_salary: number;
  absence_deduction: number;
  tardiness_deduction: number;
  social_insurance: number;
  income_tax: number;
  loan_deduction: number;
  other_deductions: number;
  total_deductions: number;
  eos_gratuity: number;
  net_salary: number;
  notes: string | null;
  employees: Employee | null;
};

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatIsoDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export const metadata = {
  title: "كل قسائم المرتبات | نِظام",
};

export default async function BulkPayslipsPrintPage({ params }: PageProps) {
  const { periodId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [periodRes, entriesRes, companyRes] = await Promise.all([
    supabase
      .from("payroll_periods")
      .select("*")
      .eq("id", periodId)
      .single<Period>(),
    // PII fields (national_id, social_insurance_number, bank_*) on the
    // joined employees row come back NULL after mig 050. We batch-fetch
    // the decrypted versions from employees_with_pii below and splice
    // them into the entries before rendering.
    supabase
      .from("payroll_entries")
      .select(
        `*, employee_id, employees(full_name, employee_code, job_title, department, hire_date)`,
      )
      .eq("period_id", periodId)
      .order("employee_id")
      .returns<Array<Entry & { employee_id: string }>>(),
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();
      if (!profile?.company_id) return { data: null };
      return supabase
        .from("companies")
        .select("name")
        .eq("id", profile.company_id)
        .single<{ name: string }>();
    })(),
  ]);

  if (!periodRes.data) notFound();
  const period = periodRes.data;
  const entries = entriesRes.data ?? [];
  const companyName = companyRes.data?.name ?? "—";

  // Batch-fetch decrypted PII for every employee in this period.
  // employees_with_pii is a view onto the same underlying RLS — no
  // cross-tenant leak risk.
  const employeeIds = [
    ...new Set(entries.map((e) => e.employee_id).filter(Boolean)),
  ];
  if (employeeIds.length > 0) {
    const { data: piiRows } = await supabase
      .from("employees_with_pii")
      .select(
        "id, national_id_dec, social_insurance_number_dec, bank_name_dec, bank_account_number_dec",
      )
      .in("id", employeeIds)
      .returns<
        Array<{
          id: string;
          national_id_dec: string | null;
          social_insurance_number_dec: string | null;
          bank_name_dec: string | null;
          bank_account_number_dec: string | null;
        }>
      >();
    const piiById = new Map((piiRows ?? []).map((p) => [p.id, p]));
    for (const e of entries) {
      const pii = piiById.get(e.employee_id);
      if (e.employees && pii) {
        e.employees.national_id = pii.national_id_dec;
        e.employees.social_insurance_number = pii.social_insurance_number_dec;
        e.employees.bank_name = pii.bank_name_dec;
        e.employees.bank_account_number = pii.bank_account_number_dec;
      }
    }
  }

  const periodLabel =
    period.start_date && period.end_date
      ? `${formatIsoDate(period.start_date)} → ${formatIsoDate(period.end_date)}`
      : `${ARABIC_MONTHS[period.month - 1]} ${period.year}`;

  return (
    <>
      {/* Auto-fire print() on mount — single trigger covers all payslips */}
      <AutoPrint />

      {/* Print-only CSS: page break between each payslip, hide nav buttons */}
      <style>{`
        @page { size: A4; margin: 10mm 12mm; }
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .payslip-page {
            page-break-after: always;
            break-after: page;
          }
          .payslip-page:last-child {
            page-break-after: auto;
          }
        }
      `}</style>

      {/* Top toolbar (hidden on print) */}
      <div className="no-print bg-slate-100 border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-wrap gap-3 sticky top-0 z-10">
        <Link
          href={`/dashboard/payroll/${periodId}`}
          className="text-sm text-slate-600 hover:text-slate-900 font-cairo"
        >
          ← الرجوع للدورة
        </Link>
        <div className="text-sm font-cairo">
          <strong className="text-slate-800">{entries.length} قسيمة</strong>
          {" · "}
          <span className="text-slate-500">{periodLabel}</span>
        </div>
        <PrintAgainButton />
      </div>

      <main className="bg-slate-50 print:bg-white py-6 print:py-0">
        {entries.length === 0 ? (
          <div className="max-w-2xl mx-auto p-12 bg-white border border-slate-200 rounded-2xl text-center mt-12">
            <div className="text-5xl mb-3">📋</div>
            <h2 className="text-xl font-bold font-cairo mb-2 text-slate-700">
              مفيش قسائم
            </h2>
            <p className="text-sm text-slate-500 font-cairo">
              مفيش entries في الدورة دي. ارجع للدورة وحاول إعادة توليد القسائم.
            </p>
          </div>
        ) : (
          entries.map((entry, idx) => (
            <PayslipPage
              key={entry.id}
              entry={entry}
              periodLabel={periodLabel}
              companyName={companyName}
              isFrequency={period.frequency}
              workingDays={period.working_days}
              paidAt={period.paid_at}
              total={entries.length}
              index={idx + 1}
            />
          ))
        )}
      </main>
    </>
  );
}

// ----------------------------------------------------------------------------
// One A4 payslip page
// ----------------------------------------------------------------------------
function PayslipPage({
  entry,
  periodLabel,
  companyName,
  workingDays,
  paidAt,
  index,
  total,
}: {
  entry: Entry;
  periodLabel: string;
  companyName: string;
  isFrequency: "monthly" | "weekly" | null;
  workingDays: number;
  paidAt: string | null;
  index: number;
  total: number;
}) {
  const emp = entry.employees;
  const grossWithEos = entry.gross_salary + (entry.eos_gratuity ?? 0);

  return (
    <article
      className="payslip-page max-w-3xl mx-auto bg-white border border-slate-200 shadow-lg mb-6 print:shadow-none print:border-0 print:mb-0 print:mx-0 print:max-w-full"
      style={{ minHeight: "270mm" }}
    >
      {/* Header band — company + period */}
      <header className="px-8 py-6 bg-gradient-to-l from-slate-900 to-slate-800 text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[10px] tracking-[0.3em] text-amber-400 font-bold uppercase font-cairo mb-1">
              قسيمة راتب
            </div>
            <h1 className="text-xl font-black font-cairo">{companyName}</h1>
            <div className="text-xs text-slate-300 font-cairo mt-1">
              فترة: {periodLabel} · {workingDays} يوم عمل
            </div>
          </div>
          <div className="text-left text-xs font-cairo">
            <div className="text-slate-300">
              قسيمة {index} من {total}
            </div>
            {paidAt && (
              <div className="text-emerald-300 mt-1">
                ✓ تم الصرف
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Employee details */}
      <section className="px-8 py-4 border-b border-slate-200">
        <div className="text-[10px] tracking-wider text-slate-500 uppercase font-cairo mb-2">
          بيانات الموظف
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm font-cairo">
          <Row label="الاسم" value={emp?.full_name ?? "—"} bold />
          <Row label="كود الموظف" value={emp?.employee_code ?? "—"} mono />
          <Row label="المسمى الوظيفي" value={emp?.job_title ?? "—"} />
          <Row label="القسم" value={emp?.department ?? "—"} />
          {emp?.national_id && (
            <Row label="الرقم القومي" value={emp.national_id} mono />
          )}
          {emp?.social_insurance_number && (
            <Row label="رقم التأمينات" value={emp.social_insurance_number} mono />
          )}
        </div>
      </section>

      {/* Attendance summary */}
      <section className="px-8 py-3 bg-slate-50 border-b border-slate-200">
        <div className="text-[10px] tracking-wider text-slate-500 uppercase font-cairo mb-2">
          الحضور
        </div>
        <div className="grid grid-cols-4 gap-3 text-center text-sm font-cairo">
          <Stat
            label="حضور"
            value={entry.attended_days}
            color="emerald"
          />
          <Stat
            label="نص يوم"
            value={entry.half_day_days}
            color="cyan"
          />
          <Stat
            label="إجازة"
            value={entry.leave_days}
            color="amber"
          />
          <Stat label="غياب" value={entry.absent_days} color="rose" />
        </div>
      </section>

      {/* Earnings + Deductions */}
      <section className="px-8 py-4 grid md:grid-cols-2 gap-6 border-b border-slate-200">
        {/* Earnings */}
        <div>
          <h2 className="text-xs font-bold tracking-wider text-emerald-600 uppercase mb-3 font-cairo border-b border-emerald-100 pb-2">
            💵 الإيرادات
          </h2>
          <div className="space-y-1.5 text-sm font-cairo">
            <LineItem label="الراتب الأساسي" value={entry.basic_salary} />
            <LineItem label="بدل سكن" value={entry.housing_allowance} />
            <LineItem label="بدل انتقال" value={entry.transport_allowance} />
            <LineItem label="بدلات أخرى" value={entry.other_allowances} />
            <LineItem label="حافز" value={entry.incentive_allowance} />
            <LineItem
              label={
                entry.bonus_reason
                  ? `مكافأة (${entry.bonus_reason})`
                  : "مكافأة"
              }
              value={entry.bonuses}
            />
            <LineItem label="أوفر تايم" value={entry.overtime} />
            {entry.eos_gratuity > 0 && (
              <LineItem
                label="🚪 مكافأة نهاية الخدمة"
                value={entry.eos_gratuity}
              />
            )}
            <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-emerald-700">
              <span>إجمالي الإيرادات</span>
              <span>{formatEGP(grossWithEos)}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div>
          <h2 className="text-xs font-bold tracking-wider text-red-600 uppercase mb-3 font-cairo border-b border-red-100 pb-2">
            💸 الاستقطاعات
          </h2>
          <div className="space-y-1.5 text-sm font-cairo">
            <LineItem label="خصم الغياب" value={entry.absence_deduction} />
            <LineItem
              label="خصم تأخير / انصراف مبكر"
              value={entry.tardiness_deduction}
            />
            <LineItem
              label="التأمينات الاجتماعية"
              value={entry.social_insurance}
            />
            <LineItem label="ضريبة الدخل" value={entry.income_tax} />
            <LineItem label="قسط قرض / سلفة" value={entry.loan_deduction} />
            <LineItem
              label="خصومات أخرى"
              value={entry.other_deductions}
            />
            <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-red-700">
              <span>إجمالي الاستقطاعات</span>
              <span>{formatEGP(entry.total_deductions)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Net pay — the big number */}
      <section className="px-8 py-5 bg-gradient-to-l from-emerald-50 to-cyan-50 border-b border-emerald-200">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold tracking-wider text-emerald-700 uppercase font-cairo">
              صافي الراتب المستحق
            </div>
            <div className="text-xs text-slate-500 mt-1 font-cairo">
              Net pay · {periodLabel}
            </div>
          </div>
          <div className="text-3xl md:text-4xl font-black text-emerald-700 font-cairo">
            {formatEGP(entry.net_salary)}
          </div>
        </div>
      </section>

      {/* Bank info */}
      {(emp?.bank_name || emp?.bank_account_number) && (
        <section className="px-8 py-3 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-[10px] tracking-wider text-slate-500 uppercase mb-2 font-cairo">
            بيانات التحويل البنكي
          </h2>
          <div className="grid grid-cols-2 gap-x-6 text-sm font-cairo">
            <Row label="البنك" value={emp.bank_name ?? "—"} />
            <Row
              label="رقم الحساب"
              value={emp.bank_account_number ?? "—"}
              mono
            />
          </div>
        </section>
      )}

      {/* Notes */}
      {entry.notes && (
        <section className="px-8 py-3 border-b border-amber-100 bg-amber-50/50">
          <h2 className="text-[10px] tracking-wider text-amber-700 uppercase mb-1 font-cairo">
            ملاحظات
          </h2>
          <p className="text-xs text-amber-900 font-cairo">{entry.notes}</p>
        </section>
      )}

      {/* Signature lines */}
      <section className="px-8 py-6 grid grid-cols-2 gap-8">
        <div>
          <div className="border-t border-slate-300 pt-2 text-center text-xs font-cairo text-slate-600">
            توقيع الموظف
          </div>
        </div>
        <div>
          <div className="border-t border-slate-300 pt-2 text-center text-xs font-cairo text-slate-600">
            توقيع المسؤول + الختم
          </div>
        </div>
      </section>

      <footer className="px-8 py-2 text-center text-[9px] font-cairo text-slate-400 border-t border-slate-100">
        صادرة من نظام نِظام HR · {companyName} ·{" "}
        قسيمة #{entry.id.slice(0, 8)}
      </footer>
    </article>
  );
}

function Row({
  label,
  value,
  mono,
  bold,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <span className="text-[11px] text-slate-500 shrink-0">{label}:</span>
      <span
        className={`text-slate-800 ${mono ? "font-mono text-xs" : ""} ${bold ? "font-bold" : ""}`}
        dir={mono ? "ltr" : "rtl"}
      >
        {value}
      </span>
    </div>
  );
}

function LineItem({ label, value }: { label: string; value: number }) {
  if (value === 0) return null;
  return (
    <div className="flex justify-between text-slate-700">
      <span>{label}</span>
      <span className="font-mono">{formatEGP(value)}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "rose" | "amber" | "cyan";
}) {
  const cls = {
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
    rose: "text-rose-700 bg-rose-50 border-rose-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    cyan: "text-cyan-700 bg-cyan-50 border-cyan-200",
  }[color];
  return (
    <div className={`p-2 rounded-lg border ${cls}`}>
      <div className="text-lg font-black font-cairo">{value}</div>
      <div className="text-[10px] font-bold font-cairo">{label}</div>
    </div>
  );
}
