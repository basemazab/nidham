// Employee's own payslip history. Migration 015 added
// employees_view_own_payroll_entries + employees_view_payroll_periods_for_own_entries
// so a mobile-linked employee can SELECT their own rows without HR.
// Migration 017 then locked everyone else out -- HR is the only role
// that sees company-wide data.

import { supabase } from "./supabase";

export type PayslipSummary = {
  id: string;             // payroll_entries.id
  period_id: string;
  year: number;
  month: number;
  frequency: "monthly" | "weekly" | null;
  start_date: string | null;
  end_date: string | null;
  period_status: "draft" | "approved" | "paid" | "cancelled";
  paid_at: string | null;
  net_salary: number;
  gross_salary: number;
  attended_days: number;
  absent_days: number;
};

export type PayslipDetail = PayslipSummary & {
  basic_salary: number;
  housing_allowance: number;
  transport_allowance: number;
  other_allowances: number;
  incentive_allowance: number;
  bonuses: number;
  overtime: number;
  absence_deduction: number;
  social_insurance: number;
  income_tax: number;
  loan_deduction: number;
  other_deductions: number;
  total_deductions: number;
  half_day_days: number;
  leave_days: number;
  notes: string | null;
};

type RawEntry = {
  id: string;
  period_id: string;
  net_salary: number;
  gross_salary: number;
  attended_days: number;
  absent_days: number;
  basic_salary?: number;
  housing_allowance?: number;
  transport_allowance?: number;
  other_allowances?: number;
  incentive_allowance?: number;
  bonuses?: number;
  overtime?: number;
  absence_deduction?: number;
  social_insurance?: number;
  income_tax?: number;
  loan_deduction?: number;
  other_deductions?: number;
  total_deductions?: number;
  half_day_days?: number;
  leave_days?: number;
  notes?: string | null;
  payroll_periods: {
    year: number;
    month: number;
    frequency: "monthly" | "weekly" | null;
    start_date: string | null;
    end_date: string | null;
    status: "draft" | "approved" | "paid" | "cancelled";
    paid_at: string | null;
  };
};

export async function listMyPayslips(
  employeeId: string,
): Promise<PayslipSummary[]> {
  const { data } = await supabase
    .from("payroll_entries")
    .select(
      `id, period_id, net_salary, gross_salary, attended_days, absent_days,
       payroll_periods(year, month, frequency, start_date, end_date, status, paid_at)`,
    )
    .eq("employee_id", employeeId)
    .order("created_at", { ascending: false });

  const rows = (data as RawEntry[] | null) ?? [];
  return rows
    // Only show approved or paid -- drafts shouldn't be visible
    // to the employee until HR signs off.
    .filter((r) => r.payroll_periods?.status !== "draft")
    .map((r) => ({
      id: r.id,
      period_id: r.period_id,
      year: r.payroll_periods.year,
      month: r.payroll_periods.month,
      frequency: r.payroll_periods.frequency,
      start_date: r.payroll_periods.start_date,
      end_date: r.payroll_periods.end_date,
      period_status: r.payroll_periods.status,
      paid_at: r.payroll_periods.paid_at,
      net_salary: Number(r.net_salary),
      gross_salary: Number(r.gross_salary),
      attended_days: Number(r.attended_days),
      absent_days: Number(r.absent_days),
    }));
}

export async function getMyPayslip(
  entryId: string,
  employeeId: string,
): Promise<PayslipDetail | null> {
  const { data } = await supabase
    .from("payroll_entries")
    .select(
      `id, period_id, net_salary, gross_salary, attended_days, absent_days,
       basic_salary, housing_allowance, transport_allowance, other_allowances,
       incentive_allowance, bonuses, overtime, absence_deduction,
       social_insurance, income_tax, loan_deduction, other_deductions,
       total_deductions, half_day_days, leave_days, notes,
       payroll_periods(year, month, frequency, start_date, end_date, status, paid_at)`,
    )
    .eq("id", entryId)
    .eq("employee_id", employeeId)
    .single<RawEntry>();

  if (!data || data.payroll_periods?.status === "draft") return null;

  return {
    id: data.id,
    period_id: data.period_id,
    year: data.payroll_periods.year,
    month: data.payroll_periods.month,
    frequency: data.payroll_periods.frequency,
    start_date: data.payroll_periods.start_date,
    end_date: data.payroll_periods.end_date,
    period_status: data.payroll_periods.status,
    paid_at: data.payroll_periods.paid_at,
    net_salary: Number(data.net_salary),
    gross_salary: Number(data.gross_salary),
    attended_days: Number(data.attended_days),
    absent_days: Number(data.absent_days),
    basic_salary: Number(data.basic_salary ?? 0),
    housing_allowance: Number(data.housing_allowance ?? 0),
    transport_allowance: Number(data.transport_allowance ?? 0),
    other_allowances: Number(data.other_allowances ?? 0),
    incentive_allowance: Number(data.incentive_allowance ?? 0),
    bonuses: Number(data.bonuses ?? 0),
    overtime: Number(data.overtime ?? 0),
    absence_deduction: Number(data.absence_deduction ?? 0),
    social_insurance: Number(data.social_insurance ?? 0),
    income_tax: Number(data.income_tax ?? 0),
    loan_deduction: Number(data.loan_deduction ?? 0),
    other_deductions: Number(data.other_deductions ?? 0),
    total_deductions: Number(data.total_deductions ?? 0),
    half_day_days: Number(data.half_day_days ?? 0),
    leave_days: Number(data.leave_days ?? 0),
    notes: data.notes ?? null,
  };
}

const MONTH_NAMES_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES_AR[month - 1] ?? month} ${year}`;
}

// Prefer the cycle window (e.g. "21/04/2026 → 20/05/2026") when the
// period has explicit start/end dates (migration 026+). Fall back to
// the legacy calendar-month label otherwise.
export function cycleLabel(p: {
  year: number;
  month: number;
  start_date: string | null;
  end_date: string | null;
}): string {
  if (p.start_date && p.end_date) {
    return `${formatIsoDate(p.start_date)} → ${formatIsoDate(p.end_date)}`;
  }
  return monthLabel(p.year, p.month);
}

function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
