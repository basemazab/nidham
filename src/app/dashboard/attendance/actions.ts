"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHR, requireAdmin } from "@/lib/permissions";
import { bustDashboardCache } from "@/lib/cache";

const VALID_STATUSES = [
  "present",
  "absent",
  "half_day",
  "leave",
  "holiday",
  "weekend",
] as const;

type AttendanceStatus = (typeof VALID_STATUSES)[number];

// Hard cap so a fat-fingered date range can't drag the database to its
// knees. 60 days × 200 employees = 12,000 rows, which is still ~one
// round-trip via Supabase's batch insert.
const BULK_MAX_DAYS = 60;

// Deletion is a single DELETE statement in Postgres, no per-row work,
// so the cap can be much larger. A full year is plenty for "wipe and
// re-import" scenarios.
const BULK_DELETE_MAX_DAYS = 365;

export async function saveAttendance(formData: FormData) {
  await requireHR();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  if (!profile) throw new Error("Profile not found");

  const date = String(formData.get("date") ?? "");
  if (!date) {
    redirect("/dashboard/attendance?error=" + encodeURIComponent("التاريخ مطلوب"));
  }

  // Collect all status_<employee_id> entries. Tardiness + early-leave
  // (minutes) are read alongside the status with the same employee_id
  // suffix so they end up on the same upserted row.
  const records: Array<{
    company_id: string;
    employee_id: string;
    date: string;
    status: string;
    tardiness_minutes: number;
    early_leave_minutes: number;
    created_by: string;
  }> = [];

  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith("status_")) continue;
    const value = String(rawValue ?? "");
    if (!value) continue;
    if (!VALID_STATUSES.includes(value as AttendanceStatus)) continue;

    const empId = key.replace("status_", "");
    const tardiness = clampMinutes(formData.get(`tardiness_${empId}`));
    const earlyLeave = clampMinutes(formData.get(`early_leave_${empId}`));

    records.push({
      company_id: profile.company_id as string,
      employee_id: empId,
      date,
      status: value,
      tardiness_minutes: tardiness,
      early_leave_minutes: earlyLeave,
      created_by: user.id,
    });
  }

  if (records.length === 0) {
    redirect(
      "/dashboard/attendance?date=" +
        encodeURIComponent(date) +
        "&error=" +
        encodeURIComponent("اختار حالة موظف واحد على الأقل"),
    );
  }

  const { error } = await supabase
    .from("attendance")
    .upsert(records, { onConflict: "employee_id,date" });

  if (error) {
    redirect(
      "/dashboard/attendance?date=" +
        encodeURIComponent(date) +
        "&error=" +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/attendance");
  bustDashboardCache();
  redirect(
    "/dashboard/attendance?date=" +
      encodeURIComponent(date) +
      "&saved=" +
      records.length,
  );
}

// ----------------------------------------------------------------------------
// Bulk attendance -- "mark everyone X for date D" or "for the range D1..D2"
//
// The HR runs this once a week / once a month when most employees have
// been present and they don't want to click 50 dropdowns. The action
// is ADDITIVE only: existing attendance rows are never overwritten,
// so the per-employee form remains the source of truth for any
// exception the HR has already recorded.
//
// fridays_as_weekend: when ticked, any Friday in the range is recorded
// as 'weekend' instead of the chosen status. Egypt's universal rest
// day is Friday; this keeps the bulk action honest about the workweek.
// ----------------------------------------------------------------------------
export async function bulkSaveAttendance(formData: FormData) {
  await requireHR();
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();
  if (!profile) throw new Error("Profile not found");

  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDateRaw = String(formData.get("end_date") ?? "").trim();
  const endDate = endDateRaw || startDate; // single-day mode: end = start
  const statusRaw = String(formData.get("status") ?? "present").trim();
  const fridaysAsWeekend =
    String(formData.get("fridays_as_weekend") ?? "") === "on";

  if (!startDate) {
    redirect(
      "/dashboard/attendance?error=" +
        encodeURIComponent("التاريخ مطلوب"),
    );
  }

  if (!VALID_STATUSES.includes(statusRaw as AttendanceStatus)) {
    redirect(
      "/dashboard/attendance?error=" +
        encodeURIComponent("الحالة المختارة غير صحيحة"),
    );
  }
  const status = statusRaw as AttendanceStatus;

  const dates = datesBetween(startDate, endDate);
  if (dates.length === 0) {
    redirect(
      "/dashboard/attendance?error=" +
        encodeURIComponent("تاريخ النهاية لازم يكون بعد أو يساوي تاريخ البداية"),
    );
  }
  if (dates.length > BULK_MAX_DAYS) {
    redirect(
      "/dashboard/attendance?error=" +
        encodeURIComponent(
          `الفترة كبيرة جدًا (${dates.length} يوم). الحد الأقصى ${BULK_MAX_DAYS} يوم في المرة الواحدة.`,
        ),
    );
  }

  // Pull all active employees in this tenant
  const { data: employees } = await supabase
    .from("employees")
    .select("id")
    .eq("status", "active")
    .returns<{ id: string }[]>();

  const empIds = (employees ?? []).map((e) => e.id);
  if (empIds.length === 0) {
    redirect(
      "/dashboard/attendance?error=" +
        encodeURIComponent("مفيش موظفين نشطين في الشركة"),
    );
  }

  // Build the (employee × date) cartesian product. For each cell we
  // pick the effective status (Friday becomes 'weekend' when the
  // toggle is on).
  const records: Array<{
    company_id: string;
    employee_id: string;
    date: string;
    status: string;
    created_by: string;
  }> = [];

  for (const isoDate of dates) {
    // ISO date: split is locale-safe (no timezone surprise).
    const [yStr, mStr, dStr] = isoDate.split("-");
    const dt = new Date(
      Number(yStr),
      Number(mStr) - 1,
      Number(dStr),
    );
    const isFriday = dt.getDay() === 5;
    const effectiveStatus =
      fridaysAsWeekend && isFriday ? "weekend" : status;

    for (const empId of empIds) {
      records.push({
        company_id: profile.company_id as string,
        employee_id: empId,
        date: isoDate,
        status: effectiveStatus,
        created_by: user.id,
      });
    }
  }

  // ADDITIVE insert: the (employee_id, date) unique index makes any
  // duplicate row a conflict; ignoreDuplicates: true tells Postgres
  // to silently skip, leaving the existing row untouched.
  const { error, count } = await supabase
    .from("attendance")
    .upsert(records, {
      onConflict: "employee_id,date",
      ignoreDuplicates: true,
      count: "exact",
    });

  if (error) {
    redirect(
      "/dashboard/attendance?error=" +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/attendance");
  bustDashboardCache();

  // Land back on the END date so the HR can immediately review the
  // most recent day that was just bulk-filled.
  const inserted = count ?? records.length;
  redirect(
    "/dashboard/attendance?date=" +
      encodeURIComponent(endDate) +
      "&bulk=" +
      encodeURIComponent(
        `${inserted}|${dates.length}|${empIds.length}`,
      ),
  );
}

// ----------------------------------------------------------------------------
// Bulk delete -- wipe attendance for a date or a date range.
//
// Admin-only because deletion is destructive: cascades nothing (it's
// just attendance rows), but losing a month of recorded clock-ins
// would be painful to redo. The confirm-phrase below is parsed by the
// modal client which posts "حذف" once the user types it.
//
// Whole-company by date range: simple DELETE FROM attendance with a
// date filter, scoped by RLS to the caller's company.
// ----------------------------------------------------------------------------
export async function bulkDeleteAttendance(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  const startDate = String(formData.get("start_date") ?? "").trim();
  const endDateRaw = String(formData.get("end_date") ?? "").trim();
  const endDate = endDateRaw || startDate;
  const confirm = String(formData.get("confirm") ?? "").trim();

  if (!startDate) {
    redirect(
      "/dashboard/attendance?error=" + encodeURIComponent("التاريخ مطلوب"),
    );
  }
  if (confirm !== "حذف") {
    redirect(
      "/dashboard/attendance?error=" +
        encodeURIComponent("لازم تكتب 'حذف' في خانة التأكيد عشان نمسح."),
    );
  }

  const dates = datesBetween(startDate, endDate);
  if (dates.length === 0) {
    redirect(
      "/dashboard/attendance?error=" +
        encodeURIComponent("تاريخ النهاية لازم يكون بعد أو يساوي تاريخ البداية"),
    );
  }
  if (dates.length > BULK_DELETE_MAX_DAYS) {
    redirect(
      "/dashboard/attendance?error=" +
        encodeURIComponent(
          `الفترة كبيرة جدًا (${dates.length} يوم). الحد الأقصى ${BULK_DELETE_MAX_DAYS} يوم في المرة الواحدة.`,
        ),
    );
  }

  // Count first so the success banner is specific.
  const { count: beforeCount } = await supabase
    .from("attendance")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id)
    .gte("date", startDate)
    .lte("date", endDate);

  const willDelete = beforeCount ?? 0;
  if (willDelete === 0) {
    redirect(
      "/dashboard/attendance?date=" +
        encodeURIComponent(endDate) +
        "&error=" +
        encodeURIComponent("مفيش سجلات حضور في الفترة دي عشان تتمسح."),
    );
  }

  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("company_id", profile.company_id)
    .gte("date", startDate)
    .lte("date", endDate);

  if (error) {
    redirect(
      "/dashboard/attendance?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/reports/attendance");
  bustDashboardCache();

  redirect(
    "/dashboard/attendance?date=" +
      encodeURIComponent(endDate) +
      "&deleted=" +
      encodeURIComponent(`${willDelete}|${dates.length}`),
  );
}

// ----------------------------------------------------------------------------
// Single-employee, single-day delete. Triggered from the per-row "✕"
// button on the attendance page so HR can fix an individual mistake
// without nuking the whole day.
// ----------------------------------------------------------------------------
export async function deleteOneAttendance(formData: FormData) {
  await requireHR();
  const supabase = await createClient();
  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const date = String(formData.get("date") ?? "").trim();

  if (!employeeId || !date) {
    redirect(
      "/dashboard/attendance?error=" +
        encodeURIComponent("الموظف والتاريخ مطلوبين للحذف"),
    );
  }

  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("employee_id", employeeId)
    .eq("date", date);

  if (error) {
    redirect(
      "/dashboard/attendance?date=" +
        encodeURIComponent(date) +
        "&error=" +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/reports/attendance");
  redirect("/dashboard/attendance?date=" + encodeURIComponent(date));
}

// Parse and clamp a tardiness / early-leave minute value to the DB
// check-constraint range (0..720). Empty or non-numeric input -> 0.
function clampMinutes(value: FormDataEntryValue | null): number {
  if (value === null) return 0;
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 720);
}

function datesBetween(start: string, end: string): string[] {
  const [ys, ms, ds] = start.split("-").map((n) => parseInt(n, 10));
  const [ye, me, de] = end.split("-").map((n) => parseInt(n, 10));
  if (
    !Number.isFinite(ys) ||
    !Number.isFinite(ms) ||
    !Number.isFinite(ds) ||
    !Number.isFinite(ye) ||
    !Number.isFinite(me) ||
    !Number.isFinite(de)
  ) {
    return [];
  }
  const startD = new Date(ys, ms - 1, ds);
  const endD = new Date(ye, me - 1, de);
  if (Number.isNaN(startD.getTime()) || Number.isNaN(endD.getTime()))
    return [];
  if (endD < startD) return [];

  const out: string[] = [];
  const cur = new Date(startD);
  while (cur <= endD) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
