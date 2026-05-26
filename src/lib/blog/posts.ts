// ============================================================================
// Blog posts registry — single source of truth for /blog metadata
// ============================================================================
//
// Each post is authored as a TSX file in src/content/blog/{slug}.tsx (richer
// than MDX for our use case — we need interactive comparison tables and
// calculators, not just markdown). Metadata lives here so:
//   • /blog index page can list posts without importing every content file
//   • sitemap.ts can build URLs without dynamic imports at build time
//   • OpenGraph + JSON-LD have a typed source of truth
//
// To add a new post:
//   1. Add an entry to POSTS below (slug + metadata)
//   2. Create src/content/blog/{slug}.tsx exporting a default PostContent
//   3. That's it. sitemap.ts + /blog index pick it up automatically.

export type BlogPost = {
  slug: string;
  // SEO meta — title is what appears in <title>, displayed at top of post
  title: string;
  // Plain-text description for <meta name="description"> + OG. Keep < 160 chars.
  description: string;
  // Used in <h1> on the post. Often same as title without the brand suffix.
  heading: string;
  // Short blurb shown on /blog index cards
  excerpt: string;
  // Primary keyword the post targets (for analytics + audit)
  keyword: string;
  // ISO date string — used for <time> + datePublished schema
  publishedAt: string;
  // ISO date string — bump when content gets revised, signals Google freshness
  updatedAt: string;
  // Estimated read time in minutes (for the index card)
  readMinutes: number;
  // Author — for E-E-A-T signals + JSON-LD
  author: string;
  // Tag chips for the index page filter UI (informal — not strict taxonomy)
  tags: string[];
  // Optional cover image path under /public. Falls back to a brand gradient.
  cover?: string;
};

