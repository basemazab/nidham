// ============================================================================
// Help Center content — articles + categories
// ============================================================================
//
// All articles live in code (not a DB table) for three reasons:
//   1. They ship with the deploy — no separate "publish" step
//   2. They're version-controlled so we can audit changes
//   3. No additional Supabase round-trip on the help page
//
// Each article has Markdown-lite body (newlines preserved, ##-headers,
// **bold**, links). The renderer in /dashboard/help/[slug]/page.tsx
// handles minimal markdown without dragging in a full library.

export type HelpCategory = {
  slug: string;
  title: string;
  icon: string;
  description: string;
  color: "cyan" | "amber" | "emerald" | "violet" | "rose" | "blue" | "slate";
};

export type HelpArticle = {
  slug: string;
  category: string;
  title: string;
  excerpt: string;       // 1-2 sentence summary shown in lists
  body: string;          // markdown-lite full content
  tags: string[];
  estimatedReadMin: number;
  relatedSlugs?: string[];
  lastUpdated: string;   // ISO date
};

export const HELP_CATEGORIES: HelpCategory[] = [
  {
    slug: "getting-started",
    title: "البداية السريعة",
    icon: "🚀",
    description: "أول 30 دقيقة في النظام — من التسجيل لأول راتب",
    color: "cyan",
  },
  {
    slug: "employees",
    title: "إدارة الموظفين",
    icon: "👥",
    description: "إضافة، استيراد، وتعديل بيانات الموظفين",
    color: "blue",
  },
  {
    slug: "attendance",
    title: "الحضور والانصراف",
    icon: "⏰",
    description: "GPS، يدوي، البصمة، الورديات، وتقارير الحضور",
    color: "amber",
  },
  {
    slug: "payroll",
    title: "الرواتب",
    icon: "💰",
    description: "تأمينات، ضرائب، قسائم، وإقفال الفترة",
    color: "emerald",
  },
  {
    slug: "requests",
    title: "طلبات الموظفين",
    icon: "📨",
    description: "إجازات، سلف، استئذانات، والموافقات",
    color: "violet",
  },
  {
    slug: "crm",
    title: "إدارة العملاء (CRM)",
    icon: "💼",
    description: "Pipeline، التفاعلات، والعقود",
    color: "blue",
  },
  {
    slug: "marketing",
    title: "استوديو التسويق",
    icon: "✦",
    description: "AI tools + Landing Pages + Leads + Meta integration",
    color: "rose",
  },
  {
    slug: "ai",
    title: "أدوات الـ AI",
    icon: "🤖",
    description: "المساعد الذكي، فحص CVs، استيراد PDF",
    color: "violet",
  },
  {
    slug: "mobile",
    title: "تطبيق الموبايل",
    icon: "📱",
    description: "تركيب، تسجيل دخول الموظفين، وحل المشاكل",
    color: "cyan",
  },
  {
    slug: "law",
    title: "قانون العمل المصري",
    icon: "⚖",
    description: "12/2003، 148/2019، الضرائب، والامتثال",
    color: "slate",
  },
  {
    slug: "troubleshooting",
    title: "حل المشاكل",
    icon: "🔧",
    description: "أخطاء شائعة + كيفية إصلاحها",
    color: "amber",
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  // ==========================================================================
  // Getting Started
  // ==========================================================================
  {
    slug: "first-30-minutes",
    category: "getting-started",
    title: "أول 30 دقيقة في Nidham",
    excerpt:
      "خطوة بخطوة من تسجيل الشركة لحد ما الموظف الأول يثبّت حضوره من الموبايل.",
    body: `## ١. سجّل الشركة (٣٠ ثانية)
روح **nidhamhr.com/signup** → ادخل:
- اسمك الكامل
- إيميل (هيبقى صاحب الحساب الـ admin)
- كلمة سر
- اسم الشركة + الصناعة

النظام بيدّيك **١٤ يوم تجربة مجانية** بكل الـ features، بدون كارت ائتمان.

## ٢. عيّن موقع المكتب (دقيقة)
لو هتستخدم GPS check-in، لازم تحدد إحداثيات المكتب:
**Dashboard → Settings → موقع المكتب**

- اكتب العنوان أو ضغط على الخريطة
- حدد نصف القطر (افتراضي ١٠٠ متر)
- احفظ

## ٣. أضف موظفيك (٥-٢٠ دقيقة حسب العدد)
عندك ٣ طرق:

**أ) ضيف واحد واحد** — للشركات الصغيرة (≤١٠ موظفين)
Dashboard → الموظفين → **+ موظف جديد**

**ب) رفع Excel** — للشركات المتوسطة
Dashboard → الموظفين → **استيراد** → اختر CSV/Excel
لازم الـ columns تكون: \`اسم\`, \`موبايل\`, \`قومي\`, \`مرتب\`...
حمّل الـ template من الصفحة عشان تكون متأكد.

**ج) رفع PDF بالـ AI** — لو عندك جدول مطبوع
Dashboard → الموظفين → استيراد → **رفع PDF**
الـ AI بيقرا الـ PDF ويستخرج صفوف، تراجعهم وتأكد قبل الحفظ.

## ٤. شارك كود QR مع كل موظف
في صفحة كل موظف فيه زرار **"إنشاء كود دعوة"**.
الـ QR ده الموظف بيمسحه بكاميرا تليفونه → التطبيق بيفتح ويسجّله تلقائياً.

تطبيق Nidham للموظفين متاح في:
- Android: Play Store
- iPhone: App Store
- أو لـ test: استخدم **Expo Go** (راجع الـ doc بتاع المحمول)

## ٥. اعمل أول Payroll period
**Dashboard → الرواتب → + فترة جديدة**

- اختار الشهر
- النظام بيختار تلقائياً الموظفين شهري
- يحسب التأمينات (١٤٪ من المرتب لحد سقف)
- يحسب الضرائب (٦ شرائح، مطبّقة بالقانون الجديد)
- يخصم السلف الموافق عليها

**اضغط "حفظ + إقفال"** → النظام يطبع قسيمة لكل موظف.`,
    tags: ["onboarding", "تسجيل", "بداية"],
    estimatedReadMin: 5,
    relatedSlugs: [
      "add-employees",
      "office-gps-location",
      "first-payroll",
      "mobile-app-setup",
    ],
    lastUpdated: "2026-05-17",
  },

  // ==========================================================================
  // Employees
  // ==========================================================================
  {
    slug: "add-employees",
    category: "employees",
    title: "إضافة الموظفين — ٣ طرق",
    excerpt: "Excel، PDF بالـ AI، أو يدوي واحد واحد.",
    body: `## الطريقة ١: واحد واحد (Manual)
**Dashboard → الموظفين → + موظف جديد**

الحقول المطلوبة:
- **اسم بالكامل** (لازم)
- **رقم قومي** (لازم — ١٤ خانة، النظام بيتأكد من validity)
- **موبايل** (لازم — للـ invitation QR)
- **مرتب أساسي** (لازم — للحسابات)
- **تاريخ التعيين** (للإجازات + EOS)
- **القسم + المسمى الوظيفي** (اختياري)
- **بنك + IBAN** (للـ payroll export)

الحقول الاختيارية:
- إيميل (للإشعارات)
- نوع العقد (دائم/مؤقت)
- نظام العمل (شهري/أسبوعي)
- الورديات + الـ shift_id

## الطريقة ٢: Excel/CSV
**Dashboard → الموظفين → استيراد → CSV**

١. حمّل الـ **template** من الصفحة
٢. عبّى الصفوف
٣. ارفع الملف
٤. النظام يعرض preview قبل الحفظ — راجع وأكّد

### الـ columns في الـ template:
| العمود | لازم؟ | مثال |
|---|---|---|
| full_name | ✅ | أحمد محمد علي |
| national_id | ✅ | 28501012345678 |
| phone | ✅ | 01001234567 |
| base_salary | ✅ | 5000 |
| hire_date | ✅ | 2024-03-15 |
| department | ❌ | المبيعات |
| job_title | ❌ | مدير مبيعات |
| email | ❌ | a.mohamed@... |

## الطريقة ٣: PDF بالـ AI
**Dashboard → الموظفين → استيراد → PDF**

لو عندك ملف PDF فيه جدول موظفين (من نظام HR قديم، شيت مطبوع، الخ)، الـ AI بيقرا:
- يستخرج كل صف
- يـ map للأعمدة الصح
- يعرض الـ preview للمراجعة

⚠ **مهم:** اللي الـ AI بيستخرجه مش 100% دقيق. لازم تراجع الـ preview قبل ما تحفظ.`,
    tags: ["employees", "import", "Excel", "PDF"],
    estimatedReadMin: 3,
    relatedSlugs: ["first-30-minutes", "employee-invitation-qr"],
    lastUpdated: "2026-05-17",
  },

  {
    slug: "employee-invitation-qr",
    category: "employees",
    title: "كود الدعوة QR للموظف",
    excerpt: "إزاي تسلّم الموظف وصول للتطبيق في ٣٠ ثانية.",
    body: `## الفكرة
بدل ما الموظف ينزّل التطبيق ويعمل حساب يدوي ويحفظ كلمة سر، إنت بتعمل له:
1. **كود QR فريد** من صفحته في الـ dashboard
2. الموظف يمسح الكود بكاميرا تليفونه
3. التطبيق يفتح، يطلب كلمة سر بس
4. خلاص — مربوط بشركتك وبسجّل حضور

## الخطوات
**Dashboard → الموظفين → اضغط على الموظف → "إنشاء كود دعوة"**

هيظهرلك QR + رابط. تقدر:
- ✅ تطبع الـ QR وتحطه على المكتب
- ✅ تبعت screenshot عبر واتساب
- ✅ تبعت الـ link مباشرة (المسح من كاميرا يفتح التطبيق)

## الموظف بيعمل إيه؟
1. ينزّل **تطبيق Nidham** (لو ما نزّلهوش قبل كده)
2. يفتح التطبيق → يضغط **"كود دعوة"**
3. يمسح الـ QR من تليفونه
4. يضع كلمة سر جديدة
5. خلاص ✅

## الكود ساري لكام يوم؟
**٣٠ يوم** من تاريخ الإنشاء. لو خلصت المدة، اعمل كود جديد.

## الموظف ضاع منه التطبيق؟
ارجع لصفحته في الـ dashboard → **"إنشاء كود جديد"**. هيلغي القديم تلقائياً.`,
    tags: ["mobile", "QR", "invitation"],
    estimatedReadMin: 2,
    relatedSlugs: ["mobile-app-setup"],
    lastUpdated: "2026-05-17",
  },

  // ==========================================================================
  // Attendance
  // ==========================================================================
  {
    slug: "office-gps-location",
    category: "attendance",
    title: "تعيين موقع المكتب بالـ GPS",
    excerpt: "إزاي تضبط geofence ٣٠-٢٠٠ متر حول مكتبك.",
    body: `## ليه الـ GPS مهم؟
لما الموظف يحاول يثبّت حضور من التطبيق، النظام بيتأكد إنه فعلاً جوه نطاق المكتب — مش من البيت ولا من قهوة.

## الخطوات
**Dashboard → Settings → موقع المكتب**

١. اكتب عنوان المكتب أو اضغط على المكان في الخريطة
٢. اضبط **نصف القطر (radius)**:
   - **٥٠ متر** — مكتب صغير في عمارة
   - **١٠٠ متر** — افتراضي، يغطي مكتب + parking
   - **٢٠٠ متر** — مصنع كبير
   - **٥٠٠ متر** — منطقة صناعية
٣. احفظ

## الموظف خارج النطاق؟
لو حاول يثبّت حضور وهو بعيد:
- التطبيق هيظهر **"إنت خارج نطاق المكتب"**
- مش هيقدر يسجّل
- في الـ dashboard هتشوف محاولته (للأمان)

## استثناءات
لو عندك موظف بيشتغل من البيت أو في الـ field:
- روح صفحته → علّم **"GPS غير مطلوب"**
- يقدر يثبّت من أي مكان

## مفيش GPS؟
لو الـ Wi-Fi مش بيدّي إحداثيات دقيقة (عمارات عالية في الدور التحت، الخ):
- ممكن تستخدم **رفع يدوي** من الـ HR في الـ Dashboard
- أو **استيراد من بصمة ZKTeco** لو عندك جهاز`,
    tags: ["attendance", "GPS", "geofence"],
    estimatedReadMin: 3,
    relatedSlugs: ["zkteco-import"],
    lastUpdated: "2026-05-17",
  },

  {
    slug: "zkteco-import",
    category: "attendance",
    title: "استيراد الحضور من جهاز البصمة (ZKTeco)",
    excerpt: "خلي الـ HR ترفع ملف من جهاز البصمة كل أسبوع/شهر.",
    body: `## المنطق
لو عندك جهاز بصمة ZKTeco أو مشابه، الموظف بيبصم. الجهاز يحفظ السجلات. كل أسبوع/شهر، الـ HR بـ:

1. تنزّل ملف من الجهاز (XLS/TXT)
2. ترفعه على Nidham
3. النظام يـ match الـ employee_id من الملف مع كود الموظف في الـ DB
4. يحسب ساعات العمل + التأخير + الإجازات

## الخطوات
**Dashboard → الحضور → استيراد**

١. اختار الـ tab **"بصمة"**
٢. ارفع الملف
٣. النظام يعرض preview:
   - عدد السجلات
   - الموظفين الـ matched
   - الـ unmatched (عشان تتأكد ليه)
٤. أكّد الحفظ

## كود الموظف في الجهاز ≠ في Nidham؟
كل موظف عنده **"كود البصمة"** field في الـ profile.
لازم تتأكد إنه نفس الكود الموجود في جهاز ZKTeco.

**Dashboard → الموظفين → اختر الموظف → كود الموظف (لربط البصمة)**

## أجهزة مدعومة
- ZKTeco (كل الموديلات اللي بتدّي XLS export)
- TimeWell
- Suprema (بفلتر يدوي للأعمدة)
- أي جهاز بيدّي CSV/XLS فيه: \`employee_id\`, \`date\`, \`time_in\`, \`time_out\``,
    tags: ["attendance", "biometric", "ZKTeco"],
    estimatedReadMin: 4,
    relatedSlugs: ["office-gps-location"],
    lastUpdated: "2026-05-17",
  },

  // ==========================================================================
  // Payroll
  // ==========================================================================
  {
    slug: "first-payroll",
    category: "payroll",
    title: "أول راتب — خطوة بخطوة",
    excerpt: "من إنشاء الفترة لطباعة القسائم.",
    body: `## الخطوة ١: أنشئ فترة جديدة
**Dashboard → الرواتب → + فترة جديدة**

- **الشهر:** اختار (مثلاً مايو 2026)
- **نوع الفترة:** شهري / أسبوعي (افتراضي شهري)

النظام تلقائياً بيـ pull كل الموظفين النشطين في الفترة دي.

## الخطوة ٢: راجع الإدخالات
في الفترة هتلاقي صف لكل موظف فيه:

| الحقل | المصدر |
|---|---|
| المرتب الأساسي | من ملف الموظف |
| بدلات | يدوي إن وجد |
| أيام الحضور | تلقائي من سجل الحضور |
| ساعات إضافي | تلقائي |
| التأمينات | محسوبة آلياً (١٤٪ بحد سقف الـ ١٠،٩٠٠) |
| الضريبة | محسوبة آلياً (٦ شرائح) |
| السلف المخصومة | من طلبات السلف الموافق عليها |
| **الصافي** | المحصلة |

## الخطوة ٣: عدّل لو لزم
في عمود "تعديل" تقدر تضيف:
- مكافأة استثنائية
- خصم تأخير زيادة
- بدل سفر
- ملاحظات

## الخطوة ٤: إقفال الفترة
لما تكون راضي → **"إقفال الفترة + اعتماد"**
النظام يـ:
- يجمد الأرقام (مفيش تعديل بعد كده)
- يحوّل السلف لـ "مدفوعة"
- يخصم من رصيد الإجازات
- يجهّز القسائم للطبع

## الخطوة ٥: اطبع القسائم
**زرار "🧾 طباعة كل القسائم"** يطبع للكل دفعة واحدة (A4، فاصل بين كل قسيمة).

أو افتح موظف واطبع لقسيمته الفردية.

## Export بنكي
**زرار "Export Bank Transfer"** يدّيك ملف CSV/XLS فيه:
- اسم الموظف
- رقم البنك
- IBAN
- المبلغ الصافي

ترفعه على الـ portal بتاع بنكك → خلاص ✅`,
    tags: ["payroll", "رواتب", "قسائم"],
    estimatedReadMin: 5,
    relatedSlugs: ["payroll-empty", "egyptian-tax-brackets"],
    lastUpdated: "2026-05-17",
  },

  {
    slug: "payroll-empty",
    category: "payroll",
    title: "الفترة فاضية — مفيش موظفين",
    excerpt: "ليه ممكن الفترة تطلع بدون موظفين وإزاي تحلها.",
    body: `## السبب الشائع
الـ field "pay_frequency" في ملف الموظف لازم يكون = **"monthly"** أو **"weekly"** عشان يـ match مع نوع الفترة.

في موظفين قدامى ممكن يكون الـ field فاضي (NULL). النظام ما بيدخلهمش.

## الحل السريع
لو شفت رسالة **"الفترة فاضية"** + معاها زرار أخضر كبير **"إنشاء الإدخالات + تعميد التكرار"**:

١. اضغط الزرار → النظام يـ:
   - يـ default الموظفين فاضيين الـ pay_frequency لـ "monthly"
   - يضيفهم للفترة
   - يحسب الرواتب فوراً

٢. لو لسه الفترة فاضية بعد كده → في موظف غير نشط (status=inactive) أو معندوش مرتب أساسي.

## الحل التفصيلي
**Dashboard → الموظفين → افتح موظف فاضي → نوع الراتب**
عيّنه **"شهري"** أو **"أسبوعي"**

كرر لكل موظف → ارجع لصفحة الفترة → **"إعادة إنشاء"**`,
    tags: ["payroll", "troubleshooting"],
    estimatedReadMin: 2,
    relatedSlugs: ["first-payroll"],
    lastUpdated: "2026-05-17",
  },

  // ==========================================================================
  // Marketing
  // ==========================================================================
  {
    slug: "marketing-studio-overview",
    category: "marketing",
    title: "استوديو التسويق — نظرة عامة",
    excerpt: "6 AI tools + Landing Pages + Leads + Analytics + Meta integration.",
    body: `## ايه هو استوديو التسويق؟
**استوديو التسويق** هو وكالة تسويق رقمي كاملة جواه Nidham. متاح للنسخة **Enterprise** بس.

بدل ما تدفع وكالة 10,000-50,000 ج/شهر، الـ AI بيعمل لك:
- تحليل المنتج وتحديد القنوات المناسبة
- بناء personas للجمهور المستهدف
- كتابة إعلانات لـ Meta + Google + TikTok
- استراتيجية SEO + keywords
- خطة حملة كاملة بميزانية + KPIs
- تشخيص مشاكل صفحتك قبل ما تصرف على إعلانات

## الـ Pipeline التشغيلي
الـ AI يعمل المحتوى، لكن إزاي بتجيب الـ leads فعلاً؟

١. **Landing Page** — بتعمل صفحة هبوط بدقايق
٢. **Lead Capture** — كل lead بيدخل CRM تلقائياً مع مصدره
٣. **Pipeline Kanban** — بتحرك الـ leads بين الحالات (جديد → عميل)
٤. **Analytics** — بتعرف أي حملة بتجيب ROI أفضل

## ابدأ من فين؟
1. **انشئ مشروع تسويق** — Dashboard → استوديو التسويق → + مشروع جديد
2. **اكتب وصف المنتج** بالتفصيل (30 حرف على الأقل)
3. **شغّل تحليل AI** — بيدّيك USP + Positioning + قنوات
4. **اعمل Landing Page** — Dashboard → استوديو التسويق → صفحات الهبوط
5. **استخدم الـ link في إعلاناتك** — أي lead يدخل الـ Inbox

## أحجام مجانية
- Groq gpt-oss-120b: ~30,000 request/يوم
- Groq gpt-oss-20b: ~100,000 request/يوم
- Gemini Flash Lite: 1,500/يوم
- النظام يـ fallback تلقائياً بين الـ 3`,
    tags: ["marketing", "AI", "studio"],
    estimatedReadMin: 4,
    relatedSlugs: [
      "create-landing-page",
      "meta-lead-ads-setup",
      "leads-pipeline",
    ],
    lastUpdated: "2026-05-17",
  },

  {
    slug: "create-landing-page",
    category: "marketing",
    title: "اعمل أول Landing Page",
    excerpt: "صفحة هبوط احترافية في ٥ دقايق — قابلة للنشر في إعلاناتك فوراً.",
    body: `## الخطوات
**Dashboard → استوديو التسويق → صفحات الهبوط → + صفحة جديدة**

### الحقول
| الحقل | الوصف |
|---|---|
| اسم الصفحة | داخلي — للـ admin بس (مثلاً "PVC Summer 2026") |
| نوع الصفحة | Generic / Lead Magnet / Product / Service / Event |
| العنوان الرئيسي | الكلام الكبير اللي العميل يشوفه (٥+ حروف) |
| وصف فرعي | تحت العنوان مباشرة |
| الوصف التفصيلي | فقرات عن المنتج |
| CTA Label | كلام الزرار (مثلاً "كلّمنا واتساب") |
| CTA Action | WhatsApp / Phone / External Link / Form |
| CTA Target | الرقم أو الـ URL حسب الـ action |
| الحقول المطلوبة | name / phone / whatsapp / email / city... |
| اللون الأساسي | hex (مثلاً #0891B2) |

### النتيجة
هتاخد **رابط عام** زي:
\`https://nidhamhr.com/p/abc123-pvc-summer\`

### النشر في إعلاناتك
انسخ الـ link → حطه في:
- Facebook Ad → "اعرف المزيد" link
- Bio على Instagram
- Description على TikTok
- WhatsApp broadcast

## UTM Tracking
عشان تعرف فين بالظبط الـ lead جه من، ضيف parameters:

\`\`\`
/p/abc123-pvc-summer?utm_source=facebook&utm_campaign=summer-2026
\`\`\`

كل lead بيدخل الـ CRM هيكون عنده الـ source + campaign محفوظين.

## التتبع
في صفحة الـ Landing Page تشوف:
- 👁 **عدد المشاهدات**
- 💬 **كم ضغط واتساب**
- 📞 **كم ضغط التليفون**
- 🎯 **كم سيب بياناته** (form submits)
- **CVR%** (نسبة التحويل)`,
    tags: ["landing", "marketing"],
    estimatedReadMin: 4,
    relatedSlugs: [
      "marketing-studio-overview",
      "leads-pipeline",
      "meta-lead-ads-setup",
    ],
    lastUpdated: "2026-05-17",
  },

  {
    slug: "leads-pipeline",
    category: "marketing",
    title: "Pipeline Kanban — متابعة الـ leads",
    excerpt: "اسحب الـ leads بين 6 مراحل بـ drag-and-drop.",
    body: `## المراحل
| المرحلة | المعنى |
|---|---|
| 🆕 جديد | بيانات جت لتوها، محدش كلمه |
| 📞 اتواصل | حد كلّمه (مكالمة/واتساب/إيميل) |
| 🎯 مهتم | رد + مهتم — في النقاش |
| 🏆 عميل | اتحوّل لعميل (وقّع) |
| ❌ ضايع | مش مهتم / اختار منافس |
| 💤 خامد | مش رد لفترة طويلة |

## إزاي تستخدمه؟
**Dashboard → Leads Inbox → Pipeline View**

- اسحب الكارت من عمود لعمود → الحالة تتحدث **تلقائياً**
- Optimistic UI — الكارت يتحرك فوراً، النظام يحفظ في الباك جراوند
- لو حصل error → الكارت يرجع + toast بالـ error

## الـ Stale Alert
أي lead عمره أكتر من **24 ساعة** ومحدش كلّمه بيظهر بـ **نقطة حمراء** على الكارت — تذكير إنه لازم اتنفّذ.

## قيمة الـ Pipeline
في الـ header تشوف:
- **قيمة الـ Pipeline النشط** (مجموع estimated_value للـ leads في "مهتم" + "active")
- **+ X ج محقّقين فعلاً** (مجموع الـ won deals)

## نصايح
- ✅ لما lead يبقى "عميل"، عيّن **estimated_value** عشان الـ ROI يطلع صح
- ✅ كل أسبوع راجع الـ "خامد" → ممكن تـ re-engage
- ✅ الـ "ضايع" مهم — راجع الـ lost_reason عشان تتحسن`,
    tags: ["leads", "kanban", "pipeline"],
    estimatedReadMin: 3,
    relatedSlugs: ["create-landing-page", "marketing-analytics"],
    lastUpdated: "2026-05-17",
  },

  {
    slug: "marketing-analytics",
    category: "marketing",
    title: "تحليل الأداء — Funnel + ROI",
    excerpt: "افهم منين العملاء بييجوا وأي حملة بتحقق ROI.",
    body: `## الـ Funnel
**Dashboard → استوديو التسويق → تحليل التسويق**

الـ funnel chart بيوريك المراحل من الزيارة للعميل:

\`\`\`
👁 زيارات → 💬 ضغط CTA → 📝 Leads → 📞 اتواصل → 🏆 عملاء
\`\`\`

لكل مرحلة:
- **العدد المطلق**
- **نسبة التحويل من المرحلة السابقة**

مثال: لو ١٠٠ visit بقت ١٠ leads = **10% lead-conversion**.

## Breakdowns
### حسب المصدر
بيجمع الـ leads حسب \`first_utm_source\`:
- facebook
- google
- direct
- referral
- meta_lead_ads
- landing_page

لكل مصدر بيوريك: leads, contacted, won, **revenue**, **win rate**

### حسب الحملة
نفس الفكرة لكن حسب \`first_utm_campaign\`. لو شفت أن "Summer-2026" بيجيب 50 lead بـ 20% win rate، اعرف تستثمر فيها أكتر.

### Leaderboard الـ Landing Pages
كل page بيظهر:
- عدد الزيارات
- عدد الـ leads
- **CVR%** (الـ conversion rate)
- العملاء + الإيرادات

## KPIs الرئيسية في الـ Header
1. **💰 إيرادات محقّقة** (مجموع won deals آخر 90 يوم)
2. **🏆 عملاء جدد**
3. **💎 متوسط قيمة الصفقة**
4. **📊 معدل التحويل** (visit → won)

## استخدامها العملي
- لو حملة CVR < 1% → غيّر الـ landing page
- لو مصدر يجيب leads بـ win rate < 5% → الـ targeting غلط
- لو landing page بـ CVR > 5% → ضاعف الميزانية عليها`,
    tags: ["analytics", "ROI", "marketing"],
    estimatedReadMin: 3,
    relatedSlugs: ["create-landing-page", "leads-pipeline"],
    lastUpdated: "2026-05-17",
  },

  {
    slug: "meta-lead-ads-setup",
    category: "marketing",
    title: "ربط Meta Lead Ads — Facebook + Instagram",
    excerpt: "خلي الـ leads من إعلاناتك الممولة يجوا CRM تلقائياً.",
    body: `## الفكرة
بدل ما تنزّل CSV كل يوم من Ads Manager، Meta بتبعت الـ leads تلقائياً للـ webhook بتاع Nidham. كل lead يدخل CRM في ثوانٍ.

## محتاج
- ✅ Facebook Page
- ✅ Facebook App (هتعملها)
- ✅ Page Access Token مع \`leads_retrieval\` permission
- ✅ Webhook URL (Nidham بيدّيه لك)
- ✅ ٣ env vars في Vercel:
  - \`META_APP_SECRET\`
  - \`META_WEBHOOK_VERIFY_TOKEN\`
  - \`META_ENCRYPTION_KEY\`

## الخطوات
**Dashboard → استوديو التسويق → Integrations → اقرا الـ Setup Guide**

الـ guide فيه 9 خطوات تفصيلية:
1. اعمل Facebook App
2. ضيف Webhooks Product
3. عيّن Page Webhook Subscription
4. اشترك في \`leadgen\` field
5. اطلب App Permission: \`leads_retrieval\` (Meta بتراجع 1-2 أسبوع)
6. جيب Page Access Token من Graph API Explorer
7. اشترك التطبيق في صفحتك
8. عيّن env vars في Vercel
9. اربط الصفحة هنا في Nidham

## بعد الربط
- أي Lead Form Ad تشغّله على Meta هيدخل CRM تلقائياً
- المصدر = \`meta_lead_ads\`
- الـ campaign = الـ campaign_id من Meta
- الـ ad_content = الـ ad_id

## التحقق من الـ webhooks
في صفحة الـ Integrations في النظام، هتلاقي:
- 📥 **Webhooks Received** counter
- 🎯 **Leads Imported** counter
- **آخر 15 webhook** مع outcome (success / duplicate / failed)
- **آخر error** لو في مشكلة

## مشاكل شائعة
- **Token Expired** — Meta بتجدد الـ tokens. لو ظهر error، اعمل token جديد من Graph Explorer وحدّثه في النظام
- **Permission denied** — لازم App Review على \`leads_retrieval\`
- **Webhook 401** — \`META_APP_SECRET\` غلط أو مفقود`,
    tags: ["meta", "webhooks", "integrations"],
    estimatedReadMin: 6,
    relatedSlugs: ["create-landing-page", "leads-pipeline"],
    lastUpdated: "2026-05-17",
  },

  // ==========================================================================
  // AI
  // ==========================================================================
  {
    slug: "ai-cv-screening",
    category: "ai",
    title: "فحص CVs بالـ AI",
    excerpt: "ارفع CV → AI يقيّم 0-100 + يطلع أسئلة مقابلة.",
    body: `## كيف يشتغل
**Dashboard → التوظيف → اختر وظيفة → + مرشح جديد**

ارفع CV (PDF) → الـ AI يـ:
1. يقرا المحتوى بالعربي والإنجليزي
2. يقيّم 0-100 حسب الـ JD
3. يطلع **نقاط القوة** (3-5 نقطة)
4. يطلع **نقاط الضعف** (2-3 نقطة)
5. يقترح **5 أسئلة مقابلة** محددة للمرشح ده

## ليه الـ score مهم؟
بدل ما تقرا 50 CV يدوي، الـ AI يـ rank لك أحسن 10. توفر 80% من وقت الـ pre-screening.

## دقة الـ AI؟
- ✅ كويس في الـ filtering الأولي
- ⚠ مش بديل عن المقابلة الشخصية
- ⚠ بعض المرشحين بيكتبوا CVs ضعيفة بس عندهم خبرة حقيقية — راجع low-score CVs قبل ما ترفض

## الـ Models المستخدمة
1. **Groq gpt-oss-120b** (primary)
2. **Groq gpt-oss-20b** (fallback)
3. **Llama 4 Scout** (fallback)
4. **Gemini Flash Lite** (final fallback)

النظام يـ fallback تلقائياً لو واحد فيهم وقع.

## الـ Privacy
- الـ CVs بترفع لـ Supabase Storage
- الـ AI providers بيعالجوا الـ text بس
- مفيش رفع لطرف ثالث
- الـ data مش بتُستخدم لـ training`,
    tags: ["AI", "recruitment", "CV"],
    estimatedReadMin: 3,
    relatedSlugs: ["ai-assistant"],
    lastUpdated: "2026-05-17",
  },

  {
    slug: "ai-assistant",
    category: "ai",
    title: "المساعد الذكي",
    excerpt: "اسأل بالعربي عن قانون العمل أو بيانات شركتك.",
    body: `## الفكرة
**Dashboard → المساعد الذكي**

اكتب سؤال بالعربي → الـ AI يرد بناءً على:
- قانون العمل المصري 12/2003
- قانون التأمينات 148/2019
- شرائح الضرائب الجديدة 2024
- **بيانات شركتك** (موظفينك، رواتبك، الـ CRM، الخ)

## أمثلة على أسئلة مفيدة
- "ضريبة الدخل على مرتب 8000 كام؟"
- "إيه أعلى موظف حضور الشهر ده؟"
- "كم لازم أدفع تأمينات على فريق 25 موظف بمتوسط مرتب 6000؟"
- "مين أحسن sales person في القاهرة بناءً على التفاعلات؟"
- "أحمد لما يستقيل، إيه مكافأة نهاية الخدمة بتاعته؟"
- "إيه قانون الإجازات السنوية للموظف اللي شغال أقل من سنة؟"

## مش بيعمل
- ❌ مش بيعمل تعديلات على البيانات (هو read-only)
- ❌ مش بيرد على أسئلة خارج نطاق HR/CRM
- ❌ مش بيدّي استشارات قانونية ملزمة (راجع محامي للقضايا الحقيقية)

## الأخطاء الشائعة
- **"وصلنا للحد اليومي"** — جرّب بعد دقيقتين (TPM rate limit)
- **"حصلت مشكلة"** — لو استمر، راجع الـ Vercel logs`,
    tags: ["AI", "assistant", "قانون"],
    estimatedReadMin: 2,
    relatedSlugs: ["ai-cv-screening", "egyptian-labor-law"],
    lastUpdated: "2026-05-17",
  },

  // ==========================================================================
  // Mobile
  // ==========================================================================
  {
    slug: "mobile-app-setup",
    category: "mobile",
    title: "تطبيق الموبايل — تركيب ودخول",
    excerpt: "إزاي ينزّل التطبيق ويسجّل دخول بكود الـ QR.",
    body: `## للموظف

### ١. نزّل التطبيق
- **Android:** Google Play Store → ابحث "Nidham"
- **iPhone:** App Store → ابحث "Nidham"

أو في فترة التطوير، استخدم **Expo Go**:
1. نزّل Expo Go
2. اطلب من HR يديك الـ QR من dev mode

### ٢. اطلب كود دعوة من HR
HR هيدّيك:
- صورة QR (في WhatsApp أو مطبوعة)
- أو رابط مباشر

### ٣. سجّل دخول
- افتح Nidham → **"عندك كود دعوة؟"**
- امسح الـ QR من الكاميرا داخل التطبيق
- ضع كلمة سر جديدة (احفظها — مش هتقدر تستعيدها بسهولة)
- خلاص ✅

### ٤. ابدأ تثبّت حضور
- اضغط **"تثبيت حضور"** عند وصولك للمكتب
- اضغط **"انصراف"** عند المغادرة
- التطبيق يستخدم GPS — لازم تكون جوه نطاق المكتب

## للـ HR / Admin

### إنت مش هتستخدم تطبيق الموبايل
الموبايل **للموظفين فقط**. إنت admin → استخدم web dashboard.

### الموظف نسي كلمة السر؟
حالياً مفيش "نسيت كلمة السر" في التطبيق. الحل:
1. صفحة الموظف في الـ Dashboard
2. **"إنشاء كود دعوة جديد"**
3. ابعت له الكود الجديد
4. هو يفتح التطبيق → يدخل بالكود الجديد → يضع كلمة سر جديدة`,
    tags: ["mobile", "تطبيق", "employee"],
    estimatedReadMin: 4,
    relatedSlugs: ["employee-invitation-qr"],
    lastUpdated: "2026-05-17",
  },

  // ==========================================================================
  // Law
  // ==========================================================================
  {
    slug: "egyptian-labor-law",
    category: "law",
    title: "قانون العمل المصري — ملخص للـ HR",
    excerpt: "أهم البنود في قانون 12/2003 + 148/2019 (تأمينات).",
    body: `## الإجازات السنوية (Article 47)
| الحالة | عدد أيام |
|---|---|
| موظف < سنة | ـ |
| موظف 1-10 سنوات | **21 يوم** |
| موظف > 10 سنوات أو > 50 سنة | **30 يوم** |

النظام بيحسب تلقائياً بناءً على \`hire_date\` + تاريخ الميلاد.

## الإجازات المرضية
- **6 أشهر بمرتب كامل** للموظفين بأقل من 10 سنوات
- تتجدد كل سنة
- محتاجة شهادة طبية بعد 3 أيام

## نهاية الخدمة (Article 122)
لو الشركة فصلت موظف بدون سبب وجيه:
- **شهرين عن كل سنة خدمة** (للسنوات < 5)
- **شهر إضافي** عن كل سنة بعد الـ 5

## التأمينات الاجتماعية (قانون 148/2019)
- **14%** من المرتب الإجمالي
- **سقف:** ١٠,٩٠٠ ج/شهر (2024)
- **يعني:** أقصى تأمين = 14% × 10,900 = ١,٥٢٦ ج

## ضرائب الدخل (2024)
| الشريحة | المرتب السنوي | النسبة |
|---|---|---|
| 1 | حتى 21,000 | **0%** |
| 2 | 21,001 - 30,000 | **10%** |
| 3 | 30,001 - 45,000 | **15%** |
| 4 | 45,001 - 60,000 | **20%** |
| 5 | 60,001 - 200,000 | **22.5%** |
| 6 | 200,001 - 400,000 | **25%** |
| 7 | > 400,000 | **27.5%** |

## ساعات العمل
- **8 ساعات/يوم**
- **48 ساعة/أسبوع**
- إضافي بـ 1.35× في النهار، 1.5× في الليل، 2× في الإجازات
- استراحة 1 ساعة بعد 5 ساعات شغل

## فترة التجربة
- **حد أقصى 3 شهور**
- لا يحق للموظف مكافأة نهاية خدمة في الفترة دي

⚠ **مهم:** المعلومات دي للمرجع السريع. لأي قضية حقيقية، راجع محامي.`,
    tags: ["قانون", "law", "ضرائب", "تأمينات"],
    estimatedReadMin: 5,
    relatedSlugs: ["egyptian-tax-brackets", "ai-assistant"],
    lastUpdated: "2026-05-17",
  },

  {
    slug: "egyptian-tax-brackets",
    category: "law",
    title: "شرائح ضريبة الدخل 2024",
    excerpt: "حساب الضريبة على مرتب موظف خطوة بخطوة.",
    body: `## الشرائح
| # | المرتب السنوي | النسبة |
|---|---|---|
| 1 | 0 - 21,000 | **0%** (إعفاء) |
| 2 | 21,001 - 30,000 | **10%** |
| 3 | 30,001 - 45,000 | **15%** |
| 4 | 45,001 - 60,000 | **20%** |
| 5 | 60,001 - 200,000 | **22.5%** |
| 6 | 200,001 - 400,000 | **25%** |
| 7 | فوق 400,000 | **27.5%** |

## مثال: موظف بـ 8,000 ج/شهر = 96,000 ج/سنة

| الشريحة | المبلغ | النسبة | الضريبة |
|---|---|---|---|
| إعفاء | 21,000 | 0% | 0 |
| 21k-30k = 9,000 | 9,000 | 10% | 900 |
| 30k-45k = 15,000 | 15,000 | 15% | 2,250 |
| 45k-60k = 15,000 | 15,000 | 20% | 3,000 |
| 60k-96k = 36,000 | 36,000 | 22.5% | 8,100 |
| **الإجمالي السنوي** | | | **14,250** |
| **شهرياً** | | | **1,187.5 ج** |

## ⚠ ملاحظات
- النظام يحسب تلقائياً، مش لازم تقعد تحسب يدوي
- لو الموظف عنده **خصم تأمين** (1,526 ج/شهر مثلاً)، الضريبة بتحسب على **المرتب - التأمين**
- في إعفاء شخصي **9,000 ج/سنة** بيضاف للشريحة الأولى
- في إعفاءات إضافية للمتزوجين + أطفال

استخدم **المساعد الذكي** عشان تحسب لموظف معين:
> "ضريبة الدخل على مرتب 8000 لموظف متزوج كام؟"`,
    tags: ["ضرائب", "tax", "payroll"],
    estimatedReadMin: 3,
    relatedSlugs: ["egyptian-labor-law", "first-payroll"],
    lastUpdated: "2026-05-17",
  },

  // ==========================================================================
  // Troubleshooting
  // ==========================================================================
  {
    slug: "ai-errors",
    category: "troubleshooting",
    title: "أخطاء الـ AI الشائعة",
    excerpt: "إزاي تفسر وتحل أخطاء quota / json_schema / failed_generation.",
    body: `## "وصلنا للحد اليومي للـ AI"
**معناه:** الـ provider الحالي (Groq/Gemini) وصل لحد الـ rate limit أو الـ daily quota.

**الحل:**
1. **استنى 60-90 ثانية** — أغلب الأحيان TPM (tokens per minute) وليس daily
2. **اتأكد من Gemini API Key** في Vercel — لو مفعّل، النظام يـ fallback تلقائياً
3. **لو في الصباح:** استنى لمنتصف الليل UTC (3 صباحاً Cairo) لتجديد quota
4. **لو بشكل دائم:** فكر في الـ Groq paid tier

## "This model does not support response format json_schema"
**معناه:** الـ model القديم (مثل Llama 3.x) مش بيدعم structured outputs.

**الحل:** ده اتحل في الـ commit بتاع gpt-oss-120b. لازم Vercel يعمل redeploy على آخر version.

## "Failed to generate JSON"
**معناه:** الـ AI حاول يولّد JSON لكن فشل في الـ schema validation.

**الحل:** الـ callWithFallback chain يجرب models تانية تلقائياً. لو لسه بيفشل:
- بسّط الـ schema (شيل مين/ماكس counts صعبة)
- جرّب موضوع تاني أوضح
- استنى دقيقة لو الـ provider مزدحم

## "Token decryption failed"
**معناه:** \`META_ENCRYPTION_KEY\` في Vercel اتغيرت أو مش متعيّنة.

**الحل:**
1. اتأكد إنها متعيّنة في Vercel → Settings → Environment Variables
2. لو حدّثتها مؤخراً، لازم تعيد ربط كل الـ social accounts (التشفير القديم مش هيشتغل)
3. Redeploy بعد التعديل

## "Migration X لسه ما اتطبّقتش"
بانر أصفر يظهر لما الجدول مش موجود.

**الحل:**
1. روح Supabase → SQL Editor → New query
2. الصق محتوى الملف المذكور
3. Run`,
    tags: ["AI", "troubleshooting", "errors"],
    estimatedReadMin: 4,
    relatedSlugs: ["ai-assistant", "ai-cv-screening"],
    lastUpdated: "2026-05-17",
  },
];

// Helper: get articles in a category
export function getArticlesByCategory(categorySlug: string): HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.category === categorySlug);
}

// Helper: get article by slug
export function getArticleBySlug(slug: string): HelpArticle | null {
  return HELP_ARTICLES.find((a) => a.slug === slug) ?? null;
}

// Helper: get related articles for an article
export function getRelatedArticles(article: HelpArticle): HelpArticle[] {
  if (!article.relatedSlugs?.length) return [];
  return article.relatedSlugs
    .map((slug) => getArticleBySlug(slug))
    .filter((a): a is HelpArticle => a !== null);
}

// Helper: search articles by keyword (client-side; trivial implementation)
export function searchArticles(query: string): HelpArticle[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];
  return HELP_ARTICLES.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.excerpt.toLowerCase().includes(q) ||
      a.body.toLowerCase().includes(q) ||
      a.tags.some((t) => t.toLowerCase().includes(q)),
  ).slice(0, 12);
}
