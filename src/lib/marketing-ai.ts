// ============================================================================
// Marketing Studio AI engine — prompts + schemas for every tool
// ============================================================================
//
// Each marketing tool gets a tailored AI prompt + structured-output schema.
// The system prompts encode senior-marketer expertise: how to write a
// brief, how to segment audiences, how to copy that converts in Arabic
// markets, how to research keywords for Egyptian search behavior.
//
// All calls go through pickAgentModel() from /lib/ai-models.ts so we
// get the same multi-provider fallback (Groq -> Gemini) the chat agent uses.

import { generateObject } from "ai";
import { z } from "zod";
import { pickAgentModel } from "./ai-models";

// ----------------------------------------------------------------------------
// 1) PRODUCT ANALYZER
// ----------------------------------------------------------------------------
// Takes a 1-paragraph product description and returns a deep marketing-grade
// analysis: USP, competitive moat, primary value proposition, market
// positioning, recommended channels, suggested price strategy. The output
// feeds every other tool.

export const productAnalysisSchema = z.object({
  one_line_pitch: z.string().describe("جملة واحدة مختصرة + قوية تلخص المنتج"),
  unique_value_proposition: z
    .string()
    .describe("القيمة الفريدة اللي تميز المنتج عن المنافسين (3-4 جمل)"),
  primary_benefits: z
    .array(z.string())
    .min(3)
    .max(5)
    .describe("أهم 3-5 فوائد للعميل بصياغة 'إنت هتقدر/هتبقى/هتوفّر'"),
  competitive_moat: z
    .string()
    .describe("ليه صعب على المنافس يقلّد المنتج ده؟"),
  market_positioning: z
    .enum(["premium", "value", "budget", "specialist", "mass-market"])
    .describe("الموقع التسويقي المناسب"),
  recommended_channels: z
    .array(
      z.enum([
        "facebook_ads",
        "instagram_ads",
        "tiktok_ads",
        "google_search",
        "google_display",
        "youtube",
        "linkedin",
        "whatsapp_business",
        "snapchat",
        "telegram",
        "seo_content",
        "influencer",
        "email",
      ]),
    )
    .min(2)
    .describe("أفضل قنوات تسويق للمنتج ده مرتبة بالأولوية"),
  pricing_strategy: z
    .string()
    .describe("استراتيجية تسعير مقترحة + سبب الاختيار"),
  marketing_risks: z
    .array(z.string())
    .describe("مخاطر تسويقية ممكن تواجه المنتج"),
  growth_opportunities: z
    .array(z.string())
    .describe("فرص نمو يقدر المنتج يستفيد منها"),
});

export type ProductAnalysis = z.infer<typeof productAnalysisSchema>;

const PRODUCT_ANALYSIS_SYSTEM = `أنت كبير مستشاري التسويق في وكالة Big4 (Ogilvy/McCann)، خبرة 15 سنة
في السوق المصري والخليجي. متخصص في تحويل وصف المنتج إلى تحليل تسويقي
عميق يستخدمه أصحاب الشركات لاتخاذ قرارات الميزانية والقنوات.

قواعدك:
1. **متعمّق، لا سطحي** — كل نقطة تجيبها مبنية على فهم سوقي حقيقي مش
   كلام عام.
2. **عربي عملي** — مفيش فصحى ثقيلة. كأنك بتشرح لصاحب شركة في مصر.
3. **مصري في المثال** — لو ضرب مثال لمنافس، يكون فعلاً موجود في السوق
   المصري.
4. **مبني على القيمة** — كل فائدة تكتبها صياغتها تركز على العميل (إنت
   هتقدر/هتبقى)، مش على المنتج (المنتج بيعمل).
5. **القنوات بالترتيب** — أول قناة في recommended_channels هي اللي
   تنصح بتبدأ بيها فعلاً.`;

