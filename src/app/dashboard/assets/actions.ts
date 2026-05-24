"use server";

// ============================================================================
// Asset management — create / update / assign / return server actions
// ============================================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireHR } from "@/lib/permissions";
import { arabicizeDbError } from "@/lib/i18n";

function asText(v: FormDataEntryValue | null): string | null {
  if (v === null) return null;
  const t = String(v).trim();
  return t.length === 0 ? null : t;
}
function asNumber(v: FormDataEntryValue | null): number | null {
  const t = asText(v);
  if (t === null) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function asInt(v: FormDataEntryValue | null): number | null {
  const t = asText(v);
  if (t === null) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

export async function createAsset(formData: FormData) {
  const { profile } = await requireHR();
  const supabase = await createClient();

  const name = asText(formData.get("name"));
  const assetType = asText(formData.get("asset_type"));
  if (!name || !assetType) {
    redirect(
      "/dashboard/assets/new?error=" +
        encodeURIComponent("الاسم والنوع مطلوبين"),
    );
  }

  const { data, error } = await supabase
    .from("assets")
    .insert({
      company_id: profile.company_id,
      name,
      asset_type: assetType,
      serial_number: asText(formData.get("serial_number")),
      asset_tag: asText(formData.get("asset_tag")),
      purchase_date: asText(formData.get("purchase_date")),
      purchase_cost: asNumber(formData.get("purchase_cost")),
      depreciation_years: asInt(formData.get("depreciation_years")),
      current_estimated_value: asNumber(formData.get("current_estimated_value")),
      notes: asText(formData.get("notes")),
      status: "available",
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(
      "/dashboard/assets/new?error=" +
        encodeURIComponent(arabicizeDbError(error?.message ?? "فشل إنشاء الأصل")),
    );
  }

  revalidatePath("/dashboard/assets");
  redirect(`/dashboard/assets/${data.id}`);
}

export async function assignAsset(formData: FormData) {
  const { profile } = await requireHR();
  const supabase = await createClient();

  const assetId = asText(formData.get("asset_id"));
  const employeeId = asText(formData.get("employee_id"));
  if (!assetId || !employeeId) {
    redirect("/dashboard/assets?error=" + encodeURIComponent("بيانات ناقصة"));
  }

  const now = new Date().toISOString();
  const condition = asText(formData.get("condition_on_assign"));
  const notes = asText(formData.get("notes"));

  // 1) Update the asset row
  const { error: e1 } = await supabase
    .from("assets")
    .update({
      assigned_employee_id: employeeId,
      assigned_at: now,
      status: "assigned",
    })
    .eq("id", assetId)
    .eq("company_id", profile.company_id);
  if (e1) {
    redirect(`/dashboard/assets/${assetId}?error=` + encodeURIComponent(e1.message));
  }

  // 2) Append the assignment-history row
  await supabase.from("asset_assignments").insert({
    company_id: profile.company_id,
    asset_id: assetId,
    employee_id: employeeId,
    assigned_at: now,
    condition_on_assign: condition,
    notes,
  });

  revalidatePath(`/dashboard/assets/${assetId}`);
  revalidatePath("/dashboard/assets");
  redirect(`/dashboard/assets/${assetId}?assigned=1`);
}

export async function returnAsset(formData: FormData) {
  const { profile } = await requireHR();
  const supabase = await createClient();

  const assetId = asText(formData.get("asset_id"));
  if (!assetId) redirect("/dashboard/assets");

  const now = new Date().toISOString();
  const conditionOnReturn = asText(formData.get("condition_on_return"));
  const notes = asText(formData.get("notes"));

  // 1) Find the open assignment row (assigned_at most recent, returned_at NULL)
  const { data: openAssignment } = await supabase
    .from("asset_assignments")
    .select("id")
    .eq("asset_id", assetId)
    .eq("company_id", profile.company_id)
    .is("returned_at", null)
    .order("assigned_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (openAssignment) {
    await supabase
      .from("asset_assignments")
      .update({
        returned_at: now,
        condition_on_return: conditionOnReturn,
        notes,
      })
      .eq("id", openAssignment.id)
      .eq("company_id", profile.company_id);
  }

  // 2) Clear the asset's denormalised assignment fields
  const lostOrDamaged =
    conditionOnReturn === "damaged" || conditionOnReturn === "lost";
  await supabase
    .from("assets")
    .update({
      assigned_employee_id: null,
      assigned_at: null,
      status: lostOrDamaged ? (conditionOnReturn === "lost" ? "lost" : "in_maintenance") : "available",
    })
    .eq("id", assetId)
    .eq("company_id", profile.company_id);

  revalidatePath(`/dashboard/assets/${assetId}`);
  revalidatePath("/dashboard/assets");
  redirect(`/dashboard/assets/${assetId}?returned=1`);
}

export async function retireAsset(assetId: string) {
  const { profile } = await requireHR();
  const supabase = await createClient();
  await supabase
    .from("assets")
    .update({ status: "retired", assigned_employee_id: null, assigned_at: null })
    .eq("id", assetId)
    .eq("company_id", profile.company_id);
  revalidatePath("/dashboard/assets");
  redirect(`/dashboard/assets/${assetId}?retired=1`);
}
