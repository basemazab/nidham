"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function ensureSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("super_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!data) {
    throw new Error("Not authorized");
  }

  return supabase;
}

export async function updateSubscription(
  subscriptionId: string,
  formData: FormData,
) {
  const supabase = await ensureSuperAdmin();

  const plan = String(formData.get("plan") ?? "trial");
  const status = String(formData.get("status") ?? "trial");
  const endsAt = String(formData.get("ends_at") ?? "");
  const monthlyValueRaw = String(formData.get("monthly_value") ?? "").trim();
  const monthlyValue = monthlyValueRaw === "" ? null : Number(monthlyValueRaw);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const update: Record<string, unknown> = {
    plan,
    status,
    notes,
    monthly_value: monthlyValue,
  };
  if (endsAt) update.ends_at = endsAt;

  const { error } = await supabase
    .from("subscriptions")
    .update(update)
    .eq("id", subscriptionId);

  if (error) {
    redirect(
      `/admin/subscriptions/${subscriptionId}?error=` +
        encodeURIComponent(error.message),
    );
  }

  // The owner's view at /dashboard/subscription reads from the same row.
  // Without revalidating that path here, the company admin keeps seeing
  // the stale Trial plan in their own dashboard even after super-admin
  // flipped them to a paid tier.
  revalidatePath("/admin");
  revalidatePath("/admin/subscriptions/" + subscriptionId);
  revalidatePath("/dashboard/subscription");
  revalidatePath("/dashboard", "layout");
  redirect(`/admin/subscriptions/${subscriptionId}?saved=1`);
}

// ----------------------------------------------------------------------------
// Per-tenant feature overrides (mig 041)
// ----------------------------------------------------------------------------
// Lets the super-admin force individual features ON or OFF for a tenant,
// independent of their subscription tier. Used to support custom packages
// like "Marketing-only" or "HR-only".
// ----------------------------------------------------------------------------

/**
 * Toggle a single feature for a tenant. Three states represented in the
 * form payload:
 *   action="enable"  → upsert row with enabled=true
 *   action="disable" → upsert row with enabled=false
 *   action="inherit" → DELETE the row (revert to tier-based default)
 */
