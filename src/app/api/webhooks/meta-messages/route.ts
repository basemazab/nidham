// ============================================================================
// /api/webhooks/meta-messages — receives Facebook / Instagram messages
// ============================================================================
//
// Meta calls this endpoint in TWO ways:
//
//   1. GET  /api/webhooks/meta-messages?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…
//      → One-time verification during Meta App webhook setup. We respond
//        with the `hub.challenge` value IF the `hub.verify_token` matches
//        what's configured in marketing_inbox_settings for some tenant.
//
//   2. POST /api/webhooks/meta-messages
//      → Real incoming message event. Body shape:
//        {
//          "object": "page" | "instagram",
//          "entry": [{
//            "id": "<PAGE_ID>",                   // ← we map to tenant by this
//            "messaging": [{                       // for Messenger
//              "sender": { "id": "<PSID>" },
//              "recipient": { "id": "<PAGE_ID>" },
//              "timestamp": …,
//              "message": { "mid": "…", "text": "…" }
//            }]
//          }]
//        }
//
// We verify the HMAC signature, find the matching tenant by `meta_page_id`,
// upsert the conversation, store the message, then trigger an AI reply
// asynchronously (fire-and-forget so the webhook returns 200 fast).
//
// SECURITY:
//   • Meta retries up to 24h if we don't return 200 within 20s. So we
//     MUST respond fast — AI processing happens via `waitUntil` (Vercel)
//     or just async (the response goes out, the work continues).
//   • Signature verification protects against forged messages.
//   • Tenant scoping via meta_page_id ensures Pages can't cross-leak.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  verifyMetaSignature,
  sendMetaMessage,
  fetchUserProfile,
} from "@/lib/marketing-inbox/meta-client";
import {
  generateMarketingReply,
  tryTemplateMatch,
  type ConversationTurn,
} from "@/lib/marketing-inbox/ai-reply";

// Force Node runtime (we need `crypto` for HMAC and our service-role
// Supabase client). Edge runtime would block the HMAC.
export const runtime = "nodejs";

// ── 1) GET — Meta webhook verification handshake ──
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode !== "subscribe" || !token || !challenge) {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Find ANY tenant with this verify_token configured. During Meta App
  // setup, the user enters a string they choose into both the Meta UI
  // and our settings — they must match for the handshake to succeed.
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("marketing_inbox_settings")
    .select("company_id")
    .eq("meta_verify_token", token)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    // Don't reveal which tokens are valid — generic 403
    return new NextResponse("Forbidden", { status: 403 });
  }

  // Meta wants the challenge value back, plain text
  return new NextResponse(challenge, { status: 200 });
}

// ── 2) POST — incoming message event ──
export async function POST(req: NextRequest) {
  // We need the raw body for signature verification. Reading req.json()
  // would consume the stream, so capture text first.
  const rawBody = await req.text();
  const signatureHeader = req.headers.get("x-hub-signature-256");

  // Parse JSON — Meta always sends valid JSON.
  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Bad payload", { status: 400 });
  }

  // Acknowledge fast — Meta times out after 20s. We process async after
  // responding 200. (If processing throws, we'll log but not retry.)
  processEventAsync(payload, rawBody, signatureHeader).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[meta-webhook] async processing failed:", err);
  });

  return NextResponse.json({ ok: true });
}

// ── Types — minimal subset of Meta's payload shape ──
type MetaWebhookPayload = {
  object: "page" | "instagram";
  entry: Array<{
    id: string; // page id (Messenger) or IG account id (Instagram)
    time?: number;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        is_echo?: boolean;
        attachments?: Array<{ type: string; payload?: { url?: string } }>;
      };
    }>;
  }>;
};

