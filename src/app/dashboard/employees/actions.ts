"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      "/dashboard/employees/new?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/employees");
  redirect("/dashboard/employees");
}

export async function updateEmployee(id: string, formData: FormData) {
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
      `/dashboard/employees/${id}?error=` + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/employees");
  revalidatePath(`/dashboard/employees/${id}`);
  redirect("/dashboard/employees?updated=1");
}

export async function deleteEmployee(id: string) {
  const supabase = await createClient();
  await supabase.from("employees").delete().eq("id", id);
  revalidatePath("/dashboard/employees");
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
  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_employee_invitation", {
    p_employee_id: id,
  });
  if (error) {
    redirect(
      `/dashboard/employees/${id}?invite_error=` +
        encodeURIComponent(error.message),
    );
  }
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
