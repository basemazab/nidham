"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  calculatePayroll,
  calculateProRationFactor,
  type AttendanceBreakdown,
} from "@/lib/payroll";
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
  incentive_allowance: number | null;
  pay_frequency: "monthly" | "weekly";
  // Dates that trigger pro-ration when the employee was hired or
  // terminated inside the cycle. Both nullable — legacy employees
  // imported without these dates get factor 1 (full salary).
  hire_date: string | null;
  termination_date: string | null;
};

type AttendanceRecord = {
  employee_id: string;
  date: string;
  status: string;
  tardiness_minutes: number | null;
  early_leave_minutes: number | null;
  /**
   * NULL for non-leave rows. Set on rows with status='leave' to express:
   *   'paid'   — annual / casual / public-holiday leave (counted as worked)
   *   'unpaid' — إجازة بدون مرتب (deducted from salary)
   *   'sick'   — Art. 71/72 partial-pay (handled in payroll engine later)
   */
  leave_type: string | null;
};

/**
 * Generate a new payroll period.
 *
 * Accepts EITHER:
 *   (frequency, start_date, end_date, working_days)  -- new, cycle-aware
 *   (year, month, working_days)                       -- legacy, monthly only
 *
 * In the new model, only employees whose pay_frequency matches the
 * period's frequency are included. So generating a "weekly" period
 * picks up the daily-paid production workers; generating a "monthly"
 * period picks up the salaried staff. The cycle window can be any
 * (start, end) -- 21st-to-20th, Sat-to-Fri, etc.
 */
