# Nidham HR SEO Master Index

> Single page that links to all SEO + marketing + outreach materials.
> Bookmark this for daily reference.

**Goal:** Rank #1 on Google for "نظام HR مصري" and similar high-intent Egyptian Arabic queries within 6 months.

---

## 📂 Documentation Files

### Strategic Documents
| File | What it contains | When to use |
|---|---|---|
| [`SEO_STRATEGY.md`](./SEO_STRATEGY.md) | Full 6-month SEO playbook, keywords, content roadmap, backlink strategy | Weekly review |
| [`SEO_MASTER_INDEX.md`](./SEO_MASTER_INDEX.md) | This file | Bookmark |

### Outreach Materials
| File | What it contains | When to use |
|---|---|---|
| [`GMB_CONTENT_PACK.md`](./GMB_CONTENT_PACK.md) | Google Business Profile content (descriptions, Q&A, posts, services) | Once at GMB setup + ongoing posts |
| [`B2B_DIRECTORIES_OUTREACH.md`](./B2B_DIRECTORIES_OUTREACH.md) | 30+ Egyptian + MENA directories with submission instructions | One-time setup (6-week sprint) |
| [`TECH_PRESS_OUTREACH.md`](./TECH_PRESS_OUTREACH.md) | Pitches for 7 publications + 5 podcasts + press release template | Ongoing, every 1-2 months |

---

## 🚀 Site Resources

### Public Marketing Pages (already shipped)
- **Homepage:** `/`
- **Pricing:** `/pricing`
- **Product (HR):** `/product`
- **CRM:** `/crm`
- **About:** `/about`
- **Security:** `/security`
- **Customers:** `/customers`
- **API Docs:** `/api-docs`
- **Contact:** `/contact`

### Blog Posts (10 published)
- **Index:** `/blog`
- `/blog/bayzat-alternative-egypt-2026` — "Bayzat alternative Egypt"
- `/blog/how-to-calculate-egypt-salary-2026` — "ازاي احسب مرتب الموظف"
- `/blog/social-insurance-form-1-egypt` — "نموذج 1 تأمينات اجتماعية"
- `/blog/end-of-service-calculator-egypt` — "حساب نهاية الخدمة"
- `/blog/excel-vs-hr-system-egypt` — "Excel vs نظام HR"
- `/blog/whatsapp-bot-for-employees-egypt` — "بوت WhatsApp للموظفين"
- `/blog/gps-attendance-system-egypt` — "نظام حضور GPS"
- `/blog/e-signature-legality-egypt` — "التوقيع الإلكتروني مصر"
- `/blog/7-hr-mistakes-egyptian-companies` — "أخطاء HR شركات مصرية"
- `/blog/experience-certificate-egypt-tutorial` — "شهادة خبرة"

### Free Tools (link magnets)
- **Hub:** `/tools`
- `/tools/salary-calculator` — حاسبة المرتب الصافي
- `/tools/end-of-service` — حاسبة مكافأة نهاية الخدمة
- `/tools/social-insurance` — حاسبة التأمينات الاجتماعية

### Technical SEO Infrastructure
- **Sitemap:** `/sitemap.xml` (auto-generated, 34 URLs)
- **Robots:** `/robots.txt` (auto-generated)
- **Manifest:** `/manifest.webmanifest` (PWA)
- **JSON-LD Schemas:** mounted on every page (Organization, SoftwareApplication, WebSite, FAQPage, BlogPosting, BreadcrumbList)

### Code-level SEO Components
- `src/components/json-ld.tsx` — 6 schema components
- `src/app/sitemap.ts` — auto-generated sitemap
- `src/app/robots.ts` — auto-generated robots.txt
- `src/lib/blog/posts.ts` — blog registry (single source of truth)
- `src/components/blog-chrome.tsx` — shared nav + footer

---

## 🎯 Daily Action Items (after SEO foundation)

### Each Day
- [ ] Reply to GMB reviews within 24 hours
- [ ] Check Google Search Console for indexing issues

### Each Week
- [ ] 1 new GMB post (use templates from `GMB_CONTENT_PACK.md`)
- [ ] Review keywords ranking trends (Google Search Console)
- [ ] Comment / engage on 3-5 Egyptian HR LinkedIn posts

### Each Month
- [ ] 1-2 new blog posts (from Month 3+ in `SEO_STRATEGY.md`)
- [ ] Request 5-10 GMB reviews from happy customers
- [ ] Audit + update existing top-3 ranking pages
- [ ] Submit to 3-5 new B2B directories (track in `B2B_DIRECTORIES_OUTREACH.md`)
- [ ] Send 2-3 press pitches (track in `TECH_PRESS_OUTREACH.md`)