export async function analyzeProduct(input: {
  product_summary: string;
  industry?: string | null;
  target_market?: string;
}): Promise<ProductAnalysis> {
  const picked = pickAgentModel();
  const userPrompt = `**وصف المنتج:** ${input.product_summary}
${input.industry ? `**الصناعة:** ${input.industry}` : ""}
${input.target_market ? `**السوق المستهدف:** ${input.target_market}` : "**السوق المستهدف:** مصر"}

اعمل تحليل تسويقي عميق لإيه عملاء الشركة المثاليين، إزاي تتميز عن
المنافسين، أي قنوات تسويق هتجيب أفضل ROI، واستراتيجية تسعير منطقية.`;

  const { object } = await generateObject({
    model: picked.model,
    schema: productAnalysisSchema,
    system: PRODUCT_ANALYSIS_SYSTEM,
    prompt: userPrompt,
    temperature: 0.6,
  });
  return object;
}

// ----------------------------------------------------------------------------
// 2) AUDIENCE BUILDER — generate buyer personas + targeting params
// ----------------------------------------------------------------------------

export const personaSchema = z.object({
  name: z
    .string()
    .describe("اسم شخصية + سن + مهنة (مثلاً: 'أحمد المهندس - 35')"),
  demographics: z.object({
    age_range: z.string().describe("النطاق العمري (e.g. '28-40')"),
    gender: z.enum(["male", "female", "any"]),
    location: z
      .array(z.string())
      .describe("المدن/المحافظات الأنسب في مصر"),
    income_level: z
      .enum(["low", "lower_middle", "middle", "upper_middle", "high"]),
    education: z.string().nullable(),
    occupation: z.string(),
    marital_status: z.string().nullable(),
  }),
  psychographics: z.object({
    interests: z
      .array(z.string())
      .describe("اهتمامات وهوايات (3-6 عناصر)"),
    values: z
      .array(z.string())
      .describe("القيم اللي تهمه (مثلاً: 'العائلة، الجودة، السعر')"),
    lifestyle: z.string(),
    media_consumption: z
      .array(z.string())
      .describe("القنوات اللي يقضي وقته فيها (Instagram, TikTok, etc.)"),
  }),
  pain_points: z
    .array(z.string())
    .min(3)
    .describe("المشاكل اللي بيعاني منها وعايز يحلها"),
  goals: z
    .array(z.string())
    .min(3)
    .describe("اللي عايز يحققه في حياته (ذات صلة بالمنتج)"),
  buying_journey: z.object({
    triggers: z
      .array(z.string())
      .describe("اللحظات اللي تخليه يفكر يشتري"),
    research_channels: z
      .array(z.string())
      .describe("الأماكن اللي بيدور فيها قبل القرار"),
    objections: z
      .array(z.string())
      .describe("اعتراضات شائعة بتمنعه من الشراء"),
    decision_factors: z
      .array(z.string())
      .describe("اللي بيحسم القرار في النهاية"),
  }),
  meta_targeting: z.object({
    detailed_interests: z
      .array(z.string())
      .describe(
        "كلمات بالإنجليزية تطابق Facebook Detailed Targeting Interests",
      ),
    behaviors: z.array(z.string()),
    age_min: z.number().int(),
    age_max: z.number().int(),
    locations: z.array(z.string()),
    gender: z.enum(["all", "male", "female"]),
    languages: z.array(z.string()),
  }),
  google_targeting: z.object({
    in_market_segments: z.array(z.string()),
    affinity_segments: z.array(z.string()),
    keyword_themes: z
      .array(z.string())
      .describe("كلمات مفتاحية ذات صلة بالنية الشرائية"),
  }),
});

export const personasResponseSchema = z.object({
  personas: z.array(personaSchema).min(2).max(4),
  primary_persona_index: z
    .number()
    .int()
    .describe("Index الـ persona الأهم (0-based)"),
  segmentation_strategy: z
    .string()
    .describe(
      "نصيحة حول كيف نوزع الميزانية بين الـ personas",
    ),
});

export type Persona = z.infer<typeof personaSchema>;
export type PersonasResponse = z.infer<typeof personasResponseSchema>;

