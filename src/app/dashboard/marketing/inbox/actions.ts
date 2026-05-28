"use server";

import { revalidatePath } from "next/cache";
import { requireHR } from "@/lib/permissions";
import { sendMetaMessage } from "@/lib/marketing-inbox/meta-client";

// ============================================================================
// Server Actions — Marketing Inbox
// ============================================================================

// Send a manual reply from the HR/Sales user → the Messenger/Instagram user.
export async function sendHumanReply(input: {
  conversationId: string;
  text: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, profile } = await requireHR();
  const { data: { user } } = await supabase.auth.getUser();
  if (!input.text.trim()) return { ok: false, error: "الرسالة فاضية" };

  // 1) Fetch conversation + ensure it belongs to the caller's tenant
  const { data: conv } = await supabase
    .from("marketing_inbox_conversations")
    .select("id, company_id, channel, external_user_id")
    .eq("id", input.conversationId)
    .single();

  if (!conv || conv.company_id !== profile.company_id) {
    return { ok: false, error: "محادثة غير موجودة" };
  }

  if (conv.channel !== "messenger" && conv.channel !== "instagram") {
    return { ok: false, error: "القناة غير مدعومة حالياً" };
  }

  // 2) Fetch the tenant's Meta page token
  const { data: settings } = await supabase
    .from("marketing_inbox_settings")
    .select("meta_page_token")
    .eq("company_id", profile.company_id)
    .single();

  if (!settings?.meta_page_token) {
    return {
      ok: false,
      error: "Meta Page Token مش مضبوط — اكمل الإعدادات الأول",
    };
  }

  // 3) Store the message FIRST (so user sees it even if Meta API fails)
  const { error: insertErr } = await supabase
    .from("marketing_inbox_messages")
    .insert({
      conversation_id: input.conversationId,
      direction: "outbound",
      sender: "human",
      author_user_id: user?.id ?? undefined,
      body: input.text,
      delivery_error: null,
    });

  if (insertErr) {
    return { ok: false, error: insertErr.message };
  }

  // 4) Send via Meta — best effort; store delivery_error if it fails
  const send = await sendMetaMessage({
    channel: conv.channel,
    pageToken: settings.meta_page_token,
    recipientId: conv.external_user_id,
    text: input.text,
  });

  if (!send.ok) {
    // Update the stored message with the delivery error
    await supabase
      .from("marketing_inbox_messages")
      .update({
        delivery_error: send.error,
        meta_message_id: null,
      })
      .eq("conversation_id", input.conversationId)
      .is("delivery_error", null)
      .order("created_at", { ascending: false })
      .limit(1);
  }

  // 5) Update conversation status to "human_replied"
  await supabase
    .from("marketing_inbox_conversations")
    .update({ status: "human_replied" })
    .eq("id", input.conversationId);

  revalidatePath(`/dashboard/marketing/inbox/${input.conversationId}`);
  revalidatePath("/dashboard/marketing/inbox");

  if (!send.ok) {
    return { ok: false, error: send.error };
  }
  return { ok: true };
}

