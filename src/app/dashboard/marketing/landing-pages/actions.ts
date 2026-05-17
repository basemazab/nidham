"use server";

// ============================================================================
// Landing Pages — server actions
// ============================================================================
//
// CRUD for the user's landing pages. Each page is renderable at /p/[slug]
// by anonymous visitors. The slug is unique GLOBALLY (Postgres unique
// constraint) because the public route is global; we prefix slugs with a
// short hash of company_id at creation time so two tenants picking the
// same name don't collide.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireHR } from "@/lib/permissions";
import { canUseFeature } from "@/lib/subscriptions-server";
import { arabicizeDbError } from "@/lib/i18n";
import crypto from "node:crypto";

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function gateEnterprise() {
  const { profile, supabase } = await requireHR();
  if (!(await canUseFeature("marketing_studio"))) {
    redirect(
      "/dashboard?error=" +
        encodeURIComponent("Landing Pages متاحة للنسخة Enterprise فقط"),
    );
  }
  return { profile, supabase };
}

/**
 * Build a URL-safe slug. We:
 *  1. Transliterate the user's "name" loosely (just keep ASCII alphanumerics
 *     and dashes — Arabic letters are stripped because they don't render
 *     well in URLs)
 *  2. If the result is empty (pure-Arabic name), fall back to "page"
 *  3. Prefix with a 6-char company hash so the global unique index is happy
 *     even when two tenants both make "summer-2026"
 */
function buildSlug(rawName: string, companyId: string): string {
  const ascii = rawName
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);
  const base = ascii || "page";
  const companyHash = crypto
    .createHash("sha256")
    .update(companyId)
    .digest("hex")
    .slice(0, 6);
  return `${companyHash}-${base}`;
}

// Parse the form_fields textarea: one field per line. Whitelist against
// supported keys to avoid the renderer crashing on unknown values.
const ALLOWED_FORM_FIELDS = new Set([
  "name",
  "phone",
  "whatsapp",
  "email",
  "city",
  "interest",
  "budget",
  "message",
]);

