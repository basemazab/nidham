# Nidham HR — 30-Day Action Plan

> **بالعربي:** كل اللي محتاج تعمله بنفسك خلال 30 يوم، بالترتيب، مع الوقت اللازم لكل خطوة.
>
> الكود كله جاهز ومتشغّل. الباقي outreach + setup يدوي.

---

## ⚡ اليوم 1 (اليوم) — Deploy + GSC (إجمالي: 30 دقيقة)

### الخطوة 1: Deploy الكود الجديد لـ Vercel (5 دقايق)
```bash
git add .
git commit -m "feat: SEO expansion — 15 blog posts + 3 calculators + 4 industry pages + outreach packs"
git push
```
Vercel هيبني تلقائياً.

### الخطوة 2: تأكد إن الموقع شغّال (5 دقايق)
افتح في المتصفح:
- ✅ https://www.nidhamhr.com/blog (لازم تشوف 15 مقال)
- ✅ https://www.nidhamhr.com/tools (لازم تشوف 3 حاسبات)
- ✅ https://www.nidhamhr.com/industries (لازم تشوف 4 قطاعات)
- ✅ https://www.nidhamhr.com/sitemap.xml (لازم تشوف 44 URL)

### الخطوة 3: Resubmit Sitemap في Google Search Console (3 دقايق)
1. افتح https://search.google.com/search-console
2. اختر `nidhamhr.com`
3. من القائمة الجانبية → **Sitemaps**
4. لو فيه sitemap قديم: دوس عليه → **Remove**
5. أضف جديد: اكتب `sitemap.xml` ودوس **Submit**

### الخطوة 4: Request Indexing لأهم 10 صفحات (15 دقيقة)
في Google Search Console → **URL Inspection** → الصق كل URL واحد واحد ودوس **Request Indexing**:

```
https://www.nidhamhr.com/
https://www.nidhamhr.com/pricing
https://www.nidhamhr.com/product
https://www.nidhamhr.com/crm
https://www.nidhamhr.com/blog
https://www.nidhamhr.com/tools
https://www.nidhamhr.com/industries
https://www.nidhamhr.com/tools/salary-calculator
https://www.nidhamhr.com/blog/labor-law-12-2003-egypt-explained
https://www.nidhamhr.com/blog/bayzat-alternative-egypt-2026
```

---

## 📅 الأسبوع 1 — GMB + LinkedIn (إجمالي: 4 ساعات)

### يوم 2: إنشاء Google Business Profile (2 ساعة)

1. **افتح:** https://business.google.com/create
2. **افتح الملف:** `docs/GMB_CONTENT_PACK.md` (موجود في المشروع)
3. **اتبع التعليمات الموجودة فيه خطوة بخطوة:**
   - اسم النشاط
   - الفئة الأساسية + الفئات الإضافية
   - العنوان
   - التليفون
   - الموقع الإلكتروني
   - الوصف العربي (انسخ من الملف مباشرة)
   - 12 خدمة (انسخ من الملف)
   - 20 سؤال وجواب (الصقهم في قسم Q&A)
4. **رفع 10 صور** على الأقل (لوجو + فريق + screenshots)
5. **انتظر التحقق** (Google هيبعت كود لـ العنوان أو رقم التليفون)

### يوم 3: إنشاء LinkedIn Company Page (1 ساعة)

1. **افتح:** https://www.linkedin.com/company/setup/new/
2. **اختار:** "Small business"
3. **املا:**
   - Name: `Nidham HR`
   - Industry: Computer Software
   - Logo + Cover photo
   - About: انسخ الوصف من `GMB_CONTENT_PACK.md` (Blurb 4 — Long)
4. **أضف 5-10 موظفين** (لو الفريق صغير، استخدم الـ employees الموجودين)
5. **انشر أول 3 posts:**
   - الـ post الأول: "إحنا أطلقنا نِظام HR — أول نظام HR مصري متكامل"
   - الـ post الثاني: لينك لـ مقال (مثلاً Bayzat alternative)
   - الـ post الثالث: لينك لـ حاسبة المرتب

### يوم 4-5: Wuzzuf + Bayt + Forsa (1 ساعة لكل)

#### Wuzzuf (https://wuzzuf.net)
1. اشترك كـ **Employer**
2. أنشئ Company Profile كامل (logo + cover + about)
3. **انسخ Blurb 3 من** `docs/B2B_DIRECTORIES_OUTREACH.md`
4. انشر 1-2 وظائف حقيقية أو نموذجية:
   - "Customer Success Manager"
   - "Sales Representative"
