"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function asText(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
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

export async function logInteraction(formData: FormData) {
  const supabase = await createClient();

  const employeeId = asText(formData.get("employee_id"));
  const customerId = asText(formData.get("customer_id"));
  const type = asText(formData.get("type"));
  const outcome = asText(formData.get("outcome"));

  if (!employeeId || !customerId || !type || !outcome) {
    redirect(
      "/dashboard/interactions?error=" +
        encodeURIComponent("الموظف والعميل والنوع والنتيجة كلهم مطلوبين"),
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("interactions").insert({
    company_id: await getCurrentCompanyId(supabase),
    employee_id: employeeId,
    customer_id: customerId,
    date: asText(formData.get("date")) ?? new Date().toISOString().split("T")[0],
    type,
    outcome,
    notes: asText(formData.get("notes")),
    created_by: user.id,
  });

  if (error) {
    redirect(
      "/dashboard/interactions?error=" + encodeURIComponent(error.message),
    );
  }

  revalidatePath("/dashboard/interactions");
  revalidatePath("/dashboard/reports/bridge");
  redirect("/dashboard/interactions?saved=1");
}

export async function deleteInteraction(id: string) {
  const supabase = await createClient();
  await supabase.from("interactions").delete().eq("id", id);
  revalidatePath("/dashboard/interactions");
  revalidatePath("/dashboard/reports/bridge");
}
