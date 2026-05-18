// ============================================================================
// /dashboard/payroll/[id]/export — downloadable exports
// ============================================================================
//
// One route handles THREE formats based on the `?format=` query string:
//
//   ?format=xlsx  -> full payroll register (default)
//   ?format=csv   -> generic bank-friendly CSV
//   ?format=sif   -> CIB/NBE pipe-delimited SIF
//
// The output is streamed with an attachment Content-Disposition so the
// browser saves the file instead of trying to display it.

import { NextResponse } from "next/server";
import { requireHR } from "@/lib/permissions";
import {
  buildBankCsv,
  buildBankSif,
  buildPayrollXlsx,
  type PayrollExportRow,
  type PeriodMeta,
} from "@/lib/payroll-export";

type RouteContext = { params: Promise<{ id: string }> };

type EntryRow = {
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
  eos_gratuity: number;
  notes: string | null;
  employee_id: string;
  // The embedded employees relation now returns only the non-PII fields
  // (PII is fetched separately via the employees_with_pii view — see
  // the body of GET below). We splice the PII back in before building
  // PayrollExportRow.
  employees: {
    employee_code: string | null;
    full_name: string;
    job_title: string | null;
    department: string | null;
    bank_iban: string | null;
    payment_method: "cash" | "bank" | "instapay" | null;
  } | null;
};

/** Decrypted PII pulled separately from the employees_with_pii view. */
type EmployeePIIRow = {
  id: string;
  national_id_dec: string | null;
  bank_name_dec: string | null;
  bank_account_number_dec: string | null;
};

export async function GET(req: Request, ctx: RouteContext) {
  const { supabase, profile } = await requireHR();
  const { id: periodId } = await ctx.params;

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "xlsx").toLowerCase();

  // Fetch the period + company + entries (RLS scopes to caller's tenant)
  const [periodRes, companyRes, entriesRes] = await Promise.all([
    supabase
      .from("payroll_periods")
      .select("year, month, frequency, start_date, end_date, working_days, status")
      .eq("id", periodId)
      .single<{
        year: number;
        month: number;
        frequency: "monthly" | "weekly" | null;
        start_date: string | null;
        end_date: string | null;
        working_days: number;
        status: string;
      }>(),
    supabase
      .from("companies")
      .select("name")
      .eq("id", profile.company_id)
      .single<{ name: string }>(),
    // Join to the base `employees` table for non-PII fields (employee_code,
    // full_name, job_title, etc.). PII fields (national_id, bank_*) on the
    // raw table are NULL after mig 050's encryption trigger, so we fetch
    // them separately below via the `employees_with_pii` view.
    supabase
      .from("payroll_entries")
      .select(
        "id, employee_id, attended_days, half_day_days, leave_days, absent_days, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, bonuses, overtime, gross_salary, absence_deduction, tardiness_deduction, social_insurance, income_tax, loan_deduction, other_deductions, total_deductions, net_salary, eos_gratuity, notes, employees(employee_code, full_name, job_title, department, bank_iban, payment_method)",
      )
      .eq("period_id", periodId)
      .order("employee_id")
      .returns<EntryRow[]>(),
  ]);

  if (!periodRes.data) {
    return NextResponse.json({ error: "Period not found" }, { status: 404 });
  }

  const period = periodRes.data;
  const company = companyRes.data;
  const entries = entriesRes.data ?? [];

  // Fetch the decrypted PII for everyone in this period in ONE round-trip
  // through the employees_with_pii view (mig 050). PostgREST doesn't let
  // us embed the view as a relation off payroll_entries, so we batch-fetch
  // by employee_id and splice into the rows below.
  const employeeIds = [
    ...new Set(entries.map((e) => e.employee_id).filter(Boolean)),
  ];
  const piiById = new Map<string, EmployeePIIRow>();
  if (employeeIds.length > 0) {
    const { data: piiRows } = await supabase
      .from("employees_with_pii")
      .select("id, national_id_dec, bank_name_dec, bank_account_number_dec")
      .in("id", employeeIds)
      .returns<EmployeePIIRow[]>();
    for (const p of piiRows ?? []) {
      piiById.set(p.id, p);
    }
  }

  const rows: PayrollExportRow[] = entries.map((e) => {
    const pii = piiById.get(e.employee_id);
    return {
    employee_code: e.employees?.employee_code ?? null,
    full_name: e.employees?.full_name ?? "—",
    national_id: pii?.national_id_dec ?? null,
    job_title: e.employees?.job_title ?? null,
    department: e.employees?.department ?? null,
    bank_name: pii?.bank_name_dec ?? null,
    bank_account_number: pii?.bank_account_number_dec ?? null,
    bank_iban: e.employees?.bank_iban ?? null,
    payment_method: e.employees?.payment_method ?? "cash",
    attended_days: Number(e.attended_days),
    half_day_days: Number(e.half_day_days),
    leave_days: Number(e.leave_days),
    absent_days: Number(e.absent_days),
    basic_salary: Number(e.basic_salary),
    housing_allowance: Number(e.housing_allowance),
    transport_allowance: Number(e.transport_allowance),
    other_allowances: Number(e.other_allowances),
    incentive_allowance: Number(e.incentive_allowance ?? 0),
    bonuses: Number(e.bonuses),
    overtime: Number(e.overtime),
    gross_salary: Number(e.gross_salary),
    absence_deduction: Number(e.absence_deduction),
    tardiness_deduction: Number(e.tardiness_deduction ?? 0),
    social_insurance: Number(e.social_insurance),
    income_tax: Number(e.income_tax),
    loan_deduction: Number(e.loan_deduction),
    other_deductions: Number(e.other_deductions),
    total_deductions: Number(e.total_deductions),
    eos_gratuity: Number(e.eos_gratuity ?? 0),
    net_salary: Number(e.net_salary),
    notes: e.notes,
    };
  });

  const meta: PeriodMeta = {
    company_name: company?.name ?? "—",
    start_date: period.start_date,
    end_date: period.end_date,
    year: period.year,
    month: period.month,
    frequency: period.frequency,
    working_days: period.working_days,
  };

  const baseFilename =
    period.start_date && period.end_date
      ? `nidham-payroll-${period.start_date}-to-${period.end_date}`
      : `nidham-payroll-${period.year}-${String(period.month).padStart(2, "0")}`;

  // --- Generic CSV ---
  if (format === "csv") {
    const body = buildBankCsv(rows, meta);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseFilename}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // --- Bank SIF ---
  if (format === "sif") {
    const body = buildBankSif(rows, meta);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseFilename}.sif"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // --- Excel (default) ---
  const xlsxBuf = buildPayrollXlsx(rows, meta);
  return new NextResponse(xlsxBuf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${baseFilename}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
