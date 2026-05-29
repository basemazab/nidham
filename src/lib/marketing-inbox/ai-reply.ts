import { z } from "zod";
import { generateText } from "ai";
import { pickAgentModel } from "@/lib/ai-models";

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

export type ConversationTurn = {
  role: "user" | "assistant";
  body: string;
};

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

ردّ بجسون ONLY — أي كلام برة الجسون هيكسر التطبيق وبيعتبر خطأ.
اكتب JSON بالشكل ده بالظبط (ممنوع إضافة أي text خارج الـ JSON):
{
  "reply": "ردك بالعامية المصرية",
  "intent": "pricing_inquiry | demo_request | feature_question | support_request | complaint | spam | greeting | other",
  "leadQuality": "hot | warm | cold | spam",
  "shouldHandoff": true أو false,
  "handoffReason": "سبب التحويل لبشر (أو نص فاضي لو shouldHandoff = false)"
}`.trim();

  const historyTurns = (input.history || []).slice(-5);
  const conversationContext = historyTurns
    .map((t) => `${t.role === "user" ? "العميل" : "المساعد"}: ${t.body}`)
    .join("\n");

  const userPrompt = `
${conversationContext ? `المحادثة قبل كده:\n${conversationContext}\n\n` : ""}الرسالة الجديدة من العميل:
"${input.userMessage}"

اكتب JSON فقط — من غير أي كلام تاني.
  `.trim();

  const { model } = pickAgentModel();

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: userPrompt,
    temperature: 0.4,
  });

  const text = result.text.trim();
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("AI response did not contain valid JSON");
  }
  const jsonStr = text.slice(jsonStart, jsonEnd + 1);
  const parsed = JSON.parse(jsonStr);
  const validated = AiReplyResultSchema.parse(parsed);
  return validated;
}

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
