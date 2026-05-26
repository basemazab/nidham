# Nidham SEO Strategy — Path to #1 on Google

> Goal: Rank #1 for "نظام HR مصري" and "Egyptian HR software" within 6 months.

This document is the playbook. Code changes have already shipped (sitemap, robots, JSON-LD, meta optimization). Remaining work is content + backlinks + GMB.

---

## 1. Target Keywords (ranked by intent × difficulty)

### 🎯 Tier 1 — Money keywords (commercial intent, primary focus)

| Keyword | Monthly searches (Egypt) | Difficulty | Current rank | Goal |
|---|---|---|---|---|
| نظام HR مصري | ~720 | Low (KGR < 0.5) | Not ranked | #1 in 3 months |
| برنامج موارد بشرية | ~880 | Medium | Not ranked | Top 5 in 6 months |
| نظام مرتبات مصري | ~590 | Low | Not ranked | #1 in 3 months |
| برنامج مرتبات للشركات | ~320 | Low | Not ranked | Top 3 in 4 months |
| Egyptian HR software | ~210 | Medium | Not ranked | Top 5 in 6 months |
| HR system Egypt | ~170 | Medium | Not ranked | Top 5 in 6 months |
| Bayzat alternative Egypt | ~90 | **Very Low** | Not ranked | #1 in 2 months |
| ZenHR alternative | ~110 | Low | Not ranked | #1 in 3 months |

### 🚀 Tier 2 — Feature-specific (capture intent, low competition)

| Keyword | Why important |
|---|---|
| نظام حضور وانصراف GPS | Egypt is geofence-curious — high conversion |
| حساب التأمينات الاجتماعية 2024 | High-intent calculator searches |
| نموذج 1 تأمينات اجتماعية | People want the form free — we have it |
| نموذج 6 ترك الخدمة | Same |
| حاسبة نهاية الخدمة قانون 12/2003 | Bottom-of-funnel intent |
| توقيع إلكتروني للعقود | Trending in MENA post-pandemic |
| بوت WhatsApp للموظفين | Differentiator — no one else has |

### 📚 Tier 3 — Long-tail informational (build authority)

| Keyword | Content type |
|---|---|
| ازاي احسب مرتب الموظف في مصر 2026 | Blog (calculator) |
| الفرق بين قانون العمل وقانون التأمينات | Blog (explainer) |
| ازاي اعمل نموذج 1 تأمينات اجتماعية | Tutorial |
| ايه حقوق الموظف في نهاية الخدمة | Legal explainer |
| ازاي اختار نظام HR للشركة الصغيرة | Buyer's guide |
| Excel vs نظام HR — ايه الأفضل للشركات الناشئة | Comparison |
| 7 أخطاء HR في الشركات المصرية | Listicle |
| ازاي تستخرج شهادة عمل من النظام | Tutorial |

---

## 2. On-Page Optimization (already shipped ✅)

### Done in code
- ✅ Sitemap.xml auto-generated (`src/app/sitemap.ts`) covering 18 public pages
- ✅ Robots.txt allowing all marketing pages, blocking auth routes
- ✅ JSON-LD Organization + SoftwareApplication + WebSite schemas on every page
- ✅ FAQPage schema on /pricing (8 questions targeting "People Also Ask")
- ✅ Optimized title tags (front-loaded keywords)
- ✅ Optimized meta descriptions (with CTA + benefit + keywords)
- ✅ Canonical URLs + Arabic language hreflang
- ✅ Open Graph + Twitter Card tags
- ✅ Keywords meta tag (25+ Arabic + English keywords)

### Still TODO in code
- [ ] H1 audit per page — each must contain primary keyword
- [ ] Image alt text in Arabic (currently many `<img>` lack alt)
- [ ] Internal linking pillar-cluster model (homepage → /pricing → /product → /crm)
- [ ] Sitemap.xml submission to Google Search Console
- [ ] Schema validation: https://search.google.com/test/rich-results

---

## 3. Technical SEO (post-deploy checklist)