---

## 📊 Tracking Dashboard

> Create a simple Google Sheets or Notion page with these tabs:

### Tab 1: Indexing Status
| Page URL | Submitted to GSC | Indexed | Last Updated |
|---|---|---|---|
| https://www.nidhamhr.com/ | ✅ | Pending | YYYY-MM-DD |
| ... | | | |

### Tab 2: Keyword Rankings
| Keyword | Current Position | Target | Last Check |
|---|---|---|---|
| Bayzat alternative Egypt | — | #1 | YYYY-MM-DD |
| ازاي احسب مرتب الموظف | — | Top 5 | YYYY-MM-DD |
| ... | | | |

### Tab 3: Backlinks Acquired
| Source | URL | Anchor Text | Date | DA |
|---|---|---|---|---|
| Etisalat YP | | Nidham HR | | 35 |
| ... | | | | |

### Tab 4: GMB Reviews
| Customer | Stars | Date | Replied | Notes |
|---|---|---|---|---|
| ... | | | | |

### Tab 5: Press Coverage
| Publication | Article Title | Date | URL | Type |
|---|---|---|---|---|
| ... | | | | |

---

## 🎓 SEO Knowledge Refresher

### الـ Core Web Vitals (المعدلات اللازمة للترتيب الأعلى)
- **LCP** (Largest Contentful Paint): < 2.5s
- **INP** (Interaction to Next Paint): < 200ms
- **CLS** (Cumulative Layout Shift): < 0.1

**Test at:** https://pagespeed.web.dev/

### Schema Markup Validation
**Test at:** https://search.google.com/test/rich-results

### Search Console URLs
- **Main:** https://search.google.com/search-console
- **Sitemap submission:** GSC → Sitemaps
- **URL inspection:** GSC → URL Inspection (paste URL, click "Request Indexing")

### Useful SEO Tools
- **Ahrefs Webmaster Tools:** Free for site owners — https://ahrefs.com/webmaster-tools
- **Microsoft Clarity:** Free heatmaps — https://clarity.microsoft.com
- **Ubersuggest:** Limited free — https://neilpatel.com/ubersuggest/
- **Schema Markup Validator:** Free — https://validator.schema.org/

---

## ⚡ Quick Wins Checklist (الأشياء اللي اتعملت بالفعل)

### Code-level (✅ تم)
- [x] Sitemap.xml auto-generated (34 URLs)
- [x] Robots.txt configured
- [x] JSON-LD on all pages (6 schemas)
- [x] Optimized meta titles + descriptions
- [x] Canonical URLs + Arabic hreflang
- [x] Open Graph + Twitter Cards
- [x] FAQ schema on pricing page
- [x] BlogPosting schema on every post
- [x] BreadcrumbList schema on tools + posts
- [x] 10 high-quality blog posts (3000+ words combined per post)
- [x] 3 interactive calculators (link magnets)
- [x] Internal linking pillar-cluster model

### Manual tasks (لازم تعمليها بنفسك)
- [ ] Verify ownership in Google Search Console
- [ ] Submit sitemap to GSC
- [ ] Request indexing for top 5 pages
- [ ] Create Google Business Profile (use `GMB_CONTENT_PACK.md`)
- [ ] Submit to 30 B2B directories (use `B2B_DIRECTORIES_OUTREACH.md`)
- [ ] Send 5-7 press pitches (use `TECH_PRESS_OUTREACH.md`)
- [ ] Apply to ITIDA membership
- [ ] Create LinkedIn Company Page
- [ ] Launch on Product Hunt (planned event)

---

## 📈 6-Month Projection

| Month | Target | Status |
|---|---|---|
| 1 | All code SEO done, GSC + sitemap submitted, 5+ blog posts | ✅ Done in week 1 |
| 2 | 10+ blog posts, GMB live, 15+ directories | ✅ Code done; manual tasks pending |
| 3 | First press feature, 30+ directories, top-20 on primary keywords | TBD |
| 4 | Top-5 for "Bayzat alternative", 3+ press features | TBD |
| 5 | Top-3 for primary keywords, 50+ backlinks | TBD |
| 6 | **#1 for "نظام HR مصري"**, 50+ GMB reviews | TBD |

---

**Last Updated:** 2026-05-26
**Owner:** [اسم المسئول]
**Cadence:** Update this file every month with new resources / completed items.
