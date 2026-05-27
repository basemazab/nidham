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

  // 3) Send via Meta
  if (conv.channel !== "messenger" && conv.channel !== "instagram") {
    return { ok: false, error: "Channel غير مدعوم في الإصدار الحالي" };
  }

  const send = await sendMetaMessage({
    channel: conv.channel,
    pageToken: settings.meta_page_token,
    recipientId: conv.external_user_id,
    text: input.text,
  });

  // 4) Store the message regardless (so the HR sees what they sent)
  const { error: insertErr } = await supabase
    .from("marketing_inbox_messages")
    .insert({
      conversation_id: input.conversationId,
      direction: "outbound",
      sender: "human",
      body: input.text,
      meta_message_id: send.ok ? send.messageId : null,
      sent_at: send.ok ? new Date().toISOString() : null,
      delivery_error: send.ok ? null : send.error,
    });

  if (insertErr) {
    return { ok: false, error: insertErr.message };
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

function textOrNull(value: FormDataEntryValue | null): string | null {
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}
