// ============================================================================
// Social Media AI engine — post generation + reply drafting
// ============================================================================
//
// This is the brain behind /admin/social. It produces:
//   - PLATFORM-AWARE posts (char limits, hashtag conventions, tone)
//   - VARIANT packs (3-5 variations to A/B test or rotate)
//   - REPLY drafts that match the comment's intent (question, complaint,
//     compliment, lead-in) with the right urgency level
//
// All generation goes through the existing callWithFallback() so we get
// the multi-provider resilience (Groq gpt-oss-120b → 20b → llama-4-scout
// → Gemini) and structured-output safety.

import { generateObject } from "ai";
import { z } from "zod";
import { callWithFallback } from "./ai-models";

// ----------------------------------------------------------------------------
// Platform-specific constraints
// ----------------------------------------------------------------------------
export type Platform =
  | "facebook"
  | "instagram"
  | "twitter"
  | "linkedin"
  | "tiktok"
  | "youtube"
  | "threads"
  | "telegram";

type PlatformSpec = {
  label: string;
  maxLength: number;
  hashtagStyle: "many" | "few" | "none";
  emojiStyle: "rich" | "moderate" | "minimal";
  toneHint: string;
  bestPostType: string;
};

export const PLATFORM_SPECS: Record<Platform, PlatformSpec> = {
  facebook: {
    label: "Facebook",
    maxLength: 1500, // FB allows up to 63K but engagement craters past 1500
    hashtagStyle: "few",
    emojiStyle: "moderate",
    toneHint: "Conversational + storytelling. Stories outperform announcements 3x.",
    bestPostType: "story-driven case study or pain-point question",
  },
  instagram: {
    label: "Instagram",
    maxLength: 2200,
    hashtagStyle: "many",
    emojiStyle: "rich",
    toneHint: "Visual-first. Hook in first line. 10-15 hashtags at the end.",
    bestPostType: "before/after visual, infographic, behind-the-scenes",
  },
  twitter: {
    label: "X (Twitter)",
    maxLength: 280,
    hashtagStyle: "few",
    emojiStyle: "minimal",
    toneHint: "Punchy, single insight per tweet. Threadable.",
    bestPostType: "spicy take, contrarian view, or hot tip",
  },
  linkedin: {
    label: "LinkedIn",
    maxLength: 3000,
    hashtagStyle: "few",
    emojiStyle: "minimal",
    toneHint: "Professional + insight-driven. Stories about business outcomes.",
    bestPostType: "founder perspective, case study, industry observation",
  },
  tiktok: {
    label: "TikTok",
    maxLength: 2200,
    hashtagStyle: "many",
    emojiStyle: "rich",
    toneHint: "Hook-driven, hashtag-stuffed, casual tone.",
    bestPostType: "trend-jacking + product demo",
  },
  youtube: {
    label: "YouTube",
    maxLength: 5000,
    hashtagStyle: "few",
    emojiStyle: "moderate",
    toneHint: "SEO-optimized description. First 2 lines visible in feed.",
    bestPostType: "tutorial / explainer description",
  },
  threads: {
    label: "Threads",
    maxLength: 500,
    hashtagStyle: "few",
    emojiStyle: "moderate",
    toneHint: "Like Twitter but more relaxed. Threadable.",
    bestPostType: "casual observation or question",
  },
  telegram: {
    label: "Telegram",
    maxLength: 4096,
    hashtagStyle: "few",
    emojiStyle: "moderate",
    toneHint: "Direct, value-dense. Channel subscribers expect tips.",
    bestPostType: "tip + actionable next step",
  },
};


// ----------------------------------------------------------------------------
// generateSocialPosts — produce N posts across one or more platforms
// ----------------------------------------------------------------------------

const postVariantSchema = z.object({
  platform: z.enum([
    "facebook",
    "instagram",
    "twitter",
    "linkedin",
    "tiktok",
    "youtube",
    "threads",
    "telegram",
  ]),
  hook: z
    .string()
    .describe("The first line of the post — must stop the scroll"),
  body: z.string().describe("Full post body, must respect platform limits"),
  hashtags: z
    .array(z.string())
    .describe("Recommended hashtags WITHOUT the # prefix"),
  cta_label: z
    .string()
    .describe("The action we want the reader to take, e.g. 'كلمنا واتساب'"),
  estimated_engagement_score: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe("Realistic engagement potential 1-10 (be honest, not optimistic)"),
  reasoning: z
    .string()
    .describe("One sentence: why this post works for this platform"),
});

