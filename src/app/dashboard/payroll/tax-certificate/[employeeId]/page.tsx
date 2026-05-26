// ============================================================================
// /dashboard/payroll/tax-certificate/[employeeId]?year=YYYY
// ============================================================================
//
// Renders the annual income-tax certificate (نموذج 41 — الإقرار السنوي)
// that an Egyptian employee needs when filing their personal income tax.
//
// The data comes from the employee_tax_certificate() RPC introduced in
// migration 036, which sums every approved/paid payroll entry across
// the chosen year. We display the totals plus a per-period breakdown
// so the employee can cross-check against their payslips.

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyProfile, requireHRPage } from "@/lib/permissions";
import { formatEGP } from "@/lib/payroll";
import { DownloadPdfButton } from "@/components/download-pdf-button";

type PageProps = {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ year?: string }>;
};

type CertRow = {
  employee_id: string;
  employee_name: string;
  national_id: string | null;
  year: number;
  periods_count: number;
  gross_total: number;
  insurance_total: number;
  tax_total: number;
  bonuses_total: number;
  net_total: number;
};

type PeriodBreakdown = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  year: number;
  month: number;
  status: string;
  entries: {
    gross_salary: number;
    social_insurance: number;
    income_tax: number;
    bonuses: number;
    net_salary: number;
  }[];
};

