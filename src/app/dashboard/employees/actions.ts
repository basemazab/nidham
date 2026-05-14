"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import { sendEmail, emailMobileInvitation } from "@/lib/email";

function asText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function asNumber(value: FormDataEntryValue | null): number | null {
  const text = asText(value);
  if (text === null) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export async function createEmployee(formData: FormData) {
  await requireHR();
  const supabase = await createClient();

  const fullName = asText(formData.get("full_name"));
  if (!fullName) {
    redirect("/dashboard/employees/new?error=" + encodeURIComponent("اسم الموظف مطلوب"));
  }

  const { error } = await supabase.from("employees").insert({
    full_name: fullName,
    employee_code: asText(formData.get("employee_code")),
    job_title: asText(formData.get("job_title")),
    department: asText(formData.get("department")),
    phone: asText(formData.get("phone")),
    email: asText(formData.get("email")),
    hire_date: asText(formData.get("hire_date")),
    basic_salary: asNumber(formData.get("basic_salary")),
    housing_allowance: asNumber(formData.get("housing_allowance")),
    transport_allowance: asNumber(formData.get("transport_allowance")),
    other_allowances: asNumber(formData.get("other_allowances")),
    national_id: asText(formData.get("national_id")),
    social_insurance_number: asText(formData.get("social_insurance_number")),
    bank_name: asText(formData.get("bank_name")),
    bank_account_number: asText(formData.get("bank_account_number")),
    status: asText(formData.get("status")) ?? "active",
    notes: asText(formData.get("notes")),
    // company_id is auto-filled by the RLS WITH CHECK policy via the trigger
    // ... actually, RLS only filters; we must set company_id explicitly:
    company_id: await getCurrentCompanyId(supabase),
  });

  if (error) {
    redirect(
      "/dashboard/employees/new?error=" +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/employees");
  redirect("/dashboard/employees");
}

export async function updateEmployee(id: string, formData: FormData) {
  await requireHR();
  const supabase = await createClient();

  const fullName = asText(formData.get("full_name"));
  if (!fullName) {
    redirect(
      `/dashboard/employees/${id}?error=` +
        encodeURIComponent("اسم الموظف مطلوب"),
    );
  }

  const { error } = await supabase
    .from("employees")
    .update({
      full_name: fullName,
      employee_code: asText(formData.get("employee_code")),
      job_title: asText(formData.get("job_title")),
      department: asText(formData.get("department")),
      phone: asText(formData.get("phone")),
      email: asText(formData.get("email")),
      hire_date: asText(formData.get("hire_date")),
      basic_salary: asNumber(formData.get("basic_salary")),
      housing_allowance: asNumber(formData.get("housing_allowance")),
      transport_allowance: asNumber(formData.get("transport_allowance")),
      other_allowances: asNumber(formData.get("other_allowances")),
      national_id: asText(formData.get("national_id")),
      social_insurance_number: asText(formData.get("social_insurance_number")),
      bank_name: asText(formData.get("bank_name")),
      bank_account_number: asText(formData.get("bank_account_number")),
      status: asText(formData.get("status")) ?? "active",
      notes: asText(formData.get("notes")),
    })
    .eq("id", id);

  if (error) {
    redirect(
      `/dashboard/employees/${id}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/employees");
  revalidatePath(`/dashboard/employees/${id}`);
  redirect("/dashboard/employees?updated=1");
}

export async function deleteEmployee(id: string) {
  // Deletion cascades to attendance, payroll_entries, leave_requests,
  // advance_requests, permission_requests -- restrict to admin only.
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("employees").delete().eq("id", id);
  revalidatePath("/dashboard/employees");
}

// ============================================================================
// Nuclear option: delete ALL employees in the current company.
//
// Admin-only, gated behind a typed-phrase confirmation ("حذف الكل") so a
// rogue click or a stolen session can't quietly wipe a 200-employee
// roster. Counts before delete + reports back via the URL so HR sees
// "تم حذف 47 موظف" instead of an ambiguous "done".
//
// Cascades: every employee-keyed table (attendance, payroll_entries,
// leave_requests, advance_requests, permission_requests, leave_balances,
// audit_log via trigger) has ON DELETE CASCADE on employee_id, so the
// dependent data goes with them. auth.users rows are NOT touched; if HR
// wants to retire an employee's mobile account, they need to remove the
// auth user separately.
// ============================================================================
export async function deleteAllEmployees(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  const phrase = String(formData.get("confirm_phrase") ?? "").trim();
  if (phrase !== "حذف الكل") {
    redirect(
      "/dashboard/employees?error=" +
        encodeURIComponent("لازم تكتب 'حذف الكل' بالظبط عشان تأكد."),
    );
  }

  // Count first so the success message can be specific.
  const { count } = await supabase
    .from("employees")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id);

  if (!count || count === 0) {
    redirect(
      "/dashboard/employees?error=" +
        encodeURIComponent("مفيش موظفين عندك أصلاً."),
    );
  }

  // Wipe. RLS is doing the company-scoping anyway, but we're explicit
  // about the company_id eq for defence in depth -- if RLS got loosened
  // in a future migration this still scopes to the caller's tenant.
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      "/dashboard/employees?error=" +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard/attendance");
  revalidatePath("/dashboard/payroll");
  redirect(
    "/dashboard/employees?deleted_all=" + encodeURIComponent(String(count)),
  );
}

/**
 * Generates an invitation token for an employee. The HR person hands
 * the resulting UUID to the employee (paper / WhatsApp / SMS), and the
 * mobile app's "Claim invitation" flow uses it to bind the new auth
 * user to this employees row.
 *
 * RLS on the RPC checks that the caller is admin/manager in the same
 * company, so there's no extra permission gate here.
 */
export async function generateEmployeeInvitation(id: string) {
  await requireHR();
  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_employee_invitation", {
    p_employee_id: id,
  });
  if (error) {
    redirect(
      `/dashboard/employees/${id}?invite_error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  // Read the freshly-issued token + the employee's email so we can
  // ship the invite over email automatically. Skip silently if the
  // employee has no email on file -- the HR can still copy the token
  // from the dashboard and hand it over manually.
  void (async () => {
    try {
      const { data: emp } = await supabase
        .from("employees")
        .select("full_name, email, invitation_token")
        .eq("id", id)
        .single<{
          full_name: string;
          email: string | null;
          invitation_token: string | null;
        }>();
      if (!emp?.email || !emp?.invitation_token) return;
      await sendEmail(
        emailMobileInvitation({
          to: emp.email,
          employeeName: emp.full_name,
          inviteToken: emp.invitation_token,
        }),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("generateEmployeeInvitation email failed:", err);
    }
  })();

  revalidatePath(`/dashboard/employees/${id}`);
  redirect(`/dashboard/employees/${id}?invite_generated=1`);
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