export const socialPostsResponseSchema = z.object({
  posts: z.array(postVariantSchema).min(1).max(8),
  campaign_theme: z.string().describe("Short theme tying the variants together"),
  best_time_to_post: z
    .string()
    .describe("Recommended posting time for Egyptian audience (e.g. '8-10 PM Cairo time')"),
});

export type SocialPostVariant = z.infer<typeof postVariantSchema>;
export type SocialPostsResponse = z.infer<typeof socialPostsResponseSchema>;

const POST_SYSTEM = `أنت Senior Social Media Manager متخصص في B2B SaaS بالسوق المصري.
بتشتغل لـ Nidham — نظام HR + CRM + استوديو تسويق ذكي للشركات الصغيرة
والمتوسطة في مصر. متوافق مع قانون العمل 12/2003 وقانون التأمينات 148/2019.
عندك 12 سنة خبرة وعملت 500+ campaign للـ SaaS.

🎯 جمهورك المستهدف:
- أصحاب شركات مصرية (5-500 موظف)
- مديري HR محتاجين يخلصوا من Excel والورق
- مديري تسويق بيحاولوا يجيبوا leads من Facebook Ads
- مديري شركات بيدفعوا كتير لـ HR/Marketing agencies

🗣 الـ Brand Voice:
1. **مصري طبيعي** — لهجة شارع مهنية. مفيش فصحى ثقيلة. قول
   "يعني" و "علشان" و "بقى". لكن مش هزلي — احنا نظام محترم.
2. **Specific Numbers** — كل ادعاء معاه رقم: "وفر 8 ساعات
   شهرياً"، "21 يوم إجازة محسوبين تلقائياً"، "متوسط CPA -35%".
3. **Pain-First** — ابدأ بـ pain point مش بـ feature. لو ابتديت
   بـ "مين تعب من حساب التأمينات يدوياً؟" أحسن من "قدّم نظام تأمينات".
4. **Show Don't Tell** — بدل "AI ذكي"، قول "AI بيكتب 5 إعلانات في دقيقتين".
5. **CTA واحدة واضحة** — مفيش "اعرف أكتر + شارك + اتابعنا". CTA واحدة.
6. **مش متحايل** — مفيش clickbait. مفيش "ده غيّر حياتي!". المصري بيشم الـ BS.

✦ مواضيع تنفع:
- مشاكل Excel في إدارة الموظفين
- أخطاء قانون العمل اللي بتتكلف فلوس
- AI Marketing — وكالة بدون وكالة
- الفرق بين شركة بتبيع وشركة بتستلم calls
- قصص نجاح (real numbers)
- ميزة جديدة (lean — ميزة واحدة في الـ post)
- إحصائيات SMB في مصر`;


export async function generateSocialPosts(input: {
  topic: string;
  platforms: Platform[];
  goal:
    | "awareness"
    | "lead_generation"
    | "engagement"
    | "thought_leadership"
    | "feature_launch";
  variant_count?: number;
  brand_voice_override?: string;
  reference_url?: string;
}): Promise<SocialPostsResponse> {
  const platformBriefs = input.platforms
    .map((p) => {
      const s = PLATFORM_SPECS[p];
      return `- **${s.label}** (≤${s.maxLength} حرف): ${s.toneHint}. أفضل: ${s.bestPostType}. هاشتاج: ${s.hashtagStyle === "many" ? "10-15" : s.hashtagStyle === "few" ? "1-3" : "0"}. Emoji: ${s.emojiStyle}.`;
    })
    .join("\n");

  const goalText: Record<typeof input.goal, string> = {
    awareness: "زيادة الوعي بـ Nidham بين أصحاب الشركات",
    lead_generation: "جذب leads جاهزة (لصفحة تجربة 14 يوم)",
    engagement: "زيادة تعليقات + reshares للوصول لجمهور أوسع",
    thought_leadership: "وضعنا كصوت موثوق في HR/Marketing tech في مصر",
    feature_launch: "إطلاق ميزة جديدة بتفاصيل واضحة",
  };

  const prompt = `**الموضوع:** ${input.topic}
**الهدف:** ${goalText[input.goal]}
**المنصات المطلوبة:**
${platformBriefs}

${input.reference_url ? `**رابط مرجعي:** ${input.reference_url}` : ""}
${input.brand_voice_override ? `**ملاحظة خاصة على الـ tone:** ${input.brand_voice_override}` : ""}

اكتب ${input.variant_count ?? input.platforms.length} variants — واحد على الأقل
لكل منصة من المطلوبة. كل variant مفصّل للمنصة بتاعته:
- الـ Hook لازم يوقف الـ scroll في الـ feed
- الـ Body يحترم الـ char limit
- الـ Hashtags تكون مناسبة لـ Egyptian audience + نوع الـ platform
- الـ CTA واحدة واضحة

كن صادق في الـ engagement_score — مش كل post = 10/10. اللي بيـ ride موجة
trend أو فيه controversy أعلى. اللي feature dump أقل.`;

  return callWithFallback(async (picked) => {
    const { object } = await generateObject({
      maxRetries: 0,
      model: picked.model,
      schema: socialPostsResponseSchema,
      system: POST_SYSTEM,
      prompt,
      temperature: 0.85,
    });
    return object;
  });
}


