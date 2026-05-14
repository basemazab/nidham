"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { calculatePayroll, type AttendanceBreakdown } from "@/lib/payroll";
import { requireAdmin, requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import { bustDashboardCache } from "@/lib/cache";

function asText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const t = String(value).trim();
  return t.length === 0 ? null : t;
}

function asNumber(value: FormDataEntryValue | null): number {
  const t = asText(value);
  if (t === null) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

async function getCurrentCompanyId(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (error || !data) throw new Error("Profile not found");
  return data.company_id as string;
}

type EmployeeRow = {
  id: string;
  full_name: string;
  basic_salary: number | null;
  housing_allowance: number | null;
  transport_allowance: number | null;
  other_allowances: number | null;
};

type AttendanceRecord = {
  employee_id: string;
  status: string;
};

/**
 * Generate a new payroll period for a given month/year.
 * Auto-computes payroll for each active employee using their salary structure
 * + that month's attendance.
 */
export async function generatePayrollPeriod(formData: FormData) {
  await requireHR();
  const supabase = await createClient();
  const companyId = await getCurrentCompanyId(supabase);

  const year = parseInt(asText(formData.get("year")) ?? "", 10);
  const month = parseInt(asText(formData.get("month")) ?? "", 10);
  const workingDays = parseInt(
    asText(formData.get("working_days")) ?? "22",
    10,
  );

  if (!year || !month || month < 1 || month > 12) {
    redirect(
      "/dashboard/payroll/new?error=" +
        encodeURIComponent("الشهر والسنة مطلوبين"),
    );
  }

  // Check if period already exists
  const { data: existing } = await supabase
    .from("payroll_periods")
    .select("id")
    .eq("company_id", companyId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (existing) {
    redirect(`/dashboard/payroll/${existing.id}`);
  }

  // Create the period
  const { data: period, error: periodError } = await supabase
    .from("payroll_periods")
    .insert({
      company_id: companyId,
      year,
      month,
      working_days: workingDays,
      status: "draft",
    })
    .select("id")
    .single();

  if (periodError || !period) {
    redirect(
      "/dashboard/payroll/new?error=" +
        encodeURIComponent(periodError?.message ?? "Failed to create period"),
    );
  }

  // Fetch active employees + their attendance for the month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [employeesRes, attendanceRes] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, full_name, basic_salary, housing_allowance, transport_allowance, other_allowances",
      )
      .eq("status", "active")
      .returns<EmployeeRow[]>(),
    supabase
      .from("attendance")
      .select("employee_id, status")
      .gte("date", startDate)
      .lte("date", endDate)
      .returns<AttendanceRecord[]>(),
  ]);

  const employees = employeesRes.data ?? [];
  const attendance = attendanceRes.data ?? [];

  // Auto-link advances: for each employee, ask the DB how much of their
  // open advances should be deducted in this specific (year, month).
  // compute_advance_deduction_for_month is referentially transparent --
  // deleting / regenerating the period self-corrects. Migration 019.
  const advanceDeductions = new Map<string, number>();
  await Promise.all(
    employees.map(async (emp) => {
      const { data } = await supabase.rpc(
        "compute_advance_deduction_for_month",
        { p_employee_id: emp.id, p_year: year, p_month: month },
      );
      const value = typeof data === "number" ? data : 0;
      advanceDeductions.set(emp.id, value);
    }),
  );

  // Compute & insert entry per employee.
  // Buckets:
  //   attended: explicit "present"
  //   halfDay : explicit "half_day"
  //   absent  : explicit "absent"  → only kind that triggers a deduction
  //   leave   : everything else paid-but-not-worked (leave/holiday/weekend/
  //             sick_leave/...) — derived as the remainder so a new status
  //             added later never silently disappears from the math.
  const entries = employees.map((emp) => {
    const empAttendance = attendance.filter((a) => a.employee_id === emp.id);
    const attended = empAttendance.filter((a) => a.status === "present").length;
    const halfDay = empAttendance.filter((a) => a.status === "half_day").length;
    const absent = empAttendance.filter((a) => a.status === "absent").length;
    const leave = Math.max(0, empAttendance.length - attended - halfDay - absent);

    const breakdown: AttendanceBreakdown = { attended, halfDay, leave, absent };
    const loanDeduction = advanceDeductions.get(emp.id) ?? 0;

    const result = calculatePayroll(
      {
        basicSalary: emp.basic_salary ?? 0,
        housingAllowance: emp.housing_allowance ?? 0,
        transportAllowance: emp.transport_allowance ?? 0,
        otherAllowances: emp.other_allowances ?? 0,
        loanDeduction,
      },
      breakdown,
      workingDays,
    );

    return {
      company_id: companyId,
      period_id: period.id,
      employee_id: emp.id,
      attended_days: breakdown.attended,
      half_day_days: breakdown.halfDay,
      leave_days: breakdown.leave,
      absent_days: breakdown.absent,
      basic_salary: emp.basic_salary ?? 0,
      housing_allowance: emp.housing_allowance ?? 0,
      transport_allowance: emp.transport_allowance ?? 0,
      other_allowances: emp.other_allowances ?? 0,
      bonuses: 0,
      overtime: 0,
      gross_salary: result.grossSalary,
      absence_deduction: result.absenceDeduction,
      social_insurance: result.socialInsurance,
      income_tax: result.incomeTax,
      loan_deduction: loanDeduction,
      other_deductions: 0,
      total_deductions: result.totalDeductions,
      net_salary: result.netSalary,
    };
  });

  if (entries.length > 0) {
    // Upsert keyed by the (period_id, employee_id) unique index so a
    // double-submit or page refresh doesn't crash on the constraint.
    await supabase.from("payroll_entries").upsert(entries, {
      onConflict: "period_id,employee_id",
    });
  }

  revalidatePath("/dashboard/payroll");
  bustDashboardCache();
  redirect(`/dashboard/payroll/${period.id}`);
}

