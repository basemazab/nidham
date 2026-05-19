# دليل نقل المشروع لجهاز جديد

> الملف ده دليل عملي لـ **نقل مشروع Nidham من جهاز لجهاز** أو إعداد جهاز
> جديد. اقراه قبل ما تبدأ، وعمل copy للمفاتيح الحساسة قبل ما تمسح أي حاجة.

**الـ commit الحالي:** اعمل `git log -1 --oneline` لتعرف آخر commit عندك.
**الـ GitHub repo:** https://github.com/basemazab/nidham
**الـ Vercel project:** `nidham` (في dashboard.vercel.com)
**الـ Supabase project:** `whedifdmllooyejzuwrw` (في supabase.com)

---

## 📍 1. مكان المشروع الحالي

```
C:\Users\hr2\projects\nidham
```

كل التعليمات في الملف ده بتفترض إن المسار ده هو الـ source. لو على جهازك في
مكان مختلف، عدّل المسارات بعد كده.

---

## 🛠 2. المتطلبات على الجهاز الجديد

ثبّت دول قبل أي حاجة تانية:

| الأداة | النسخة | الـ Download |
|--------|--------|--------------|
| Git | 2.40+ | https://git-scm.com/download/win |
| Node.js | v20 LTS | https://nodejs.org |
| PowerShell | 5.1+ (مدمج في Windows) | — |
| VS Code (موصى) | الأحدث | https://code.visualstudio.com |
| Expo Go على iPhone | الأحدث | App Store |

تأكد من التثبيت بعد ما تخلص:

```powershell
git --version       # المفروض >= 2.40
node --version      # المفروض v20.x
npm --version       # المفروض >= 10
```

---

## 🚀 3. طريقتين لنقل المشروع

### الطريقة A — Git clone (موصى ✅)

أنضف، أسرع، وبتاخد آخر نسخة دايماً. كل اللي في `master/main` على GitHub
بـ Push من الجهاز القديم → Pull على الجهاز الجديد.

```powershell
# على الجهاز الجديد
cd C:\Users\<اسم_المستخدم>\projects
git clone https://github.com/basemazab/nidham.git
cd nidham
```

> 🔑 **GitHub authentication:**
> هتطلب منك username + password (أو token). استخدم **Personal Access Token**:
> 1. GitHub.com → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
> 2. Generate new token → اعطه `repo` scope
> 3. انسخه واستخدمه كـ password
>
> ولّد token جديد لكل جهاز — متستخدمش نفسه على جهازين.

### الطريقة B — نسخ المجلد كاملاً

استخدمها لو فيه شغل لسه ما عملتش له commit، أو لو الجهاز الجديد ما عندوش
إنترنت.

```powershell
# على الجهاز القديم - مهم تستثنِ node_modules + .next
robocopy `
  C:\Users\hr2\projects\nidham `
  D:\backup\nidham `
  /MIR `
  /XD node_modules .next `
  /XF tsconfig.tsbuildinfo
```

بعدها انقل المجلد `D:\backup\nidham` على USB / OneDrive / Google Drive
إلى الجهاز الجديد.

---

## 🔐 4. الـ Secrets — الحاجة الأهم

في ملفات بيانات حساسة **مش موجودة في Git** عشان الأمان. لازم تنقلها يدوي.

### 4.1 ملف `.env.local`

في الـ root بتاع المشروع. عاوز تنسخه كما هو من الجهاز القديم.

**على الجهاز القديم:**
```powershell
type C:\Users\hr2\projects\nidham\.env.local
```

انسخ كل المحتوى. الملف عادة فيه:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://whedifdmllooyejzuwrw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...                    # ⚠️ سيكرت

# AI
GEMINI_API_KEY=AIza...
GROQ_API_KEY=gsk_...

# Meta (Facebook / Instagram)
META_APP_ID=...
META_APP_SECRET=...
META_ACCESS_TOKEN=...
META_ENCRYPTION_KEY=...

# Sentry (لو ظبطته)
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_DSN=https://...
SENTRY_ORG=...
SENTRY_PROJECT=nidham
SENTRY_AUTH_TOKEN=...
```

**على الجهاز الجديد:**