5. الـ company page بقى متاحة على Google

#### Bayt (https://www.bayt.com)
نفس الخطوات ↑ بس على Bayt.

#### Forsa (https://forsa.com)
نفس الخطوات.

---

## 📅 الأسبوع 2 — Egyptian Directories (إجمالي: 4 ساعات)

### يوم 6-7: Yellow Pages + Egypt Yellow Pages (1 ساعة)

#### Etisalat Yellow Pages (https://www.yellowpages.com.eg)
1. Sign up
2. أضف Business Listing
3. الصق Blurb 3 من `docs/B2B_DIRECTORIES_OUTREACH.md`

#### Egypt Yellow Pages (https://www.egyptyellowpages.com)
نفس الخطوات.

### يوم 8-10: المواقع الحكومية + الصناعية (3 ساعات)

#### ITIDA — أهم لينك ممكن تجيبه! (.gov.eg)
1. افتح https://www.itida.gov.eg
2. ابحث عن **"Software & IT Services Industry Member"**
3. املا طلب العضوية
4. **الميزة:** الـ link من .gov.eg بيخلي Google يعتمد على الموقع بشكل أقوى

#### Federation of Egyptian Industries (FEI)
1. افتح https://www.fei.org.eg
2. اطلب عضوية كـ Software Company

#### AmCham (American Chamber of Commerce in Egypt)
1. افتح https://www.amcham.org.eg
2. اطلب member directory listing

---

## 📅 الأسبوع 3 — Tech Press Pitches (إجمالي: 2 ساعة)

### يوم 11-12: ابعت 3 Pitches

افتح `docs/TECH_PRESS_OUTREACH.md` و **انسخ الـ pitches منه**:

#### Pitch #1: Wamda
1. ابعت لـ `editors@wamda.com`
2. Subject: `Egyptian HR SaaS undercuts Bayzat by 70% — exclusive story?`
3. Body: انسخ من الملف

#### Pitch #2: Menabytes
1. ابعت لـ `editor@menabytes.com`
2. Subject: `[Exclusive] Nidham HR launches in Egypt with WhatsApp-native employee experience`
3. Body: انسخ من الملف

#### Pitch #3: بوابة الأهرام
1. ابحث على إيميل قسم التكنولوجيا (LinkedIn ممتاز)
2. Subject: `تكنولوجيا مصرية بتنافس الأنظمة الخليجية — هل تستحق التغطية؟`
3. Body: انسخ من الملف

### يوم 13: Follow-up

لو حد رد، رد فوراً + ابعت الـ Press Kit (موجود في الملف).
لو محدش رد بعد 5 أيام، تجهز follow-up (Template موجود).

---

## 📅 الأسبوع 4 — SaaS Directories + Reviews (إجمالي: 3 ساعات)

### يوم 16-18: SaaS Directories
- G2 Crowd: https://www.g2.com
- Capterra: https://www.capterra.com
- AlternativeTo: https://alternativeto.net (سجّل Nidham كـ "Bayzat alternative")
- Crunchbase: https://www.crunchbase.com

### يوم 19-21: ابدأ Collect Reviews

1. **افتح:** `docs/GMB_CONTENT_PACK.md` → قسم "Review Request Templates"
2. **اعمل قائمة بـ 10 عملاء راضيين**
3. **ابعت لكل واحد على WhatsApp** الـ template (موجود)
4. **استهدف:** 5+ reviews في الأسبوع الأول من السؤال

---

## 📅 الأسبوع 5-6 (الشهر التاني) — التوسّع

### Backlinks المتقدمة
- Product Hunt launch (يوم محدد)
- Guest posts على HR blogs المصرية
- Podcast appearances (Pitches موجودة في `TECH_PRESS_OUTREACH.md`)

### Content Cadence
- 2 blog posts/أسبوع (الـ tail keywords)
- 1 GMB post/أسبوع (Templates موجودة في `GMB_CONTENT_PACK.md`)
- 1 LinkedIn post/أسبوع

### Customer Outreach
- Follow up مع كل العملاء اللي قدّموا reviews
- اطلب Case Studies من أنجح 3 عملاء
- صور / فيديوهات للموقع (testimonials)

---

## 🎯 الـ KPIs اللي لازم تتابعها أسبوعياً