/**
 * Recalculate an individual payroll entry (e.g., after editing bonuses/deductions).
 */
export async function updatePayrollEntry(entryId: string, formData: FormData) {
  await requireHR();
  const supabase = await createClient();
  const companyId = await getCurrentCompanyId(supabase);

  // Get current entry + period
  const { data: entry } = await supabase
    .from("payroll_entries")
    .select(
      "id, period_id, employee_id, attended_days, half_day_days, leave_days, absent_days, basic_salary, housing_allowance, transport_allowance, other_allowances",
    )
    .eq("id", entryId)
    .eq("company_id", companyId)
    .single();

  if (!entry) {
    redirect("/dashboard/payroll?error=" + encodeURIComponent("Entry not found"));
  }

  const { data: period } = await supabase
    .from("payroll_periods")
    .select("working_days, status")
    .eq("id", entry.period_id)
    .single();

  if (!period) {
    redirect("/dashboard/payroll?error=" + encodeURIComponent("Period not found"));
  }

  if (period.status === "paid") {
    redirect(
      `/dashboard/payroll/${entry.period_id}/${entryId}?error=` +
        encodeURIComponent("الشهر مقفول — مينفعش تعدل"),
    );
  }

  // Allow override of attendance + salary + bonuses/deductions
  const attended = asNumber(formData.get("attended_days"));
  const halfDay = asNumber(formData.get("half_day_days"));
  const leave = asNumber(formData.get("leave_days"));
  const absent = asNumber(formData.get("absent_days"));

  const basic = asNumber(formData.get("basic_salary"));
  const housing = asNumber(formData.get("housing_allowance"));
  const transport = asNumber(formData.get("transport_allowance"));
  const other = asNumber(formData.get("other_allowances"));
  const bonuses = asNumber(formData.get("bonuses"));
  const overtime = asNumber(formData.get("overtime"));
  const loan = asNumber(formData.get("loan_deduction"));
  const otherDed = asNumber(formData.get("other_deductions"));

  const result = calculatePayroll(
    {
      basicSalary: basic,
      housingAllowance: housing,
      transportAllowance: transport,
      otherAllowances: other,
      bonuses,
      overtime,
      loanDeduction: loan,
      otherDeductions: otherDed,
    },
    { attended, halfDay, leave, absent },
    period.working_days ?? 22,
  );

  await supabase
    .from("payroll_entries")
    .update({
      attended_days: attended,
      half_day_days: halfDay,
      leave_days: leave,
      absent_days: absent,
      basic_salary: basic,
      housing_allowance: housing,
      transport_allowance: transport,
      other_allowances: other,
      bonuses,
      overtime,
      gross_salary: result.grossSalary,
      absence_deduction: result.absenceDeduction,
      social_insurance: result.socialInsurance,
      income_tax: result.incomeTax,
      loan_deduction: loan,
      other_deductions: otherDed,
      total_deductions: result.totalDeductions,
      net_salary: result.netSalary,
      notes: asText(formData.get("notes")),
    })
    .eq("id", entryId);

  revalidatePath(`/dashboard/payroll/${entry.period_id}`);
  redirect(`/dashboard/payroll/${entry.period_id}`);
}

export async function approvePayrollPeriod(periodId: string) {
  // Approving payroll is an admin-only action -- it commits money flow
  // and the approver is recorded in approved_by.
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  // Server-side gate — the UI hides the button when status != "draft", but a
  // direct call (e.g., replayed form post) must also be rejected so a
  // "paid" period can never be reverted to "approved".
  const { error } = await supabase
    .from("payroll_periods")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: profile.id,
    })
    .eq("id", periodId)
    .eq("status", "draft");

  if (error) {
    redirect(
      `/dashboard/payroll/${periodId}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath(`/dashboard/payroll/${periodId}`);
}

export async function markPayrollAsPaid(periodId: string) {
  await requireAdmin();
  const supabase = await createClient();

  // Only an approved period can be marked paid — guards against replay.
  const { error } = await supabase
    .from("payroll_periods")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", periodId)
    .eq("status", "approved");

  if (error) {
    redirect(
      `/dashboard/payroll/${periodId}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath(`/dashboard/payroll/${periodId}`);
}

export async function deletePayrollPeriod(periodId: string) {
  await requireAdmin();
  const supabase = await createClient();

  // Only draft periods may be deleted; otherwise audit history is lost.
  await supabase
    .from("payroll_periods")
    .delete()
    .eq("id", periodId)
    .eq("status", "draft");

  revalidatePath("/dashboard/payroll");
  bustDashboardCache();
  redirect("/dashboard/payroll");
}