ضع الملف في `<project_path>\.env.local` بنفس المحتوى.

> 🚫 **متبعتش الـ secrets في chat / email / WhatsApp.** استخدم:
> - 1Password / Bitwarden vault
> - USB stick فيزيكي
> - Bitwarden Send (مشفّر، له expiry)

### 4.2 المفاتيح خارج الكود

دول لازم تكون عندك نسخة منهم في 1Password حتى لو ضاع الـ `.env.local`:

| المفتاح | فين موجود | الأهمية |
|---------|-----------|---------|
| **Supabase Vault encryption key** | داخل Supabase Vault | 🔴 **حرج** — لو ضاع، كل PII (national_id, bank info) للأبد |
| Supabase Service Role Key | `.env.local` + Vercel env vars | 🔴 حرج — وصول كامل للـ DB |
| Supabase Anon Key | `.env.local` + الموبايل app (hardcoded في `mobile/src/lib/supabase.ts`) | 🟡 مهم |
| Sentry DSN + Auth Token | Vercel env vars | 🟡 مهم |
| GitHub Personal Access Token | جهاز كل واحد ليه واحد منفصل | 🟢 يولّد جديد |

> 🔑 **الـ Supabase Vault encryption key الحالي:**
> `f8d124a188b47bf620ce9f27f165eb02cab3d25f80d1a8b5df36a04f60bb40b1`
>
> ⚠️ **مهم:** ده الـ key اللي اتولّد أثناء الـ chat session فاللي ممكن يكون في
> history. لو هتـ launch فعلياً للإنتاج، ولّد واحد جديد محلياً وعمل rotate في
> Supabase Vault (`vault.update_secret(...)`).
>
> احفظه الآن في 1Password بـ entry اسمه:
> *"Nidham — PII Encryption Key (DO NOT LOSE)"*

### 4.3 الـ Vercel environment variables

كل اللي في `.env.local` المفروض موجود برضو على Vercel:

1. روح **vercel.com → project nidham → Settings → Environment Variables**
2. اعمل screenshot من كل القيم (الـ values مخفية بعد ما تتحفظ بس asma أسماء الـ keys ظاهرة)
3. لو محتاج تعدل، حدّث على Vercel + الـ `.env.local`

---

## 📦 5. تنصيب الـ Dependencies

بعد ما clone أو copy وضع الـ `.env.local`:

```powershell
cd C:\Users\<اسمك>\projects\nidham

# الـ web app (Next.js + كل اللي مرتبط)
npm install

# الـ mobile app (Expo + React Native)
cd mobile
npm install
cd ..
```

`npm install` بياخد 3-5 دقايق أول مرة. لو ظهر warnings عن peer dependencies
اتجاهلهم — متعرض الـ deps محقّقة.

---

## ✅ 6. تأكد إن كل حاجة شغّالة

```powershell
# Type-check نضيف
npx tsc --noEmit
# المفروض: مفيش أي output

# الـ tests
npm test
# المفروض: 80 / 80 ناجحين

# الـ dev server
npm run dev
# افتح http://localhost:3000 وشوف الـ landing page

# الـ mobile (في tab جديد)
cd mobile
npm start
# QR code يطلع — صوّرها من iPhone Camera
```

---

## 🔄 7. Workflow اليومي على الجهاز الجديد

### قبل البدء بكل جلسة:

```powershell
cd C:\Users\<اسمك>\projects\nidham
git pull origin main          # خد آخر تغييرات
npm install                   # لو فيه dependencies جديدة
```

### بعد كل تغيير:

```powershell
git add <الملفات_اللي_اتغيرت>
git commit -m "<وصف_التغيير>"
git push origin main
```

### تشغيل الموبايل + الويب مع بعض:

افتح **terminal واحد**:
```powershell
npm run dev
```

افتح **terminal تاني**:
```powershell
cd mobile
npm start
```

اللي يحصل: الويب على `localhost:3000`، الموبايل على Expo Go.

---

## 🆘 8. مشاكل شائعة

