"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ──────────────────────────────────────────────────────
// CONVERSATION MEMORY
// ──────────────────────────────────────────────────────

export async function listConversations(userId: string, companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("*")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return data;
}

export async function getConversationMessages(conversationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function createConversation(
  userId: string,
  companyId: string,
  title: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({
      user_id: userId,
      company_id: companyId,
      title,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function saveMessage(params: {
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content?: string;
  toolCalls?: unknown;
  tokens?: number;
  model?: string;
  latencyMs?: number;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("ai_messages").insert({
    conversation_id: params.conversationId,
    role: params.role,
    content: params.content,
    tool_calls: params.toolCalls as any,
    tokens: params.tokens ?? 0,
    model: params.model,
    latency_ms: params.latencyMs,
  });

  if (error) throw new Error(error.message);
}

export async function updateConversationMeta(
  conversationId: string,
  updates: { turn_count?: number; token_count?: number; summary?: string; title?: string },
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_conversations")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (error) throw new Error(error.message);
}

export async function archiveConversation(conversationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_conversations")
    .update({ is_archived: true })
    .eq("id", conversationId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/ai");
}

export async function deleteConversation(conversationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/ai");
}

// ──────────────────────────────────────────────────────
// KNOWLEDGE BASE (RAG)
// ──────────────────────────────────────────────────────

export async function searchKnowledgeBase(
  companyId: string,
  query: string,
  limit: number = 5,
) {
  const supabase = await createClient();

  // Full-text search fallback (works without pgvector)
  const { data, error } = await supabase
    .from("ai_knowledge_base")
    .select("*")
    .eq("company_id", companyId)
    .textSearch("content", query, {
      type: "websearch",
      config: "arabic",
    })
    .limit(limit);

  if (error) {
    // Fallback to simple ILIKE if text search is not configured
    const { data: fallback } = await supabase
      .from("ai_knowledge_base")
      .select("*")
      .eq("company_id", companyId)
      .ilike("content", `%${query}%`)
      .limit(limit);
    return fallback ?? [];
  }

  return data ?? [];
}

export async function listKnowledgeBase(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_knowledge_base")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function addKnowledgeDocument(params: {
  companyId: string;
  title: string;
  content: string;
  sourceType: "manual" | "policy" | "law_article" | "contract" | "faq" | "uploaded";
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_knowledge_base")
    .insert({
      company_id: params.companyId,
      title: params.title,
      content: params.content,
      source_type: params.sourceType,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/ai/knowledge");
  return data;
}

export async function deleteKnowledgeDocument(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ai_knowledge_base")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/ai/knowledge");
}

// ──────────────────────────────────────────────────────
// AI AUDIT LOG
// ──────────────────────────────────────────────────────

export async function logAiAction(params: {
  companyId: string;
  userId: string;
  conversationId?: string;
  actionType: string;
  actionInput?: unknown;
  actionResult?: unknown;
  success: boolean;
  errorMessage?: string;
  latencyMs?: number;
}) {
  try {
    const supabase = await createClient();
    await supabase.from("ai_audit_log").insert({
      company_id: params.companyId,
      user_id: params.userId,
      conversation_id: params.conversationId,
      action_type: params.actionType,
      action_input: params.actionInput as any,
      action_result: params.actionResult as any,
      success: params.success,
      error_message: params.errorMessage,
      latency_ms: params.latencyMs,
    });
  } catch {
    // audit log is non-critical; don't crash the caller
  }
}

export async function listAiAuditLog(
  companyId: string,
  limit: number = 50,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_audit_log")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data;
}
