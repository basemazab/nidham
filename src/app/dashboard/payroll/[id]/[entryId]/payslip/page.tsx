import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatEGP } from "@/lib/payroll";
import { PrintButton } from "./print-button";
import { DownloadPdfButton } from "@/components/download-pdf-button";

// Render fresh on every request — payslip data + structure both change
// frequently (HR adjustments, new loans, late-day updates), and seeing
// last week's cached version would confuse the employee. Combined with
// the no-store header below, this bypasses any CDN / SW navigation
// cache that might serve stale HTML.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  params: Promise<{ id: string; entryId: string }>;
};

type Entry = {
  id: string;
  employee_id: string;
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

type EmployeeWithPII = {
  id: string;
  full_name: string;
  employee_code: string | null;
  job_title: string | null;
  department: string | null;
  hire_date: string | null;
  national_id_dec: string | null;
  social_insurance_number_dec: string | null;
  bank_name_dec: string | null;
  bank_account_number_dec: string | null;
};

type Loan = {
  id: string;
  amount: number;
  monthly_installment: number;
  remaining_amount: number;
  status: string;
  reason: string | null;
  requested_at: string;
};

type AttendanceDay = {
  date: string;
  status: string;
  tardiness_minutes: number | null;
  early_leave_minutes: number | null;
};

type Company = {
  name: string;
};

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default async function PayslipPage({ params }: PageProps) {
  const { id, entryId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 1. Payroll entry + period (joined). We DON'T join employees here
  //    because the employees table has the PII columns nulled after the
  //    encryption trigger (mig 050). We read the DECRYPTED PII below
  //    from employees_with_pii instead.
  const { data: entry } = await supabase
    .from("payroll_entries")
    .select(
      "*, payroll_periods(year, month, frequency, start_date, end_date, working_days, status, paid_at)",
    )
    .eq("id", entryId)
    .single<Entry>();

  if (!entry) notFound();

  // 2. Employee with decrypted PII (mig 067 grants pii_decrypt to
  //    authenticated, so this returns proper values now — fixes the
  //    old "—" display for national_id and bank info).
  const { data: emp } = await supabase
    .from("employees_with_pii")
    .select(
      "id, full_name, employee_code, job_title, department, hire_date, national_id_dec, social_insurance_number_dec, bank_name_dec, bank_account_number_dec",
    )
    .eq("id", entry.employee_id)
    .maybeSingle<EmployeeWithPII>();

  // 3. ALL loans for this employee (lifetime). Used to show:
  //      • Total taken (sum of all amounts)
  //      • Total paid back (sum of payments)
  //      • Total remaining outstanding (sum across active loans)
  //    This is exactly what the user asked for: "إجمالي السلف اللي اخدها".
  const { data: loans } = await supabase
    .from("employee_loans")
    .select(
      "id, amount, monthly_installment, remaining_amount, status, reason, requested_at",
    )
    .eq("employee_id", entry.employee_id)
    .order("requested_at", { ascending: false })
    .returns<Loan[]>();

  const allLoans = loans ?? [];
  const activeLoans = allLoans.filter(
    (l) => l.status === "active" || l.status === "approved",
  );
  const totalLoanAmount = allLoans.reduce((s, l) => s + Number(l.amount), 0);
  const totalLoanPaid = allLoans.reduce(
    (s, l) => s + (Number(l.amount) - Number(l.remaining_amount)),
    0,
  );
  const totalLoanRemaining = activeLoans.reduce(
    (s, l) => s + Number(l.remaining_amount),
    0,
  );

  // 4. Attendance details for the period — tardiness + early-leave
  //    in MINUTES (not just the deduction amount). User explicitly
  //    asked for this: "إجمالي التأخيرات".
  const periodStart = entry.payroll_periods?.start_date;
  const periodEnd = entry.payroll_periods?.end_date;
  let attendance: AttendanceDay[] = [];
  if (periodStart && periodEnd) {
    const { data: attRows } = await supabase
      .from("attendance")
      .select("date, status, tardiness_minutes, early_leave_minutes")
      .eq("employee_id", entry.employee_id)
      .gte("date", periodStart)
      .lte("date", periodEnd)
      .returns<AttendanceDay[]>();
    attendance = attRows ?? [];
  }
  const totalTardinessMinutes = attendance.reduce(
    (s, r) => s + Number(r.tardiness_minutes ?? 0),
    0,
  );
  const totalEarlyLeaveMinutes = attendance.reduce(
    (s, r) => s + Number(r.early_leave_minutes ?? 0),
    0,
  );
  const lateDaysCount = attendance.filter(
    (r) => (r.tardiness_minutes ?? 0) > 0,
  ).length;
  const earlyLeaveDaysCount = attendance.filter(
    (r) => (r.early_leave_minutes ?? 0) > 0,
  ).length;

  // Company name for the header
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
      .single<Company>();
    if (company) companyName = company.name;
  }

  const period = entry.payroll_periods;
  // (emp pulled separately above from employees_with_pii — see lines ~95)
  // Prefer the explicit cycle window (migration 026). Fall back to
  // year+month for any pre-026 row that wasn't backfilled.
  const monthLabel = period
    ? period.start_date && period.end_date
      ? `${formatIsoDate(period.start_date)} → ${formatIsoDate(period.end_date)}`
      : `${ARABIC_MONTHS[period.month - 1]} ${period.year}`
    : "—";
  const cycleTypeLabel = period?.frequency === "weekly" ? "أسبوعي" : "شهري";

  return (
    <main className="flex-1 bg-slate-100 min-h-screen py-8 px-4 print:bg-white print:p-0">
      {/* Top action bar (hidden when printing) */}
      <div className="max-w-3xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/dashboard/payroll/${id}`}
          className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
        >
          ← الرجوع لشهر المرتبات
        </Link>
        <div className="flex flex-wrap gap-2 items-center">
          <DownloadPdfButton
            targetSelector="#payslip-pdf"
            filename={`payslip-${emp?.full_name?.replace(/\s+/g, "-") ?? entryId.slice(0, 8)}.pdf`}
          />
          <PrintButton />
        </div>
      </div>

      {/* The payslip card — A4-friendly */}
      <article
        id="payslip-pdf"
        className="max-w-3xl mx-auto bg-white shadow-lg print:shadow-none print:max-w-none rounded-2xl print:rounded-none border border-slate-200 print:border-0 overflow-hidden"
        dir="rtl"
      >
        {/* Header bar */}
        <div className="bg-gradient-to-l from-brand-cyan-dark to-brand-navy text-white px-8 py-6 print:bg-slate-800 print:text-white">
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
                    : period?.status === "draft"
                      ? "مسودة"
                      : "—"}
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
            <Row
              label="الرقم القومي"
              value={emp?.national_id_dec ?? "—"}
              mono
            />
            <Row
              label="رقم التأمينات"
              value={emp?.social_insurance_number_dec ?? "—"}
              mono
            />
            <Row
              label="تاريخ التعيين"
              value={emp?.hire_date ? formatIsoDate(emp.hire_date) : "—"}
            />
            <Row label="أيام العمل بالشهر" value={`${period?.working_days ?? "—"} يوم`} />
          </div>
        </section>

        {/* Attendance — days summary */}
        <section className="px-8 py-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-3 font-cairo">
            الحضور والانصراف · ملخص الأيام
          </h2>
          <div className="grid grid-cols-4 gap-3 text-center text-sm font-cairo">
            <Stat label="حضور" value={String(entry.attended_days)} color="emerald" />
            <Stat label="نصف يوم" value={String(entry.half_day_days)} color="amber" />
            <Stat label="إجازة" value={String(entry.leave_days)} color="slate" />
            <Stat label="غياب" value={String(entry.absent_days)} color="red" />
          </div>
        </section>

        {/* Tardiness + early-leave MINUTES breakdown.
            ALWAYS rendered (no conditional) — employee should see the
            structure even at zero so they understand what's being tracked. */}
        <section className="px-8 py-5 border-b border-slate-100 bg-amber-50/40">
          <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-3 font-cairo">
            تفصيل التأخير والانصراف المبكر
          </h2>
          <div className="grid grid-cols-2 gap-3 font-cairo text-sm">
            <div className="bg-white border-2 border-amber-200 rounded-xl p-3">
              <div className="text-[10px] text-amber-700 font-bold uppercase tracking-wider mb-1">
                ⏰ إجمالي التأخير في الشهر
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-800 font-mono">
                  {totalTardinessMinutes}
                </span>
                <span className="text-xs text-amber-700">دقيقة</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {lateDaysCount > 0
                  ? `في ${lateDaysCount} يوم تأخّرت فيهم`
                  : "✓ مفيش تأخير الشهر ده — ممتاز"}
              </div>
            </div>
            <div className="bg-white border-2 border-orange-200 rounded-xl p-3">
              <div className="text-[10px] text-orange-700 font-bold uppercase tracking-wider mb-1">
                🚪 إجمالي الانصراف المبكر
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-orange-800 font-mono">
                  {totalEarlyLeaveMinutes}
                </span>
                <span className="text-xs text-orange-700">دقيقة</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                {earlyLeaveDaysCount > 0
                  ? `في ${earlyLeaveDaysCount} يوم انصرفت فيهم بدري`
                  : "✓ مفيش انصراف مبكر — ممتاز"}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            💡 خصم التأخير المالي مذكور تحت في قسم "الاستقطاعات"
          </p>
        </section>

        {/* Earnings & Deductions side by side */}
        <section className="px-8 py-6 grid md:grid-cols-2 gap-8 border-b border-slate-100">
          {/* Earnings */}
          <div>
            <h2 className="text-xs font-bold tracking-wider text-emerald-600 uppercase mb-3 font-cairo border-b border-emerald-100 pb-2">
              💵 الإيرادات
            </h2>
            <div className="divide-y divide-emerald-100 text-sm font-cairo">
              <LineItem
                emoji="💼"
                label="الراتب الأساسي"
                hint="الأجر الأساسي قبل أي بدلات"
                value={entry.basic_salary}
              />
              <LineItem
                emoji="🏠"
                label="بدل سكن"
                hint="حسب عقد العمل"
                value={entry.housing_allowance}
              />
              <LineItem
                emoji="🚗"
                label="بدل انتقال"
                hint="مواصلات يومية"
                value={entry.transport_allowance}
              />
              <LineItem
                emoji="📦"
                label="بدلات أخرى"
                hint="موبايل، أدوات، إلخ"
                value={entry.other_allowances}
              />
              <LineItem
                emoji="🎁"
                label="حافز"
                hint="حافز إنتاج / حافز أداء شهري"
                value={entry.incentive_allowance}
              />
              <LineItem
                emoji="🎉"
                label={
                  entry.bonus_reason
                    ? `مكافأة (${entry.bonus_reason})`
                    : "مكافأة"
                }
                hint="مكافأة استثنائية لشهر معين"
                value={entry.bonuses}
              />
              <LineItem
                emoji="⏱"
                label="أوفر تايم"
                hint="ساعات إضافية × المعدل القانوني"
                value={entry.overtime}
              />
              <LineItem
                emoji="🚪"
                label="مكافأة نهاية الخدمة"
                hint="حسب مادة 122 — تظهر فقط عند الإنهاء"
                value={entry.eos_gratuity}
              />
              <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-emerald-700">
                <span>إجمالي الإيرادات</span>
                <span>
                  {formatEGP(
                    entry.basic_salary +
                      entry.housing_allowance +
                      entry.transport_allowance +
                      entry.other_allowances +
                      entry.incentive_allowance +
                      entry.bonuses +
                      entry.overtime +
                      entry.eos_gratuity,
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Deductions */}
          <div>
            <h2 className="text-xs font-bold tracking-wider text-red-600 uppercase mb-3 font-cairo border-b border-red-100 pb-2">
              💸 الاستقطاعات
            </h2>
            <div className="space-y-2 text-sm font-cairo">
              <LineItem
                emoji="❌"
                label={`خصم الغياب${
                  entry.absent_days > 0 ? ` (${entry.absent_days} يوم)` : ""
                }`}
                hint={
                  entry.absent_days > 0
                    ? "غياب بدون إذن — يخصم يوم كامل لكل يوم"
                    : "خصم على الغياب بدون إذن"
                }
                value={entry.absence_deduction}
              />
              <LineItem
                emoji="⏰"
                label={`خصم التأخير${
                  totalTardinessMinutes > 0
                    ? ` (${totalTardinessMinutes} دقيقة)`
                    : ""
                } والانصراف المبكر${
                  totalEarlyLeaveMinutes > 0
                    ? ` (${totalEarlyLeaveMinutes} دقيقة)`
                    : ""
                }`}
                hint={
                  totalTardinessMinutes > 0 || totalEarlyLeaveMinutes > 0
                    ? `إجمالي ${totalTardinessMinutes + totalEarlyLeaveMinutes} دقيقة في الشهر`
                    : "تأخير عن مواعيد العمل / انصراف قبل ميعاد الانصراف"
                }
                value={entry.tardiness_deduction}
              />
              <LineItem
                emoji="🏥"
                label="التأمينات الاجتماعية (14%)"
                hint="حصة الموظف — قانون 148/2019"
                value={entry.social_insurance}
              />
              <LineItem
                emoji="📊"
                label="ضريبة الدخل"
                hint="حسب شرائح 2026 الضريبية"
                value={entry.income_tax}
              />
              <LineItem
                emoji="💵"
                label={`قسط السلفة هذا الشهر${
                  activeLoans.length > 1
                    ? ` (${activeLoans.length} سلف نشطة)`
                    : ""
                }`}
                hint={
                  activeLoans.length > 0
                    ? `موزّع على ${activeLoans.length} سلفة — التفاصيل تحت`
                    : "مفيش سلف نشطة"
                }
                value={entry.loan_deduction}
              />
              <LineItem
                emoji="⚠"
                label="جزاءات وخصومات أخرى"
                hint="إنذارات / مخالفات / تلف عهدة / غيرها"
                value={entry.other_deductions}
              />
              <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between font-bold text-red-700">
                <span>إجمالي الاستقطاعات</span>
                <span>{formatEGP(entry.total_deductions)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Net salary — the big number */}
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
            <div className="text-3xl md:text-4xl font-black text-emerald-700 font-cairo">
              {formatEGP(entry.net_salary)}
            </div>
          </div>
        </section>

        {/* Bank details */}
        {(emp?.bank_name_dec || emp?.bank_account_number_dec) && (
          <section className="px-8 py-4 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2 font-cairo">
              بيانات التحويل البنكي
            </h2>
            <div className="grid grid-cols-2 gap-x-6 text-sm font-cairo">
              <Row label="البنك" value={emp.bank_name_dec ?? "—"} />
              <Row
                label="رقم الحساب"
                value={maskAccount(emp.bank_account_number_dec)}
                mono
              />
            </div>
          </section>
        )}

        {/* Loan summary — ALWAYS rendered so the employee sees the
            framework even at zero. Shows lifetime taken, paid back, and
            what's still due. */}
        <section className="px-8 py-5 border-b border-slate-100">
          <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-3 font-cairo">
            💵 ملخص السلف والقروض
          </h2>

          {/* 3 big numbers — visible always */}
          <div className="grid grid-cols-3 gap-3 mb-4 font-cairo">
            <div className="p-3 rounded-xl bg-slate-50 border-2 border-slate-200 text-center">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
                إجمالي السلف المأخوذة
              </div>
              <div
                className="text-xl font-black text-slate-800 font-mono"
                dir="ltr"
              >
                {formatEGP(totalLoanAmount)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {allLoans.length > 0
                  ? `عبر ${allLoans.length} سلفة`
                  : "ما خدتش سلف لسه"}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-center">
              <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider mb-1">
                إجمالي المسدّد
              </div>
              <div
                className="text-xl font-black text-emerald-700 font-mono"
                dir="ltr"
              >
                {formatEGP(totalLoanPaid)}
              </div>
              <div className="text-[10px] text-emerald-600 mt-0.5">
                من بداية تعيينك
              </div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border-2 border-amber-200 text-center">
              <div className="text-[10px] text-amber-700 font-bold uppercase tracking-wider mb-1">
                المتبقي عليك
              </div>
              <div
                className="text-xl font-black text-amber-700 font-mono"
                dir="ltr"
              >
                {formatEGP(totalLoanRemaining)}
              </div>
              <div className="text-[10px] text-amber-600 mt-0.5">
                {activeLoans.length > 0
                  ? `${activeLoans.length} سلفة نشطة`
                  : "✓ خالي تماماً"}
              </div>
            </div>
          </div>

          {/* Active loans detail */}
          {activeLoans.length > 0 ? (
            <div className="space-y-2 text-xs font-cairo">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                السلف النشطة:
              </div>
              {activeLoans.map((l) => {
                const paid = Number(l.amount) - Number(l.remaining_amount);
                const pct =
                  Number(l.amount) > 0
                    ? Math.round((paid / Number(l.amount)) * 100)
                    : 0;
                return (
                  <div
                    key={l.id}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-200"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-slate-700 truncate">
                        {l.reason ||
                          `سلفة بقيمة ${formatEGP(Number(l.amount))}`}
                      </span>
                      <span
                        className="font-mono text-slate-600 whitespace-nowrap"
                        dir="ltr"
                      >
                        {formatEGP(Number(l.remaining_amount))} متبقي ·{" "}
                        {formatEGP(Number(l.monthly_installment))}/شهر
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-400 to-emerald-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {pct}% اتسدّد · بدأت في{" "}
                      {formatIsoDate(l.requested_at.split("T")[0])}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center text-xs font-cairo text-emerald-700">
              ✓ مفيش سلف نشطة دلوقتي — لو احتجت سلفة، كلم HR من تطبيق
              الموبايل
            </div>
          )}
        </section>

        {/* Notes */}
        {entry.notes && (
          <section className="px-8 py-4 border-b border-slate-100">
            <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase mb-2 font-cairo">
              ملاحظات
            </h2>
            <p className="text-sm text-slate-700 font-cairo whitespace-pre-line">
              {entry.notes}
            </p>
          </section>
        )}

        {/* Signatures */}
        <section className="px-8 py-8 grid grid-cols-2 gap-12 print:gap-20">
          <SignatureBox label="توقيع الموظف" />
          <SignatureBox label="توقيع الإدارة / HR" />
        </section>

        {/* Footer */}
        <footer className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 font-cairo flex flex-wrap items-center justify-between gap-2">
          <div>
            تم احتساب التأمينات والضريبة وفقًا لقانون التأمينات 148/2019 وقانون
            الضريبة على الدخل 91/2005 وتعديلاته (2024-2025).
          </div>
          <div className="font-mono" dir="ltr">
            Generated by نِظام · Nidham
          </div>
        </footer>
      </article>

      <p className="text-center text-xs text-slate-400 mt-6 print:hidden font-cairo">
        💡 اضغط «طباعة» أو Ctrl+P عشان تحفظ القسيمة PDF أو تطبعها
      </p>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Small presentational helpers
// ----------------------------------------------------------------------------

function Row({
  label,
  value,
  bold,
  mono,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] text-slate-400 mb-0.5">{label}</div>
      <div
        className={`text-slate-800 ${bold ? "font-bold" : ""} ${mono ? "font-mono text-right" : ""}`}
        dir={mono ? "ltr" : undefined}
      >
        {value}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "emerald" | "amber" | "slate" | "red";
}) {
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

function LineItem({
  label,
  value,
  emoji,
  hint,
}: {
  label: string;
  value: number;
  emoji?: string;
  hint?: string;
}) {
  // Zero values are deliberately rendered (so the employee sees every
  // possible payslip line) but visually muted so they don't compete
  // with the lines that actually have money attached.
  const isZero = value === 0;
  return (
    <div
      className={`flex items-start justify-between py-1.5 ${
        isZero ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-1.5 flex-1 min-w-0">
        {emoji && <span className="text-base flex-shrink-0">{emoji}</span>}
        <div className="flex-1 min-w-0">
          <div className="text-slate-800 text-sm">{label}</div>
          {hint && (
            <div className="text-[10px] text-slate-500 mt-0.5">{hint}</div>
          )}
        </div>
      </div>
      <span
        className={`font-mono whitespace-nowrap mr-2 ${
          isZero ? "text-slate-400" : "text-slate-800 font-bold"
        }`}
        dir="ltr"
      >
        {formatEGP(value)}
      </span>
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

/**
 * Mask a bank account number so only the last 4 digits show. Used on
 * the payslip to avoid full-account-number leak if the printed PDF is
 * forwarded or photographed. Returns "—" for empty input.
 */
function maskAccount(acc: string | null | undefined): string {
  if (!acc) return "—";
  const clean = acc.replace(/\s+/g, "");
  if (clean.length < 6) return clean;
  return `**** **** ${clean.slice(-4)}`;
}