| المشكلة | الحل |
|---------|------|
| `npm install` بطيء أو معلّق | اقفله، شغّل `npm cache clean --force`، ثم `npm install` تاني |
| `git pull` بيقول conflicts | `git stash` ثم `git pull` ثم `git stash pop` (لو فيه شغل محلي) |
| الـ dev server بيدّيك `Module not found` بعد pull | `rm -rf node_modules .next && npm install` |
| Vercel deploy بيـ fail | شوف logs على Vercel — غالباً `.env.local` ناقص فيه variable |
| `npx tsc --noEmit` بيدي errors | `npm install` اشتغل صح؟ هل كل الـ types موجودة؟ |
| Mobile Expo QR مش بيشتغل | Wi-Fi نفس الشبكة + Firewall على port 8081 |
| Supabase rejects encryption | تأكد إن Vault `app_encryption_key` معمول على Supabase |

---

## 🌐 9. Vercel Deployment

لو الجهاز الجديد هتعمل deploy منه:

### مرة واحدة:
```powershell
npm install -g vercel
vercel login
# سجل دخول بنفس الـ GitHub account المربوط بـ Vercel
```

### كل deploy:
```powershell
git push origin main
# Vercel تلقائياً بيـ build + deploy على Production
```

أو manually:
```powershell
vercel --prod
```

---

## 📱 10. Mobile Build (Production APK / IPA)

لو محتاج تبني APK/IPA للـ stores:

```powershell
cd mobile
npm install -g eas-cli
eas login
eas build --platform ios
eas build --platform android
```

تفاصيل أكتر في `mobile/README.md`.

---

## 🗂 11. Project Structure (مرجع سريع)

```
nidham/
├── src/                          # كود الـ Next.js web app
│   ├── app/                      # App router (الصفحات + API routes)
│   ├── lib/                      # Helpers: supabase, payroll, format, etc.
│   ├── components/               # React components مشتركة
│   └── lib/supabase/             # Supabase client wrappers
├── db/
│   └── migrations/               # SQL migrations 001 → 050 (مرتبة)
├── mobile/                       # Expo / React Native app للموظفين
│   ├── app/                      # Expo Router screens
│   ├── src/                      # lib + components
│   └── README.md                 # دليل الـ mobile
├── tests/                        # Vitest + Playwright + k6 + UAT
├── docs/                         # docs/SENTRY_SETUP.md، training-guide-ar.md
├── enterprise/                   # On-prem Docker Compose stack
├── desktop/                      # (إن وجد) Tauri desktop wrapper
├── public/                       # static assets
├── scripts/                      # helper scripts (screenshot capture)
├── package.json                  # web app dependencies + scripts
├── next.config.ts                # Next.js + Sentry config
├── vitest.config.ts              # tests config
├── playwright.config.ts          # E2E tests config
├── .env.local                    # 🔐 الـ secrets (مش في git)
├── CLAUDE.md                     # تعليمات للـ Claude لما يساعدك
├── AGENTS.md                     # تعليمات للـ AI agents
├── PRODUCTION_READINESS_AUDIT.md # تقرير الـ audit (P0 / P1 / P2)
└── SETUP_NEW_MACHINE.md          # الملف ده ✋
```

---

## 🎯 12. Checklist للجهاز الجديد (سريع)

نسخ → الصق → نفّذ بالترتيب:

```powershell
# 1. ثبّت Git + Node v20 + Expo Go على iPhone

# 2. Clone
cd C:\Users\<اسمك>\projects
git clone https://github.com/basemazab/nidham.git
cd nidham

# 3. ضع .env.local من 1Password / USB

# 4. Install
npm install
cd mobile && npm install && cd ..

# 5. تأكد
npx tsc --noEmit
npm test

# 6. شغل
npm run dev
# في tab تاني:
cd mobile && npm start
```

لو الخطوات الـ 6 دي اتمشيت بنجاح، انت **جاهز تكمل من الجهاز الجديد**.

---

## 📞 13. اتصال

- **GitHub:** https://github.com/basemazab/nidham
- **Vercel:** dashboard.vercel.com (project: nidham)
- **Supabase:** supabase.com (project: whedifdmllooyejzuwrw)
- **Sentry:** sentry.io (لو ظبطته)

---

**آخر تحديث للملف ده:** 2026-05-19
**كاتبه:** Claude (في session مع باسم)