export async function setTenantFeatureOverride(formData: FormData) {
  const supabase = await ensureSuperAdmin();

  const subscriptionId = String(formData.get("subscription_id") ?? "").trim();
  const companyId = String(formData.get("company_id") ?? "").trim();
  const featureKey = String(formData.get("feature_key") ?? "").trim();
  const action = String(formData.get("action") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;

  if (
    !/^[0-9a-f-]{36}$/i.test(subscriptionId) ||
    !/^[0-9a-f-]{36}$/i.test(companyId) ||
    !featureKey
  ) {
    redirect(
      `/admin/subscriptions/${subscriptionId}?error=` +
        encodeURIComponent("بيانات الـ override غير صحيحة"),
    );
  }

  if (action === "inherit") {
    await supabase
      .from("tenant_feature_overrides")
      .delete()
      .eq("company_id", companyId)
      .eq("feature_key", featureKey);
  } else {
    const enabled = action === "enable";
    const { data: profile } = await supabase.auth.getUser();
    await supabase.from("tenant_feature_overrides").upsert(
      {
        company_id: companyId,
        feature_key: featureKey,
        enabled,
        reason,
        set_by: profile.user?.id,
        set_at: new Date().toISOString(),
      },
      { onConflict: "company_id,feature_key" },
    );
  }

  // The tenant's own dashboard caches feature flags in the layout, so
  // we revalidate that too.
  revalidatePath(`/admin/subscriptions/${subscriptionId}`);
  revalidatePath("/dashboard", "layout");
  redirect(`/admin/subscriptions/${subscriptionId}?feature_saved=1`);
}

/**
 * Apply a preset (Marketing-only / HR-only / Everything / etc.) by
 * setting ALL features for the tenant in one shot. Features in the
 * preset's enabledFeatures array → enabled=true. Everything else →
 * enabled=false.
 */
export async function applyTenantFeaturePreset(formData: FormData) {
  const supabase = await ensureSuperAdmin();

  const subscriptionId = String(formData.get("subscription_id") ?? "").trim();
  const companyId = String(formData.get("company_id") ?? "").trim();
  const presetKey = String(formData.get("preset_key") ?? "").trim();

  if (
    !/^[0-9a-f-]{36}$/i.test(subscriptionId) ||
    !/^[0-9a-f-]{36}$/i.test(companyId) ||
    !presetKey
  ) {
    redirect(
      `/admin/subscriptions/${subscriptionId}?error=` +
        encodeURIComponent("بيانات الـ preset غير صحيحة"),
    );
  }

  // Resolve the preset
  const { FEATURE_PRESETS, ALL_FEATURES } = await import(
    "@/lib/subscriptions"
  );
  const preset = FEATURE_PRESETS.find((p) => p.key === presetKey);
  if (!preset) {
    redirect(
      `/admin/subscriptions/${subscriptionId}?error=` +
        encodeURIComponent("الـ preset مش معروف"),
    );
  }

  // Build the {feature, enabled} list — every known feature gets either
  // true or false, no inheriting. This makes the preset deterministic.
  const enabledSet = new Set(preset.enabledFeatures);
  const overrides = ALL_FEATURES.map((f) => ({
    feature: f,
    enabled: enabledSet.has(f),
  }));

  const { error } = await supabase.rpc("bulk_set_tenant_overrides", {
    p_company_id: companyId,
    p_overrides: overrides,
    p_reason: `Preset applied: ${preset.label}`,
  });

  if (error) {
    redirect(
      `/admin/subscriptions/${subscriptionId}?error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath(`/admin/subscriptions/${subscriptionId}`);
  revalidatePath("/dashboard", "layout");
  redirect(
    `/admin/subscriptions/${subscriptionId}?preset_applied=${encodeURIComponent(preset.label)}`,
  );
}

/**
 * Wipe all overrides for the tenant. Useful when switching the customer
 * back to "standard plan behavior" — they'll inherit whatever their
 * subscription tier grants by default.
 */
export async function clearTenantFeatureOverrides(formData: FormData) {
  const supabase = await ensureSuperAdmin();
  const subscriptionId = String(formData.get("subscription_id") ?? "").trim();
  const companyId = String(formData.get("company_id") ?? "").trim();

  if (
    !/^[0-9a-f-]{36}$/i.test(subscriptionId) ||
    !/^[0-9a-f-]{36}$/i.test(companyId)
  ) {
    redirect("/admin");
  }

  await supabase.rpc("clear_tenant_overrides", { p_company_id: companyId });

  revalidatePath(`/admin/subscriptions/${subscriptionId}`);
  revalidatePath("/dashboard", "layout");
  redirect(`/admin/subscriptions/${subscriptionId}?overrides_cleared=1`);
}

export async function extendTrial(
  subscriptionId: string,
  formData: FormData,
) {
  const supabase = await ensureSuperAdmin();
  const days = Number(formData.get("days") ?? 14);

  const { data: current } = await supabase
    .from("subscriptions")
    .select("ends_at")
    .eq("id", subscriptionId)
    .single();

  if (!current) {
    redirect(
      `/admin/subscriptions/${subscriptionId}?error=` +
        encodeURIComponent("الاشتراك غير موجود"),
    );
  }

  const currentEnd = new Date(current.ends_at as string);
  currentEnd.setDate(currentEnd.getDate() + days);
  const newEnd = currentEnd.toISOString().split("T")[0];

  const { error } = await supabase
    .from("subscriptions")
    .update({ ends_at: newEnd })
    .eq("id", subscriptionId);

  if (error) {
    redirect(
      `/admin/subscriptions/${subscriptionId}?error=` +
        encodeURIComponent(error.message),
    );
  }

  revalidatePath("/admin");
  revalidatePath("/admin/subscriptions/" + subscriptionId);
  revalidatePath("/dashboard/subscription");
  revalidatePath("/dashboard", "layout");
  redirect(`/admin/subscriptions/${subscriptionId}?extended=${days}`);
}
