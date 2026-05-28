# نِظام (Nidham) — HR + CRM + AI Recruitment

**نظام إدارة موارد بشرية متكامل** للشركات المصرية — متوافق مع قانون العمل 12/2003 وقانون التأمينات 148/2019 و PDPL 151/2020.

## المميزات

| الوحدة | الوصف |
|--------|-------|
| **HR** | موظفين، حضور، إجازات، سلف، عقود، دوام |
| **Payroll** | رواتب شهرية/أسبوعية/يومية، تأمينات 11%، ضريبة دخل 2026، أوفرتايم قانوني (1.35/1.7/2.0) |
| **التقارير** | كشوف مرتبات Excel/PDF، نموذج 41 ضريبة، كشف بنك SIF/CSV، استمارات تأمينات 1/2/6 |
| **Recruitment** | وظائف عامة، تقديم، فرز سير ذاتية بالذكاء الاصطناعي |
| **CRM** | عملاء، تفاعلات، عقود، مسار تحويل مبيعات |
| **التسويق** | صفحات هبوط، حملات، إعلانات، صندوق وارد تواصل اجتماعي |
| **AI** | مساعد ذكي، فرز CV، توليد محتوى تسويقي، رد آلي على وسائل التواصل |
| **WhatsApp** | بوت للموظفين (حضور، إجازات، كشف مرتب) |
| **التوقيع الإلكتروني** | توقيع المستندات إلكترونياً |

## التقنيات

- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind CSS v4
- **Database:** Supabase (PostgreSQL + Auth + Storage + Vault للـ PII)
- **AI:** Anthropic Claude, Google Gemini 2.5 Flash, Groq
- **موبايل:** Expo/React Native
- **Desktop:** Electron
- **Enterprise:** Docker Compose + Kong API Gateway
- **Monitoring:** Sentry
- **Testing:** Vitest + Playwright + k6

## البدء

```bash
# 1. clone + install
npm install

# 2. انسخ .env.local.example إلى .env.local واملأ المفاتيح
cp scripts/.env.local.example .env.local

# 3. شغل
npm run dev
```

افتح http://localhost:3000

## الاختبارات

```bash
npm test              # Unit + integration (Vitest)
npm run test:e2e      # E2E (Playwright)
npm run test:load     # Load (k6)
npm run build         # Build إنتاجي
```

## النشر

- **SaaS:** Vercel (auto-deploy على `git push`)
- **Enterprise on-prem:** `enterprise/` (Docker Compose + Kong)
- **Mobile:** `mobile/` (Expo + EAS Build)
