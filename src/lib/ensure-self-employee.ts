// ============================================================================
// ensureSelfEmployee — guarantees the logged-in user has an employee record
// ============================================================================
//
// CRM-only customers (signed up via /crm) don't have employee records
// since they don't use the HR module. But the interactions table needs
// an `employee_id` to record who logged each call/meeting/email.
//
// This helper finds (or creates) a lightweight employee row linked to the
// current user, returning the employee_id ready to use as a foreign key.
//
// Used by /dashboard/customers' QuickLogModal so any signed-in user can
// log interactions without first going through the full employee setup.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SBClient = SupabaseClient<any, "public">;

export async function ensureSelfEmployee(
  supabase: SBClient,
  userId: string,
  companyId: string,
  fallbackName?: string,
  fallbackEmail?: string,
): Promise<string> {
  // 1. Already linked? Return the existing employee_id.
  const { data: existing } = await supabase
    .from("employees")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle<{ id: string }>();
  if (existing?.id) return existing.id;

  // 2. Not linked — create a minimal employee record via service-role
  //    so RLS on companies/employees doesn't block us.
  const serviceClient = createServiceClient();
  const { data: created, error } = await serviceClient
    .from("employees")
    .insert({
      company_id: companyId,
      user_id: userId,
      full_name: fallbackName || fallbackEmail?.split("@")[0] || "User",
      email: fallbackEmail ?? null,
      status: "active",
      pay_frequency: "monthly",
      basic_salary: 0,
      job_title: "User",
      department: "—",
      hire_date: new Date().toISOString().split("T")[0],
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !created) {
    throw new Error(
      `Could not create self-employee record: ${error?.message ?? "unknown"}`,
    );
  }
  return created.id;
}