// ── Posts (newest first — order here controls /blog index order) ────────────
export const POSTS: BlogPost[] = [
  {
    slug: "labor-law-12-2003-egypt-explained",
    title: "قانون العمل المصري 12/2003 — شرح أهم 10 مواد للـ HR",
    heading: "قانون العمل 12/2003 — أهم 10 مواد",
    description:
      "شرح مبسّط لأهم 10 مواد من قانون العمل المصري 12/2003 — العقد، الإجازات، الجزاءات، الفصل، الأوفر تايم، مكافأة نهاية الخدمة + عقوبات المخالفة.",
    excerpt:
      "كل HR في مصر لازم يعرف الـ 10 مواد دي. كل خطأ في تطبيقها بيكلّفك من 5,000 لـ 100,000 جنيه في قضية أو غرامة.",
    keyword: "قانون العمل المصري 12/2003",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 7,
    author: "فريق نِظام HR",
    tags: ["قانون العمل", "أساسيات HR", "قانوني"],
  },
  {
    slug: "overtime-calculation-egypt",
    title: "حساب الأوفر تايم في مصر — النسب القانونية + أمثلة عملية",
    heading: "حساب الأوفر تايم بالنسب القانونية الصحيحة",
    description:
      "النسب القانونية للأوفر تايم: +35% نهاري، +70% ليلي، +100% أيام الراحة. حساب أجر الساعة + سيناريوهات معقدة + الجانب الضريبي.",
    excerpt:
      "تطبيق نسبة موحّدة 1.5x لكل أوفر تايم = خطأ قانوني. القانون 12/2003 المادة 85 بيحدد 3 نسب مختلفة حسب التوقيت.",
    keyword: "حساب الأوفر تايم",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 8,
    author: "فريق نِظام HR",
    tags: ["قانون العمل", "أوفر تايم", "حسابات HR"],
  },
  {
    slug: "annual-leave-egypt-labor-law",
    title: "الإجازات في قانون العمل المصري — الأنواع الست بالتفصيل",
    heading: "الإجازات في قانون العمل المصري 12/2003",
    description:
      "كل أنواع الإجازات في قانون العمل المصري: السنوية، المرضية، الأمومة، الحج، العارضة، رعاية المولود — مع المدد والشروط.",
    excerpt:
      "6 أنواع إجازات + 14 يوم عطلات رسمية. كل نوع له شروطه ومدته. توثيق الإجازات إلكترونياً ضروري لتجنّب القضايا.",
    keyword: "الإجازة السنوية قانون العمل",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 9,
    author: "فريق نِظام HR",
    tags: ["قانون العمل", "إجازات", "حقوق الموظف"],
  },
  {
    slug: "legal-termination-article-69-egypt",
    title: "الفصل المشروع في قانون العمل — المادة 69 + الفصل التعسفي",
    heading: "المادة 69 — متى يكون الفصل مشروعاً",
    description:
      "الـ 7 حالات للفصل بدون مكافأة + الإجراءات القانونية الصحيحة + عقوبة الفصل التعسفي + بدائل الفصل + أمثلة من محاكم النقض.",
    excerpt:
      "أي فصل خارج الـ 7 حالات للمادة 69 = فصل تعسفي بيكلّف 2-3 أضعاف مكافأة نهاية الخدمة. الإجراءات الصحيحة بتحمي الشركة.",
    keyword: "الفصل المشروع المادة 69",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 10,
    author: "فريق نِظام HR",
    tags: ["قانون العمل", "فصل الموظف", "قانوني"],
  },
  {
    slug: "income-tax-egypt-2026-explained",
    title: "ضريبة كسب العمل في مصر 2026 — الشرايح المتدرجة بالتفصيل",
    heading: "ضريبة كسب العمل 2026 — كل ما تحتاج معرفته",
    description:
      "شرح كامل لشرايح ضريبة كسب العمل في مصر 2026 (Law 175/2023): الإعفاء الشخصي 20,000، الشرايح المتدرجة من 0% لـ 27.5%، أمثلة عملية.",
    excerpt:
      "أول 60,000 جنيه/سنة معفاة بالكامل (20,000 إعفاء + 40,000 شريحة 0%). الشرايح بعد كده متدرجة من 10% لـ 27.5%.",
    keyword: "ضريبة كسب العمل في مصر 2026",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 8,
    author: "فريق نِظام HR",
    tags: ["ضرائب", "قانون مصري", "حسابات HR"],
  },
  {
    slug: "whatsapp-bot-for-employees-egypt",
    title: "بوت WhatsApp للموظفين — كيف يوفر 4 ساعات أسبوعياً للـ HR",
    heading: "بوت WhatsApp للموظفين — التوفير الفعلي للـ HR",
    description:
      "WhatsApp Bot للموظفين بيوفر 4-6 ساعات أسبوعياً للـ HR. شرح الـ 8 تدفقات الأساسية، التكاليف، الأمان، والمقارنة مع الإيميل التقليدي.",
    excerpt:
      "95% من الموظفين بيستخدموا WhatsApp يومياً. لما الـ HR يتفاعل معاهم في نفس القناة، النتيجة: 4 ساعات توفير + رضا أعلى للموظفين.",
    keyword: "بوت WhatsApp للموظفين",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 9,
    author: "فريق نِظام HR",
    tags: ["WhatsApp", "أتمتة HR", "موظفين"],
  },
  {
    slug: "gps-attendance-system-egypt",
    title: "نظام حضور وانصراف بالـ GPS — هل يصلح للشركات المصرية؟",
    heading: "حضور وانصراف بالـ GPS — الدليل الكامل",
    description:
      "نظام حضور بالـ GPS مع سيلفي للشركات المصرية: السيناريوهات، الجانب القانوني، المخاوف الشائعة، المقارنة مع البصمة، وكيفية التطبيق.",
    excerpt:
      "للسائقين، الـ field workers، الشركات متعددة الفروع — البصمة المركزية مش هتشتغل. GPS attendance هو الحل، وقانوني تماماً.",
    keyword: "نظام حضور وانصراف GPS",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 10,
    author: "فريق نِظام HR",
    tags: ["حضور وانصراف", "GPS", "تكنولوجيا HR"],
  },
  {
    slug: "e-signature-legality-egypt",
    title: "التوقيع الإلكتروني في مصر — هل قانوني؟ + كيف تستخدمه",
    heading: "التوقيع الإلكتروني في مصر — الإطار القانوني الكامل",
    description:
      "التوقيع الإلكتروني قانوني في مصر منذ 2004 (قانون 15/2004). شرح الأنواع، الاستخدامات في HR، الـ Best Practices، ودور ITIDA.",
    excerpt:
      "هل التوقيع الإلكتروني له نفس قوة التوقيع اليدوي؟ متى تحتاج شهادة ITIDA؟ وما هي الأنواع الثلاثة من التوقيع الإلكتروني؟",
    keyword: "التوقيع الإلكتروني في مصر",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 11,
    author: "فريق نِظام HR",
    tags: ["قانون", "توقيع إلكتروني", "ITIDA"],
  },
  {
    slug: "7-hr-mistakes-egyptian-companies",
    title: "7 أخطاء HR شائعة في الشركات المصرية — وكيف تتجنّبها",
    heading: "7 أخطاء HR بيقع فيها معظم الشركات المصرية",
    description:
      "7 أخطاء HR شائعة + 3 إضافية بتكلّف الشركات المصرية مئات الآلاف سنوياً: قسمة 30 vs 26، نموذج 1، توثيق الإجازات، الجزاءات، الأوفر تايم، وأكتر.",
    excerpt:
      "كل خطأ من السبعة دول ممكن يكلّفك من 5,000 لـ 100,000 جنيه في قضية أو غرامة. القائمة المرجعية لكل HR في مصر.",
    keyword: "أخطاء HR شركات مصرية",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 12,
    author: "فريق نِظام HR",
    tags: ["قانون العمل", "أخطاء شائعة", "best practices"],
  },
  {
    slug: "experience-certificate-egypt-tutorial",
    title: "ازاي تستخرج شهادة خبرة في 3 دقايق — الدليل الكامل + نموذج جاهز",
    heading: "شهادة خبرة في مصر — كل ما تحتاج معرفته",
    description:
      "الـ 7 عناصر الأساسية لشهادة خبرة مقبولة في السفارات والشركات + نموذج جاهز للتعديل + الأخطاء اللي بترفض الشهادة + الجانب القانوني.",
    excerpt:
      "شهادة خبرة بدون عنصر واحد من السبعة دول بترفض في السفارات. النموذج الجاهز + إزاي تطبعها في 3 دقايق بدل ما تكتبها يدوي.",
    keyword: "شهادة خبرة",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 8,
    author: "فريق نِظام HR",
    tags: ["نماذج رسمية", "شهادات", "قانون العمل"],
  },
  {
    slug: "excel-vs-hr-system-egypt",
    title: "Excel vs نظام HR — متى تنتقل؟ دليل المؤسس المصري",
    heading: "Excel vs نظام HR — متى تنتقل؟",
    description:
      "متى تتخلى عن Excel وتنتقل لنظام HR متخصص؟ مقارنة بالأرقام بين التكلفة الحقيقية والمخاطر القانونية + خطة انتقال في 7 أيام.",
    excerpt:
      "بنحسبلك التكلفة الحقيقية لـ Excel (مش بس صفر جنيه): الوقت، الأخطاء، المخاطر القانونية. ومتى الانتقال يبقى إجباري لشركتك.",
    keyword: "Excel vs نظام HR",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 10,
    author: "فريق نِظام HR",
    tags: ["مقارنات", "إدارة الشركات", "اختيار نظام HR"],
  },
  {
    slug: "end-of-service-calculator-egypt",
    title: "حساب نهاية الخدمة في مصر — قانون 12/2003 + 5 أمثلة عملية",
    heading: "حساب مكافأة نهاية الخدمة في مصر",
    description:
      "كل ما تحتاج معرفته عن مكافأة نهاية الخدمة في مصر: المعادلة، الشروط، 5 أمثلة عملية، الحالات الخاصة، وكيفية تجنب الأخطاء.",
    excerpt:
      "نص شهر/سنة في أول 5 سنوات، شهر/سنة بعد كده. لكن إيه يدخل في الأجر؟ ومتى يفقد الموظف المكافأة؟ شرح كامل بـ 5 أمثلة.",
    keyword: "حساب نهاية الخدمة",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 12,
    author: "فريق نِظام HR",
    tags: ["قانون العمل", "نهاية الخدمة", "حسابات HR"],
  },
  {
    slug: "social-insurance-form-1-egypt",
    title: "نموذج 1 تأمينات اجتماعية — الشرح الكامل + إزاي تطبعه جاهز",
    heading: "نموذج 1 تأمينات اجتماعية — الشرح الكامل",
    description:
      "شرح كامل لنموذج 1 التأمينات: الخانات، الأوراق المطلوبة، الأخطاء الشائعة، الغرامات، وإزاي تطبعه جاهز في 30 ثانية بدل 15 دقيقة.",
    excerpt:
      "كل HR محتاج يقدم نموذج 1 لكل موظف جديد خلال 7 أيام. الغرامة 100 جنيه/يوم تأخير. شرح كل خانة + الأخطاء اللي بترفض النموذج.",
    keyword: "نموذج 1 تأمينات اجتماعية",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 8,
    author: "فريق نِظام HR",
    tags: ["نماذج رسمية", "تأمينات", "قانون 148/2019"],
  },
  {
    slug: "bayzat-alternative-egypt-2026",
    title: "أفضل بديل لـ Bayzat في مصر 2026 — مقارنة شاملة",
    heading: "أفضل بديل لـ Bayzat في مصر 2026",
    description:
      "مقارنة تفصيلية بين Bayzat و ZenHR و نِظام HR للشركات المصرية: الأسعار، الميزات، التوافق مع قانون 12/2003 والتأمينات 148/2019.",
    excerpt:
      "Bayzat بنته شركة إماراتية للسوق الخليجي. لو شركتك مصرية، فيه بدائل أرخص وأكثر توافقاً مع القانون المصري. مقارنة شاملة بالأرقام.",
    keyword: "Bayzat alternative Egypt",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 9,
    author: "فريق نِظام HR",
    tags: ["مقارنات", "اختيار نظام HR", "السوق المصري"],
  },
  {
    slug: "how-to-calculate-egypt-salary-2026",
    title: "كيف تحسب مرتب موظف في مصر 2026 — دليل خطوة بخطوة",
    heading: "كيف تحسب مرتب موظف في مصر 2026",
    description:
      "دليل شامل لحساب مرتب الموظف في مصر 2026: التأمينات 11%، شرايح ضريبة الدخل الجديدة، حساب الإجمالي والصافي مع أمثلة عملية.",
    excerpt:
      "خطوات حساب صافي مرتب الموظف في مصر 2026 — من الإجمالي للصافي، مع شرايح الضريبة الجديدة وحساب التأمينات بالأرقام.",
    keyword: "ازاي احسب مرتب الموظف في مصر",
    publishedAt: "2026-05-26",
    updatedAt: "2026-05-26",
    readMinutes: 11,
    author: "فريق نِظام HR",
    tags: ["حساب المرتبات", "قانون مصري", "تأمينات وضرائب"],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
export function getPostBySlug(slug: string): BlogPost | undefined {
  return POSTS.find((p) => p.slug === slug);
}

export function getAllSlugs(): string[] {
  return POSTS.map((p) => p.slug);
}

// ── Content loader ──────────────────────────────────────────────────────────
//
// Webpack/Turbopack can struggle with fully-dynamic import paths
// (`import(\`@/content/blog/${slug}\`)`). Using a static map of `() =>
// import(...)` thunks keeps the call site clean while letting the bundler
// see every possible target — each post still ships as a separate chunk
// (loaded only when that route renders), so we don't sacrifice tree-shaking.
//
// To add a post: register it in POSTS above, create the TSX file, then
// add one line here.
export const POST_CONTENT_LOADERS: Record<
  string,
  () => Promise<{ default: React.ComponentType }>
> = {
  "bayzat-alternative-egypt-2026": () =>
    import("@/content/blog/bayzat-alternative-egypt-2026"),
  "how-to-calculate-egypt-salary-2026": () =>
    import("@/content/blog/how-to-calculate-egypt-salary-2026"),
  "social-insurance-form-1-egypt": () =>
    import("@/content/blog/social-insurance-form-1-egypt"),
  "end-of-service-calculator-egypt": () =>
    import("@/content/blog/end-of-service-calculator-egypt"),
  "excel-vs-hr-system-egypt": () =>
    import("@/content/blog/excel-vs-hr-system-egypt"),
  "whatsapp-bot-for-employees-egypt": () =>
    import("@/content/blog/whatsapp-bot-for-employees-egypt"),
  "gps-attendance-system-egypt": () =>
    import("@/content/blog/gps-attendance-system-egypt"),
  "e-signature-legality-egypt": () =>
    import("@/content/blog/e-signature-legality-egypt"),
  "7-hr-mistakes-egyptian-companies": () =>
    import("@/content/blog/7-hr-mistakes-egyptian-companies"),
  "experience-certificate-egypt-tutorial": () =>
    import("@/content/blog/experience-certificate-egypt-tutorial"),
  "labor-law-12-2003-egypt-explained": () =>
    import("@/content/blog/labor-law-12-2003-egypt-explained"),
  "overtime-calculation-egypt": () =>
    import("@/content/blog/overtime-calculation-egypt"),
  "annual-leave-egypt-labor-law": () =>
    import("@/content/blog/annual-leave-egypt-labor-law"),
  "legal-termination-article-69-egypt": () =>
    import("@/content/blog/legal-termination-article-69-egypt"),
  "income-tax-egypt-2026-explained": () =>
    import("@/content/blog/income-tax-egypt-2026-explained"),
};
