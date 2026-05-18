# تقرير الاستعداد للإنتاج — Nidham SaaS

**تاريخ التقرير:** 2026-05-18
**النسخة:** commit `b2a1130` على branch `main`
**المُعِدّ:** مراجعة آلية متعمّقة للكود الفعلي (مش افتراضات)
**النطاق:** كل الـ codebase الحالي تحت `C:\Users\hr2\projects\nidham`

---

## 🚨 ملخص تنفيذي

النظام **مش جاهز** للبيع لشركات حقيقية. عندنا:

- **17 مكان حساس** في server actions ممكن super-admin فيها يعدّل / يمسح بيانات tenant تاني (RLS WITH CHECK مش بيحمي على update/delete).
- **حسابات قانونية غلط:** نسبة التأمينات 14% (الصح 11% للموظف)، الـ MAX insurable wage 12,600 ج (الصح 16,700 ج من يناير 2026)، شرايح الضريبة 2024 (مش 2026).
- **مفيش معالجة لـ:** التعيين/الفصل في نص الشهر، الإجازة بدون مرتب، الـ overtime القانوني (35% / 70% / 100%).
- **مفيش حماية أمان:** rate-limiting على login، 2FA، password complexity، Sentry/monitoring.
- **مفيش امتثال PDPL:** privacy policy، consent، right-to-delete، تشفير رقم قومي + بيانات بنكية.

**لا تبيع لأي شركة قبل ما الـ 🔴 Blockers تتحل.**

---

## 1️⃣ MULTI-TENANT SECURITY

### 1.1 جدول كل الجداول وحالة RLS

| الجدول | المهاجرة | فيها `company_id`؟ | RLS مفعّل؟ | ملاحظات |
|--------|----------|-------------------|------------|---------|
| `companies` | 001 | — (الجدول الأم) | ✅ | السياسة: `id = current_company_id()` |
| `profiles` | 001 | ✅ | ✅ | |
| `employees` | 002 | ✅ | ✅ | |
| `attendance` | 003 | ✅ | ✅ | |
| `customers` | 004 | ✅ | ✅ | |
| `interactions` | 005 | ✅ | ✅ | |
| `contracts` | 006 | ✅ | ✅ | |
| `subscriptions` | 007 | ✅ | ✅ | |
| `super_admins` | 008 | — (جدول عالمي) | ✅ | بقصد |
| `team_invitations` | 009 | ✅ | ✅ | |
| `payroll_periods` | 011 | ✅ | ✅ | |
| `payroll_entries` | 011 | ✅ | ✅ | |
| `jobs` | 012 | ✅ | ✅ | |
| `candidates` | 012 | ✅ | ✅ | |
| `applications` | 012 | ✅ | ✅ | |
| `leave_requests` | 015 | ✅ | ✅ | |
| `advance_requests` | 015 | ✅ | ✅ | |
| `permission_requests` | 015 | ✅ | ✅ | |
| `leave_balances` | 018 | ✅ | ✅ | |
| `audit_log` | 018 | ✅ | ✅ | بدون FK (مقصود — يفضل يفضل بعد حذف الشركة) |
| `shifts` | 024 | ✅ | ✅ | |
| `shift_rotations` | 024 | ✅ | ✅ | |
| `salary_history` | 035 | ✅ | ✅ | |
| `employee_retention_insights` | 035 | ✅ | ✅ | |
| `bulk_bonus_runs` | 036 | ✅ | ✅ | |
| `marketing_*` (5 جداول) | 037 | ✅ | ✅ | |
| `landing_pages` | 039 | ✅ | ✅ | |
| `lead_events` | 039 | ✅ | ✅ | |
| `meta_integrations` | 040 | ✅ | ✅ | |
| `meta_lead_imports` | 040 | ✅ | ✅ | |
| `tenant_feature_overrides` | 041 | ✅ | ✅ | |
| `social_accounts` | 043 | ❌ (super-admin only) | ✅ | بقصد — RLS بـ `is_super_admin()` |
| `social_posts` | 043 | ❌ (super-admin only) | ✅ | بقصد |
| `social_post_targets` | 043 | ❌ (super-admin only) | ✅ | بقصد |
| `social_comments` | 043 | ❌ (super-admin only) | ✅ | بقصد |
| `social_replies` | 043 | ❌ (super-admin only) | ✅ | بقصد |
| `social_settings` | 043 | ❌ (super-admin only) | ✅ | بقصد |
| `employee_documents` | 047 | ✅ | ✅ | |
| `public_holidays` | 048 | ✅ (NULL = عالمي) | ✅ | |

