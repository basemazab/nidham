"use server";

// ============================================================================
// Retention Insights — server actions
// ============================================================================
//
// Three actions:
//   1) generateRetentionInsights() -- runs the scoring engine, deletes
//      previous PENDING insights, inserts the new ones.
//   2) actionRetentionInsight(formData) -- mark insight as actioned.
//      For 'raise': also updates employees.basic_salary (the trigger
//      auto-logs salary_history).
//      For 'bonus': just marks actioned + redirects to payroll (HR
//      adds bonus manually in V1). V2 will wire up a scheduled_bonus
//      table.
//   3) dismissRetentionInsight(formData) -- mark insight as dismissed
//      (HR doesn't agree, e.g. "moshrek not eligible").
//
// Loading
// -------
// loadEmployeeSignals() fetches:
//   - active employees in caller's company (full record)
//   - last 90 days of attendance
//   - salary_history latest change_date per employee
//   - last 30 days of approved leaves
// then assembles EmployeeSignals[] for the engine.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import {
  analyzeAll,
  type EmployeeSignals,
  type RetentionInsight,
  monthsBetween,
} from "@/lib/retention";

type EmployeeRow = {
  id: string;
  company_id: string;
  full_name: string;
  job_title: string | null;
  department: string | null;
  hire_date: string | null;
  basic_salary: number | null;
  housing_allowance: number | null;
  transport_allowance: number | null;
  other_allowances: number | null;
  incentive_allowance: number | null;
  pay_frequency: "monthly" | "weekly" | null;
  status: string;
};

type AttendanceRow = {
  employee_id: string;
  date: string;
  status: string;
  tardiness_minutes: number | null;
  early_leave_minutes: number | null;
};

type SalaryHistoryRow = {
  employee_id: string;
  change_date: string;
};

type LeaveRow = {
  employee_id: string;
  days_count: number;
  status: string;
};