const PERSONAS_SYSTEM = `أنت Customer Strategist في وكالة تسويق دولية، خبرة 12 سنة في
السوق المصري والعربي. متخصص في بناء "Buyer Personas" مبنية على واقع
السوق المحلي، مش قوالب جاهزة من الغرب.

قواعدك:
1. **شخصية حقيقية** — كل persona تبني عليها صياغة كأنه إنسان فعلي:
   "أحمد مهندس معماري عنده 35 سنة، متزوج وعنده طفلين، يسكن المعادي،
   راتبه 25-35 ألف، شغّال في شركة مقاولات صغيرة..."
2. **اهتمامات Facebook حقيقية** — في meta_targeting.detailed_interests
   استخدم Interests بأسماء فعلية تظهر في Facebook Ads Manager:
   "Home renovation", "Real estate development", "DIY", إلخ.
3. **مدن مصرية محددة** — بدل "Cairo" قول "Cairo, Giza, Alexandria,
   New Cairo, 6 October City". إستهدف صح.
4. **اعتراضات صادقة** — لو المنتج غالي، حط "السعر" في objections.
   لو جديد، حط "عدم الثقة بالعلامة الجديدة".
5. **2-4 personas مش أكتر** — كل واحد له ميزانية مختلفة في حملة الإعلان.
6. **رتب الأولوية** — primary_persona_index يكون اللي عنده أعلى احتمال
   شراء (مش الأكبر سن، الأوفر فلوس).`;

export async function generatePersonas(input: {
  product_summary: string;
  industry?: string | null;
  analysis?: ProductAnalysis;
}): Promise<PersonasResponse> {
  const picked = pickAgentModel();
  const analysisStr = input.analysis
    ? `\n\n**تحليل المنتج السابق:**\n${JSON.stringify(input.analysis, null, 0)}`
    : "";
  const userPrompt = `**وصف المنتج:** ${input.product_summary}
${input.industry ? `**الصناعة:** ${input.industry}` : ""}${analysisStr}

ابني 2-4 buyer personas للسوق المصري للمنتج ده، مع targeting parameters
كاملة لـ Facebook + Google Ads.`;

  const { object } = await generateObject({
    model: picked.model,
    schema: personasResponseSchema,
    system: PERSONAS_SYSTEM,
    prompt: userPrompt,
    temperature: 0.7,
  });
  return object;
}

// ----------------------------------------------------------------------------
// 3) AD COPY GENERATOR — produce platform-ready ad copy
// ----------------------------------------------------------------------------

export const adCreativeSchema = z.object({
  platform: z.enum([
    "meta",
    "google",
    "tiktok",
    "instagram",
    "linkedin",
    "snapchat",
  ]),
  format: z.enum([
    "single_image",
    "carousel",
    "video",
    "story",
    "reel",
    "search_ad",
    "display_ad",
  ]),
  headline: z
    .string()
    .max(45)
    .describe("عنوان قصير + قوي (max 40 حرف)"),
  body: z
    .string()
    .max(160)
    .describe("نص الإعلان (max 125 حرف لـ Meta, 90 لـ Google)"),
  cta: z
    .string()
    .describe(
      "Call to action (e.g. 'كلمنا واتساب' / 'احجز كشف' / 'اطلب الكتالوج')",
    ),
  hook: z
    .string()
    .nullable()
    .describe("Hook للفيديو (TikTok/Reels) — أول 3 ثواني"),
  creative_concept: z
    .string()
    .describe(
      "وصف للـ image/video المقترح: 'صورة وايد - شخص بيركّب باب WPC في فيلا حديثة، إضاءة طبيعية'",
    ),
});

export const adCreativesResponseSchema = z.object({
  creatives: z.array(adCreativeSchema).min(3).max(8),
  notes: z
    .string()
    .describe("ملاحظات للمسوّق: أي variant جرّب الأول، توقعاتك للأداء"),
});

