// ============================================================================
// /api/webhooks/meta-leads — Meta Lead Ads webhook endpoint
// ============================================================================
//
// Two HTTP methods:
//
//   GET  — Verification challenge. Called by Meta when the developer
//          configures the webhook in the Facebook App dashboard. Must
//          echo `hub.challenge` if `hub.verify_token` matches the value
//          we configured in META_WEBHOOK_VERIFY_TOKEN.
//
//   POST — Lead notification. Called by Meta when a Lead Form ad gets
//          a new submission on any page that's subscribed to our App.
//          Must:
//            1) Verify X-Hub-Signature-256 (HMAC-SHA256 of raw body with
//               META_APP_SECRET as the key) to prove the request is
//               actually from Meta
//            2) For each leadgen entry, look up the tenant by page_id
//            3) Fetch the lead form data from Graph API using the
//               tenant's page access token
//            4) Create a customer row + log a meta_lead_imports row
//
// Failure modes are LOGGED to meta_lead_imports so the dashboard can
// show "you've received 4 webhooks but 2 failed — here's why".
//
// Required env vars (set in Vercel):
//   META_APP_SECRET            — Facebook App Secret (for signature)
//   META_WEBHOOK_VERIFY_TOKEN  — arbitrary string, set in App dashboard
//   META_ENCRYPTION_KEY        — for decrypting stored page access tokens
//
// ---------------------------------------------------------------------------
// Tenant setup walkthrough (one-time per tenant, from /dashboard/marketing/
// integrations/meta):
//
//   1) Tenant grants Nidham access to their FB Page (via the Login flow
//      or by manually generating a page access token in Graph API
//      Explorer with the leads_retrieval scope).
//   2) Tenant pastes the token + page ID into the Integration form.
//   3) Tenant subscribes our App to their page via the FB Page Settings
//      → Advanced messaging → App subscriptions, OR via the API:
//         POST /{page_id}/subscribed_apps?subscribed_fields=leadgen
//   4) Done — leads from any active Lead Form ad on that page now flow
//      into the inbox automatically.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";

// Force the route to be dynamic so Vercel doesn't try to pre-render it.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ----------------------------------------------------------------------------
// GET — verification challenge
// ----------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (!expectedToken) {
    console.error("[meta-leads/GET] META_WEBHOOK_VERIFY_TOKEN not set");
    return new NextResponse("server misconfigured", { status: 500 });
  }
  if (mode === "subscribe" && token === expectedToken && challenge) {
    // Meta expects the raw challenge string echoed back as text/plain
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// ----------------------------------------------------------------------------
// POST — leadgen notification
// ----------------------------------------------------------------------------
type LeadgenChange = {
  field: string;
  value: {
    leadgen_id: string;
    page_id: string;
    form_id?: string;
    ad_id?: string;
    adgroup_id?: string;  // Meta's name for adset_id in some payloads
    created_time?: number;
  };
};

type WebhookPayload = {
  object: string;
  entry?: {
    id: string;
    time: number;
    changes?: LeadgenChange[];
  }[];
};

type GraphLeadResponse = {
  id: string;
  created_time: string;
  ad_id?: string;
  campaign_id?: string;
  form_id?: string;
  field_data?: { name: string; values: string[] }[];
};

export async function POST(req: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;
  const encryptionKey = process.env.META_ENCRYPTION_KEY;

  if (!appSecret || !encryptionKey) {
    console.error(
      "[meta-leads/POST] missing META_APP_SECRET or META_ENCRYPTION_KEY",
    );
    return NextResponse.json(
      { ok: false, error: "server misconfigured" },
      { status: 500 },
    );
  }

  // 1) Verify signature against the RAW body bytes
  const rawBody = await req.text();
  const sigHeader = req.headers.get("x-hub-signature-256");

  if (!verifySignature(rawBody, sigHeader, appSecret)) {
    console.warn("[meta-leads/POST] signature verification failed");
    return new NextResponse("invalid signature", { status: 401 });
  }

  // 2) Parse payload
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody) as WebhookPayload;
  } catch (err) {
    console.error("[meta-leads/POST] JSON parse failed:", err);
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  if (payload.object !== "page") {
    // Could be instagram or other; we only handle "page" leadgen for now.
    return NextResponse.json({ ok: true, note: "ignored non-page object" });
  }

  // 3) Process each leadgen change. We don't await the supabase client
  // until we have something to do — Meta retries failed deliveries so we
  // want to ACK with 200 even if individual leads fail.
  const supabase = await createClient();
  const results: { leadgen_id: string; outcome: string }[] = [];

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "leadgen") continue;
      const { leadgen_id, page_id, form_id, ad_id, adgroup_id } = change.value;

      const outcome = await processLeadgen({
        supabase,
        leadgenId: leadgen_id,
        pageId: page_id,
        formId: form_id,
        adId: ad_id,
        adsetId: adgroup_id,
        encryptionKey,
      });
      results.push({ leadgen_id, outcome });
    }
  }

  // Always 200 — Meta interprets non-2xx as "retry forever" which leads
  // to webhook delivery delays for all subsequent leads on the same page.
  return NextResponse.json({ ok: true, processed: results });
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function verifySignature(
  rawBody: string,
  header: string | null,
  appSecret: string,
): boolean {
  if (!header) return false;
  // Format: "sha256=abcdef..."
  const [algo, sig] = header.split("=");
  if (algo !== "sha256" || !sig) return false;

  const expected = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  // timingSafeEqual requires equal-length buffers
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(
      Buffer.from(sig, "hex"),
      Buffer.from(expected, "hex"),
    );
  } catch {
    return false;
  }
}