// ----------------------------------------------------------------------------
// generateReplyDraft — produce an AI reply to a single comment
// ----------------------------------------------------------------------------

export const replyDraftSchema = z.object({
  sentiment: z.enum(["positive", "neutral", "negative", "question", "spam"]),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  summary: z
    .string()
    .describe("One-sentence summary of what the commenter wants"),
  reply_body: z
    .string()
    .describe("The actual reply text. Egyptian Arabic. Under 300 chars."),
  suggested_action: z.enum([
    "post_reply",
    "escalate_to_human",
    "ignore",
    "block_user",
  ]),
  reasoning: z.string().describe("Why this is the right action + tone"),
});

export type ReplyDraft = z.infer<typeof replyDraftSchema>;

const REPLY_SYSTEM = `أنت Community Manager بـ Nidham — نظام SaaS مصري. شغلك ترد على تعليقات
على بوستات social media تحاول تحوّل المهتمين لـ leads.

🎯 قواعدك:
1. **Match the tone** — لو التعليق ودود، رد ودود. لو فيه سخرية، رد بـ humor
   هادي. لو فيه شكوى حقيقية، رد بجد + escalate.
2. **مفيش ترويج صريح** — مفيش "تجربة نظامنا 14 يوم!" في كل رد. الرد فيه قيمة أولاً.
3. **مصري طبيعي** — مفيش "حضرتك" في كل جملة. كأنك بتكلم زميل.
4. **خلي الرد قصير** — جملة-جملتين max. الناس مش بتقرا paragraphs في الكومنتات.
5. **CTA لطيف** — لو فيه فرصة، اقترح يبعت رسالة private أو يتفرّج على شي محدد.
6. **اعرف اللي مش هترد عليه:**
   - **spam** → ignore
   - **تعليقات سخيفة جداً أو مهين** → block_user (نادر)
   - **شكاوى لازم تتعالج بـ human** → escalate_to_human
   - **سؤال بسيط أو positive** → post_reply

🚨 Urgency rules:
- "critical": شخص بيشكي علنا من Nidham + ممكن يأذي السمعة → escalate
- "high": سؤال شراء جاد، lead بيسأل عن الأسعار
- "medium": سؤال عام، تعليق ودود
- "low": لايك زيادة، تعليق غير مفيد`;

export async function draftCommentReply(input: {
  post_body: string;
  comment_body: string;
  comment_author: string | null;
  platform: Platform;
  brand_voice?: string;
}): Promise<ReplyDraft> {
  const userPrompt = `**المنصة:** ${PLATFORM_SPECS[input.platform].label}
**نص البوست بتاعنا:**
${input.post_body.slice(0, 500)}

**التعليق (من ${input.comment_author ?? "user"}):**
${input.comment_body.slice(0, 800)}

اقرأ التعليق، صنّفه (sentiment + urgency)، واكتب الرد المناسب.`;

  return callWithFallback(async (picked) => {
    const { object } = await generateObject({
      maxRetries: 0,
      model: picked.model,
      schema: replyDraftSchema,
      system: REPLY_SYSTEM,
      prompt: userPrompt,
      temperature: 0.7,
    });
    return object;
  });
}
