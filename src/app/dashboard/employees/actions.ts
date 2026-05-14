"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import { bustDashboardCache } from "@/lib/cache";
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

  const payFrequencyRaw = asText(formData.get("pay_frequency"));
  const payFrequency =
    payFrequencyRaw === "weekly" ? "weekly" : "monthly";

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
    incentive_allowance: asNumber(formData.get("incentive_allowance")),
    pay_frequency: payFrequency,
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
  bustDashboardCache();
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

  const payFrequencyRaw = asText(formData.get("pay_frequency"));
  const payFrequency =
    payFrequencyRaw === "weekly" ? "weekly" : "monthly";

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
      incentive_allowance: asNumber(formData.get("incentive_allowance")),
      pay_frequency: payFrequency,
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
  bustDashboardCache();
  revalidatePath(`/dashboard/employees/${id}`);
  redirect("/dashboard/employees?updated=1");
}

// End-of-service settlement breakdown returned by the RPC. The
// terminateEmployee action calls it twice -- once to preview before
// HR confirms, and once again after confirmation to snapshot the
// final number onto employees.eos_gratuity.
export type EOSBreakdown = {
  hire_date: string;
  termination_date: string;
  years_of_service: number;
  wage_base: number;
  months_owed: number;
  gratuity_amount: number;
};

/**
 * Compute the End-of-Service gratuity owed to an employee at a given
 * termination date. Pure preview -- doesn't modify the employee row.
 * Used by the "Terminate" modal to show HR "كده فاضل عليك تدفع
 * X جنيه" before they confirm.
 */
export async function previewEOSGratuity(
  employeeId: string,
  terminationDate: string,
): Promise<EOSBreakdown | null> {
  await requireHR();
  const supabase = await createClient();
  const { data } = await supabase.rpc("compute_eos_gratuity", {
    p_employee_id: employeeId,
    p_termination_date: terminationDate,
  });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  return row as EOSBreakdown;
}

/**
 * Finalize an employee's termination:
 *   1. Compute EOS gratuity at the chosen date
 *   2. Set status='terminated' + termination_date + termination_reason +
 *      eos_gratuity (snapshot, NOT recomputed later if wages change)
 *   3. Audit log captures the row update via the migration-018 trigger
 *
 * Admin-only because the consequences (gratuity write, employee
 * locked out, payroll exclusion) are financial.
 */
export async function terminateEmployee(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  const employeeId = String(formData.get("employee_id") ?? "").trim();
  const terminationDate = String(formData.get("termination_date") ?? "").trim();
  const reason = String(formData.get("termination_reason") ?? "").trim();

  const validReasons = [
    "resignation",
    "termination_by_employer",
    "mutual_agreement",
    "end_of_contract",
    "retirement",
    "death",
  ];

  if (!employeeId) {
    redirect("/dashboard/employees?error=" + encodeURIComponent("الموظف غير محدد"));
  }
  if (!terminationDate) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent("تاريخ انتهاء الخدمة مطلوب"),
    );
  }
  if (!validReasons.includes(reason)) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent("سبب انتهاء الخدمة غير صحيح"),
    );
  }

  // 1. Final preview right before the write so the snapshot uses the
  //    latest wage data.
  const { data: eosData } = await supabase.rpc("compute_eos_gratuity", {
    p_employee_id: employeeId,
    p_termination_date: terminationDate,
  });
  const eos = (Array.isArray(eosData) ? eosData[0] : eosData) as
    | EOSBreakdown
    | null;
  if (!eos) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent("مش قادر يحسب المكافأة — تأكد إن للموظف تاريخ تعيين"),
    );
  }

  // 2. Write the termination record. RLS scopes by company_id.
  const { error } = await supabase
    .from("employees")
    .update({
      status: "terminated",
      termination_date: terminationDate,
      termination_reason: reason,
      eos_gratuity: eos.gratuity_amount,
    })
    .eq("id", employeeId)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/employees/${employeeId}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/employees");
  revalidatePath(`/dashboard/employees/${employeeId}`);
  bustDashboardCache();
  redirect(
    `/dashboard/employees/${employeeId}?terminated=` +
      encodeURIComponent(
        `${eos.gratuity_amount}|${eos.years_of_service}|${eos.months_owed}`,
      ),
  );
}

export async function deleteEmployee(id: string) {
  // Deletion cascades to attendance, payroll_entries, leave_requests,
  // advance_requests, permission_requests -- restrict to admin only.
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("employees").delete().eq("id", id);
  revalidatePath("/dashboard/employees");
  bustDashboardCache();
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
  bustDashboardCache();
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