type SupabaseClientLike = Awaited<ReturnType<typeof createClient>>;

async function processLeadgen(args: {
  supabase: SupabaseClientLike;
  leadgenId: string;
  pageId: string;
  formId?: string;
  adId?: string;
  adsetId?: string;
  encryptionKey: string;
}): Promise<string> {
  const { supabase, leadgenId, pageId, formId, adId, adsetId, encryptionKey } =
    args;

  // 1) Look up which tenant owns this page + decrypt their page token.
  const { data: lookupRows, error: lookupErr } = await supabase.rpc(
    "lookup_meta_integration_by_page",
    { p_page_id: pageId, p_encryption_key: encryptionKey },
  );

  type LookupRow = {
    integration_id: string;
    company_id: string;
    page_access_token: string;
    default_landing_page_id: string | null;
  };
  const lookup = (Array.isArray(lookupRows) ? lookupRows[0] : lookupRows) as
    | LookupRow
    | null
    | undefined;

  if (lookupErr || !lookup) {
    await logImport(supabase, {
      leadgenId,
      pageId,
      adId,
      formId,
      adsetId,
      outcome: "token_missing",
      error: `no integration for page ${pageId}: ${lookupErr?.message ?? "not found"}`,
    });
    return "token_missing";
  }

  // 2) Fetch lead form data from Graph API
  const graphUrl = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${encodeURIComponent(lookup.page_access_token)}&fields=id,created_time,ad_id,campaign_id,form_id,field_data`;
  let lead: GraphLeadResponse;
  try {
    const res = await fetch(graphUrl, { cache: "no-store" });
    if (!res.ok) {
      const errText = await res.text();
      await logImport(supabase, {
        leadgenId,
        pageId,
        adId,
        formId,
        adsetId,
        integrationId: lookup.integration_id,
        companyId: lookup.company_id,
        outcome: "fetch_failed",
        error: `graph ${res.status}: ${errText.slice(0, 300)}`,
      });
      await bumpCounters(supabase, lookup.integration_id, false, `graph ${res.status}`);
      return "fetch_failed";
    }
    lead = (await res.json()) as GraphLeadResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logImport(supabase, {
      leadgenId,
      pageId,
      adId,
      formId,
      adsetId,
      integrationId: lookup.integration_id,
      companyId: lookup.company_id,
      outcome: "fetch_failed",
      error: `fetch threw: ${msg.slice(0, 300)}`,
    });
    await bumpCounters(supabase, lookup.integration_id, false, msg);
    return "fetch_failed";
  }

  // 3) Flatten field_data into a normalized map. Meta returns it like:
  //    [{ name: "full_name", values: ["Ahmed"] }, { name: "phone_number", values: ["+201..."] }]
  const fields = new Map<string, string>();
  for (const f of lead.field_data ?? []) {
    if (f.values?.[0]) fields.set(f.name.toLowerCase(), f.values[0]);
  }

  const name =
    fields.get("full_name") ??
    fields.get("name") ??
    [fields.get("first_name"), fields.get("last_name")].filter(Boolean).join(" ").trim();
  const phone = fields.get("phone_number") ?? fields.get("phone");
  const email = fields.get("email");
  const whatsapp = fields.get("whatsapp_number") ?? fields.get("whatsapp");
  const city = fields.get("city") ?? fields.get("address.city");
  const message =
    fields.get("message") ??
    fields.get("notes") ??
    fields.get("comments");

  if (!name || (!phone && !email && !whatsapp)) {
    await logImport(supabase, {
      leadgenId,
      pageId,
      adId,
      formId,
      adsetId,
      integrationId: lookup.integration_id,
      companyId: lookup.company_id,
      outcome: "parse_failed",
      error: `missing name/contact: ${JSON.stringify(Array.from(fields.keys()))}`,
      rawPayload: lead as unknown as Record<string, unknown>,
    });
    await bumpCounters(supabase, lookup.integration_id, false, "missing required fields");
    return "parse_failed";
  }

  // 4) Dedup against existing customer by phone OR email in same tenant
  const dedupPhone = phone?.trim() || null;
  const dedupEmail = email?.trim().toLowerCase() || null;

  let customerId: string | null = null;
  if (dedupPhone || dedupEmail) {
    const ors: string[] = [];
    if (dedupPhone) ors.push(`phone.eq.${dedupPhone}`);
    if (dedupEmail) ors.push(`email.eq.${dedupEmail}`);
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("company_id", lookup.company_id)
      .or(ors.join(","))
      .limit(1)
      .maybeSingle<{ id: string }>();
    if (existing) customerId = existing.id;
  }

  if (customerId) {
    // Existing customer: refresh fields, don't reset status
    await supabase
      .from("customers")
      .update({
        full_name: name,
        phone: dedupPhone ?? undefined,
        email: dedupEmail ?? undefined,
        whatsapp: whatsapp ?? undefined,
        notes: message
          ? `[Meta Lead Ad · ${new Date().toLocaleString("ar-EG")}]\n${message}`
          : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId)
      .eq("company_id", lookup.company_id);

    await logImport(supabase, {
      leadgenId,
      pageId,
      adId: lead.ad_id ?? adId,
      formId: lead.form_id ?? formId,
      campaignId: lead.campaign_id,
      adsetId,
      integrationId: lookup.integration_id,
      companyId: lookup.company_id,
      customerId,
      outcome: "duplicate",
      rawPayload: lead as unknown as Record<string, unknown>,
    });
    await bumpCounters(supabase, lookup.integration_id, true, null);
    return "duplicate";
  }

  // New customer
  const { data: inserted, error: insertErr } = await supabase
    .from("customers")
    .insert({
      company_id: lookup.company_id,
      full_name: name,
      phone: dedupPhone,
      email: dedupEmail,
      whatsapp,
      status: "lead",
      source: "meta_lead_ads",
      first_utm_source: "meta_lead_ads",
      first_utm_medium: "paid_social",
      first_utm_campaign: lead.campaign_id ?? null,
      first_utm_content: lead.ad_id ?? adId ?? null,
      landing_page_id: lookup.default_landing_page_id,
      first_seen_at: lead.created_time
        ? new Date(lead.created_time).toISOString()
        : new Date().toISOString(),
      notes: [
        message,
        city ? `📍 ${city}` : null,
        `📥 من Meta Lead Form · ad_id=${lead.ad_id ?? adId ?? "—"}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    })
    .select("id")
    .single<{ id: string }>();

  if (insertErr || !inserted) {
    await logImport(supabase, {
      leadgenId,
      pageId,
      adId: lead.ad_id ?? adId,
      formId: lead.form_id ?? formId,
      campaignId: lead.campaign_id,
      adsetId,
      integrationId: lookup.integration_id,
      companyId: lookup.company_id,
      outcome: "parse_failed",
      error: insertErr?.message ?? "insert returned no row",
      rawPayload: lead as unknown as Record<string, unknown>,
    });
    await bumpCounters(supabase, lookup.integration_id, false, insertErr?.message ?? null);
    return "insert_failed";
  }

  await logImport(supabase, {
    leadgenId,
    pageId,
    adId: lead.ad_id ?? adId,
    formId: lead.form_id ?? formId,
    campaignId: lead.campaign_id,
    adsetId,
    integrationId: lookup.integration_id,
    companyId: lookup.company_id,
    customerId: inserted.id,
    outcome: "success",
    rawPayload: lead as unknown as Record<string, unknown>,
  });
  await bumpCounters(supabase, lookup.integration_id, true, null);
  return "success";
}