// ── Async processor — runs after the 200 response is sent ──
async function processEventAsync(
  payload: MetaWebhookPayload,
  rawBody: string,
  signatureHeader: string | null,
): Promise<void> {
  const supabase = createServiceClient();

  for (const entry of payload.entry || []) {
    const pageId = entry.id;
    const channel = payload.object === "instagram" ? "instagram" : "messenger";

    // Find tenant by page_id
    const { data: settings } = await supabase
      .from("marketing_inbox_settings")
      .select(
        "company_id, meta_page_token, meta_app_secret, ai_enabled, ai_system_prompt, ai_business_context, ai_handoff_keywords, auto_push_to_crm, channel_messenger, channel_instagram",
      )
      .eq("meta_page_id", pageId)
      .maybeSingle();

    if (!settings) {
      // Unknown page → silently drop. Don't error (Meta would keep retrying).
      continue;
    }

    // Channel must be enabled for this tenant
    if (channel === "messenger" && !settings.channel_messenger) continue;
    if (channel === "instagram" && !settings.channel_instagram) continue;

    // Verify signature (the page must have an app_secret set for this to work)
    if (settings.meta_app_secret) {
      const valid = verifyMetaSignature({
        rawBody,
        signatureHeader,
        appSecret: settings.meta_app_secret,
      });
      if (!valid) {
        // eslint-disable-next-line no-console
        console.warn("[meta-webhook] signature mismatch for page", pageId);
        continue;
      }
    }

    // Process each message in the entry
    for (const event of entry.messaging || []) {
      if (!event.message?.text || event.message.is_echo) continue;

      const senderId = event.sender.id;
      const messageText = event.message.text;
      const metaMessageId = event.message.mid;

      // Upsert conversation
      const conversationId = await upsertConversation({
        supabase,
        companyId: settings.company_id,
        channel,
        externalUserId: senderId,
        pageToken: settings.meta_page_token,
      });

      if (!conversationId) continue;

      // Insert the inbound message (ignore duplicates via unique constraint)
      const { error: insertErr } = await supabase
        .from("marketing_inbox_messages")
        .insert({
          conversation_id: conversationId,
          direction: "inbound",
          sender: "user",
          body: messageText,
          meta_message_id: metaMessageId,
        });

      if (insertErr) {
        // 23505 = unique violation = we've already processed this message
        if (insertErr.code !== "23505") {
          // eslint-disable-next-line no-console
          console.error("[meta-webhook] insert message failed:", insertErr);
        }
        continue;
      }

      // AI reply (if enabled)
      if (settings.ai_enabled && settings.meta_page_token) {
        await runAiReply({
          supabase,
          conversationId,
          companyId: settings.company_id,
          channel,
          recipientId: senderId,
          pageToken: settings.meta_page_token,
          userMessage: messageText,
          businessContext: settings.ai_business_context,
          systemPromptOverride: settings.ai_system_prompt,
          handoffKeywords: settings.ai_handoff_keywords || [],
          autoPushToCrm: settings.auto_push_to_crm,
        });
      }
    }
  }
}

// ── Upsert conversation + fetch user profile on first sight ──
async function upsertConversation(args: {
  supabase: ReturnType<typeof createServiceClient>;
  companyId: string;
  channel: "messenger" | "instagram";
  externalUserId: string;
  pageToken: string | null;
}): Promise<string | null> {
  // Try to find existing
  const { data: existing } = await args.supabase
    .from("marketing_inbox_conversations")
    .select("id")
    .eq("company_id", args.companyId)
    .eq("channel", args.channel)
    .eq("external_user_id", args.externalUserId)
    .maybeSingle();

  if (existing) return existing.id;

  // New — fetch profile so we have a name to show
  let profile: { name?: string; picture?: string } | null = null;
  if (args.pageToken) {
    profile = await fetchUserProfile({
      channel: args.channel,
      pageToken: args.pageToken,
      externalUserId: args.externalUserId,
    });
  }

  const { data: created, error } = await args.supabase
    .from("marketing_inbox_conversations")
    .insert({
      company_id: args.companyId,
      channel: args.channel,
      external_user_id: args.externalUserId,
      external_user_name: profile?.name || null,
      external_user_picture: profile?.picture || null,
      status: "open",
    })
    .select("id")
    .single();

  if (error || !created) {
    // eslint-disable-next-line no-console
    console.error("[meta-webhook] upsert conv failed:", error);
    return null;
  }
  return created.id;
}