### Core Web Vitals (target all green)
```
LCP (Largest Contentful Paint): < 2.5s   — measure at https://pagespeed.web.dev
INP (Interaction to Next Paint): < 200ms
CLS (Cumulative Layout Shift):   < 0.1
```

### Run these tools after each major content push:
1. **Google Search Console** — submit sitemap, monitor indexing
2. **PageSpeed Insights** — Core Web Vitals + Lighthouse
3. **Schema Markup Validator** — verify JSON-LD parses
4. **Mobile-Friendly Test** — Google says mobile-first indexing is mandatory in 2026

### Vercel-specific optimizations (already on)
- ✅ HTTPS forced (Vercel default)
- ✅ HTTP/2 (Vercel default)
- ✅ CDN edge caching globally
- ✅ Image optimization via Next.js `<Image />` (used in `/product`)
- ✅ Static rendering where possible (marketing pages are static)

---

## 4. Content Strategy — 30 blog posts roadmap

### Month 1 (high-intent, immediate ranking targets) — **5/5 SHIPPED ✅**
1. ✅ **"أفضل بديل لـ Bayzat في مصر 2026"** — `/blog/bayzat-alternative-egypt-2026` (targets very-low-difficulty "Bayzat alternative Egypt")
2. ✅ **"كيف تحسب مرتب موظف في مصر 2026"** — `/blog/how-to-calculate-egypt-salary-2026` (high commercial intent, calculator searches)
3. ✅ **"نموذج 1 تأمينات اجتماعية — الشرح الكامل"** — `/blog/social-insurance-form-1-egypt` (very-high HR-manager intent)
4. ✅ **"حساب نهاية الخدمة في مصر — قانون 12/2003"** — `/blog/end-of-service-calculator-egypt` (high commercial intent, calculator)
5. ✅ **"Excel vs نظام HR — متى تنتقل؟"** — `/blog/excel-vs-hr-system-egypt` (comparison shopping intent)

### Month 2 (feature-led, mid-funnel) — **5/5 SHIPPED ✅**
6. ✅ **"بوت WhatsApp للموظفين"** — `/blog/whatsapp-bot-for-employees-egypt` (differentiator)
7. ✅ **"نظام حضور وانصراف بالـ GPS"** — `/blog/gps-attendance-system-egypt`
8. ✅ **"التوقيع الإلكتروني في مصر — هل قانوني؟"** — `/blog/e-signature-legality-egypt`
9. ✅ **"7 أخطاء HR شائعة في الشركات المصرية"** — `/blog/7-hr-mistakes-egyptian-companies` (listicle)
10. ✅ **"ازاي تستخرج شهادة خبرة في 3 دقايق"** — `/blog/experience-certificate-egypt-tutorial`

### Month 3 (authority builders, long-form)
11-30. Mix of: case studies (CircleCode style — anonymized), legal explainers (قانون العمل أهم 10 مواد), tutorials (10 dashboard walkthroughs).

### Blog post structure (every post):
- **H1** with primary keyword (one only)
- **TOC** if > 1500 words
- **Intro** with hook + promise (100 words)
- **5-7 H2 sections** each containing a long-tail keyword
- **FAQ section** at the end (gets Featured Snippets)
- **Internal links** to /pricing, /product, /crm, related posts
- **External links** to government sources (mof.gov.eg, gosi.gov.eg)
- **Author bio** with title + linked profile (E-E-A-T signal)
- **Date + last updated** visible
- **3-5 images** with descriptive Arabic alt text

---

## 5. Backlink Strategy (Egyptian market)

### Quick wins (Month 1)
1. **Listings on Egyptian B2B directories**:
   - Etisalat Pages (pages.etisalat.eg)
   - Egypt Yellow Pages
   - Bayt.com (post job listings)
   - WUZZUF (employer profile)
   - Forsa.com (HR community)

2. **Tech press**:
   - TechCrunch Egypt → submit founder story
   - Wamda → Egyptian SaaS coverage
   - Menabytes → product launch
   - بوابة الأهرام (Ahram Gate) → press release