export async function generatePayrollPeriod(formData: FormData) {
  await requireHR();
  const supabase = await createClient();
  const companyId = await getCurrentCompanyId(supabase);

  const frequency = (asText(formData.get("frequency")) ?? "monthly") as
    | "monthly"
    | "weekly";

  let startDate = asText(formData.get("start_date"));
  let endDate = asText(formData.get("end_date"));

  // Legacy path: derive start/end from (year, month) if start_date wasn't
  // sent (keeps the older /dashboard/payroll/new URL working).
  const yearRaw = asText(formData.get("year"));
  const monthRaw = asText(formData.get("month"));
  if (!startDate && yearRaw && monthRaw) {
    const y = parseInt(yearRaw, 10);
    const m = parseInt(monthRaw, 10);
    if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
      startDate = `${y}-${String(m).padStart(2, "0")}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      endDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    }
  }

  if (!startDate || !endDate) {
    redirect(
      "/dashboard/payroll/new?error=" +
        encodeURIComponent("تاريخ البداية والنهاية مطلوبين"),
    );
  }

  const workingDays = parseInt(
    // Egyptian-standard default: 26 working days per month
    // (30 days minus ~4 Fridays). See payroll.ts:calculatePayroll for
    // the full reasoning.
    asText(formData.get("working_days")) ?? "26",
    10,
  );

  // Derive a year+month label from start_date so old queries that read
  // those columns (sidebar list, payroll page header) still work.
  const startD = new Date(startDate + "T00:00:00");
  const year = startD.getFullYear();
  const month = startD.getMonth() + 1;

  // Idempotency: same (frequency, start_date) => same period.
  const { data: existing } = await supabase
    .from("payroll_periods")
    .select("id")
    .eq("company_id", companyId)
    .eq("frequency", frequency)
    .eq("start_date", startDate)
    .maybeSingle();

  if (existing) {
    redirect(`/dashboard/payroll/${existing.id}`);
  }

  const { data: period, error: periodError } = await supabase
    .from("payroll_periods")
    .insert({
      company_id: companyId,
      year,
      month,
      frequency,
      start_date: startDate,
      end_date: endDate,
      working_days: workingDays,
      status: "draft",
    })
    .select("id")
    .single();

  if (periodError || !period) {
    redirect(
      "/dashboard/payroll/new?error=" +
        encodeURIComponent(arabicizeDbError(periodError?.message ?? "Failed to create period")),
    );
  }

  // Employee filter: for monthly cycles we include rows whose
  // pay_frequency is NULL too — those are legacy employees imported
  // before migration 026 added the column with default 'monthly'. A
  // weekly cycle stays strict: a worker MUST be explicitly flagged as
  // weekly to land in the weekly payroll.
  const employeesQuery =
    frequency === "monthly"
      ? supabase
          .from("employees")
          .select(
            "id, full_name, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, pay_frequency, hire_date, termination_date",
          )
          .eq("status", "active")
          .or("pay_frequency.eq.monthly,pay_frequency.is.null")
      : supabase
          .from("employees")
          .select(
            "id, full_name, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, pay_frequency, hire_date, termination_date",
          )
          .eq("status", "active")
          .eq("pay_frequency", "weekly");

  const [employeesRes, attendanceRes, companyRes, holidaysRes] = await Promise.all([
    employeesQuery.returns<EmployeeRow[]>(),
    supabase
      .from("attendance")
      .select(
        "employee_id, date, status, tardiness_minutes, early_leave_minutes, leave_type",
      )
      .gte("date", startDate)
      .lte("date", endDate)
      .returns<AttendanceRecord[]>(),
    supabase
      .from("companies")
      .select("social_insurance_enabled, income_tax_enabled")
      .eq("id", companyId)
      .single<{
        social_insurance_enabled: boolean | null;
        income_tax_enabled: boolean | null;
      }>(),
    // Public holidays inside the period — both global rows (company_id
    // IS NULL) and any tenant-specific overrides. We use these to
    // re-classify "absent" days that happen to fall on a holiday as
    // "leave" (paid). An employee who missed a check-in on 25 Jan
    // shouldn't see a salary deduction for the national holiday.
    supabase
      .from("public_holidays")
      .select("date, is_paid, company_id")
      .gte("date", startDate)
      .lte("date", endDate)
      .or(`company_id.eq.${companyId},company_id.is.null`)
      .returns<{ date: string; is_paid: boolean; company_id: string | null }[]>(),
  ]);

  const payrollSettings = {
    socialInsuranceEnabled: companyRes.data?.social_insurance_enabled === true,
    incomeTaxEnabled: companyRes.data?.income_tax_enabled === true,
  };

  const employees = employeesRes.data ?? [];
  const attendance = attendanceRes.data ?? [];

  // Build the set of paid-holiday dates in this period. Tenant-specific
  // rows override global rows on the same date (the per-tenant value
  // wins for both 'is_paid' and existence). Unpaid holidays drop out —
  // they should still trigger an absence deduction.
  const paidHolidayDates = new Set<string>();
  const holidayMap = new Map<string, boolean>(); // date → is_paid
  for (const h of holidaysRes.data ?? []) {
    // Tenant-specific overrides take precedence — process them last
    // by sorting (NULL company_id first).
  }
  const sortedHolidays = (holidaysRes.data ?? []).slice().sort((a, b) => {
    if (a.company_id === null && b.company_id !== null) return -1;
    if (a.company_id !== null && b.company_id === null) return 1;
    return 0;
  });
  for (const h of sortedHolidays) {
    holidayMap.set(h.date, h.is_paid);
  }
  for (const [date, isPaid] of holidayMap) {
    if (isPaid) paidHolidayDates.add(date);
  }

  // Auto-link advances: for each employee, ask the DB how much of their
  // open advances should be deducted from this specific cycle window.
  // compute_advance_deduction_for_period is referentially transparent --
  // deleting / regenerating the period self-corrects.
  // Migration 027 replaces the legacy (year, month) variant with a
  // date-range one so 21->20 monthly cycles deduct correctly.
  const advanceDeductions = new Map<string, number>();
  await Promise.all(
    employees.map(async (emp) => {
      const { data } = await supabase.rpc(
        "compute_advance_deduction_for_period",
        {
          p_employee_id: emp.id,
          p_period_start: startDate,
          p_period_end: endDate,
        },
      );
      const value = typeof data === "number" ? data : 0;
      advanceDeductions.set(emp.id, value);
    }),
  );

  // Compute & insert entry per employee.
  // Buckets:
  //   attended    : explicit "present"
  //   halfDay     : explicit "half_day"
  //   absent      : explicit "absent" — UNLESS the date is a paid public
  //                 holiday, in which case the day is RECLASSIFIED as
  //                 leave (paid) so the employee isn't penalised for not
  //                 clocking in on 25 Jan / Eid / etc.
  //   unpaidLeave : status="leave" AND leave_type="unpaid" → deducted
  //                 like an absence, but tracked separately for audit.
  //   leave       : everything else paid-but-not-worked (paid leave,
  //                 holiday, weekend, sick_leave, ...) — derived as the
  //                 remainder so a new status added later never silently
  //                 disappears from the math.
  const entries = employees.map((emp) => {
    const empAttendance = attendance.filter((a) => a.employee_id === emp.id);
    const attended = empAttendance.filter((a) => a.status === "present").length;
    const halfDay = empAttendance.filter((a) => a.status === "half_day").length;
    // "absent" rows that fall on a paid public holiday are reclassified
    // as leave (no deduction). HR will see them as 'leave' in the
    // breakdown rather than as absences — which is the right semantic
    // ("the employee was on holiday that day, not absent").
    const absentRows = empAttendance.filter((a) => a.status === "absent");
    const absentOnHoliday = absentRows.filter((a) =>
      paidHolidayDates.has(a.date),
    ).length;
    const absent = absentRows.length - absentOnHoliday;
    // Unpaid leave: status='leave' with explicit leave_type='unpaid'.
    const unpaidLeave = empAttendance.filter(
      (a) => a.status === "leave" && a.leave_type === "unpaid",
    ).length;
    // Everything that isn't present/half_day/unaccounted-absent/unpaid-
    // leave falls into the paid leave bucket (annual + casual + sick +
    // public holiday + weekend + the absent-on-holiday rows we
    // reclassified above).
    const leave = Math.max(
      0,
      empAttendance.length - attended - halfDay - absent - unpaidLeave,
    );

    // Sum tardiness + early-leave minutes across only workday rows
    // (present + half_day). A "weekend" or "leave" row carrying a stray
    // non-zero value shouldn't count toward a deduction.
    const tardinessMinutes = empAttendance
      .filter((a) => a.status === "present" || a.status === "half_day")
      .reduce((s, a) => s + (a.tardiness_minutes ?? 0), 0);
    const earlyLeaveMinutes = empAttendance
      .filter((a) => a.status === "present" || a.status === "half_day")
      .reduce((s, a) => s + (a.early_leave_minutes ?? 0), 0);

    const breakdown: AttendanceBreakdown = {
      attended,
      halfDay,
      leave,
      absent,
      unpaidLeave,
      tardinessMinutes,
      earlyLeaveMinutes,
    };
    const loanDeduction = advanceDeductions.get(emp.id) ?? 0;

    // Pro-rate the monthly base if the employee was hired or
    // terminated inside this cycle. Returns 1.0 when they were employed
    // for the full window — the common case.
    const proRationFactor = calculateProRationFactor({
      periodStart: startDate,
      periodEnd: endDate,
      hireDate: emp.hire_date,
      terminationDate: emp.termination_date,
    });

    const result = calculatePayroll(
      {
        basicSalary: emp.basic_salary ?? 0,
        housingAllowance: emp.housing_allowance ?? 0,
        transportAllowance: emp.transport_allowance ?? 0,
        otherAllowances: emp.other_allowances ?? 0,
        incentiveAllowance: emp.incentive_allowance ?? 0,
        loanDeduction,
      },
      breakdown,
      workingDays,
      { ...payrollSettings, proRationFactor },
    );

    return {
      company_id: companyId,
      period_id: period.id,
      employee_id: emp.id,
      attended_days: breakdown.attended,
      half_day_days: breakdown.halfDay,
      leave_days: breakdown.leave,
      absent_days: breakdown.absent,
      // Snapshot the FULL salary structure on the entry; the pro-ration
      // is reflected in gross_salary / net_salary below. We deliberately
      // keep the raw basic/allowances so a later "what was the contract
      // salary on this date" audit still works.
      basic_salary: emp.basic_salary ?? 0,
      housing_allowance: emp.housing_allowance ?? 0,
      transport_allowance: emp.transport_allowance ?? 0,
      other_allowances: emp.other_allowances ?? 0,
      incentive_allowance: emp.incentive_allowance ?? 0,
      bonuses: 0,
      overtime: 0,
      gross_salary: result.grossSalary,
      absence_deduction: result.absenceDeduction,
      tardiness_deduction: result.tardinessDeduction,
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
  const incentive = asNumber(formData.get("incentive_allowance"));
  const bonuses = asNumber(formData.get("bonuses"));
  // Egyptian Labor Law Art. 85 overtime: hours per category. When any of
  // these is > 0, the engine computes the pay using legally-mandated
  // multipliers (1.35 / 1.7 / 2.0). The raw `overtime` money field is
  // kept as a fallback so legacy entries without the breakdown still work
  // — HR can also use it for "manual override" cases.
  const otHoursDay = asNumber(formData.get("overtime_hours_day"));
  const otHoursNight = asNumber(formData.get("overtime_hours_night"));
  const otHoursRest = asNumber(formData.get("overtime_hours_rest"));
  const overtime = asNumber(formData.get("overtime"));
  const loan = asNumber(formData.get("loan_deduction"));
  const otherDed = asNumber(formData.get("other_deductions"));

  // Per-company toggles drive whether the auto deductions apply.
  const { data: companyRow } = await supabase
    .from("companies")
    .select("social_insurance_enabled, income_tax_enabled")
    .eq("id", companyId)
    .single<{
      social_insurance_enabled: boolean | null;
      income_tax_enabled: boolean | null;
    }>();

  const result = calculatePayroll(
    {
      basicSalary: basic,
      housingAllowance: housing,
      transportAllowance: transport,
      otherAllowances: other,
      incentiveAllowance: incentive,
      bonuses,
      overtime,
      overtimeHoursDay: otHoursDay,
      overtimeHoursNight: otHoursNight,
      overtimeHoursRest: otHoursRest,
      loanDeduction: loan,
      otherDeductions: otherDed,
    },
    { attended, halfDay, leave, absent },
    // Egyptian standard: 26 working days (30 - ~4 Fridays). See payroll.ts.
    period.working_days ?? 26,
    {
      socialInsuranceEnabled: companyRow?.social_insurance_enabled === true,
      incomeTaxEnabled: companyRow?.income_tax_enabled === true,
    },
  );

  // RLS hardening: defensive company_id clamp on the UPDATE. The SELECT
  // above already filtered by company_id, but a second clamp on the
  // mutation closes the loop in case the SELECT path is ever refactored.
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
      incentive_allowance: incentive,
      bonuses,
      // Persist BOTH the per-category hour breakdown AND the computed
      // money total. The hour columns are the audit trail; the money
      // column is what the rest of the payroll pipeline (exports,
      // payslip) keeps reading.
      overtime: result.overtime,
      overtime_hours_day: otHoursDay,
      overtime_hours_night: otHoursNight,
      overtime_hours_rest: otHoursRest,
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
    .eq("id", entryId)
    .eq("company_id", companyId);

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
  //
  // RLS hardening: explicit company_id scope. Under super-admin sessions
  // (mig 038), RLS WITH CHECK alone doesn't stop a forged periodId from
  // hitting another tenant's row. The .eq("company_id", ...) clamp does.
  const { error } = await supabase
    .from("payroll_periods")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: profile.id,
    })
    .eq("id", periodId)
    .eq("company_id", profile.company_id)
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
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  // Only an approved period can be marked paid — guards against replay.
  // company_id clamp protects against cross-tenant writes under super-admin
  // sessions (mig 038).
  const { error } = await supabase
    .from("payroll_periods")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", periodId)
    .eq("company_id", profile.company_id)
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
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  // Only draft periods may be deleted; otherwise audit history is lost.
  // company_id clamp protects against cross-tenant deletes under super-admin
  // sessions (mig 038).
  await supabase
    .from("payroll_periods")
    .delete()
    .eq("id", periodId)
    .eq("company_id", profile.company_id)
    .eq("status", "draft");

  revalidatePath("/dashboard/payroll");
  bustDashboardCache();
  redirect("/dashboard/payroll");
}

export async function rollbackPayrollToDraft(periodId: string) {
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  // Only approved periods can be rolled back to draft. Paid or cancelled
  // periods cannot be rolled back — financial data has been committed.
  const { error } = await supabase
    .from("payroll_periods")
    .update({
      status: "draft",
      approved_at: null,
      approved_by: null,
    })
    .eq("id", periodId)
    .eq("company_id", profile.company_id)
    .eq("status", "approved");

  if (error) {
    redirect(
      `/dashboard/payroll/${periodId}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath(`/dashboard/payroll/${periodId}`);
  bustDashboardCache();
}

export async function simulatePayrollRun(periodId: string) {
  const { profile } = await requireHR();
  const supabase = await createClient();

  // Fetch the period + entries without any DB writes
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("*, payroll_entries(*)")
    .eq("id", periodId)
    .eq("company_id", profile.company_id)
    .single();

  if (!period) {
    return { error: "فترة المرتبات غير موجودة" };
  }

  const entries = (period as any).payroll_entries || [];
  const summary = {
    total_employees: entries.length,
    gross_total: entries.reduce((s: number, e: any) => s + Number(e.gross_salary || 0), 0),
    net_total: entries.reduce((s: number, e: any) => s + Number(e.net_salary || 0), 0),
    deductions_total: entries.reduce((s: number, e: any) => s + Number(e.total_deductions || 0), 0),
    insurance_total: entries.reduce((s: number, e: any) => s + Number(e.social_insurance || 0), 0),
    tax_total: entries.reduce((s: number, e: any) => s + Number(e.income_tax || 0), 0),
    bonuses_total: entries.reduce((s: number, e: any) => s + Number(e.bonuses || 0), 0),
  };

  return { summary };
}

// ============================================================================
// REGENERATE PERIOD ENTRIES
// ============================================================================
//
// Re-runs the entry-creation logic against an EXISTING period. Used when:
//   1) A period was created before a bug fix and ended up empty.
//   2) Attendance was imported AFTER the period was created — entries
//      need a fresh recalculation to pick up the new attendance.
//   3) New employees were added after period creation.
//
// Only operates on DRAFT periods. Approved/paid periods stay frozen.
// Existing entries are deleted and replaced — manual overrides on
// individual entries (bonus / overtime / other_deductions) get LOST,
// so the UI warns the user.

export async function regeneratePeriodEntries(formData: FormData) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  const periodId = String(formData.get("period_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(periodId)) {
    redirect("/dashboard/payroll");
  }

  // Load period + verify it's still editable + belongs to caller's tenant
  const { data: period } = await supabase
    .from("payroll_periods")
    .select(
      "id, company_id, frequency, start_date, end_date, working_days, status",
    )
    .eq("id", periodId)
    .single<{
      id: string;
      company_id: string;
      frequency: "monthly" | "weekly" | null;
      start_date: string | null;
      end_date: string | null;
      working_days: number;
      status: string;
    }>();

  if (!period) {
    redirect("/dashboard/payroll");
  }
  if (period.status !== "draft") {
    redirect(
      `/dashboard/payroll/${periodId}?error=` +
        encodeURIComponent("ممكن تعيد توليد الـ entries على المسودات فقط"),
    );
  }
  if (!period.start_date || !period.end_date) {
    redirect(
      `/dashboard/payroll/${periodId}?error=` +
        encodeURIComponent("الدورة دي ناقصة تاريخ بداية أو نهاية"),
    );
  }

  const frequency = period.frequency ?? "monthly";

  // Same employee filter as generatePayrollPeriod — monthly accepts NULL
  // pay_frequency as legacy default, weekly stays strict.
  const employeesQuery =
    frequency === "monthly"
      ? supabase
          .from("employees")
          .select(
            "id, full_name, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, pay_frequency, hire_date, termination_date",
          )
          .eq("status", "active")
          .or("pay_frequency.eq.monthly,pay_frequency.is.null")
      : supabase
          .from("employees")
          .select(
            "id, full_name, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, pay_frequency, hire_date, termination_date",
          )
          .eq("status", "active")
          .eq("pay_frequency", "weekly");

  const [employeesRes, attendanceRes, companyRes] = await Promise.all([
    employeesQuery.returns<EmployeeRow[]>(),
    supabase
      .from("attendance")
      .select(
        "employee_id, date, status, tardiness_minutes, early_leave_minutes, leave_type",
      )
      .gte("date", period.start_date)
      .lte("date", period.end_date)
      .returns<AttendanceRecord[]>(),
    supabase
      .from("companies")
      .select("social_insurance_enabled, income_tax_enabled")
      .eq("id", profile.company_id)
      .single<{
        social_insurance_enabled: boolean | null;
        income_tax_enabled: boolean | null;
      }>(),
  ]);

  const payrollSettings = {
    socialInsuranceEnabled: companyRes.data?.social_insurance_enabled === true,
    incomeTaxEnabled: companyRes.data?.income_tax_enabled === true,
  };

  const employees = employeesRes.data ?? [];
  const attendance = attendanceRes.data ?? [];

  if (employees.length === 0) {
    redirect(
      `/dashboard/payroll/${periodId}?error=` +
        encodeURIComponent(
          `لسه مفيش موظفين بحالة «نشط» وتكرار «${frequency === "monthly" ? "شهري" : "أسبوعي"}». افتح صفحة الموظفين وعدّل التكرار.`,
        ),
    );
  }

  // Wipe existing entries — keeps the period's audit fields (status,
  // dates, etc.) but starts fresh on the data side. Manual overrides
  // (bonuses, overtime) on the per-employee entries are LOST. The UI
  // warns the user before they click Regenerate.
  await supabase
    .from("payroll_entries")
    .delete()
    .eq("period_id", periodId)
    .eq("company_id", profile.company_id);

  // Auto-link advances per employee for the new period window
  const advanceDeductions = new Map<string, number>();
  await Promise.all(
    employees.map(async (emp) => {
      const { data } = await supabase.rpc(
        "compute_advance_deduction_for_period",
        {
          p_employee_id: emp.id,
          p_period_start: period.start_date,
          p_period_end: period.end_date,
        },
      );
      advanceDeductions.set(emp.id, typeof data === "number" ? data : 0);
    }),
  );

  // Compute fresh entries — same logic as generatePayrollPeriod
  const entries = employees.map((emp) => {
    const empAttendance = attendance.filter((a) => a.employee_id === emp.id);
    const attended = empAttendance.filter((a) => a.status === "present").length;
    const halfDay = empAttendance.filter((a) => a.status === "half_day").length;
    const absent = empAttendance.filter((a) => a.status === "absent").length;
    const leave = Math.max(
      0,
      empAttendance.length - attended - halfDay - absent,
    );

    const workdayRows = empAttendance.filter(
      (a) => a.status === "present" || a.status === "half_day",
    );
    const tardinessMinutes = workdayRows.reduce(
      (s, a) => s + (a.tardiness_minutes ?? 0),
      0,
    );
    const earlyLeaveMinutes = workdayRows.reduce(
      (s, a) => s + (a.early_leave_minutes ?? 0),
      0,
    );

    const breakdown: AttendanceBreakdown = {
      attended,
      halfDay,
      leave,
      absent,
      tardinessMinutes,
      earlyLeaveMinutes,
    };
    const loanDeduction = advanceDeductions.get(emp.id) ?? 0;

    // Pro-rate for mid-cycle hire / termination (same as the initial
    // generate flow).
    const proRationFactor = calculateProRationFactor({
      periodStart: period.start_date ?? "",
      periodEnd: period.end_date ?? "",
      hireDate: emp.hire_date,
      terminationDate: emp.termination_date,
    });

    const result = calculatePayroll(
      {
        basicSalary: emp.basic_salary ?? 0,
        housingAllowance: emp.housing_allowance ?? 0,
        transportAllowance: emp.transport_allowance ?? 0,
        otherAllowances: emp.other_allowances ?? 0,
        incentiveAllowance: emp.incentive_allowance ?? 0,
        loanDeduction,
      },
      breakdown,
      // Fallback to the Egyptian-standard 26-day month if the period
      // was created without an explicit working_days (e.g. legacy rows
      // from before the divisor fix).
      period.working_days ?? 26,
      { ...payrollSettings, proRationFactor },
    );

    return {
      company_id: profile.company_id,
      period_id: periodId,
      employee_id: emp.id,
      attended_days: breakdown.attended,
      half_day_days: breakdown.halfDay,
      leave_days: breakdown.leave,
      absent_days: breakdown.absent,
      basic_salary: emp.basic_salary ?? 0,
      housing_allowance: emp.housing_allowance ?? 0,
      transport_allowance: emp.transport_allowance ?? 0,
      other_allowances: emp.other_allowances ?? 0,
      incentive_allowance: emp.incentive_allowance ?? 0,
      bonuses: 0,
      overtime: 0,
      gross_salary: result.grossSalary,
      absence_deduction: result.absenceDeduction,
      tardiness_deduction: result.tardinessDeduction,
      social_insurance: result.socialInsurance,
      income_tax: result.incomeTax,
      loan_deduction: loanDeduction,
      other_deductions: 0,
      total_deductions: result.totalDeductions,
      net_salary: result.netSalary,
    };
  });

  if (entries.length > 0) {
    const { error } = await supabase
      .from("payroll_entries")
      .insert(entries);
    if (error) {
      redirect(
        `/dashboard/payroll/${periodId}?error=` +
          encodeURIComponent(arabicizeDbError(error.message)),
      );
    }
  }

  revalidatePath(`/dashboard/payroll/${periodId}`);
  revalidatePath("/dashboard/payroll");
  bustDashboardCache();
  redirect(
    `/dashboard/payroll/${periodId}?regenerated=${entries.length}`,
  );
}

// ============================================================================
// CANCEL / REOPEN — corrections workflow
// ============================================================================
//
// Two new actions on top of the draft -> approved -> paid flow:
//
//   cancelPayrollPeriod  — flip status to "cancelled" with a reason. Used
//                          when HR realises a generated period was wrong
//                          (e.g. wrong cycle window, missing imports) AFTER
//                          approval but BEFORE/AFTER payment. Cancellation
//                          freezes the period read-only and excludes it
//                          from all dashboards + reports.
//
//   reopenPayrollPeriod  — flip status back: paid -> approved, approved ->
//                          draft. Increments reopened_count for the audit
//                          trail. Admin-only because it un-locks money flow.
//
// Both require a typed confirmation word from the form so a misclick on
// "Reopen" doesn't silently undo a payroll.

export async function cancelPayrollPeriod(formData: FormData) {
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  const periodId = String(formData.get("period_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "").trim();

  if (!/^[0-9a-f-]{36}$/i.test(periodId)) {
    redirect("/dashboard/payroll");
  }
  if (confirm !== "إلغاء") {
    redirect(
      `/dashboard/payroll/${periodId}?error=` +
        encodeURIComponent("لازم تكتب 'إلغاء' للتأكيد"),
    );
  }
  if (reason.length < 5) {
    redirect(
      `/dashboard/payroll/${periodId}?error=` +
        encodeURIComponent("اكتب سبب الإلغاء (5 حروف على الأقل)"),
    );
  }

  const { error } = await supabase
    .from("payroll_periods")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: profile.id,
      cancellation_reason: reason,
    })
    .eq("id", periodId)
    .eq("company_id", profile.company_id)
    .in("status", ["draft", "approved", "paid"]);

  if (error) {
    redirect(
      `/dashboard/payroll/${periodId}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath(`/dashboard/payroll/${periodId}`);
  revalidatePath("/dashboard/payroll");
  bustDashboardCache();
  redirect(`/dashboard/payroll/${periodId}?cancelled=1`);
}

export async function reopenPayrollPeriod(formData: FormData) {
  const { profile } = await requireAdmin();
  const supabase = await createClient();

  const periodId = String(formData.get("period_id") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "").trim();

  if (!/^[0-9a-f-]{36}$/i.test(periodId)) {
    redirect("/dashboard/payroll");
  }
  if (confirm !== "فتح") {
    redirect(
      `/dashboard/payroll/${periodId}?error=` +
        encodeURIComponent("لازم تكتب 'فتح' للتأكيد"),
    );
  }

  // Read current status to know what to roll back to.
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("status, reopened_count")
    .eq("id", periodId)
    .single<{ status: string; reopened_count: number }>();

  if (!period) {
    redirect("/dashboard/payroll");
  }

  let nextStatus: "draft" | "approved" | null = null;
  const updates: Record<string, unknown> = {
    reopened_count: (period.reopened_count ?? 0) + 1,
    last_reopened_at: new Date().toISOString(),
    last_reopened_by: profile.id,
  };

  if (period.status === "paid") {
    nextStatus = "approved";
    updates.status = "approved";
    updates.paid_at = null;
  } else if (period.status === "approved") {
    nextStatus = "draft";
    updates.status = "draft";
    updates.approved_at = null;
    updates.approved_by = null;
  } else if (period.status === "cancelled") {
    nextStatus = "draft";
    updates.status = "draft";
    updates.cancelled_at = null;
    updates.cancelled_by = null;
    updates.cancellation_reason = null;
  } else {
    redirect(
      `/dashboard/payroll/${periodId}?error=` +
        encodeURIComponent("الدورة دي مش ممكن تفتحها (draft بالفعل)"),
    );
  }

  const { error } = await supabase
    .from("payroll_periods")
    .update(updates)
    .eq("id", periodId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/payroll/${periodId}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath(`/dashboard/payroll/${periodId}`);
  revalidatePath("/dashboard/payroll");
  bustDashboardCache();
  redirect(
    `/dashboard/payroll/${periodId}?reopened=${nextStatus ?? "1"}`,
  );
}

// ============================================================================
// BULK BONUS — apply the same bonus to every entry in a period
// ============================================================================
//
// HR's most common bulk operation: "صرف عيدية ٥٠٠ ج لكل الموظفين".
// Without this, they edit 50 entries one by one. This action takes
// the amount, an Arabic reason, and an optional employee allow-list
// (defaults to "everyone in the period"), then updates each entry's
// `bonuses` column AND recalculates gross/deductions/net so the totals
// stay consistent.
//
// Every run also logs to bulk_bonus_runs so admins can see what was
// applied, by whom, when.

export async function applyBulkBonus(formData: FormData) {
  const { supabase, profile } = await requireHR();

  const periodId = String(formData.get("period_id") ?? "").trim();
  const amountRaw = formData.get("amount_each");
  const reason = String(formData.get("reason") ?? "").trim();
  const recipientsRaw = formData.get("recipients"); // "all" or comma-sep ids

  if (!/^[0-9a-f-]{36}$/i.test(periodId)) {
    redirect("/dashboard/payroll");
  }
  const amount = parseFloat(String(amountRaw ?? "0"));
  if (!Number.isFinite(amount) || amount <= 0) {
    redirect(
      `/dashboard/payroll/${periodId}/bulk-bonus?error=` +
        encodeURIComponent("المبلغ لازم يكون أكبر من صفر"),
    );
  }
  if (reason.length < 3) {
    redirect(
      `/dashboard/payroll/${periodId}/bulk-bonus?error=` +
        encodeURIComponent("اكتب سبب المكافأة (مثلاً: عيدية الفطر)"),
    );
  }

  // Period must still be editable
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("status, working_days")
    .eq("id", periodId)
    .single<{ status: string; working_days: number }>();
  if (!period) {
    redirect("/dashboard/payroll");
  }
  if (period.status === "paid" || period.status === "cancelled") {
    redirect(
      `/dashboard/payroll/${periodId}?error=` +
        encodeURIComponent("الدورة مقفولة — افتحها قبل التعديل"),
    );
  }

  // Fetch entries to update
  const filterIds =
    recipientsRaw && recipientsRaw !== "all"
      ? String(recipientsRaw)
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
      : null;

  let entriesQuery = supabase
    .from("payroll_entries")
    .select(
      "id, employee_id, attended_days, half_day_days, leave_days, absent_days, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, bonuses, overtime, loan_deduction, other_deductions",
    )
    .eq("period_id", periodId);
  if (filterIds && filterIds.length > 0) {
    entriesQuery = entriesQuery.in("id", filterIds);
  }
  const { data: entries } = await entriesQuery;

  const list = entries ?? [];
  if (list.length === 0) {
    redirect(
      `/dashboard/payroll/${periodId}/bulk-bonus?error=` +
        encodeURIComponent("مفيش موظفين للصرف عليهم"),
    );
  }

  // Per-company toggles drive whether the auto deductions apply.
  const { data: companyRow } = await supabase
    .from("companies")
    .select("social_insurance_enabled, income_tax_enabled")
    .eq("id", profile.company_id)
    .single<{
      social_insurance_enabled: boolean | null;
      income_tax_enabled: boolean | null;
    }>();

  const settings = {
    socialInsuranceEnabled: companyRow?.social_insurance_enabled === true,
    incomeTaxEnabled: companyRow?.income_tax_enabled === true,
  };

  // Recalculate each entry with bonuses + amount (idempotent within
  // this run — the existing bonuses get TOPPED UP, not overwritten,
  // so HR can run "عيدية" first then "حافز قسم" later without
  // wiping the first run).
  let appliedCount = 0;
  await Promise.all(
    list.map(async (e) => {
      const newBonuses = Number(e.bonuses ?? 0) + amount;
      const result = calculatePayroll(
        {
          basicSalary: Number(e.basic_salary ?? 0),
          housingAllowance: Number(e.housing_allowance ?? 0),
          transportAllowance: Number(e.transport_allowance ?? 0),
          otherAllowances: Number(e.other_allowances ?? 0),
          incentiveAllowance: Number(e.incentive_allowance ?? 0),
          bonuses: newBonuses,
          overtime: Number(e.overtime ?? 0),
          loanDeduction: Number(e.loan_deduction ?? 0),
          otherDeductions: Number(e.other_deductions ?? 0),
        },
        {
          attended: Number(e.attended_days ?? 0),
          halfDay: Number(e.half_day_days ?? 0),
          leave: Number(e.leave_days ?? 0),
          absent: Number(e.absent_days ?? 0),
        },
        // Fallback to the Egyptian-standard 26-day month if the period
      // was created without an explicit working_days (e.g. legacy rows
      // from before the divisor fix).
      period.working_days ?? 26,
        settings,
      );
      const { error } = await supabase
        .from("payroll_entries")
        .update({
          bonuses: newBonuses,
          bonus_reason: reason,
          gross_salary: result.grossSalary,
          social_insurance: result.socialInsurance,
          income_tax: result.incomeTax,
          total_deductions: result.totalDeductions,
          net_salary: result.netSalary,
        })
        .eq("id", e.id)
        .eq("company_id", profile.company_id);
      if (!error) appliedCount += 1;
    }),
  );

  // Audit log
  await supabase.from("bulk_bonus_runs").insert({
    company_id: profile.company_id,
    period_id: periodId,
    amount_each: amount,
    reason,
    recipients_count: appliedCount,
    total_amount: appliedCount * amount,
    applied_by: profile.id,
  });

  revalidatePath(`/dashboard/payroll/${periodId}`);
  redirect(`/dashboard/payroll/${periodId}?bulk_bonus=${appliedCount}`);
}