// ── Generate AI reply + send via Meta + store outbound message ──
async function runAiReply(args: {
  supabase: ReturnType<typeof createServiceClient>;
  conversationId: string;
  companyId: string;
  channel: "messenger" | "instagram";
  recipientId: string;
  pageToken: string;
  userMessage: string;
  businessContext: string | null;
  systemPromptOverride: string | null;
  handoffKeywords: string[];
  autoPushToCrm: boolean;
}): Promise<void> {
  // Short-circuit: if a handoff keyword fires, don't reply with AI — let
  // a human pick this up. Mark status accordingly.
  const lowered = args.userMessage.toLowerCase();
  const handoffHit = args.handoffKeywords.some((kw) =>
    lowered.includes(kw.toLowerCase()),
  );
  if (handoffHit) {
    await args.supabase
      .from("marketing_inbox_conversations")
      .update({ status: "open", ai_intent: "handoff_keyword" })
      .eq("id", args.conversationId);
    return;
  }

  // Fetch last 5 turns of conversation history (for context)
  const { data: historyRows } = await args.supabase
    .from("marketing_inbox_messages")
    .select("direction, body, sender")
    .eq("conversation_id", args.conversationId)
    .order("created_at", { ascending: true })
    .limit(10);

  const history: ConversationTurn[] = (historyRows || []).map((row) => ({
    role: row.direction === "inbound" ? ("user" as const) : ("assistant" as const),
    body: row.body,
  }));
  // Drop the latest user message (we'll re-pass it as the focal message)
  if (history.length && history[history.length - 1].role === "user") {
    history.pop();
  }

  // Generate
  let ai;
  try {
    ai = await generateMarketingReply({
      userMessage: args.userMessage,
      history,
      businessContext: args.businessContext || undefined,
      systemPromptOverride: args.systemPromptOverride || undefined,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[meta-webhook] AI generation failed:", err);
    return;
  }

  // Update conversation with the AI's verdict
  await args.supabase
    .from("marketing_inbox_conversations")
    .update({
      status: ai.shouldHandoff ? "open" : "ai_replied",
      ai_intent: ai.intent,
      ai_lead_quality: ai.leadQuality,
      ai_last_run_at: new Date().toISOString(),
    })
    .eq("id", args.conversationId);

  // If hot/warm + auto-push enabled, create a customer (lead) in CRM
  if (
    args.autoPushToCrm &&
    (ai.leadQuality === "hot" || ai.leadQuality === "warm")
  ) {
    await pushToCRM({
      supabase: args.supabase,
      conversationId: args.conversationId,
      companyId: args.companyId,
      channel: args.channel,
      externalUserId: args.recipientId,
      intent: ai.intent,
      leadQuality: ai.leadQuality,
      handoffReason: ai.handoffReason,
    });
  }

  // If AI says handoff, store the verdict but don't reply
  if (ai.shouldHandoff) {
    await args.supabase.from("marketing_inbox_messages").insert({
      conversation_id: args.conversationId,
      direction: "outbound",
      sender: "ai",
      body: `[تنبيه داخلي] العميل ده محتاج تدخّل بشري. السبب: ${ai.handoffReason || "محادثة معقدة"}.`,
      delivery_error: "handoff_requested",
    });
    return;
  }

  // Send the reply via Meta
  const send = await sendMetaMessage({
    channel: args.channel,
    pageToken: args.pageToken,
    recipientId: args.recipientId,
    text: ai.reply,
  });

  // Store the outbound message regardless
  await args.supabase.from("marketing_inbox_messages").insert({
    conversation_id: args.conversationId,
    direction: "outbound",
    sender: "ai",
    body: ai.reply,
    meta_message_id: send.ok ? send.messageId : null,
    sent_at: send.ok ? new Date().toISOString() : null,
    delivery_error: send.ok ? null : send.error,
  });
}

// ── Push qualifying leads into the existing CRM (customers table) ──
async function pushToCRM(args: {
  supabase: ReturnType<typeof createServiceClient>;
  conversationId: string;
  companyId: string;
  channel: "messenger" | "instagram";
  externalUserId: string;
  intent: string;
  leadQuality: "hot" | "warm" | "cold" | "spam";
  handoffReason?: string;
}): Promise<void> {
  // Check if conversation already has a customer linked
  const { data: conv } = await args.supabase
    .from("marketing_inbox_conversations")
    .select("customer_id, external_user_name")
    .eq("id", args.conversationId)
    .single();

  if (conv?.customer_id) return; // already linked

  // Build a customer row. We don't have a phone number yet (the user
  // just messaged via Messenger), so we use a placeholder.
  const customerName =
    conv?.external_user_name ||
    `${args.channel === "instagram" ? "IG" : "FB"} Lead`;

  const notes = [
    `🟢 Auto-imported from ${args.channel === "instagram" ? "Instagram" : "Messenger"} (${args.leadQuality.toUpperCase()})`,
    `Intent: ${args.intent}`,
    args.handoffReason ? `Note: ${args.handoffReason}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const { data: customer, error } = await args.supabase
    .from("customers")
    .insert({
      company_id: args.companyId,
      name: customerName,
      status: "lead",
      source: args.channel === "instagram" ? "instagram_dm" : "messenger_dm",
      notes,
    })
    .select("id")
    .single();

  if (error || !customer) {
    // eslint-disable-next-line no-console
    console.error("[meta-webhook] push to CRM failed:", error);
    return;
  }

  // Link conversation → customer
  await args.supabase
    .from("marketing_inbox_conversations")
    .update({ customer_id: customer.id })
    .eq("id", args.conversationId);
}