// ----------------------------------------------------------------------------
// Data loader — assembles EmployeeSignals[] from DB rows
// ----------------------------------------------------------------------------
async function loadEmployeeSignals(
  companyId: string,
): Promise<EmployeeSignals[]> {
  const supabase = await createClient();

  const today = new Date();
  const ninetyDaysAgo = new Date(today);
  ninetyDaysAgo.setDate(today.getDate() - 90);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  const sixtyDaysAgo = new Date(today);
  sixtyDaysAgo.setDate(today.getDate() - 60);

  const ninetyDaysAgoIso = ninetyDaysAgo.toISOString().split("T")[0];
  const thirtyDaysAgoIso = thirtyDaysAgo.toISOString().split("T")[0];
  const sixtyDaysAgoIso = sixtyDaysAgo.toISOString().split("T")[0];
  const todayIso = today.toISOString().split("T")[0];

  const [empRes, attRes, salaryRes, leaveRes] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "id, company_id, full_name, job_title, department, hire_date, basic_salary, housing_allowance, transport_allowance, other_allowances, incentive_allowance, pay_frequency, status",
      )
      .eq("company_id", companyId)
      .eq("status", "active")
      .returns<EmployeeRow[]>(),
    supabase
      .from("attendance")
      .select(
        "employee_id, date, status, tardiness_minutes, early_leave_minutes",
      )
      .gte("date", ninetyDaysAgoIso)
      .lte("date", todayIso)
      .returns<AttendanceRow[]>(),
    // Latest change_date per employee — Supabase doesn't have DISTINCT ON
    // in the JS client, so we sort desc and dedupe in JS.
    supabase
      .from("salary_history")
      .select("employee_id, change_date")
      .order("change_date", { ascending: false })
      .returns<SalaryHistoryRow[]>(),
    supabase
      .from("leave_requests")
      .select("employee_id, days_count, status")
      .gte("start_date", thirtyDaysAgoIso)
      .lte("start_date", todayIso)
      .eq("status", "approved")
      .returns<LeaveRow[]>(),
  ]);

  const employees = empRes.data ?? [];
  const attendance = attRes.data ?? [];
  const salaryHistory = salaryRes.data ?? [];
  const leaves = leaveRes.data ?? [];

  // Build "latest raise date" map (first row per employee since sorted desc)
  const lastRaiseDate = new Map<string, string>();
  for (const row of salaryHistory) {
    if (!lastRaiseDate.has(row.employee_id)) {
      lastRaiseDate.set(row.employee_id, row.change_date);
    }
  }

  // Build "recent leave days" map
  const recentLeaveDaysMap = new Map<string, number>();
  for (const row of leaves) {
    const cur = recentLeaveDaysMap.get(row.employee_id) ?? 0;
    recentLeaveDaysMap.set(row.employee_id, cur + (row.days_count ?? 0));
  }

  // Compute signals per employee
  const signals: EmployeeSignals[] = [];
  for (const emp of employees) {
    if (!emp.hire_date) continue; // need hire_date for tenure

    const empAtt = attendance.filter((a) => a.employee_id === emp.id);

    // 90-day stats
    const present = empAtt.filter((a) => a.status === "present").length;
    const halfDay = empAtt.filter((a) => a.status === "half_day").length;
    const absent = empAtt.filter((a) => a.status === "absent").length;
    const leave = empAtt.filter((a) => a.status === "leave").length;
    const workingRecords = present + halfDay + absent + leave;
    const attendanceRate =
      workingRecords === 0 ? 1 : (present + halfDay * 0.5) / workingRecords;

    // Workday rows for tardiness avg
    const workdayRows = empAtt.filter(
      (a) => a.status === "present" || a.status === "half_day",
    );
    const tardinessSum = workdayRows.reduce(
      (s, a) => s + (a.tardiness_minutes ?? 0),
      0,
    );
    const earlyLeaveSum = workdayRows.reduce(
      (s, a) => s + (a.early_leave_minutes ?? 0),
      0,
    );
    const tardinessMinutesAvgPerDay =
      workdayRows.length === 0 ? 0 : tardinessSum / workdayRows.length;
    const earlyLeaveMinutesAvgPerDay =
      workdayRows.length === 0 ? 0 : earlyLeaveSum / workdayRows.length;

    // Delta: last 30d vs previous 60d
    const last30 = empAtt.filter((a) => a.date >= thirtyDaysAgoIso);
    const prev60 = empAtt.filter(
      (a) => a.date >= sixtyDaysAgoIso && a.date < thirtyDaysAgoIso,
    );
    const rateFor = (rows: AttendanceRow[]): number => {
      const p = rows.filter((r) => r.status === "present").length;
      const h = rows.filter((r) => r.status === "half_day").length;
      const ab = rows.filter((r) => r.status === "absent").length;
      const lv = rows.filter((r) => r.status === "leave").length;
      const tot = p + h + ab + lv;
      return tot === 0 ? 1 : (p + h * 0.5) / tot;
    };
    const last30Rate = rateFor(last30);
    const prev60Rate = rateFor(prev60);
    const attendanceRateDelta = last30Rate - prev60Rate;

    // Tenure + months-since-last-raise
    const tenureMonths = monthsBetween(emp.hire_date, today);
    const lastChange = lastRaiseDate.get(emp.id) ?? emp.hire_date;
    const monthsSinceLastRaise = monthsBetween(lastChange, today);

    const totalCompensation =
      (emp.basic_salary ?? 0) +
      (emp.housing_allowance ?? 0) +
      (emp.transport_allowance ?? 0) +
      (emp.other_allowances ?? 0) +
      (emp.incentive_allowance ?? 0);

    signals.push({
      id: emp.id,
      fullName: emp.full_name,
      jobTitle: emp.job_title,
      department: emp.department,
      hireDate: emp.hire_date,
      basicSalary: emp.basic_salary ?? 0,
      totalCompensation,
      payFrequency: emp.pay_frequency ?? "monthly",
      tenureMonths,
      monthsSinceLastRaise,
      attendanceRate,
      totalAttendanceDays: workingRecords,
      absentDays: absent,
      tardinessMinutesAvgPerDay,
      earlyLeaveMinutesAvgPerDay,
      attendanceRateDelta,
      recentLeaveDays: recentLeaveDaysMap.get(emp.id) ?? 0,
    });
  }

  return signals;
}