**الخلاصة على مستوى الـ schema:** ✅ كل جدول tenant-scoped عنده `company_id` ومحمي بـ RLS.

### 1.2 الـ Application Layer — Critical Issues

هنا اللي الـ schema بيغطّيش عليه. تذكير: مهاجرة 038 ادّت super-admin صلاحية SELECT-all على كل الجداول. الـ RLS WITH CHECK مش بيمنعهم من `.update()` أو `.delete()` على أي صف. لازم كل server action يضيف `.eq("company_id", callerCompanyId)` يدوي.

#### 🔴 17 server action بيـ update / delete من غير company_id check:

| # | الملف | السطر | المخاطرة |
|---|------|-------|----------|
| 1 | `src/app/dashboard/payroll/actions.ts` | 437–445 | `approvePayrollPeriod` — يقدر super-admin يعتمد دورة مرتبات tenant تاني |
| 2 | `src/app/dashboard/payroll/actions.ts` | 462–469 | `markPayrollAsPaid` — نفس الكلام |
| 3 | `src/app/dashboard/payroll/actions.ts` | 486–490 | `deletePayrollPeriod` — يحذف دورة مرتبات شركة تانية |
| 4 | `src/app/dashboard/payroll/[id]/[entryId]/page.tsx` | 49–55 | يقرأ payroll_entry بـ ID فقط (آمن للقراءة بفضل RLS — لكن خطر لو السوبر-أدمن دخّل ID صف tenant تاني) |
| 5 | `src/app/dashboard/attendance/review/actions.ts` | 56–66 | `updateAttendanceRow` — يعدّل حضور موظف tenant تاني |
| 6 | `src/app/dashboard/attendance/review/actions.ts` | 97 | `deleteAttendanceRow` — يمسح حضور tenant تاني |
| 7 | `src/app/dashboard/contracts/actions.ts` | 115–118 | `updateContract` |
| 8 | `src/app/dashboard/contracts/actions.ts` | 136 | `deleteContract` |
| 9 | `src/app/dashboard/customers/actions.ts` | 91–105 | `updateCustomer` |
| 10 | `src/app/dashboard/customers/actions.ts` | 123 | `deleteCustomer` |
| 11 | `src/app/dashboard/interactions/actions.ts` | 95–105 | `updateInteraction` |
| 12 | `src/app/dashboard/interactions/actions.ts` | 120–127 | `deleteInteraction` |
| 13 | `src/app/dashboard/jobs/actions.ts` | 141–158 | `updateJob` |
| 14 | `src/app/dashboard/jobs/actions.ts` | 176 | `deleteJob` |
| 15 | `src/app/dashboard/jobs/actions.ts` | 338–345 | `updateApplicationStatus` |
| 16 | `src/app/dashboard/jobs/actions.ts` | 360–366 | `saveApplicationNotes` |
| 17 | `src/app/dashboard/jobs/actions.ts` | 383 | `deleteApplication` |

**🔴 هذه الـ 17 مكان كلها BLOCKERS.** المخاطرة مش نظرية — super-admin أو حد عنده وصول للـ session token يقدر يدمر بيانات شركة عميلك.

### 1.3 الـ Endpoints العامة

- `/api/export/route.ts`: ✅ بيستخدم `.eq("company_id", ...)` صح. آمن.
- `/api/webhooks/meta-leads/route.ts`: webhook خارجي — لازم يتراجع، لكن واضح إنه بيستخدم `meta_integrations` بـ `external_id` يـ resolve الـ tenant.
- `/p/[slug]`: landing page عامة — `.eq("slug", ...)` فقط (RLS-protected by tenant ownership).

---

## 2️⃣ EGYPTIAN LEGAL COMPLIANCE

### 2.1 الضرائب — `src/lib/payroll.ts`

