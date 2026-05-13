"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";

const VALID_STATUSES = [
  "present",
  "absent",
  "half_day",
  "leave",
  "holiday",
  "weekend",
] as const;

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

  // Collect all status_<employee_id> entries
  const records: Array<{
    company_id: string;
    employee_id: string;
    date: string;
    status: string;
    created_by: string;
  }> = [];

  for (const [key, rawValue] of formData.entries()) {
    if (!key.startsWith("status_")) continue;
    const value = String(rawValue ?? "");
    if (!value) continue;
    if (!VALID_STATUSES.includes(value as (typeof VALID_STATUSES)[number])) continue;

    records.push({
      company_id: profile.company_id as string,
      employee_id: key.replace("status_", ""),
      date,
      status: value,
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
  redirect(
    "/dashboard/attendance?date=" +
      encodeURIComponent(date) +
      "&saved=" +
      records.length,
  );
}