// ----------------------------------------------------------------------------
// generateRetentionInsights -- the "حدث التوصيات" button
// ----------------------------------------------------------------------------
export async function generateRetentionInsights() {
  const { supabase, profile } = await requireHR();

  // Load + score
  const signals = await loadEmployeeSignals(profile.company_id);
  const insights = analyzeAll(signals);

  // Clear previous PENDING insights so we don't pile up duplicates.
  // We keep actioned + dismissed for audit / "didn't I just dismiss
  // that?" context.
  await supabase
    .from("employee_retention_insights")
    .delete()
    .eq("company_id", profile.company_id)
    .eq("status", "pending");

  if (insights.length === 0) {
    revalidatePath("/dashboard/retention");
    redirect("/dashboard/retention?generated=0");
  }

  // Bulk insert
  const rows = insights.map((i: RetentionInsight) => ({
    company_id: profile.company_id,
    employee_id: i.employeeId,
    insight_type: i.insightType,
    score: i.score,
    reasoning: i.reasoning.join("\n"),
    suggested_amount: i.suggestedAmount,
    metadata: i.metadata,
    status: "pending" as const,
  }));

  const { error } = await supabase
    .from("employee_retention_insights")
    .insert(rows);

  if (error) {
    redirect(
      "/dashboard/retention?error=" +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/retention");
  revalidatePath("/dashboard");
  redirect(`/dashboard/retention?generated=${insights.length}`);
}

// ----------------------------------------------------------------------------
// actionRetentionInsight -- HR clicks "وافق ومرر للراتب"
// ----------------------------------------------------------------------------
//
// For a RAISE insight: applies the salary change directly to employees.basic_salary.
// The salary_history trigger auto-logs the change. Then marks the insight
// as actioned.
//
// For a BONUS insight: V1 just marks actioned + adds a note. The user
// will manually open the next payroll period and enter the bonus amount.
// (V2: feed it into a scheduled_bonus table that the payroll generator reads.)
//
// For an ANNIVERSARY: just marks actioned (HR decides what to do).
//
// For a FLIGHT_RISK: just marks actioned (HR booked the 1:1).
export async function actionRetentionInsight(formData: FormData) {
  const { supabase, profile } = await requireHR();
  const insightId = String(formData.get("insight_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(insightId)) {
    redirect(
      "/dashboard/retention?error=" +
        encodeURIComponent("معرف التوصية غير صالح"),
    );
  }

  // Fetch the insight (scoped by company_id via RLS)
  const { data: insight, error: fetchErr } = await supabase
    .from("employee_retention_insights")
    .select(
      "id, employee_id, insight_type, suggested_amount, metadata, status",
    )
    .eq("id", insightId)
    .eq("company_id", profile.company_id)
    .maybeSingle<{
      id: string;
      employee_id: string;
      insight_type: "raise" | "bonus" | "flight_risk" | "anniversary";
      suggested_amount: number | null;
      metadata: Record<string, unknown>;
      status: string;
    }>();

  if (fetchErr || !insight) {
    redirect(
      "/dashboard/retention?error=" +
        encodeURIComponent("التوصية مش موجودة"),
    );
  }

  if (insight.status !== "pending") {
    redirect(
      "/dashboard/retention?error=" +
        encodeURIComponent("تم التعامل مع التوصية دي من قبل"),
    );
  }

  // For RAISE: actually update the salary
  if (insight.insight_type === "raise") {
    const newSalary = Number(insight.metadata?.newSalary);
    if (!Number.isFinite(newSalary) || newSalary <= 0) {
      redirect(
        "/dashboard/retention?error=" +
          encodeURIComponent("الراتب الجديد غير صحيح"),
      );
    }

    const { error: updErr } = await supabase
      .from("employees")
      .update({ basic_salary: newSalary })
      .eq("id", insight.employee_id)
      .eq("company_id", profile.company_id);

    if (updErr) {
      redirect(
        "/dashboard/retention?error=" +
          encodeURIComponent(arabicizeDbError(updErr.message)),
      );
    }
  }

  // Mark insight as actioned
  const { error: actErr } = await supabase
    .from("employee_retention_insights")
    .update({
      status: "actioned",
      actioned_at: new Date().toISOString(),
      actioned_by: profile.id,
    })
    .eq("id", insightId);

  if (actErr) {
    redirect(
      "/dashboard/retention?error=" +
        encodeURIComponent(arabicizeDbError(actErr.message)),
    );
  }

  revalidatePath("/dashboard/retention");
  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/employees/${insight.employee_id}`);

  // For BONUS, deep-link the user to the employee's profile so they
  // can add the bonus into the next payroll period manually.
  if (insight.insight_type === "bonus") {
    redirect(
      `/dashboard/employees/${insight.employee_id}?bonus_amount=${insight.suggested_amount ?? 0}&from_retention=1`,
    );
  }

  redirect("/dashboard/retention?actioned=1");
}

// ----------------------------------------------------------------------------
// dismissRetentionInsight -- HR says "ده مش مظبوط"
// ----------------------------------------------------------------------------
export async function dismissRetentionInsight(formData: FormData) {
  const { supabase, profile } = await requireHR();
  const insightId = String(formData.get("insight_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(insightId)) {
    redirect("/dashboard/retention");
  }

  await supabase
    .from("employee_retention_insights")
    .update({
      status: "dismissed",
      actioned_at: new Date().toISOString(),
      actioned_by: profile.id,
    })
    .eq("id", insightId)
    .eq("company_id", profile.company_id)
    .eq("status", "pending");

  revalidatePath("/dashboard/retention");
  revalidatePath("/dashboard");
  redirect("/dashboard/retention?dismissed=1");
}
