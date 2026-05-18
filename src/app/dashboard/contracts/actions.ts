"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";
import { bustDashboardCache } from "@/lib/cache";

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

type ContractInput = {
  customer_id: string | null;
  contract_number: string | null;
  service_type: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  contract_value: number | null;
  payment_terms: string | null;
  status: string;
  assigned_to: string | null;
  notes: string | null;
};

function parseInput(formData: FormData): ContractInput {
  return {
    customer_id: asText(formData.get("customer_id")),
    contract_number: asText(formData.get("contract_number")),
    service_type: asText(formData.get("service_type")),
    description: asText(formData.get("description")),
    start_date: asText(formData.get("start_date")),
    end_date: asText(formData.get("end_date")),
    contract_value: asNumber(formData.get("contract_value")),
    payment_terms: asText(formData.get("payment_terms")),
    status: asText(formData.get("status")) ?? "active",
    assigned_to: asText(formData.get("assigned_to")),
    notes: asText(formData.get("notes")),
  };
}

function validate(input: ContractInput): string | null {
  if (!input.customer_id) return "العميل مطلوب";
  if (!input.start_date) return "تاريخ بدء العقد مطلوب";
  if (!input.end_date) return "تاريخ انتهاء العقد مطلوب";
  if (input.end_date < input.start_date)
    return "تاريخ الانتهاء لازم يكون بعد تاريخ البداية";
  return null;
}

export async function createContract(formData: FormData) {
  await requireHR();
  const input = parseInput(formData);
  const err = validate(input);
  if (err) {
    redirect("/dashboard/contracts/new?error=" + encodeURIComponent(err));
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contracts").insert({
    ...input,
    company_id: await getCurrentCompanyId(supabase),
  });

  if (error) {
    redirect(
      "/dashboard/contracts/new?error=" +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/contracts");
  bustDashboardCache();
  redirect("/dashboard/contracts");
}

export async function updateContract(id: string, formData: FormData) {
  const { profile } = await requireHR();
  const input = parseInput(formData);
  const err = validate(input);
  if (err) {
    redirect(`/dashboard/contracts/${id}?error=` + encodeURIComponent(err));
  }

  const supabase = await createClient();
  // RLS hardening: company_id clamp prevents cross-tenant updates under
  // super-admin sessions (mig 038).
  const { error } = await supabase
    .from("contracts")
    .update(input)
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/contracts/${id}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/contracts");
  bustDashboardCache();
  revalidatePath(`/dashboard/contracts/${id}`);
  redirect("/dashboard/contracts?updated=1");
}

export async function deleteContract(id: string) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  // RLS hardening: company_id clamp prevents cross-tenant deletes under
  // super-admin sessions (mig 038).
  await supabase
    .from("contracts")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);
  revalidatePath("/dashboard/contracts");
  bustDashboardCache();
}