| البند | في الكود | الصح في 2026 | الحالة |
|-------|---------|--------------|--------|
| الإعفاء الشخصي | 20,000 ج / سنة | 20,000 ج / سنة | ✅ |
| شريحة 0% | **غير موجودة** | 0–40,000 ج | 🔴 خطأ كبير |
| شريحة 10% | 0–40,000 ج | 40,000–55,000 ج | 🔴 |
| شريحة 15% | 40k–55k | 55k–70k | 🔴 |
| شريحة 20% | 55k–70k | 70k–200k | 🔴 |
| شريحة 22.5% | 70k–200k | 200k–400k | 🔴 |
| شريحة 25% | 200k–400k | 400k–1.2M | 🔴 |
| شريحة 27.5% | فوق 400k | فوق 1.2M | 🔴 |
| Const الكود | `TAX_BRACKETS_2024` | يحتاج `TAX_BRACKETS_2026` | 🔴 |

> **النتيجة الفعلية:** موظف بمرتب 3,500 ج / شهر (~ 42k / سنة) المفروض ضريبته 200 ج / سنة فقط (2026)، في النظام بيدفع ~ 2,200 ج / سنة. **خصم زيادة 10× تقريباً**.

> **مصدر التحقق:** [PwC Egypt Tax Summaries 2026](https://taxsummaries.pwc.com/egypt/individual/taxes-on-personal-income), [Andersen Egypt — Personal Income Tax 2026](https://eg.andersen.com/personal-income-tax/), [KPMG Egypt Individual Tax Rates](https://kpmg.com/eg/en/home/services/tax/tax-tools-and-resources/tax-rates-online/individual-income-tax-rates-table.html).

### 2.2 التأمينات الاجتماعية

| البند | في الكود | الصح في 2026 | الحالة |
|-------|---------|--------------|--------|
| `SOCIAL_INSURANCE_RATE` (نصيب الموظف) | **14%** | **11%** | 🔴 خصم زيادة |
| نصيب صاحب العمل | غير محسوب | 18.75% | ❌ غير محسوب أصلاً |
| `MAX_INSURABLE_WAGE` | **12,600 ج** | **16,700 ج** (من 1/1/2026) | 🔴 |
| الحد الأدنى للأجر التأميني | **غير موجود** | 2,700 ج | ❌ غير معالج |
| تأمين صحي إضافي | **غير موجود** | 1% موظف، 3.25% صاحب عمل | ❌ غير موجود |
| تأمين أعضاء مجلس الإدارة | **غير موجود** | 21% flat على max الكامل | ❌ غير موجود |

> **النتيجة الفعلية لموظف مرتبه 15,000 ج:**
> - الكود: تأمينات = min(15000, 12600) × 14% = **1,764 ج**
> - الصح 2026: تأمينات = min(15000, 16700) × 11% = **1,650 ج**
> - فرق **114 ج زيادة** كل شهر على كل موظف.

> **مصدر التحقق:** [Mercans — Egypt Minimum/Maximum Insurable Wage 2026](https://mercans.com/resources/statutory-alerts/egypt-minimum-and-maximum-insurable-wage-limits-increase-for-social-insurance-from-2026/), [PwC Egypt — Other Taxes](https://taxsummaries.pwc.com/egypt/individual/other-taxes), [Arab Finance — NOSI raises insurable wage limits Jan 2026](https://www.arabfinance.com/en/news/newdetails/nosi-raises-insurable-wage-limits-starting-january-2026).

### 2.3 الأوفر تايم (قانون العمل)

| البند | في الكود | المتطلب القانوني | الحالة |
|-------|---------|-------------------|--------|
| Overtime نهاري (+35%) | ❌ غير موجود | 135% من الأجر العادي | ❌ |
| Overtime ليلي (+70%) | ❌ غير موجود | 170% من الأجر العادي | ❌ |
| Overtime راحة/عيد (+100%) | ❌ غير موجود | 200% من الأجر العادي | ❌ |
| `SalaryStructure.overtime` | رقم خام بيدخله الموظف | لازم يكون محسوب من الساعات | ⚠️ |
| استكشاف الـ shift ليلي أو نهاري | ❌ غير موجود | لازم — قانون العمل بيفرّق | ❌ |

> **النتيجة:** HR لازم يحسب الـ overtime بره النظام ويكتب الرقم. مفيش حماية لو نسي يضرب في الـ 1.35 / 1.7 / 2.0.

> **مصدر التحقق:** [Playroll — Egypt Working Hours & Overtime](https://www.playroll.com/working-hours/egypt), [Qureos — Working Hours & Overtime in Egypt May 2026](https://www.qureos.com/labor-laws/working-hours-and-overtime-in-egypt).

### 2.4 مكافأة نهاية الخدمة (EOS)

من مهاجرة `031_termination_and_eos.sql`:

| البند | الحالة |
|-------|--------|
| 0.5 شهر لكل سنة (أول 5 سنين) | ✅ صح |
| 1.0 شهر لكل سنة (بعد 5 سنين) | ✅ صح |
| Preview قبل التأكيد | ✅ موجود في `previewEOSGratuity` |
| Snapshot على `employees.eos_gratuity` بعد التأكيد | ✅ موجود |
| تحويل لمرتب الأساسي الحالي (مش وقت الاستحقاق) | ✅ منطقي |
| تعامل مع موظف فُصل قبل 5 سنين كاملة | ⚠️ لازم تتأكد من الـ rounding في الـ RPC |

**عام:** ✅ EOS سليم.

### 2.5 الأعياد الرسمية

- مهاجرة 048 بتعمل جدول `public_holidays` مع 33 عطلة 2026-2027.
- ✅ المتاح في `/dashboard/settings/holidays`.
- 🔴 **لكن** الـ payroll engine **مش بيشاور** على الجدول ده. عيد قومي بيقع يوم 25 يناير، الـ payroll مش بيعرف. لو الموظف "غائب" يوم عيد، النظام بيخصم منه.

---

## 3️⃣ PAYROLL EDGE CASES

| الحالة | الحالة في الكود |
|--------|------------------|
| موظف اتعين 15/الشهر — مرتب نسبي | ❌ **غير معالج** — بياخد شهر كامل |
| موظف اتفصل 20/الشهر — مرتب نسبي | ❌ **غير معالج** — مفيش "آخر دورة مرتبات" تتولد له (لكن الـ EOS بيشتغل) |
| إجازة بدون مرتب | ❌ **غير معالج** — `AttendanceBreakdown.leave` معاملة كأنها مدفوعة دايماً، مفيش `leave_type` |
| السلف (متعددة الأشهر) | ✅ موجود — مهاجرة 027 cycle-aware |
| المكافآت + الحوافز | ⚠️ بيدخلهم HR يدوي — مفيش auto-calc |
| شيفت بيعدّي منتصف الليل (مثلاً 22:00–06:00) | ⚠️ `workedHours()` في `src/lib/attendance.ts` بيعالجها صح (overnight = +24h) — لكن من غير night premium |
| عيد رسمي في وسط شهر العمل | ❌ **غير معالج** — مفيش join مع `public_holidays` |
| تغيير راتب الموظف بعد تشغيل الـ payroll | ✅ snapshot — الـ payroll entry بياخد القيم وقت التشغيل |
| Weekly pay frequency | ⚠️ structural (مهاجرة 026) — لكن نفس الـ math (مفيش raw daily calc مخصوص) |

---

## 4️⃣ AUTHENTICATION & SESSION

| البند | الحالة |
|-------|--------|
| طول كلمة السر الأدنى | ✅ 8 على signup (`src/app/login/actions.ts:48`), 6 على login (HTML5) |
| تعقيد كلمة السر (capital, رقم, رمز) | ❌ **غير موجود** — "12345678" يمر |
| Rate limiting على login | 🔴 **غير موجود** — brute force attack وارد |
| Rate limiting على AI | ✅ موجود — `src/lib/rate-limit.ts` (in-memory bucket, مش يعمل scale أفقياً) |
| 2FA / MFA | ❌ **غير موجود** — لا TOTP، لا email OTP |
| Session duration | ⚠️ 3600 ثانية (1 ساعة) — مع auto-refresh بواسطة Supabase middleware |
| Logout يمسح cookies/tokens | ✅ `src/app/login/actions.ts:73-78` — `supabase.auth.signOut()` |
| Middleware يحمي `/dashboard/*` و `/admin/*` | ✅ في `src/lib/supabase/middleware.ts` |
| Cookie security flags (HttpOnly/Secure/SameSite) | ⚠️ معتمد على Supabase defaults — مفيش override صريح |
| Generic login error (anti-enumeration) | ✅ "البريد أو كلمة السر غلط" — مش بيكشف لو الإيميل موجود |
| Re-auth على تغيير كلمة السر | ✅ `src/app/dashboard/profile/actions.ts:41-89` |

**RBAC:**
- ✅ Helpers موجودين: `requireHR()`, `requireAdmin()`, `requireHRPage()`, `isHR()`, `getMyProfile()`
- ✅ معظم الـ server actions بتستدعي `requireHR()` أو `requireAdmin()` في الأول
- ⚠️ `updateMyProfile()` بيتأكد بس من الـ session، مفيش role gate (لكن منطقي — موظف بيعدّل نفسه)
- ⚠️ `/api/ai/screen-cv` بيعمل role check يدوياً (مش بيستخدم helper) — شغال لكن inconsistent

---

## 5️⃣ DATA PROTECTION (PDPL 151/2020)

| البند | الحالة |
|-------|--------|
| Privacy Policy page | ❌ **غير موجود** — مفيش `/privacy` أو `/policy` أو `/terms` |
| Link من landing لـ privacy | ❌ **غير موجود** |
| Consent checkbox عند signup | ❌ **غير موجود** — مخالف PDPL Article 12 |
| تسجيل موافقة الموظف عند الإضافة | ❌ **غير موجود** — مفيش `consent_recorded_at` |
| تسجيل موافقة العميل (CRM) عند الإضافة | ❌ **غير موجود** |
| تصدير كل بيانات الشركة | ✅ موجود — `/api/export` بيـ Excel فيه (employees + customers + attendance + interactions) |
| تصدير بيانات الموظف نفسه | ❌ **غير موجود** — API admin-only |
| "حذف حسابي" (الموظف) | ❌ **غير موجود** |
| "إلغاء الاشتراك + حذف الشركة" (الأدمن) | ❌ **غير موجود** |
| Audit log للتعديلات | ✅ موجود في `/dashboard/audit-log` |
| Audit log للقراءة (SELECT) | ❌ **غير موجود** — مش بيعرف مين شاف مرتب مين |
| إخفاء PII في الـ audit log | ✅ مهاجرة 022 بتمسح national_id, social_insurance_number, bank_account_number, bank_name |
| Data retention policy (auto-purge) | ❌ **غير موجود** — البيانات بتفضل forever |
| تشفير الرقم القومي at-rest | ❌ **غير موجود** — plaintext في `employees.national_id` |
| تشفير الحساب البنكي at-rest | ❌ **غير موجود** — plaintext في `employees.bank_account_number` |
| تشفير المرتبات at-rest | ❌ **غير موجود** — plaintext |
| تشفير social media tokens at-rest | ✅ موجود — `pgp_sym_encrypt()` في `social_accounts.access_token_encrypted` |
| Anonymization على الموظف المفصول | ❌ **غير موجود** — بياناته بتفضل كاملة forever |

**🔴 ده Blocker قانوني.** الـ PDPL بيتطلب صراحة:
- Article 12: lawful basis (الموافقة الصريحة)
- Article 17: حق الحذف
- Article 19: حق نقل البيانات
- Article 5: تشفير البيانات الحساسة

---

## 6️⃣ ERROR MONITORING & LOGGING

| البند | الحالة |
|-------|--------|
| Sentry / Datadog / LogFlare / NewRelic | ❌ **غير موجود** — صفر external monitoring |
| Global error boundary (`src/app/error.tsx`) | ✅ موجود — بيلوغ console، يعرض Arabic UI + digest ID |
| Per-route error boundaries | ⚠️ موجودين لكن مش متفحصين بالتفصيل |
| `/api/health` أو `/api/status` | ❌ **غير موجود** — مفيش way تعرف لو السيستم down |
| Try/catch في API routes | ✅ موجود (مثلاً `/api/ai/screen-cv` بيلوغ failures على DB) |
| Silent failures (fire-and-forget) | ⚠️ موجودة — sendEmail في requests action بتخفي fails (المهم: الـ approve لسه بيمشي) |
| Console errors بتظهر في الـ Production | ⚠️ بـ console.error فقط — مفيش aggregation |

**🔴 لو حصل error في production، انت **مش هتعرف**.** التطبيق ممكن يفشل لـ 10% من المستخدمين لساعات قبل ما حد يبلّغك.

---

## 7️⃣ REPORTS & EXPORTS

| البند | الحالة |
|-------|--------|
| كشف المرتبات Excel | ✅ موجود — `src/lib/payroll-export.ts:buildPayrollXlsx` |
| ملف بنك CSV عام | ✅ موجود — `buildBankCsv` |
| ملف بنك SIF (CIB / NBE) | ✅ موجود — `buildBankSif` بـ pipe-delimited format |
| Payslip PDF | ✅ موجود — `src/app/print/payslip/[entryId]/page.tsx` |
| Tax certificate (نموذج 41) | ✅ موجود — `/dashboard/payroll/tax-certificate/[employeeId]` |
| شهادة عمل (employment certificate) | ❌ **غير موجود** |
| استمارة 1 تأمينات (تسجيل عامل) | ❌ **غير موجود** كصفحة — مذكورة في `compliance-data.ts` checklist فقط |
| استمارة 2 تأمينات (تعديل أجر) | ❌ **غير موجود** كصفحة |
| استمارة 6 تأمينات (ترك خدمة) | ❌ **غير موجود** كصفحة |
| استمارة 7 تأمينات (إجازة مرضية) | ❌ **غير موجود** كصفحة |
| استمارة 1 مكتب العمل | ❌ **غير موجود** |
| Export قائمة الموظفين Excel | ❌ **غير موجود** |
| Export الحضور Excel | ❌ **غير موجود** (في تقرير HTML فقط) |
| Forms موجودين (`/dashboard/forms/`) | ✅ 9 forms: hr-letter, offer-letter, employment-contract, performance-evaluation, monthly-evaluation, promotion, investigation-memo, job-application-admin, job-application-trade |
| تقرير الحضور | ✅ موجود في `/dashboard/reports/attendance` |
| Bridge Analytics | ✅ موجود في `/dashboard/reports/bridge` |

**الخلاصة:** الـ payroll exports + tax certificate ممتازين. لكن **استمارات التأمينات والعمل الرسمية مش موجودة** — لو عميلك بيدفع بـ Nidham هيحتاج يطلع الاستمارات دي من الموقع الرسمي يدوياً.

---

## 8️⃣ PERFORMANCE & SCALABILITY

### Indexes (✅ معظمها سليم)

- `employees`: `(company_id)`, `(company_id, status)` ✅
- `attendance`: `(company_id)`, `(employee_id, date)`, `(company_id, date)` ✅
- `audit_log`: `(company_id, created_at desc)`, `(table_name, row_id)`, `(actor_id)` ✅
- `payroll_entries`: `(company_id)`, `(period_id)`, `(employee_id)` — ⚠️ ناقص composite `(company_id, period_id)` للـ lookups السريع
- `lead_events`: 5 indexes ✅
- `employee_documents`: indexes صحيحة

### N+1 Queries

✅ **مفيش N+1 في الكود اللي اتفحص.** كل صفحة بتعمل query واحد أو Promise.all batches. الـ Map/Set patterns بتستخدم للـ in-memory grouping بعد ما البيانات اتجابت دفعة واحدة.

### Pagination

| الصفحة | Pagination | المخاطرة |
|--------|-----------|----------|
| `/dashboard/employees` | ❌ **مفيش** — بتجيب الكل | يبطّأ على 2,000+ موظف |
| `/dashboard/customers` | ❌ **مفيش** | يبطّأ على 2,000+ عميل |
| `/dashboard/attendance/logs` | ✅ 100/صفحة | |
| `/dashboard/audit-log` | ✅ 30/صفحة (keyset) | |
| `/dashboard/payroll` (list) | ❌ **مفيش** — بيجيب كل الـ periods | يبطّأ بعد سنين من التشغيل |

### Caching

- ✅ `force-dynamic` على كل `/dashboard/*` (صحيح للـ admin tools)
- ❌ مفيش Redis / Upstash — معتمد على Supabase + Next.js cache
- ⚠️ بعد 1,000+ موظف، الـ employees page هيحتاج caching layer

### الأداء تحت ضغط

- ⚠️ **لم نُجرِ load test فعلي بـ 200 موظف** — الـ k6 scripts بتيست `/` و `/login` فقط (anonymous routes). محتاج k6 script للـ `/dashboard/employees` (authenticated) قبل الإنتاج.

---

## 9️⃣ BACKUP & DISASTER RECOVERY

| البند | الحالة |
|-------|--------|
| Supabase auto-backup | ✅ متاح حسب الـ plan (Free: 7 days PITR، Pro: 14 days، Team: 28 days) |
| موثق إنه شغال؟ | ⚠️ سطر واحد في `docs/training-guide-ar.md` بس |
| Restore drill (تجربة استعادة فعلية) | ❌ **غير موجود** — مفيش checklist أو سكربت لاستعادة tested |
| RPO / RTO موثقين | ❌ **غير موجود** — مفيش SLA مع العميل |
| Enterprise backup scripts | ✅ موجودين في `enterprise/INSTALL_AR.md` (backup.ps1 / restore.ps1) — للـ on-prem فقط |
| إمكانية العميل يصدر كل بياناته (Egress) | ✅ موجود — `/api/export` |
| Off-site / second-region backup | ❌ **غير موجود** — كل النسخ على Supabase نفس الـ region |

---

## 🔟 DOCUMENTATION

| الملف | الحالة |
|-------|--------|
| `README.md` (root) | ⚠️ **Next.js boilerplate فقط** — مفيش ذكر Nidham |
| `CLAUDE.md` / `AGENTS.md` | ✅ موجودين (دليل المطورين الـ AI) |
| `docs/training-guide-ar.md` | ✅ **ممتاز** — 23KB دليل عربي لـ HR (login, dashboard, employees, attendance, payroll, requests, mobile, checklist) |
| `enterprise/INSTALL_AR.md` | ✅ موجود — دليل on-prem |
| `enterprise/docs/architecture.md` | ✅ موجود — Docker Compose stack architecture |
| `tests/README.md` + `tests/uat/README.md` | ✅ موجودين (لسه طازة من commits اليوم) |
| دليل API integration (للعملاء الـ enterprise) | ❌ **غير موجود** |
| Changelog / Release notes | ❌ **غير موجود** — مفيش `CHANGELOG.md` |
| Security policy (`SECURITY.md`) | ❌ **غير موجود** — مفيش responsible disclosure path |
| Code of Conduct | ❌ غير موجود (مش حرج) |
| License | ⚠️ يحتاج تحقق — مفيش `LICENSE` ظاهر |

---

## 📊 ملخص بصرى

| القسم | Critical 🔴 | Important ⚠️ | OK ✅ |
|-------|-------------|---------------|-------|
| 1️⃣ Multi-tenant | **17** أماكن في server actions | لا | جداول + RLS schema |
| 2️⃣ Legal compliance | تأمينات + ضريبة 2026 + overtime | EOS rounding | جدول العطلات |
| 3️⃣ Payroll edge cases | hire/term pro-ration، unpaid leave، holidays join | weekly math | advances، snapshots |
| 4️⃣ Auth | rate limit، 2FA | password complexity، cookie flags | logout، RBAC |
| 5️⃣ Data Protection | privacy policy، consent، delete، encryption | retention | audit log، export |
| 6️⃣ Monitoring | Sentry، /health | silent fails | error boundary |
| 7️⃣ Reports | استمارات تأمينات، شهادة عمل | لا | payroll exports، tax cert |
| 8️⃣ Performance | لا | pagination على employees/customers، composite index | indexes، no N+1 |
| 9️⃣ Backup | restore drill، RPO/RTO | docs ضعيفة | Supabase auto |
| 🔟 Docs | لا | root README، CHANGELOG، SECURITY | training guide |

---

## 🎯 الأولويات للإصلاح

### 🔴 Blockers — لازم قبل أول عميل بيدفع (P0)

1. **🔐 الـ 17 RLS bypass في server actions** (قسم 1.2) — كل واحد فيهم إضافة `.eq("company_id", profile.company_id)` على الـ update/delete، ساعة شغل ماكسيمم.
2. **💰 تحديث `payroll.ts` لـ 2026:**
   - `SOCIAL_INSURANCE_RATE`: 0.14 → 0.11
   - `MAX_INSURABLE_WAGE`: 12,600 → 16,700
   - إضافة min insurable wage = 2,700
   - شرايح الضريبة: استبدل `TAX_BRACKETS_2024` بـ `TAX_BRACKETS_2026` (شريحة 0% + shifts كاملة)
   - إضافة employer's share (18.75%) — مش بيتخصم من الموظف، بس بيظهر في الـ report للشركة
3. **🛡 Rate limiting على `/login`** — Upstash Ratelimit أو @upstash/redis، 10 محاولات/ساعة لكل IP
4. **📜 Privacy Policy page + consent checkbox على signup** — مخالف PDPL 151/2020
5. **🚨 إضافة Sentry (أو حاجة مشابهة)** — مينفعش تطلع للسوق بدون monitoring
6. **🆘 `/api/health` endpoint** — للـ Vercel/Supabase uptime monitoring
7. **🔒 تشفير `national_id` + `bank_account_number` بـ `pgp_sym_encrypt`** — PII حساس بـ plaintext في DB حالياً

### 🟡 Important — في أول شهر بعد الـ launch (P1)

8. **⏰ Overtime رسمي:** أضف `night_shift_hours` و `holiday_hours` لـ `payroll_entries`، طبّق 35% / 70% / 100%
9. **📅 Holiday join في الـ payroll:** اقرأ `public_holidays` لما تحسب أيام العمل
10. **📆 Pro-ration للتعيين والفصل في نص الشهر** — استخدم `hire_date` و `termination_date` لحساب نسبة الشهر
11. **🌴 Unpaid leave:** أضف `leave_type` على `attendance.status` (paid/unpaid/sick)
12. **📝 Right-to-delete:** `/dashboard/profile/delete-account` و `/dashboard/settings/delete-company` (مع grace period 30 يوم)
13. **📋 الاستمارات الرسمية:** استمارة 1 / 2 / 6 / 7 + شهادة عمل
14. **📄 Pagination على employees + customers + payroll** قبل أول عميل بـ 1000+ موظف
15. **🔑 Password complexity:** أقل حاجة 8 حروف + رقم + capital
16. **🔁 2FA على الـ admin role** — حتى لو optional في البداية

### 🟢 Nice to have — بعد كده (P2)

17. **🛡 Audit log SELECT (مين شاف مرتب مين)** — لـ enterprise tier
18. **🗄 Data retention policy:** auto-anonymize للـ terminated employees بعد 2-3 سنين
19. **🌐 Restore drill** على staging كل 3 شهور (موثقة)
20. **📈 Load test على /dashboard/employees بـ 500-2000 موظف** (محتاج Playwright/k6 با auth)
21. **🏥 Health checks متعمقة:** DB ping, Supabase status, AI provider status
22. **📊 Composite index على `payroll_entries(company_id, period_id)`**
23. **📚 Root `README.md` يتعاد كتابته** بـ Nidham-specific overview
24. **📒 `CHANGELOG.md` + `SECURITY.md`** للـ enterprise contracts
25. **🔄 Self-export للموظف** عن بياناته الشخصية
26. **🎓 API documentation** لو هنبيع integrations

---

## 📌 ملاحظات نهائية للمالك

1. **مفيش حاجة من اللي فوق تتغير لحد ما أنت تراجع التقرير وتقرر.** زي ما طلبت — تقرير بس، مش fixes.
2. **الـ 17 RLS bypass** هما أخطر حاجة. لو السوبر-أدمن حساب بتاعك (basemazab@) تسرّب بأي شكل، المهاجم يقدر يفسد بيانات كل العملاء.
3. **حساب المرتبات الغلط** هيخلي أي شركة بتستخدمك تدفع لمصلحة الضرائب والتأمينات أرقام غلط — أنت **مسؤول قانونياً** عن الفرق.
4. **مفيش privacy policy + consent** = مخالفة PDPL = غرامة تصل لـ **5 مليون جنيه + سجن**.
5. **مفيش monitoring** = أنت أعمى. أول bug يحصل في الإنتاج هتعرف منه من العميل.

**ابدأ بالـ 7 Blockers (P0).** لو كل واحد منهم ساعة شغل، يبقى يوم كامل عشان النظام يكون آمن للبيع. بعدها نشتغل على P1 خلال أول شهر launch.

---

**انتهى التقرير. الكلمة دلوقتي لك يا باسم.**
