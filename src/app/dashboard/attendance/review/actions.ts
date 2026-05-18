"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import { bustDashboardCache } from "@/lib/cache";

const VALID_STATUSES = [
  "present",
  "absent",
  "half_day",
  "leave",
  "holiday",
  "weekend",
] as const;

// ----------------------------------------------------------------------------
// Per-row updates while reviewing a batch. Each form submits a single
// attendance.id + the new field values; the action validates + applies
// the change. Used by the review table's "save row" buttons.
// ----------------------------------------------------------------------------
export async function updateAttendanceRow(formData: FormData) {
  const { profile } = await requireHR();
  const supabase = await createClient();

  const id = String(formData.get("attendance_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirect(
      "/dashboard/attendance/review?error=" +
        encodeURIComponent("معرف السجل غير صالح"),
    );
  }

  const status = String(formData.get("status") ?? "").trim();
  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    redirect(
      "/dashboard/attendance/review?error=" +
        encodeURIComponent("الحالة المختارة غير صحيحة"),
    );
  }

  const tardinessRaw = formData.get("tardiness_minutes");
  const earlyRaw = formData.get("early_leave_minutes");
  const tardiness = clampMin(tardinessRaw);
  const earlyLeave = clampMin(earlyRaw);

  const checkInRaw = String(formData.get("check_in") ?? "").trim();
  const checkOutRaw = String(formData.get("check_out") ?? "").trim();
  const check_in = parseTimeOrNull(checkInRaw);
  const check_out = parseTimeOrNull(checkOutRaw);
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const batchId = String(formData.get("batch_id") ?? "").trim();

  // RLS hardening: explicit company_id clamp. Under super-admin sessions
  // (mig 038), RLS WITH CHECK alone wouldn't stop a forged attendance.id
  // from hitting another tenant's row.
  const { error } = await supabase
    .from("attendance")
    .update({
      status,
      tardiness_minutes: tardiness,
      early_leave_minutes: earlyLeave,
      check_in,
      check_out,
      notes,
    })
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/attendance/review?batch=${batchId}&error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/attendance/review");
  revalidatePath("/dashboard/attendance");
  bustDashboardCache();
  redirect(
    `/dashboard/attendance/review?batch=${batchId}&row_saved=${id.slice(0, 8)}`,
  );
}

// ----------------------------------------------------------------------------
// Delete a single attendance row from a review batch. HR uses this
// to drop misimported records (e.g. weekly worker that slipped through).
// ----------------------------------------------------------------------------
export async function deleteAttendanceRow(formData: FormData) {
  const { profile } = await requireHR();
  const supabase = await createClient();

  const id = String(formData.get("attendance_id") ?? "").trim();
  const batchId = String(formData.get("batch_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirect("/dashboard/attendance/review");
  }

  // RLS hardening: company_id clamp blocks cross-tenant deletes under
  // super-admin sessions (mig 038).
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);
  if (error) {
    redirect(
      `/dashboard/attendance/review?batch=${batchId}&error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/attendance/review");
  revalidatePath("/dashboard/attendance");
  bustDashboardCache();
  redirect(`/dashboard/attendance/review?batch=${batchId}&row_deleted=1`);
}

// ----------------------------------------------------------------------------
// "Confirm batch" -- just sets imported_at to a past timestamp so the
// banner on /dashboard/attendance ("X imported recently") stops showing
// for this batch. The records themselves are already live -- this is a
// UX gesture, not a data change. (We don't add a `confirmed` flag
// because reports / payroll already treat imported rows as real.)
// ----------------------------------------------------------------------------
export async function confirmAttendanceBatch(formData: FormData) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  const batchId = String(formData.get("batch_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(batchId)) {
    redirect("/dashboard/attendance/review");
  }

  // Backdate imported_at by 25 hours so count_recent_import_rows()
  // (which checks "last 24 hours") drops this batch from the banner.
  //
  // RLS hardening: company_id clamp ensures a super-admin can't confirm
  // another tenant's batch by guessing its UUID.
  const past = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
  await supabase
    .from("attendance")
    .update({ imported_at: past })
    .eq("import_batch_id", batchId)
    .eq("company_id", profile.company_id);

  revalidatePath("/dashboard/attendance/review");
  revalidatePath("/dashboard/attendance");
  redirect(`/dashboard/attendance/review?batch=${batchId}&confirmed=1`);
}

// ----------------------------------------------------------------------------
// Nuke the entire batch. Useful when HR re-uploads after fixing a bad
// file -- they delete the previous batch to start clean.
// ----------------------------------------------------------------------------
export async function deleteAttendanceBatch(formData: FormData) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  const batchId = String(formData.get("batch_id") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "").trim();

  if (!/^[0-9a-f-]{36}$/i.test(batchId)) {
    redirect("/dashboard/attendance/review");
  }
  if (confirm !== "حذف") {
    redirect(
      `/dashboard/attendance/review?batch=${batchId}&error=` +
        encodeURIComponent("لازم تكتب 'حذف' للتأكيد"),
    );
  }

  // RLS hardening: company_id clamp prevents cross-tenant batch deletes
  // under super-admin sessions (mig 038).
  const { count, error } = await supabase
    .from("attendance")
    .delete({ count: "exact" })
    .eq("import_batch_id", batchId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      "/dashboard/attendance/review?error=" +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/attendance/review");
  revalidatePath("/dashboard/attendance");
  bustDashboardCache();
  redirect(
    "/dashboard/attendance/review?batch_deleted=" +
      encodeURIComponent(String(count ?? 0)),
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function clampMin(value: FormDataEntryValue | null): number {
  if (value === null) return 0;
  const n = parseInt(String(value), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 720);
}

function parseTimeOrNull(s: string): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (h > 23 || mm > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${m[3] ?? "00"}`;
}