3. **Government / industry**:
   - Federation of Egyptian Chambers of Commerce member listing
   - Egyptian Software Association (ESA) listing
   - ITIDA (Information Technology Industry Development Agency)

### Medium-term (Month 2-3)
4. **Guest posts on HR blogs**:
   - hrcommunityeg.com
   - linkedin.com/pulse (Arabic HR articles by Basem)
   - thinkmarketingmagazine.com

5. **Podcast appearances**:
   - "خبر اقتصادي" podcast
   - "ساعة تك" podcast
   - Egyptian Founders podcast

6. **Free tools as link magnets**:
   - Free salary calculator → embed widget that links back
   - Free social insurance calculator → same
   - Free Egyptian HR templates download

### Long-term (Month 4-6)
7. **University partnerships**:
   - GUC HR department
   - AUC business school
   - Helwan University HR program
   → free Nidham for students, mentions in coursework

8. **Industry events**:
   - HR Summit Egypt
   - Cairo ICT
   - Sponsor + present case study

---

## 6. Local SEO — Google My Business + Maps

### Setup (Day 1)
1. **Create Google Business Profile** at https://business.google.com
   - Business name: "Nidham HR — نِظام"
   - Category: Software Company + Business Management Software
   - Address: Damietta address (real)
   - Phone: +20 105 535 6622
   - Hours: Sun-Thu 9 AM - 6 PM
   - Website: https://www.nidhamhr.com
   - Service area: All of Egypt (set delivery radius)

2. **Optimize the profile**:
   - 10+ high-quality photos (logo, office, team, dashboard screenshots)
   - Q&A section pre-populated with FAQ content
   - Posts feature: weekly updates about new features/blog posts

3. **Encourage reviews**:
   - Every new customer gets a WhatsApp asking for a Google review
   - Target 50 reviews in 6 months (4.5+ rating)

---

## 7. Tracking & Iteration

### Tools to set up THIS WEEK
1. **Google Search Console**
   - Add property `https://www.nidhamhr.com`
   - Submit sitemap.xml
   - Monitor "Pages" report for indexing issues

2. **Google Analytics 4**
   - Already exists? If not, add `NEXT_PUBLIC_GA4_ID` env var
   - Track conversions: signup, demo request, contact click

3. **Bing Webmaster Tools**
   - Same as GSC but for Bing/Yahoo (~5% of Egyptian search)

### Weekly KPIs to track
- Organic clicks (GSC)
- Top 10 ranking keywords
- Pages indexed
- Average position
- CTR per keyword

### Monthly KPIs
- Total organic traffic
- Conversion rate from organic
- Backlinks acquired
- Domain Rating (DR via Ahrefs)
- Branded vs non-branded traffic ratio

---

## 8. The Realistic Timeline

| Month | Action | Expected outcome |
|---|---|---|
| 1 | Code SEO + 5 posts + GSC setup | Indexed by Google, ranking for long-tails |
| 2 | 5 more posts + 10 backlinks + GMB | Top 20 for primary keywords |
| 3 | 5 more posts + 20 backlinks + 1 podcast | Top 10 for "Bayzat alternative", Top 20 for primary |
| 4 | 5 more posts + 30 backlinks + 3 podcasts | Top 5 for primary keywords |
| 5 | 5 more posts + 50 backlinks + 1 event | Top 3 |
| 6 | 5 more posts + 70 backlinks + 2 events | **#1 for primary Arabic keywords** |

---

## 9. Action Items — Right Now

After code deploy completes:

1. **Verify sitemap** — open `https://www.nidhamhr.com/sitemap.xml` (should list 18 URLs)
2. **Verify robots** — open `https://www.nidhamhr.com/robots.txt`
3. **Submit to Google Search Console**:
   - Add property, verify ownership (DNS TXT record or HTML tag in `<head>`)
   - Submit sitemap URL
   - Request indexing on top 5 pages
4. **Create Google Business Profile**
5. **Pick 5 blog post titles** from Section 4 and start writing this week

---

**Last updated: 2026-05-26 · Migrations through 069 · For Nidham HR SaaS**
