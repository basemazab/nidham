"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/permissions";
import { bustDashboardCache } from "@/lib/cache";

// Toggle the two statutory deductions (social insurance, income tax)
// for the current company. Migration 023 defaults both to false so a
// fresh tenant starts with no auto deductions; this action lets HR
// turn them on when they're ready to file.
export async function updatePayrollSettings(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  const socialInsuranceEnabled = formData.get("social_insurance_enabled") === "on";
  const incomeTaxEnabled = formData.get("income_tax_enabled") === "on";

  const { error } = await supabase
    .from("companies")
    .update({
      social_insurance_enabled: socialInsuranceEnabled,
      income_tax_enabled: incomeTaxEnabled,
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