const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export default async function TaxCertificatePage({
  params,
  searchParams,
}: PageProps) {
  const { employeeId } = await params;
  const { year: yearRaw } = await searchParams;

  await requireHRPage();
  const supabase = await createClient();

  // Scope tenant lookups so a super-admin session can't pull another
  // tenant's payroll periods just because they know an employee UUID.
  const { profile } = await getMyProfile();
  const callerCompanyId = profile?.company_id ?? "";

  const year = yearRaw ? parseInt(yearRaw, 10) : new Date().getFullYear();
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    redirect(`/dashboard/payroll/tax-certificate/${employeeId}`);
  }

  // Fetch certificate totals + per-period breakdown
  const [certRes, employeeRes, breakdownRes] = await Promise.all([
    supabase.rpc("employee_tax_certificate", {
      p_employee_id: employeeId,
      p_year: year,
    }),
    // J4: Single-step read from employees_with_pii. The previous two-step
    // workaround existed because pii_decrypt was REVOKE'd from
    // authenticated (migration 050 quirk). Migration 067 fixed that, so
    // the view now returns decrypted PII correctly under the authenticated
    // context. If the view ever fails for a real reason (employee missing,
    // RLS denial), notFound() below catches it instead of silently
    // rendering a blank national_id on an official tax certificate.
    supabase
      .from("employees_with_pii")
      .select(
        "full_name, job_title, department, hire_date, basic_salary, national_id_dec",
      )
      .eq("id", employeeId)
      .single<{
        full_name: string;
        job_title: string | null;
        department: string | null;
        hire_date: string | null;
        basic_salary: number | null;
        national_id_dec: string | null;
      }>(),
    supabase
      .from("payroll_periods")
      .select(
        "id, start_date, end_date, year, month, status, payroll_entries(gross_salary, social_insurance, income_tax, bonuses, net_salary, employee_id)",
      )
      .eq("company_id", callerCompanyId)
      .eq("year", year)
      .in("status", ["approved", "paid"])
      .order("month")
      .returns<
        (PeriodBreakdown & {
          payroll_entries: {
            gross_salary: number;
            social_insurance: number;
            income_tax: number;
            bonuses: number;
            net_salary: number;
            employee_id: string;
          }[];
        })[]
      >(),
  ]);

  if (!employeeRes.data) notFound();

  const employee = {
    ...employeeRes.data,
    national_id: employeeRes.data.national_id_dec,
  };

  const certArr = (certRes.data ?? []) as CertRow[];
  const cert = certArr[0] ?? null;

  // Filter breakdown to only this employee's entries
  const breakdown = (breakdownRes.data ?? [])
    .map((p) => ({
      ...p,
      entries: p.payroll_entries.filter((e) => e.employee_id === employeeId),
    }))
    .filter((p) => p.entries.length > 0);

  // Available years for the dropdown
  const { data: yearsData } = await supabase
    .from("payroll_periods")
    .select("year")
    .eq("company_id", callerCompanyId)
    .order("year", { ascending: false });
  const availableYears = Array.from(
    new Set((yearsData ?? []).map((y) => y.year as number)),
  );

  const today = new Date();
  const issueDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <main className="flex-1 px-4 md:px-6 py-6 bg-gradient-to-b from-slate-50 via-white min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2 pdf-hide">
          <Link
            href={`/dashboard/employees/${employeeId}`}
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرجوع لملف الموظف
          </Link>

          {/* Year selector — plain <form method="GET"> so it works
              without client-side JS (server component) */}
          <form method="GET" className="flex items-center gap-2">
            <label className="text-xs text-slate-500 font-cairo">السنة:</label>
            <select
              name="year"
              defaultValue={year}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-cairo focus:border-brand-cyan outline-none"
            >
              {availableYears.length === 0 && (
                <option value={year}>{year}</option>
              )}
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs font-cairo transition"
            >
              عرض
            </button>
          </form>
        </div>

        {/* Download button */}
        <div className="mb-4 flex justify-center pdf-hide">
          <DownloadPdfButton
            targetSelector="#tax-cert-pdf"
            filename={`tax-certificate-${employee.full_name}-${year}.pdf`}
            label="📥 تنزيل الشهادة PDF"
          />
        </div>

        {/* PDF-captured content */}
        <div
          id="tax-cert-pdf"
          className="bg-white border-2 border-slate-200 rounded-2xl p-6 md:p-10 shadow-lg"
        >
          {/* Letterhead */}
          <div className="text-center mb-6 pb-4 border-b-2 border-slate-200">
            <div className="text-[10px] tracking-[0.3em] text-slate-500 mb-1 font-cairo">
              النموذج رقم 41
            </div>
            <h1 className="text-2xl font-black font-cairo text-slate-800 mb-1">
              إقرار سنوي بأجر الموظف وضرائبه المستحقة
            </h1>
            <p className="text-sm text-slate-500 font-cairo">
              عن السنة المالية {year}
            </p>
          </div>

          {/* Employee details */}
          <section className="mb-6">
            <h2 className="text-sm font-black text-slate-700 mb-3 font-cairo">
              بيانات الموظف
            </h2>
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <Field label="الاسم" value={employee.full_name} />
              <Field
                label="الرقم القومي"
                value={employee.national_id ?? "—"}
                dir="ltr"
              />
              <Field
                label="المسمى الوظيفي"
                value={employee.job_title ?? "—"}
              />
              <Field label="القسم" value={employee.department ?? "—"} />
              <Field
                label="تاريخ التعيين"
                value={employee.hire_date ?? "—"}
                dir="ltr"
              />
              <Field
                label="الراتب الأساسي"
                value={formatEGP(employee.basic_salary ?? 0)}
              />
            </div>
          </section>

          {/* Annual totals — the actual certificate body */}
          <section className="mb-6">
            <h2 className="text-sm font-black text-slate-700 mb-3 font-cairo">
              الإجماليات السنوية
            </h2>
            {!cert || cert.periods_count === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 font-cairo text-sm">
                مفيش دورات مرتبات معتمدة أو مدفوعة للموظف ده في سنة {year}.
              </div>
            ) : (
              <div className="border-2 border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-sm">
                  <tbody className="divide-y divide-slate-100">
                    <TotalRow
                      label="عدد دورات الرواتب"
                      value={String(cert.periods_count)}
                    />
                    <TotalRow
                      label="إجمالي الأجر (Gross)"
                      value={formatEGP(cert.gross_total)}
                    />
                    <TotalRow
                      label="من ضمنها مكافآت"
                      value={formatEGP(cert.bonuses_total)}
                      indent
                    />
                    <TotalRow
                      label="إجمالي التأمينات الاجتماعية المخصومة"
                      value={formatEGP(cert.insurance_total)}
                      tone="amber"
                    />
                    <TotalRow
                      label="إجمالي ضريبة الدخل المخصومة"
                      value={formatEGP(cert.tax_total)}
                      tone="rose"
                    />
                    <TotalRow
                      label="إجمالي الصافي المستلم"
                      value={formatEGP(cert.net_total)}
                      tone="emerald"
                      bold
                    />
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Period-by-period breakdown */}
          {breakdown.length > 0 && (
            <section className="mb-6">
              <h2 className="text-sm font-black text-slate-700 mb-3 font-cairo">
                التفصيل الشهري
              </h2>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 font-bold text-slate-600 font-cairo">
                        الشهر
                      </th>
                      <th className="px-3 py-2 font-bold text-slate-600 font-cairo">
                        الإجمالي
                      </th>
                      <th className="px-3 py-2 font-bold text-slate-600 font-cairo">
                        تأمينات
                      </th>
                      <th className="px-3 py-2 font-bold text-slate-600 font-cairo">
                        ضريبة
                      </th>
                      <th className="px-3 py-2 font-bold text-slate-600 font-cairo">
                        الصافي
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {breakdown.map((p) => {
                      const t = p.entries.reduce(
                        (acc, e) => ({
                          gross: acc.gross + Number(e.gross_salary),
                          ins: acc.ins + Number(e.social_insurance),
                          tax: acc.tax + Number(e.income_tax),
                          net: acc.net + Number(e.net_salary),
                        }),
                        { gross: 0, ins: 0, tax: 0, net: 0 },
                      );
                      const periodLabel =
                        p.start_date && p.end_date
                          ? `${p.start_date} → ${p.end_date}`
                          : `${ARABIC_MONTHS[p.month - 1]} ${p.year}`;
                      return (
                        <tr key={p.id}>
                          <td className="px-3 py-2 font-cairo text-slate-700">
                            {periodLabel}
                          </td>
                          <td className="px-3 py-2 font-cairo">
                            {formatEGP(t.gross)}
                          </td>
                          <td className="px-3 py-2 text-amber-700 font-cairo">
                            {formatEGP(t.ins)}
                          </td>
                          <td className="px-3 py-2 text-rose-700 font-cairo">
                            {formatEGP(t.tax)}
                          </td>
                          <td className="px-3 py-2 text-emerald-700 font-bold font-cairo">
                            {formatEGP(t.net)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Signature block */}
          <div className="mt-10 grid md:grid-cols-2 gap-6 text-xs font-cairo text-slate-600">
            <div className="border-t-2 border-slate-300 pt-2 text-center">
              <div className="font-bold text-slate-700 mb-1">
                توقيع المسؤول
              </div>
              <div className="text-[11px]">صاحب العمل / مسؤول الموارد البشرية</div>
            </div>
            <div className="border-t-2 border-slate-300 pt-2 text-center">
              <div className="font-bold text-slate-700 mb-1">
                ختم الشركة
              </div>
              <div className="text-[11px]">تاريخ الإصدار: {issueDate}</div>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-400 mt-6 font-cairo">
            تم إصدار هذه الشهادة من نظام نِظام HR · مطابق لقانون الضريبة على الدخل والتأمينات الاجتماعية المصري
          </p>
        </div>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------
function Field({
  label,
  value,
  dir,
}: {
  label: string;
  value: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-slate-500 text-xs font-cairo">{label}:</span>
      <span className="font-bold text-slate-800 font-cairo" dir={dir}>
        {value}
      </span>
    </div>
  );
}

function TotalRow({
  label,
  value,
  tone,
  bold,
  indent,
}: {
  label: string;
  value: string;
  tone?: "amber" | "rose" | "emerald";
  bold?: boolean;
  indent?: boolean;
}) {
  const valueCls = tone
    ? {
        amber: "text-amber-700",
        rose: "text-rose-700",
        emerald: "text-emerald-700",
      }[tone]
    : "text-slate-800";
  return (
    <tr className={bold ? "bg-emerald-50/30" : ""}>
      <td
        className={`px-4 py-2.5 font-cairo text-slate-700 ${indent ? "pr-10" : ""}`}
      >
        {label}
      </td>
      <td
        className={`px-4 py-2.5 font-cairo text-left ${valueCls} ${bold ? "font-black text-base" : "font-bold"}`}
      >
        {value}
      </td>
    </tr>
  );
}