export type AdCreative = z.infer<typeof adCreativeSchema>;
export type AdCreativesResponse = z.infer<typeof adCreativesResponseSchema>;

const AD_COPY_SYSTEM = `أنت Senior Copywriter في وكالة إعلانات أمريكية، خبرة 10 سنين في
كتابة إعلانات بالعربية المصرية اللي تبيع. عملت 1000+ حملة، عارف
بالظبط ايه يخلي الإعلان يتسكان عليه vs يتسكب.

قواعدك:
1. **Hook قوي** — أول جملة من الإعلان لازم تخلي الواحد يقف. سؤال،
   ادعاء جريء، رقم محدد، أو موقف يتماهى معاه.
2. **Benefit not Feature** — متقولش "WPC مقاوم للماء". قول "خشب
   حمامك ميتدمرش بعد ٦ شهور".
3. **القيود من المنصة**:
   - Meta: headline ≤ 40 حرف، primary text ≤ 125 حرف
   - Google Search: headline 30 حرف × 3، description 90 × 2
   - TikTok: caption قصير + hook قوي للفيديو
4. **CTA واضح** — مش 'تواصل معنا' فقط. 'كلمنا واتساب لطلب الكتالوج'.
5. **3-8 variants** — متشابهة في الـ benefit لكن مختلفة في:
   - Hook (سؤال / موقف / رقم / تحدي)
   - الـ format (image / carousel / video / story)
   - الـ tone (رسمي / غير رسمي / تحدي / استفهام)
6. **مصري طبيعي** — مفيش "إذن" و "حيث" و "حينما". قول "يعني" و "علشان"
   و "لما".
7. **الـ creative_concept** — صورة اللي هيتم تصميمها أو السيناريو
   لو فيديو. حدد بدقة: مين في الكادر، ايه الفعل، ايه الإضاءة، ايه
   الخلفية.`;

export async function generateAdCopy(input: {
  product_summary: string;
  persona?: Persona | null;
  platforms: ("meta" | "google" | "tiktok" | "instagram")[];
  goal: string; // awareness / leads / sales / etc.
  count?: number;
}): Promise<AdCreativesResponse> {
  const picked = pickAgentModel();
  const personaStr = input.persona
    ? `\n\n**الـ Persona المستهدف:**\n${JSON.stringify(input.persona, null, 0)}`
    : "";
  const userPrompt = `**المنتج:** ${input.product_summary}
**الهدف:** ${input.goal}
**المنصات:** ${input.platforms.join(", ")}
**عدد الإعلانات المطلوبة:** ${input.count ?? 5}${personaStr}

اكتب ${input.count ?? 5} إعلانات مختلفة (variants) للمنصات المحددة.
كل إعلان: headline + body + cta + creative_concept. ركّز على التحويل.`;

  const { object } = await generateObject({
    model: picked.model,
    schema: adCreativesResponseSchema,
    system: AD_COPY_SYSTEM,
    prompt: userPrompt,
    temperature: 0.85,
  });
  return object;
}

// ----------------------------------------------------------------------------
// 4) SEO MASTER — keyword research + content strategy
// ----------------------------------------------------------------------------

export const keywordSchema = z.object({
  keyword: z.string().describe("الكلمة المفتاحية بالعربي (مثلاً 'ألواح pvc')"),
  intent: z.enum(["informational", "commercial", "transactional", "navigational"]),
  search_volume_estimate: z
    .number()
    .int()
    .nullable()
    .describe("تقدير حجم البحث الشهري في مصر. null لو غير معلوم"),
  difficulty_estimate: z
    .number()
    .int()
    .min(0)
    .max(100)
    .nullable()
    .describe("صعوبة الترتيب 0-100. null لو غير معلوم"),
  content_type: z.enum([
    "blog_post",
    "product_page",
    "landing_page",
    "category_page",
    "faq",
    "guide",
    "comparison",
  ]),
  suggested_title: z
    .string()
    .max(70)
    .describe("عنوان مقترح للصفحة (≤ 60 حرف للـ SEO)"),
  content_outline: z
    .string()
    .describe("مخطط مختصر: H1 + 3-5 sections رئيسية"),
  priority: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe("أولوية تنفيذ المحتوى (1=الأعلى)"),
});

