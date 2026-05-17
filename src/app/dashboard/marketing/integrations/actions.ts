"use server";

// ============================================================================
// Marketing Integrations — Meta Lead Ads connection actions
// ============================================================================

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHR } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { arabicizeDbError } from "@/lib/i18n";

async function gate() {
  const { profile, supabase } = await requireHR();
  if (!(await canUseFeature("marketing_studio"))) {
    redirect(
      "/dashboard?error=" +
        encodeURIComponent("الـ Integrations متاحة للنسخة Enterprise فقط"),
    );
  }
  return { profile, supabase };
}

function getEncryptionKey(): string | null {
  return process.env.META_ENCRYPTION_KEY ?? null;
}

// ----------------------------------------------------------------------------
// connectMetaPage — paste-token flow
// ----------------------------------------------------------------------------
export async function connectMetaPage(formData: FormData) {
  const { supabase } = await gate();

  const pageId = String(formData.get("page_id") ?? "").trim();
  const pageName = String(formData.get("page_name") ?? "").trim();
  const pageAccessToken = String(formData.get("page_access_token") ?? "").trim();
  const appId = String(formData.get("app_id") ?? "").trim() || null;
  const displayLabel =
    String(formData.get("display_label") ?? "").trim() || null;
  const defaultLandingPageIdRaw = String(
    formData.get("default_landing_page_id") ?? "",
  ).trim();
  const defaultLandingPageId = /^[0-9a-f-]{36}$/i.test(defaultLandingPageIdRaw)
    ? defaultLandingPageIdRaw
    : null;

  if (!/^\d{8,25}$/.test(pageId)) {
    redirect(
      "/dashboard/marketing/integrations?error=" +
        encodeURIComponent("Page ID لازم يكون رقم بين 8 و 25 خانة"),
    );
  }
  if (pageName.length < 2) {
    redirect(
      "/dashboard/marketing/integrations?error=" +
        encodeURIComponent("اسم الصفحة لازم يتعبّى"),
    );
  }
  if (!pageAccessToken.startsWith("EAA") || pageAccessToken.length < 100) {
    redirect(
      "/dashboard/marketing/integrations?error=" +
        encodeURIComponent(
          "Page Access Token مش صحيح — لازم يبدأ بـ EAA ويكون أطول من 100 حرف",
        ),
    );
  }

  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) {
    redirect(
      "/dashboard/marketing/integrations?error=" +
        encodeURIComponent(
          "السيرفر مش متعيّن META_ENCRYPTION_KEY — كلّم الـ admin",
        ),
    );
  }

  const { data, error } = await supabase.rpc("upsert_meta_integration", {
    p_page_id: pageId,
    p_page_name: pageName,
    p_page_access_token: pageAccessToken,
    p_encryption_key: encryptionKey,
    p_app_id: appId,
    p_display_label: displayLabel,
    p_default_landing_page_id: defaultLandingPageId,
  });

  if (error || !data) {
    console.error("[integrations/connectMetaPage]", error);
    redirect(
      "/dashboard/marketing/integrations?error=" +
        encodeURIComponent(arabicizeDbError(error?.message ?? "فشل الحفظ")),
    );
  }

  revalidatePath("/dashboard/marketing/integrations");
  redirect(`/dashboard/marketing/integrations?connected=1`);
}

// ----------------------------------------------------------------------------
// disconnectMetaPage — delete the row (token is purged with it)
// ----------------------------------------------------------------------------
export async function disconnectMetaPage(formData: FormData) {
  const { profile, supabase } = await gate();

  const integrationId = String(formData.get("integration_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(integrationId)) {
    redirect("/dashboard/marketing/integrations");
  }

  await supabase
    .from("meta_integrations")
    .delete()
    .eq("id", integrationId)
    .eq("company_id", profile.company_id);

  revalidatePath("/dashboard/marketing/integrations");
  redirect("/dashboard/marketing/integrations?disconnected=1");
}

// ----------------------------------------------------------------------------
// toggleMetaPageActive — flip is_active without losing the token
// ----------------------------------------------------------------------------
export async function toggleMetaPageActive(formData: FormData) {
  const { profile, supabase } = await gate();

  const integrationId = String(formData.get("integration_id") ?? "").trim();
  const targetState = formData.get("target_state") === "on";

  if (!/^[0-9a-f-]{36}$/i.test(integrationId)) {
    redirect("/dashboard/marketing/integrations");
  }

  await supabase
    .from("meta_integrations")
    .update({
      is_active: targetState,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId)
    .eq("company_id", profile.company_id);

  revalidatePath("/dashboard/marketing/integrations");
  redirect("/dashboard/marketing/integrations?toggled=1");
}
