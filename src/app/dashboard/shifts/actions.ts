"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHR, requireAdmin } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import { bustDashboardCache } from "@/lib/cache";

function asText(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
}

function asNumber(v: FormDataEntryValue | null): number | null {
  const t = asText(v);
  if (t === null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
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

// ----------------------------------------------------------------------------
// Shifts
// ----------------------------------------------------------------------------

export async function createShift(formData: FormData) {
  await requireHR();
  const supabase = await createClient();
  const companyId = await getCurrentCompanyId(supabase);

  const name = asText(formData.get("name"));
  const startTime = asText(formData.get("start_time"));
  const endTime = asText(formData.get("end_time"));
  const expectedHours = asNumber(formData.get("expected_hours")) ?? 8;
  const color = asText(formData.get("color")) ?? "cyan";
  const isOvernight = formData.get("is_overnight") === "on";

  if (!name || !startTime || !endTime) {
    redirect(
      "/dashboard/shifts?error=" +
        encodeURIComponent("الاسم ووقت البداية والنهاية مطلوبين"),
    );
  }

  const { error } = await supabase.from("shifts").insert({
    company_id: companyId,
    name,
    start_time: startTime,
    end_time: endTime,
    is_overnight: isOvernight,
    expected_hours: expectedHours,
    color,
  });

  if (error) {
    redirect(
      "/dashboard/shifts?error=" +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/shifts");
  bustDashboardCache();
  redirect("/dashboard/shifts?created=shift");
}

export async function updateShift(shiftId: string, formData: FormData) {
  await requireHR();
  const supabase = await createClient();

  const update: Record<string, unknown> = {};
  const name = asText(formData.get("name"));
  if (name) update.name = name;
  const startTime = asText(formData.get("start_time"));
  if (startTime) update.start_time = startTime;
  const endTime = asText(formData.get("end_time"));
  if (endTime) update.end_time = endTime;
  const expectedHours = asNumber(formData.get("expected_hours"));
  if (expectedHours !== null) update.expected_hours = expectedHours;
  const color = asText(formData.get("color"));
  if (color) update.color = color;
  if (formData.get("is_overnight") !== null) {
    update.is_overnight = formData.get("is_overnight") === "on";
  }

  const { error } = await supabase
    .from("shifts")
    .update(update)
    .eq("id", shiftId);

  if (error) {
    redirect(
      "/dashboard/shifts?error=" +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/shifts");
  bustDashboardCache();
  redirect("/dashboard/shifts?updated=shift");
}

export async function deleteShift(shiftId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("shifts").delete().eq("id", shiftId);
  revalidatePath("/dashboard/shifts");
  bustDashboardCache();
  redirect("/dashboard/shifts?deleted=shift");
}

// ----------------------------------------------------------------------------
// Rotations
// ----------------------------------------------------------------------------

// Helper: build a standard "N days × M shifts with 1 day off after each"
// pattern from a list of shift IDs.
function buildStandardPattern(
  shiftIds: string[],
  daysPerShift: number,
): (string | null)[] {
  const pattern: (string | null)[] = [];
  for (const id of shiftIds) {
    for (let i = 0; i < daysPerShift; i++) pattern.push(id);
    pattern.push(null); // off day
  }
  return pattern;
}

export async function createRotation(formData: FormData) {
  await requireHR();
  const supabase = await createClient();
  const companyId = await getCurrentCompanyId(supabase);

  const name = asText(formData.get("name"));
  const description = asText(formData.get("description"));
  const daysPerShift = asNumber(formData.get("days_per_shift")) ?? 6;

  // Up to 4 shifts in rotation order. Missing slots are ignored.
  const shiftIds: string[] = [];
  for (const key of ["shift_1", "shift_2", "shift_3", "shift_4"]) {
    const v = asText(formData.get(key));
    if (v) shiftIds.push(v);
  }

  if (!name) {
    redirect(
      "/dashboard/shifts?error=" + encodeURIComponent("اكتب اسم نمط التدوير"),
    );
  }
  if (shiftIds.length < 2) {
    redirect(
      "/dashboard/shifts?error=" +
        encodeURIComponent("اختار على الأقل وردتين للتدوير"),
    );
  }
  if (daysPerShift < 1 || daysPerShift > 30) {
    redirect(
      "/dashboard/shifts?error=" +
        encodeURIComponent("عدد الأيام لكل وردية بين 1 و 30"),
    );
  }

  const pattern = buildStandardPattern(shiftIds, daysPerShift);

  const { error } = await supabase.from("shift_rotations").insert({
    company_id: companyId,
    name,
    description,
    cycle_days: pattern.length,
    pattern,
  });

  if (error) {
    redirect(
      "/dashboard/shifts?error=" +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/shifts");
  bustDashboardCache();
  redirect("/dashboard/shifts?created=rotation");
}

export async function deleteRotation(rotationId: string) {
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("shift_rotations").delete().eq("id", rotationId);
  revalidatePath("/dashboard/shifts");
  bustDashboardCache();
  redirect("/dashboard/shifts?deleted=rotation");
}

// ----------------------------------------------------------------------------
// Employee assignment
// ----------------------------------------------------------------------------

// Assigns an employee to either a fixed shift OR a rotation, never both.
// The form picks one of:
//   - assignment_type=fixed,    shift_id=<uuid>
//   - assignment_type=rotation, rotation_id=<uuid>, anchor_date=<date>,
//                               anchor_position=<int>
//   - assignment_type=none      (clears both)
export async function assignEmployeeShift(
  employeeId: string,
  formData: FormData,
) {
  await requireHR();
  const supabase = await createClient();

  const type = asText(formData.get("assignment_type")) ?? "none";

  const update: Record<string, unknown> = {
    shift_id: null,
    rotation_id: null,
    rotation_anchor_date: null,
    rotation_anchor_position: 0,
  };

  if (type === "fixed") {
    const shiftId = asText(formData.get("shift_id"));
    if (!shiftId) {
      redirect(
        `/dashboard/employees/${employeeId}?error=` +
          encodeURIComponent("اختار الوردية"),
      );
    }
    update.shift_id = shiftId;
  } else if (type === "rotation") {
    const rotationId = asText(formData.get("rotation_id"));
    const anchorDate =
      asText(formData.get("anchor_date")) ??
      new Date().toISOString().split("T")[0];
    const anchorPos = asNumber(formData.get("anchor_position")) ?? 0;

    if (!rotationId) {
      redirect(
        `/dashboard/employees/${employeeId}?error=` +
          encodeURIComponent("اختار نمط التدوير"),
      );
    }

    update.rotation_id = rotationId;
    update.rotation_anchor_date = anchorDate;
    update.rotation_anchor_position = anchorPos;
  }

  const { error } = await supabase
    .from("employees")
    .update(update)
    .eq("id", employeeId);

  if (error) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath("/dashboard/shifts");
  bustDashboardCache();
  redirect(`/dashboard/employees/${employeeId}?shift_updated=1`);
}
