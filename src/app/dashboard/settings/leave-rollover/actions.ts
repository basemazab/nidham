"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import { bustDashboardCache } from "@/lib/cache";

// Admin-only annual leave carryover trigger. Calls the rollover RPC
// (migration 032) which is idempotent -- safe to re-run.
export async function runLeaveRollover(targetYear: number) {
  await requireAdmin();
  const supabase = await createClient();

  if (!Number.isFinite(targetYear) || targetYear < 2020 || targetYear > 2099) {
    redirect(
      "/dashboard/settings/leave-rollover?error=" +
        encodeURIComponent("السنة المستهدفة خارج النطاق المسموح"),
    );
  }

  const { data, error } = await supabase.rpc("rollover_leave_balances", {
    p_target_year: targetYear,
  });

  if (error) {
    redirect(
      `/dashboard/settings/leave-rollover?year=${targetYear}&error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  const rowCount = Array.isArray(data) ? data.length : 0;

  revalidatePath("/dashboard/settings/leave-rollover");
  bustDashboardCache();
  redirect(
    `/dashboard/settings/leave-rollover?year=${targetYear}&applied=${rowCount}`,
  );
}