export const keywordsResponseSchema = z.object({
  keywords: z.array(keywordSchema).min(10).max(25),
  quick_wins: z
    .array(z.string())
    .describe(
      "كلمات منخفضة الصعوبة وعالية النية — مكاسب سريعة في أسبوعين",
    ),
  long_term_focus: z
    .array(z.string())
    .describe(
      "كلمات صعبة لكن مهمة — هتاخد 3-6 شهور لكن عائدها كبير",
    ),
  content_strategy: z
    .string()
    .describe(
      "نصيحة استراتيجية عامة عن التركيز والإيقاع وعدد المقالات الشهرية",
    ),
});

export type KeywordRow = z.infer<typeof keywordSchema>;
export type KeywordsResponse = z.infer<typeof keywordsResponseSchema>;

const SEO_SYSTEM = `أنت Head of SEO في وكالة digital مصرية كبيرة، عملت SEO لـ 200+
شركة في القطاعات المختلفة. عارف عميق بإن المصري بيبحث ازاي،
وايه الكلمات اللي تجيب trafficبجد، وايه اللي مضيعة وقت.

قواعدك:
1. **كلمات بلهجة البحث** — لو المنتج 'ألواح PVC'، الناس بتبحث:
   'الواح pvc' (بالعربي), 'pvc panels' (بالإنجليزي), 'حوائط pvc',
   'الواح بلاستيك للحوائط'. كلهم كلمات قانونية + لازم نستهدفهم.
2. **اخلط Informational + Commercial** — في كل قائمة لازم يكون فيه
   كلمات معلوماتية (informational) + كلمات شرائية (commercial). الأولى
   تجيب جمهور، الثانية تحوّل لمبيعات.
3. **Difficulty واقعي** — كلمات كتير في السوق المصري low difficulty
   لأن المنافسة محدودة بالمحتوى العربي الجيد. متخليش الـ difficulty
   مبالغ فيها.
4. **Content Strategy** — اعتمد على الـ "Topic Cluster" approach:
   pillar page + 5-10 supporting articles.
5. **Quick Wins واضحة** — لو موجود كلمات difficulty < 30 + commercial
   intent، حطها في quick_wins. ده اللي يبدأ بيه العميل.
6. **مفيش fluff** — كل keyword لها مبرر تجاري. لو حد محتاج keyword
   لكلمة مالهاش علاقة بالمنتج، متضفهاش.`;

export async function suggestKeywords(input: {
  product_summary: string;
  industry?: string | null;
  current_url?: string | null;
}): Promise<KeywordsResponse> {
  const picked = pickAgentModel();
  const userPrompt = `**المنتج/الخدمة:** ${input.product_summary}
${input.industry ? `**الصناعة:** ${input.industry}` : ""}
${input.current_url ? `**موقع الشركة الحالي:** ${input.current_url}` : ""}

ابني SEO strategy كاملة للسوق المصري:
- 10-25 keyword strategy مرتبة بالأولوية
- Quick wins (كلمات هتجيب نتيجة في 30 يوم)
- Long-term focus (كلمات هي اللي هتاخد العميل لـ #1)
- استراتيجية محتوى عامة`;

  const { object } = await generateObject({
    model: picked.model,
    schema: keywordsResponseSchema,
    system: SEO_SYSTEM,
    prompt: userPrompt,
    temperature: 0.5,
  });
  return object;
}

// ----------------------------------------------------------------------------
// 5) CAMPAIGN STRATEGY — orchestrates personas + ads + budget
// ----------------------------------------------------------------------------