في Google Search Console:

| المقياس | الهدف بعد شهر | الهدف بعد 3 شهور | الهدف بعد 6 شهور |
|---|---|---|---|
| URLs Indexed | 20+ | 44 (الكل) | 44 + أي مقالات جديدة |
| Impressions/يوم | 50+ | 500+ | 5,000+ |
| Clicks/يوم | 5+ | 50+ | 500+ |
| Average Position | 30 | 15 | 5 |
| Backlinks | 10 | 30 | 80 |
| GMB Reviews | 5 | 20 | 50 |

---

## 📚 كل الموارد في مكان واحد

| المهمة | الملف اللي تستخدمه |
|---|---|
| Google Business Profile | `docs/GMB_CONTENT_PACK.md` |
| B2B Directories (30+) | `docs/B2B_DIRECTORIES_OUTREACH.md` |
| Press Pitches (7 مجلات) | `docs/TECH_PRESS_OUTREACH.md` |
| Podcast Outreach | `docs/TECH_PRESS_OUTREACH.md` (نفس الملف) |
| استراتيجية SEO الكاملة | `docs/SEO_STRATEGY.md` |
| تقرير الـ Audit | `docs/SEO_AUDIT_REPORT.md` |
| دليل WhatsApp setup | `docs/WHATSAPP_SETUP.md` |
| فهرس عام | `docs/SEO_MASTER_INDEX.md` |

---

## ⏱️ ميزانية الوقت الإجمالية

| الأسبوع | الوقت | المهام |
|---|---|---|
| اليوم 1 | 30 دقيقة | Deploy + GSC |
| الأسبوع 1 | 4 ساعات | GMB + LinkedIn + 3 job boards |
| الأسبوع 2 | 4 ساعات | 10 Egyptian directories |
| الأسبوع 3 | 2 ساعات | 3 press pitches |
| الأسبوع 4 | 3 ساعات | SaaS directories + Reviews |
| الأسبوع 5-6 | 4-6 ساعات | Product Hunt + content |
| **إجمالي 30 يوم** | **18-20 ساعة** | كل الـ outreach الأساسي |

تقدر تخلّص ده على مدار شهر بمعدل ساعة/يوم.

---

## 🚀 اللي بعد كده (شهور 2-6)

### Content
- 5 مقالات/شهر (من قائمة الـ Month 4-6 في `SEO_STRATEGY.md`)
- 1 case study/شهر
- 1 podcast appearance/شهر

### Backlinks
- 10-15 directory/شهر
- 3-5 guest posts/شهر
- 1 press feature/شهر

### Reviews
- 5-10 GMB reviews/شهر
- 5+ Trustpilot reviews/شهر
- 5+ G2 reviews/شهر

### Conversion
- A/B test الـ landing pages
- تحسين الـ blog → signup funnel
- إضافة exit-intent popups

---

## ✅ Checklist سريع

استخدم ده كـ daily reminder:

### يومياً (10 دقايق)
- [ ] افتح Search Console، شوف لو فيه errors
- [ ] رد على أي GMB review أو comment

### أسبوعياً (1 ساعة)
- [ ] انشر GMB post (Template من GMB_CONTENT_PACK)
- [ ] انشر LinkedIn post
- [ ] راجع keyword rankings

### شهرياً (4 ساعات)
- [ ] اكتب 2 blog posts
- [ ] ابعت 3 press pitches
- [ ] اطلب 5 reviews من عملاء جداد
- [ ] راجع KPIs

---

## 💡 نصائح ذهبية

1. **مَتنساش الـ NAP consistency** — الاسم، العنوان، التليفون لازم نفسهم بالحرف في كل directory.

2. **اللينك أهم من الكمية** — link واحد من .gov.eg أو من Wamda > 100 link من directories ضعيفة.

3. **الـ content بيرفع بطيء لكن مستمر** — متستعجلش. صبر 3 شهور قبل ما تقيم النتايج.

4. **الـ Reviews هي الكنز** — Google بيرتب الـ Local SEO بناءً عليها بشكل كبير.

5. **متجاوبش على Comments السلبية بانفعال** — رد بمهنية + اعرض حل.

6. **اعمل Branch من الكود لكل feature SEO** — متخليش main branch يحمّل تجارب SEO.

---

**Last Updated:** 2026-05-26
**Owner:** [اسم المسئول]
**Review every:** أسبوع
