// ============================================================================
// Marketing Inbox — AI auto-reply engine
// ============================================================================
//
// Generates a reply (in Egyptian Arabic) to an inbound message from a
// marketing channel (Messenger ad reply, IG DM, etc.) plus extracts the
// "intent" + "lead quality" so the conversation can be routed correctly:
//
//   • intent = "pricing_inquiry" / "demo_request" / "support" / "complaint" / "spam" / "other"
//   • leadQuality = "hot" / "warm" / "cold" / "spam"
//   • shouldHandoff = true when the AI should stop replying and a human takes over
//
// The reply is short (≤ 60 words), in Egyptian Arabic, and ALWAYS ends
// with a CTA that pulls the user toward signup or the relevant marketing
// page. No emojis except 1-2 max — feels less salesy.
//
// Uses the project's existing pickAgentModel() so the same Groq/Gemini
// fallback that powers the HR chat agent powers this too — no extra
// API keys, no extra cost beyond what the tenant is already paying.

import { z } from "zod";
import { generateObject } from "ai";
import { pickAgentModel } from "@/lib/ai-models";

// ── Schema for what the AI returns ──
export const AiReplyResultSchema = z.object({
  reply: z
    .string()
    .min(1)
    .max(400)
    .describe(
      "Reply text in Egyptian Arabic. Short, friendly, ≤ 60 words. End with a CTA.",
    ),
  intent: z.enum([
    "pricing_inquiry",
    "demo_request",
    "feature_question",
    "support_request",
    "complaint",
    "spam",
    "greeting",
    "other",
  ]),
  leadQuality: z.enum(["hot", "warm", "cold", "spam"]).describe(
    "hot = clear buying intent, asks pricing/demo. warm = interested but exploring. cold = vague. spam = irrelevant/insult/ad.",
  ),
  shouldHandoff: z
    .boolean()
    .describe(
      "True when the conversation should be handed to a human — complex pricing, complaint, lawsuit talk, or after 4+ turns without resolution.",
    ),
  handoffReason: z
    .string()
    .max(120)
    .describe(
      "Short Arabic note for the sales rep — why this lead is hot or needs human attention. Empty string if not needed.",
    ),
});

export type AiReplyResult = z.infer<typeof AiReplyResultSchema>;

// ── The system prompt — Nidham HR persona ──
//
// We pass the tenant's `business_context` as a variable so each company
// can tune what the AI knows. If they don't customize, the default below
// is Nidham HR's own self-marketing (you can use this as a template for
// other tenants once they start writing their own).
const DEFAULT_BUSINESS_CONTEXT = `
الشركة: نِظام HR — أول نظام HR + Payroll + CRM مصري متكامل.
متوافق مع قانون العمل 12/2003 وقانون التأمينات 148/2019.
الأسعار بالجنيه المصري (مش بالدولار):
  - Starter: 749 جنيه/شهر (حتى 25 موظف)
  - Pro: 2,430 جنيه/شهر (حتى 100 موظف)
  - Business: 5,990 جنيه/شهر (حتى 500 موظف)
المميزات: قسائم مرتبات تلقائية + نماذج تأمينات + GPS attendance + WhatsApp Bot + توقيع إلكتروني + CRM.
14 يوم تجربة مجانية بدون credit card.
موقع: https://www.nidhamhr.com
`;

// Conversation history shape — what came before this turn
export type ConversationTurn = {
  role: "user" | "assistant";
  body: string;
};

// ── Main entrypoint ──
//
// Pass in:
//   • the latest user message
//   • the previous turns (for context — up to last 5)
//   • optional tenant-specific business context + system prompt override
//
// Returns the AI's reply + extracted intent/lead quality.
export async function generateMarketingReply(input: {
  userMessage: string;
  history?: ConversationTurn[];
  businessContext?: string;
  systemPromptOverride?: string;
}): Promise<AiReplyResult> {
  const businessContext =
    input.businessContext?.trim() || DEFAULT_BUSINESS_CONTEXT.trim();

  const systemPrompt =
    input.systemPromptOverride?.trim() ||
    `أنت مساعد مبيعات مهذّب وذكي بيتكلم بالعامية المصرية.
بترد على رسائل من الإعلانات الممولة على Facebook و Instagram.

قواعدك الصارمة:
1. اكتب رد قصير جداً (≤ 60 كلمة).
2. عربي مصري عامي — مش فصحى.
3. كل رد لازم ينتهي بـ CTA واحد فقط (لينك أو سؤال).
4. لا تكذب على الأسعار أو الميزات. لو سؤال محدد مش متأكد منه، قل "هخلي فريق المبيعات يتواصل معاك".
5. لو الرسالة فيها شتيمة أو spam أو غير مفهومة، رد بمهذب وصنّفها spam.
6. لو العميل بيسأل على demo، شجّعه يحجز عبر https://www.nidhamhr.com/contact
7. لو بيسأل على الأسعار، اعرضها بمختصر + لينك https://www.nidhamhr.com/pricing
8. ممنوع تستخدم أكتر من 2 emoji في الرد كله.

معلومات عن الشركة (استخدمها للرد):
${businessContext}

بعد ما تكتب الرد، صنّف:
- intent: نوع الرسالة (سؤال سعر / طلب demo / سؤال ميزة / إلخ)
- leadQuality: hot لو فيه نية شراء واضحة، warm لو مهتم بيستكشف، cold لو سؤال عام، spam لو إعلان مزعج
- shouldHandoff: true لو الموضوع معقد ومحتاج بشر (سعر خاص، شكوى، محادثة طويلة)`.trim();

  // Build the messages array for the LLM
  const historyTurns = (input.history || []).slice(-5); // last 5 turns max
  const conversationContext = historyTurns
    .map((t) => `${t.role === "user" ? "العميل" : "المساعد"}: ${t.body}`)
    .join("\n");

  const userPrompt = `
${conversationContext ? `المحادثة قبل كده:\n${conversationContext}\n\n` : ""}الرسالة الجديدة من العميل:
"${input.userMessage}"

اكتب الرد مع التصنيف.
  `.trim();

  const { model } = pickAgentModel();

  const result = await generateObject({
    model,
    schema: AiReplyResultSchema,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.4, // mostly deterministic but allow personality
  });

  return result.object;
}

// ── Heuristic short-circuit ──
//
// If the message clearly matches one of the configured templates by
// keyword, skip the LLM call (faster + free + deterministic).
// Templates come from marketing_inbox_templates table.
export function tryTemplateMatch(input: {
  userMessage: string;
  templates: Array<{ trigger_keywords: string[]; reply_text: string }>;
}): string | null {
  const msg = input.userMessage.toLowerCase();
  for (const tpl of input.templates) {
    if (tpl.trigger_keywords.some((kw) => msg.includes(kw.toLowerCase()))) {
      return tpl.reply_text;
    }
  }
  return null;
}
