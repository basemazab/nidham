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

export async function createCustomer(formData: FormData) {
  await requireHR();
  const supabase = await createClient();

  const fullName = asText(formData.get("full_name"));
  if (!fullName) {
    redirect(
      "/dashboard/customers/new?error=" +
        encodeURIComponent("اسم العميل مطلوب"),
    );
  }

  const { error } = await supabase.from("customers").insert({
    full_name: fullName,
    contact_name: asText(formData.get("contact_name")),
    type: asText(formData.get("type")) ?? "individual",
    phone: asText(formData.get("phone")),
    email: asText(formData.get("email")),
    status: asText(formData.get("status")) ?? "lead",
    assigned_to: asText(formData.get("assigned_to")),
    estimated_value: asNumber(formData.get("estimated_value")),
    source: asText(formData.get("source")),
    notes: asText(formData.get("notes")),
    company_id: await getCurrentCompanyId(supabase),
  });

  if (error) {
    redirect(
      "/dashboard/customers/new?error=" +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/customers");
  bustDashboardCache();
  redirect("/dashboard/customers");
}

export async function updateCustomer(id: string, formData: FormData) {
  const { profile } = await requireHR();
  const supabase = await createClient();

  const fullName = asText(formData.get("full_name"));
  if (!fullName) {
    redirect(
      `/dashboard/customers/${id}?error=` +
        encodeURIComponent("اسم العميل مطلوب"),
    );
  }

  // RLS hardening: company_id clamp prevents cross-tenant updates under
  // super-admin sessions (mig 038).
  // N3: shipping-industry fields added (mig 069) — read alongside the
  // standard columns and saved together in a single UPDATE.
  const { error } = await supabase
    .from("customers")
    .update({
      full_name: fullName,
      contact_name: asText(formData.get("contact_name")),
      type: asText(formData.get("type")) ?? "individual",
      phone: asText(formData.get("phone")),
      email: asText(formData.get("email")),
      status: asText(formData.get("status")) ?? "lead",
      assigned_to: asText(formData.get("assigned_to")),
      estimated_value: asNumber(formData.get("estimated_value")),
      source: asText(formData.get("source")),
      notes: asText(formData.get("notes")),
      fleet_size: asNumber(formData.get("fleet_size")),
      shipments_per_month: asNumber(formData.get("shipments_per_month")),
      current_tms: asText(formData.get("current_tms")),
      decision_maker: asText(formData.get("decision_maker")),
      decision_maker_role: asText(formData.get("decision_maker_role")),
    })
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/customers/${id}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath("/dashboard/customers");
  bustDashboardCache();
  revalidatePath(`/dashboard/customers/${id}`);
  redirect("/dashboard/customers?updated=1");
}

export async function deleteCustomer(id: string) {
  // J4: error path now reported instead of swallowed
  const { profile, supabase } = await requireHR();
  const { error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);
  if (error) {
    redirect(
      `/dashboard/customers?error=${encodeURIComponent(
        "ما قدرناش نمسح العميل: " + error.message,
      )}`,
    );
  }
  revalidatePath("/dashboard/customers");
  bustDashboardCache();
}