function parseFormFields(raw: string): string[] {
  const fields = raw
    .split(/\r?\n/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .filter((s) => ALLOWED_FORM_FIELDS.has(s));
  // Always include name first (the RPC requires it)
  if (!fields.includes("name")) fields.unshift("name");
  return Array.from(new Set(fields));
}

// ----------------------------------------------------------------------------
// createLandingPage
// ----------------------------------------------------------------------------
export async function createLandingPage(formData: FormData) {
  const { profile, supabase } = await gateEnterprise();

  const name = String(formData.get("name") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  const sub_headline =
    String(formData.get("sub_headline") ?? "").trim() || null;
  const body = String(formData.get("body") ?? "").trim() || null;
  const template =
    String(formData.get("template") ?? "generic").trim() || "generic";

  const cta_label = String(formData.get("cta_label") ?? "كلّمنا").trim();
  const cta_action =
    String(formData.get("cta_action") ?? "whatsapp").trim() || "whatsapp";
  const cta_target = String(formData.get("cta_target") ?? "").trim() || null;

  const form_enabled = formData.get("form_enabled") === "on";
  const form_fields_raw = String(formData.get("form_fields") ?? "").trim();
  const form_fields = parseFormFields(
    form_fields_raw || "name\nphone\nwhatsapp",
  );
  const form_submit_label =
    String(formData.get("form_submit_label") ?? "سيب بياناتك").trim();
  const form_success_msg =
    String(formData.get("form_success_msg") ?? "").trim() ||
    "شكراً! هنتواصل معاك في أقرب وقت.";

  const accent_color =
    String(formData.get("accent_color") ?? "#0891B2").trim() || "#0891B2";

  const marketing_project_id =
    String(formData.get("marketing_project_id") ?? "").trim() || null;

  // Validation
  if (name.length < 2) {
    redirect(
      "/dashboard/marketing/landing-pages?error=" +
        encodeURIComponent("اسم الصفحة لازم 2 حروف على الأقل"),
    );
  }
  if (headline.length < 5) {
    redirect(
      "/dashboard/marketing/landing-pages?error=" +
        encodeURIComponent("العنوان الرئيسي لازم 5 حروف على الأقل"),
    );
  }
  // If the CTA isn't a form, the target is required.
  if (cta_action !== "form" && !cta_target) {
    redirect(
      "/dashboard/marketing/landing-pages?error=" +
        encodeURIComponent(
          `لازم تحط ${cta_action === "whatsapp" ? "رقم واتساب" : cta_action === "phone" ? "رقم تليفون" : "URL"} في خانة CTA Target`,
        ),
    );
  }

  const slug = buildSlug(name, profile.company_id);

  const { data, error } = await supabase
    .from("landing_pages")
    .insert({
      company_id: profile.company_id,
      slug,
      name,
      template,
      headline,
      sub_headline,
      body,
      accent_color,
      cta_label,
      cta_action,
      cta_target,
      form_enabled,
      form_fields,
      form_submit_label,
      form_success_msg,
      marketing_project_id,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[landing-pages/create] insert failed:", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
    });
    redirect(
      "/dashboard/marketing/landing-pages?error=" +
        encodeURIComponent(arabicizeDbError(error?.message ?? "فشل الإنشاء")),
    );
  }

  revalidatePath("/dashboard/marketing/landing-pages");
  redirect(`/dashboard/marketing/landing-pages/${data.id}?created=1`);
}

// ----------------------------------------------------------------------------
// updateLandingPage
// ----------------------------------------------------------------------------
export async function updateLandingPage(formData: FormData) {
  const { profile, supabase } = await gateEnterprise();

  const id = String(formData.get("id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirect("/dashboard/marketing/landing-pages");
  }

  const name = String(formData.get("name") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();

  if (name.length < 2 || headline.length < 5) {
    redirect(
      `/dashboard/marketing/landing-pages/${id}?error=` +
        encodeURIComponent("اسم الصفحة + العنوان الرئيسي لازم يتعبّوا"),
    );
  }

  const cta_action =
    String(formData.get("cta_action") ?? "whatsapp").trim() || "whatsapp";
  const cta_target = String(formData.get("cta_target") ?? "").trim() || null;
  if (cta_action !== "form" && !cta_target) {
    redirect(
      `/dashboard/marketing/landing-pages/${id}?error=` +
        encodeURIComponent("لازم تحط CTA target لو الـ action مش form"),
    );
  }

  const form_fields = parseFormFields(
    String(formData.get("form_fields") ?? "name\nphone\nwhatsapp"),
  );

  const { error } = await supabase
    .from("landing_pages")
    .update({
      name,
      template: String(formData.get("template") ?? "generic"),
      headline,
      sub_headline: String(formData.get("sub_headline") ?? "").trim() || null,
      body: String(formData.get("body") ?? "").trim() || null,
      accent_color:
        String(formData.get("accent_color") ?? "#0891B2").trim() || "#0891B2",
      cta_label: String(formData.get("cta_label") ?? "كلّمنا").trim(),
      cta_action,
      cta_target,
      form_enabled: formData.get("form_enabled") === "on",
      form_fields,
      form_submit_label:
        String(formData.get("form_submit_label") ?? "سيب بياناتك").trim(),
      form_success_msg:
        String(formData.get("form_success_msg") ?? "").trim() ||
        "شكراً! هنتواصل معاك في أقرب وقت.",
      is_active: formData.get("is_active") === "on",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", profile.company_id);

  if (error) {
    redirect(
      `/dashboard/marketing/landing-pages/${id}?error=` +
        encodeURIComponent(arabicizeDbError(error.message)),
    );
  }

  revalidatePath(`/dashboard/marketing/landing-pages/${id}`);
  revalidatePath("/dashboard/marketing/landing-pages");
  redirect(`/dashboard/marketing/landing-pages/${id}?saved=1`);
}

// ----------------------------------------------------------------------------
// archiveLandingPage — soft delete (is_active=false, archived_at=now())
// ----------------------------------------------------------------------------
export async function archiveLandingPage(formData: FormData) {
  const { profile, supabase } = await gateEnterprise();
  const id = String(formData.get("id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    redirect("/dashboard/marketing/landing-pages");
  }

  await supabase
    .from("landing_pages")
    .update({
      is_active: false,
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", profile.company_id);

  revalidatePath("/dashboard/marketing/landing-pages");
  redirect("/dashboard/marketing/landing-pages?archived=1");
}
