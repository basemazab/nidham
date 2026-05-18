# UAT — User Acceptance Testing

UAT is **business validation**, not technical testing. It answers:
> *"لو سلّمت السيستم ده لـ HR Manager مصري ما بيعرفش يكتب كود، هل هيقدر يدير شركته بيه؟"*

## الفايلز

| File | الوصف |
| ---- | ----- |
| [`UAT_PLAN.md`](./UAT_PLAN.md) | الخطة الكاملة — 27 سيناريو على 12 قسم (A–L) |
| [`seed-test-tenant.ts`](./seed-test-tenant.ts) | سكربت بيعمل tenant تيست بـ 50 موظف + شهر حضور |
| [`EXECUTION_LOG_TEMPLATE.md`](./EXECUTION_LOG_TEMPLATE.md) | Template للمختبر يملاه أثناء التيست |
| [`SIGNOFF.md`](./SIGNOFF.md) | وثيقة الاعتماد الرسمي بتوقيعات |

## خطوات الـ UAT Cycle

### 1) تجهيز البيئة (5 دقايق)

تأكد إنك عندك في `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...    # السر — مش الـ anon!
```

### 2) ضخ بيانات التيست (30 ثانية)

```bash
npx tsx tests/uat/seed-test-tenant.ts
```

ده هيـ:
- يحذف tenant التيست القديم (لو موجود)
- يعمل شركة "شركة الاتحاد للتيست"
- يضيف 50 موظف بأسماء عربية حقيقية وأقسام متنوعة
- يولّد شهر حضور كامل (يناير 2026)
- يضيف 5 عملاء

في الآخر هيطلعلك Company ID. خده.

### 3) ربط حسابك بالـ tenant ده

عشان تـ login، لازم تكون عندك user مربوط بالشركة. أسرع طريقة:

1. اعمل signup عادي على `/signup` بأي إيميل
2. روح Supabase → Table Editor → `profiles`
3. حدّث الـ `company_id` للـ row بتاعك:
   ```sql
   UPDATE profiles
   SET company_id = '<company_id_من_السكربت>'
   WHERE id = '<your_user_id>';
   ```
4. Refresh الصفحة — هتلاقي نفسك في tenant التيست

### 4) تنفيذ السيناريوهات (4–5 ساعات)

1. انسخ `EXECUTION_LOG_TEMPLATE.md` لاسم جديد (مثلاً `EXECUTION_LOG_2026-05-18.md`)
2. افتح `UAT_PLAN.md` وامشي على السيناريوهات بالترتيب (A → L)
3. لكل سيناريو، حدّد ✅ نجح / ❌ فشل / 🚫 محظور
4. لو فشل، افتح GitHub Issue واكتب رقمه في عمود "Bug ID"

### 5) Sign-off (30 دقيقة)

1. لما تخلص، افتح `SIGNOFF.md`
2. املاه: عدد السيناريوهات اللي نجحت، الـ blockers، الـ bugs المتبقية
3. القرار النهائي:
   - ✅ **مقبول** — كل الـ blockers نجحت، مفيش critical bugs
   - ⚠ **مقبول مع تحفظات** — كل الـ blockers نجحت، فيه bugs High بـ hotfix plan
   - ❌ **مرفوض** — Blocker فاشل أو Critical bug مفتوح

4. توقع + ابعت لـ stakeholders

## نصايح

- **متعملش UAT بنفسك إن أمكن.** لو مختبرك هو نفس اللي بنى الفيتشر، هو مش هيشوف نقاط الضعف. حط HR حقيقي عليه.
- **خد screenshots لأي bug.** "الزرار مش بيشتغل" مش enough — احتاج تصوير + خطوات إعادة.
- **اعمل reset بين الـ cycles.** السكربت يحذف الـ tenant القديم لما تشغله تاني.
- **متفوتش الـ blockers.** لو blocker واحد فاشل، الـ release ما بيتشحنش، حتى لو كل التانيين passed.

## إعادة الاستخدام للـ Releases

كل release جديد، عيد التسلسل بالكامل:

1. Seed tenant جديد
2. Execute كل السيناريوهات (مش بس اللي اتغيرت)
3. Sign-off

السبب: حتى تعديل صغير ممكن يكسر سيناريو في قسم تاني. الـ UAT regression suite بالنسبة للـ business logic.