async function logImport(
  supabase: SupabaseClientLike,
  args: {
    leadgenId: string;
    pageId: string;
    adId?: string;
    formId?: string;
    campaignId?: string;
    adsetId?: string;
    integrationId?: string;
    companyId?: string;
    customerId?: string;
    outcome: string;
    error?: string;
    rawPayload?: Record<string, unknown>;
  },
): Promise<void> {
  if (!args.companyId) {
    // No tenant known — log to console only (we can't write to a
    // tenant-scoped table without company_id).
    console.warn(
      `[meta-leads] orphan webhook · page=${args.pageId} leadgen=${args.leadgenId} outcome=${args.outcome} err=${args.error}`,
    );
    return;
  }
  await supabase.from("meta_lead_imports").insert({
    meta_integration_id: args.integrationId,
    company_id: args.companyId,
    leadgen_id: args.leadgenId,
    page_id: args.pageId,
    ad_id: args.adId,
    form_id: args.formId,
    campaign_id: args.campaignId,
    adset_id: args.adsetId,
    customer_id: args.customerId,
    outcome: args.outcome,
    error_message: args.error,
    raw_payload: args.rawPayload,
  });
}

async function bumpCounters(
  supabase: SupabaseClientLike,
  integrationId: string,
  imported: boolean,
  errorMessage: string | null,
): Promise<void> {
  await supabase.rpc("_meta_integration_bump_counters", {
    p_integration_id: integrationId,
    p_imported: imported,
    p_error_message: errorMessage,
  });
}
