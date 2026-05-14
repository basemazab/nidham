"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import { bustDashboardCache } from "@/lib/cache";

// Delete the chosen duplicate employee IDs. Admin-only because the
// cascade also removes attendance, payroll entries, leave/advance
// requests, etc. UI passes a comma-separated list of employee_ids
// to delete (the ones NOT marked as "keep"), with a confirm phrase.
export async function deleteDuplicateEmployees(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  const idsRaw = String(formData.get("employee_ids") ?? "").trim();
  const confirm = String(formData.get("confirm") ?? "").trim();

  if (confirm !== "حذف") {
    redirect(
      "/dashboard/employees/duplicates?error=" +
        encodeURIComponent("لازم تكتب 'حذف' في خانة التأكيد."),
    );
  }

  const ids = idsRaw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s));

  if (ids.length === 0) {
    redirect(
      "/dashboard/employees/duplicates?error=" +
        encodeURIComponent("اختار موظف واحد على الأقل عشان تحذفه."),
    );
  }
  if (ids.length > 50) {
    redirect(
      "/dashboard/employees/duplicates?error=" +
        encodeURIComponent("ممنوع حذف أكتر من 50 موظف في المرة الواحدة."),
    );
  }

  // The unique RLS company_id filter + the explicit company_id check
  // here together guarantee we never touch another tenant's rows even
  // if RLS is loosened in a future migration.
  const { error, count } = await supabase
    .from("employees")
    .delete({ count: "exact" })
    .eq("company_id", profile.company_id)
    .in("id", ids);

  if (error) {
    redirect(
      "/dashboard/employees/duplicates?error=" +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard/employees/duplicates");
  bustDashboardCache();

  redirect(
    "/dashboard/employees/duplicates?deleted=" +
      encodeURIComponent(String(count ?? ids.length)),
  );
}