export const campaignStrategySchema = z.object({
  campaign_name: z.string().describe("اسم الحملة بالعربي"),
  recommended_goal: z.enum([
    "awareness",
    "engagement",
    "leads",
    "sales",
    "traffic",
    "messages",
  ]),
  budget_allocation: z.array(
    z.object({
      platform: z.string(),
      percentage: z.number().min(0).max(100),
      rationale: z.string(),
    }),
  ),
  daily_budget_recommendation: z.object({
    minimum_to_learn: z
      .number()
      .describe("الحد الأدنى ليوم واحد عشان الـ algorithm يفهم (EGP)"),
    recommended_daily: z.number().describe("الميزانية اليومية المقترحة (EGP)"),
    ideal_test_period_days: z
      .number()
      .int()
      .describe("عدد أيام الـ test phase قبل التقييم"),
  }),
  phases: z.array(
    z.object({
      phase_name: z.string(),
      duration_days: z.number().int(),
      goal: z.string(),
      tactics: z.array(z.string()),
      kpis: z.array(z.string()),
    }),
  ),
  expected_outcomes: z.object({
    impressions_range: z.string(),
    clicks_range: z.string(),
    leads_or_sales_range: z.string(),
    expected_cpa_egp: z.string().describe("Cost Per Action (EGP) المتوقع"),
  }),
  risks_to_watch: z.array(z.string()),
  next_steps: z.array(z.string()),
});

export type CampaignStrategy = z.infer<typeof campaignStrategySchema>;

const CAMPAIGN_SYSTEM = `أنت Performance Marketing Director في وكالة كبيرة، 10 سنين خبرة
في تحويل ميزانيات الإعلانات لمبيعات حقيقية. متخصص في السوق المصري
وعارف معدلات الـ CPC والـ CPA الفعلية في كل صناعة.

قواعدك:
1. **Budget Allocation منطقي** — لو المنتج commerce وعنده visual
   appeal، Meta + Instagram أول. لو B2B / SaaS، LinkedIn + Google.
2. **Test Phase أولاً** — أول 7-14 يوم 30% من الميزانية لـ testing
   creatives. الباقي للـ scale بعد ما نعرف اللي شغّال.
3. **Daily Budget Realistic** — في مصر:
   - Meta: 100-200 EGP/يوم لـ small test, 500-1500 EGP/يوم للـ scale
   - Google: 150-300 EGP/يوم small, 600-2000 للـ scale
   - TikTok: 200 EGP/يوم minimum (الـ algorithm محتاج بيانات أكتر)
4. **Phases مرحلية** — Awareness → Engagement → Conversion. متبدأش
   بـ direct sales لـ audience cold.
5. **CPA توقعات صادقة** — لو المنتج بـ 5000 EGP في صناعة مكتظة،
   CPA متوقع 200-500 EGP/lead. متبيعش وهم بـ 50 EGP/lead.`;

export async function generateCampaignStrategy(input: {
  product_summary: string;
  goal: string;
  total_budget: number;
  duration_days: number;
  personas?: Persona[];
  platforms?: string[];
}): Promise<CampaignStrategy> {
  const picked = pickAgentModel();
  const personasStr = input.personas?.length
    ? `\n\n**الـ Personas:**\n${JSON.stringify(input.personas, null, 0)}`
    : "";
  const userPrompt = `**المنتج/الخدمة:** ${input.product_summary}
**الهدف:** ${input.goal}
**الميزانية الإجمالية:** ${input.total_budget} EGP
**المدة:** ${input.duration_days} يوم
${input.platforms?.length ? `**منصات يفضّلها العميل:** ${input.platforms.join(", ")}` : ""}${personasStr}

ابني استراتيجية حملة كاملة:
- توزيع الميزانية بين المنصات
- الميزانية اليومية المقترحة + فترة الـ test
- المراحل (Test → Scale → Optimize)
- التوقعات الواقعية + المخاطر
- Next steps`;

  const { object } = await generateObject({
    model: picked.model,
    schema: campaignStrategySchema,
    system: CAMPAIGN_SYSTEM,
    prompt: userPrompt,
    temperature: 0.5,
  });
  return object;
}
