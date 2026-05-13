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