// Mark conversation status (close / spam / qualified)
export async function updateConversationStatus(input: {
  conversationId: string;
  status: "open" | "qualified" | "closed" | "spam";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, profile } = await requireHR();

  const { error } = await supabase
    .from("marketing_inbox_conversations")
    .update({ status: input.status })
    .eq("id", input.conversationId)
    .eq("company_id", profile.company_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/dashboard/marketing/inbox/${input.conversationId}`);
  revalidatePath("/dashboard/marketing/inbox");
  return { ok: true };
}

// Save settings (Meta config + AI behavior)
export async function saveSettings(form: FormData): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const { supabase, profile } = await requireHR();

  const payload = {
    company_id: profile.company_id,
    channel_messenger: form.get("channel_messenger") === "on",
    channel_instagram: form.get("channel_instagram") === "on",
    meta_page_id: textOrNull(form.get("meta_page_id")),
    meta_page_token: textOrNull(form.get("meta_page_token")),
    meta_app_secret: textOrNull(form.get("meta_app_secret")),
    meta_verify_token: textOrNull(form.get("meta_verify_token")),
    meta_instagram_id: textOrNull(form.get("meta_instagram_id")),
    ai_enabled: form.get("ai_enabled") === "on",
    ai_system_prompt: textOrNull(form.get("ai_system_prompt")),
    ai_business_context: textOrNull(form.get("ai_business_context")),
    auto_push_to_crm: form.get("auto_push_to_crm") === "on",
  };

  const { error } = await supabase
    .from("marketing_inbox_settings")
    .upsert(payload, { onConflict: "company_id" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/marketing/inbox/settings");
  revalidatePath("/dashboard/marketing/inbox");
  return { ok: true };
}

// Test the Meta connection end-to-end
export async function testWebhookConnection(): Promise<
  | { ok: true; pageName: string; conversationCount: number; lastMessageAt: string | null }
  | { ok: false; error: string }
> {
  const { supabase, profile } = await requireHR();

  const { data: settings } = await supabase
    .from("marketing_inbox_settings")
    .select("meta_page_id, meta_page_token, meta_verify_token, meta_app_secret")
    .eq("company_id", profile.company_id)
    .single();

  if (!settings) {
    return { ok: false, error: "مفيش إعدادات — احفظ الإعدادات الأول" };
  }
  if (!settings.meta_page_token) {
    return { ok: false, error: "Page Access Token ناقص" };
  }
  if (!settings.meta_page_id) {
    return { ok: false, error: "Page ID ناقص" };
  }
  if (!settings.meta_verify_token) {
    return { ok: false, error: "Verify Token ناقص" };
  }
  if (!settings.meta_app_secret) {
    return { ok: false, error: "App Secret ناقص" };
  }

  // 1) Verify the token by fetching page info from Meta
  let pageName: string;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${settings.meta_page_id}?fields=name&access_token=${encodeURIComponent(settings.meta_page_token)}`,
    );
    const data = (await res.json()) as { name?: string; error?: { message: string } };
    if (!res.ok || data.error) {
      return { ok: false, error: `Meta API: ${data.error?.message || "فشل الاتصال"}` };
    }
    pageName = data.name || "(بلا اسم)";
  } catch (err) {
    return { ok: false, error: `فشل الاتصال بـ Meta: ${err instanceof Error ? err.message : String(err)}` };
  }

  // 2) Check if webhook has ever received anything
  const { count: convCount } = await supabase
    .from("marketing_inbox_conversations")
    .select("id", { count: "exact", head: true })
    .eq("company_id", profile.company_id);

  const { data: lastMsg } = await supabase
    .from("marketing_inbox_conversations")
    .select("last_message_at")
    .eq("company_id", profile.company_id)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    ok: true,
    pageName,
    conversationCount: convCount ?? 0,
    lastMessageAt: lastMsg?.last_message_at ?? null,
  };
}

// Preview AI reply — generates a reply WITHOUT sending to Meta
export async function previewAiReply(input: {
  conversationId: string;
}): Promise<
  | { ok: true; reply: string; intent: string; leadQuality: string; shouldHandoff: boolean }
  | { ok: false; error: string }
> {
  const { supabase, profile } = await requireHR();

  const { data: conv } = await supabase
    .from("marketing_inbox_conversations")
    .select("id, company_id, channel")
    .eq("id", input.conversationId)
    .eq("company_id", profile.company_id)
    .single();

  if (!conv) return { ok: false, error: "محادثة غير موجودة" };

  const { data: settings } = await supabase
    .from("marketing_inbox_settings")
    .select("ai_business_context, ai_system_prompt")
    .eq("company_id", profile.company_id)
    .single();

  // Get the last user message
  const { data: lastUserMsg } = await supabase
    .from("marketing_inbox_messages")
    .select("body")
    .eq("conversation_id", input.conversationId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastUserMsg) return { ok: false, error: "مفيش رسالة من العميل" };

  // Get history (last 5 turns)
  const { data: historyRows } = await supabase
    .from("marketing_inbox_messages")
    .select("direction, body")
    .eq("conversation_id", input.conversationId)
    .order("created_at", { ascending: true })
    .limit(10);

  const history = (historyRows || [])
    .filter((r) => r.body !== lastUserMsg.body)
    .map((r) => ({
      role: (r.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
      body: r.body,
    }));

  try {
    const { generateMarketingReply } = await import("@/lib/marketing-inbox/ai-reply");
    const result = await generateMarketingReply({
      userMessage: lastUserMsg.body,
      history,
      businessContext: settings?.ai_business_context || undefined,
      systemPromptOverride: settings?.ai_system_prompt || undefined,
    });
    return {
      ok: true,
      reply: result.reply,
      intent: result.intent,
      leadQuality: result.leadQuality,
      shouldHandoff: result.shouldHandoff,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

function textOrNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}
