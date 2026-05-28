"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/permissions";
import { bustDashboardCache } from "@/lib/cache";

// Toggle the two statutory deductions (social insurance, income tax)
// AND the payroll cycle windows. Migration 023 defaults the deductions
// to false, migration 026 defaults monthly to day-1 and weekly to
// Saturday. This action lets HR adjust both at once.
export async function updatePayrollSettings(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  const socialInsuranceEnabled =
    formData.get("social_insurance_enabled") === "on";
  const incomeTaxEnabled = formData.get("income_tax_enabled") === "on";

  // Cycle settings. The DB CHECK constraints enforce 1..28 and 0..6,
  // but we clamp client-side so a fat-fingered "31" doesn't 500 the
  // request -- we silently snap to the nearest valid value.
  const rawMonthly = formData.get("monthly_cycle_start_day");
  const rawWeekly = formData.get("weekly_cycle_start_dow");
  const monthlyStartDay = clamp(parseIntSafe(rawMonthly, 1), 1, 28);
  const weeklyStartDow = clamp(parseIntSafe(rawWeekly, 6), 0, 6);

  const { error } = await supabase
    .from("companies")
    .update({
      social_insurance_enabled: socialInsuranceEnabled,
      income_tax_enabled: incomeTaxEnabled,
      monthly_cycle_start_day: monthlyStartDay,
      weekly_cycle_start_dow: weeklyStartDow,
    })
    .eq("id", profile.company_id);

  if (error) {
    redirect(
      "/dashboard/payroll/settings?error=" +
        encodeURIComponent(error.message),
    );
  }

  bustDashboardCache();
  redirect("/dashboard/payroll/settings?saved=1");
}

function parseIntSafe(value: FormDataEntryValue | null, fallback: number): number {
  if (value === null) return fallback;
  const n = parseInt(String(value), 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
