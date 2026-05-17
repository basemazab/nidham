"use server";

// ============================================================================
// Public landing page (anonymous) — server actions
// ============================================================================
//
// These run for visitors who are NOT logged in. They go straight to the
// SECURITY DEFINER RPCs `submit_lead_form` and `log_lead_event` which
// internally validate the slug + tenant. We never expose tenant IDs to
// the public template.

import { headers } from "next/headers";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";

// Best-effort hash of the visitor's IP so we have something stable per
// session without storing PII. Returns null if no IP header is present
// (local dev, edge cases).
async function getIpHash(): Promise<string | null> {
  const h = await headers();
  const raw =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    null;
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

async function getUserAgent(): Promise<string | null> {
  const h = await headers();
  return h.get("user-agent")?.slice(0, 400) ?? null;
}

// ----------------------------------------------------------------------------
// submitLeadForm — proxies to public.submit_lead_form RPC. Returns the
// success message (or throws an error string the caller can render).
// ----------------------------------------------------------------------------
export async function submitLeadForm(input: {
  slug: string;
  session_id: string;
  name: string;
  phone: string;
  email: string;
  whatsapp: string;
  city: string;
  message: string;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  utm_content: string;
  utm_term: string;
  referrer: string;
}): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  // Honeypot: if the slug isn't UUID/string-shaped, bail early.
  if (!input.slug || input.slug.length > 100) {
    return { ok: false, error: "صفحة غير صحيحة" };
  }
  if (!input.name?.trim()) {
    return { ok: false, error: "الاسم مطلوب" };
  }
  if (
    !input.phone?.trim() &&
    !input.email?.trim() &&
    !input.whatsapp?.trim()
  ) {
    return { ok: false, error: "محتاج تليفون أو واتساب أو إيميل" };
  }

  const supabase = await createClient();
  const ip_hash = await getIpHash();
  const user_agent = await getUserAgent();

  const { data, error } = await supabase.rpc("submit_lead_form", {
    p_slug: input.slug,
    p_name: input.name,
    p_phone: input.phone || "",
    p_email: input.email || "",
    p_whatsapp: input.whatsapp || "",
    p_city: input.city || "",
    p_message: input.message || "",
    p_session_id: input.session_id,
    p_utm_source: input.utm_source || null,
    p_utm_medium: input.utm_medium || null,
    p_utm_campaign: input.utm_campaign || null,
    p_utm_content: input.utm_content || null,
    p_utm_term: input.utm_term || null,
    p_referrer: input.referrer || null,
    p_user_agent: user_agent,
    p_ip_hash: ip_hash,
  });

  if (error) {
    console.error("[public/submitLeadForm]", error);
    return { ok: false, error: "حصلت مشكلة في إرسال البيانات. حاول تاني." };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    ok: true,
    message: row?.success_message ?? "تم الإرسال بنجاح.",
  };
}

// ----------------------------------------------------------------------------
// logLeadEvent — fire-and-forget event logger called from the client on
// page mount (page_view) and button clicks (whatsapp_click / phone_click).
// We swallow errors silently because the visitor's UX shouldn't depend on
// telemetry succeeding.
// ----------------------------------------------------------------------------
export async function logLeadEvent(input: {
  slug: string;
  event_type: "page_view" | "whatsapp_click" | "phone_click" | "external_click";
  session_id: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!input.slug) return;

  try {
    const supabase = await createClient();
    const ip_hash = await getIpHash();
    const user_agent = await getUserAgent();

    await supabase.rpc("log_lead_event", {
      p_slug: input.slug,
      p_event_type: input.event_type,
      p_session_id: input.session_id,
      p_utm_source: input.utm_source ?? null,
      p_utm_medium: input.utm_medium ?? null,
      p_utm_campaign: input.utm_campaign ?? null,
      p_utm_content: input.utm_content ?? null,
      p_utm_term: input.utm_term ?? null,
      p_referrer: input.referrer ?? null,
      p_user_agent: user_agent,
      p_ip_hash: ip_hash,
      p_metadata: (input.metadata ?? {}) as object,
    });
  } catch (err) {
    // Telemetry must never break the page.
    console.warn("[public/logLeadEvent] swallowed:", err);
  }
}
