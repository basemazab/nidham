"use server";

// ============================================================================
// Server actions for /dashboard/settings/holidays — manage the per-tenant
// public-holiday calendar laid down by migration 048.
// ============================================================================
//
// Three actions:
//   addHoliday    — admin adds a tenant-specific holiday (company_id = me)
//   removeHoliday — admin deletes a tenant-specific holiday
//   togglePaid    — flip is_paid on a tenant-specific row
//
// We never let the operator edit the global (company_id IS NULL) seeded
// rows — those are shared across every tenant. To customize one, the
// admin creates a tenant-specific row for the same date which OVERRIDES
// the global default in the UI (we pick the company_id row over null).

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/permissions";

function isYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

const VALID_HOLIDAY_TYPES = [
  "national",
  "religious",
  "seasonal",
  "company",
  "other",
] as const;

export async function addHoliday(formData: FormData) {
  const { supabase, profile } = await requireAdmin();

  const date = String(formData.get("date") ?? "").trim();
  const nameAr = String(formData.get("name_ar") ?? "").trim();
  const nameEn = String(formData.get("name_en") ?? "").trim() || null;
  const typeRaw = String(formData.get("holiday_type") ?? "company").trim();
  const isPaid = String(formData.get("is_paid") ?? "true") === "true";

  if (!isYmd(date)) {
    redirect(
      "/dashboard/settings/holidays?error=" +
        encodeURIComponent("التاريخ مش صحيح — استخدم YYYY-MM-DD"),
    );
  }
  if (nameAr.length < 2) {
    redirect(
      "/dashboard/settings/holidays?error=" +
        encodeURIComponent("اكتب اسم العطلة بالعربي"),
    );
  }

  const holidayType: (typeof VALID_HOLIDAY_TYPES)[number] = (
    VALID_HOLIDAY_TYPES as readonly string[]
  ).includes(typeRaw)
    ? (typeRaw as (typeof VALID_HOLIDAY_TYPES)[number])
    : "company";

  const { error } = await supabase.from("public_holidays").insert({
    company_id: profile.company_id,
    date,
    name_ar: nameAr,
    name_en: nameEn,
    holiday_type: holidayType,
    is_paid: isPaid,
  });

  if (error) {
    redirect(
      "/dashboard/settings/holidays?error=" +
        encodeURIComponent(
          error.code === "23505"
            ? "في عطلة موجودة بنفس التاريخ بالفعل"
            : error.message.slice(0, 200),
        ),
    );
  }

  revalidatePath("/dashboard/settings/holidays");
  redirect("/dashboard/settings/holidays?saved=1");
}

export async function removeHoliday(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirect("/dashboard/settings/holidays");
  }

  // Hard guard: scope the delete to THIS tenant's company_id. The RLS
  // policy already enforces it but the explicit eq is defense-in-depth
  // and lets us cleanly reject any attempt to nuke a global row (which
  // has company_id = null and won't match the actor's UUID).
  const { error } = await supabase
    .from("public_holidays")
    .delete()
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      "/dashboard/settings/holidays?error=" +
        encodeURIComponent(error.message.slice(0, 200)),
    );
  }

  revalidatePath("/dashboard/settings/holidays");
  redirect("/dashboard/settings/holidays?deleted=1");
}

/**
 * Override a GLOBAL seeded holiday for THIS tenant. We do this by
 * INSERTing a new tenant-scoped row for the same date — the UI later
 * picks the tenant-specific row over the global default.
 */
export async function overrideGlobalHoliday(formData: FormData) {
  const { supabase, profile } = await requireAdmin();
  const date = String(formData.get("date") ?? "").trim();
  const nameAr = String(formData.get("name_ar") ?? "").trim();
  const isPaid = String(formData.get("is_paid") ?? "true") === "true";

  if (!isYmd(date) || nameAr.length < 2) {
    redirect(
      "/dashboard/settings/holidays?error=" +
        encodeURIComponent("التاريخ والاسم مطلوبين"),
    );
  }

  // Upsert on (company_id, date) so toggling twice doesn't make duplicates.
  const { error } = await supabase
    .from("public_holidays")
    .upsert(
      {
        company_id: profile.company_id,
        date,
        name_ar: nameAr,
        holiday_type: "company",
        is_paid: isPaid,
      },
      { onConflict: "company_id,date" },
    );

  if (error) {
    redirect(
      "/dashboard/settings/holidays?error=" +
        encodeURIComponent(error.message.slice(0, 200)),
    );
  }

  revalidatePath("/dashboard/settings/holidays");
  redirect("/dashboard/settings/holidays?saved=1");
}
