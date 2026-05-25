// ============================================================================
// /beta-terms — Beta Program Terms (شروط برنامج Beta)
// ============================================================================
//
// Documents the actual contract behind the "3 months free + 50% off for a
// year" Beta offer that's promoted everywhere. Without this, Nidham has
// promised a benefit to "first 10 companies" with no clarity on:
//   - case study rights
//   - feedback IP
//   - post-Beta conversion mechanics
//   - what happens if the customer wants to leave Beta early

import Link from "next/link";

export const metadata = {
  title: "شروط برنامج Beta | نِظام",
  description:
    "شروط الانضمام لبرنامج Nidham Beta — 3 شهور مجاناً + 50% خصم سنة، في مقابل feedback + testimonial اختياري.",
};

export const BETA_TERMS_VERSION = "v1.0";
export const BETA_TERMS_LAST_UPDATED = "2026-05-25";

export default function BetaTermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-amber-50/30 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-sm text-brand-cyan-dark hover:underline font-cairo mb-6 inline-block"
        >
          ← الرجوع للصفحة الرئيسية
        </Link>

        <header className="mb-10 pb-6 border-b border-slate-200">
          <div className="inline-block px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold mb-3 font-cairo">
            🎁 برنامج Beta — لأول 10 شركات فقط
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-cairo text-slate-900 mb-3">
            شروط برنامج Beta
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            النسخة {BETA_TERMS_VERSION} · آخر تحديث: {BETA_TERMS_LAST_UPDATED}
          </p>
        </header>

        <section className="mb-8 p-5 rounded-2xl bg-amber-50 border-2 border-amber-300">
          <h2 className="text-lg font-black font-cairo text-amber-900 mb-2">
            ⚡ ملخص العرض
          </h2>
          <div className="space-y-2 text-sm font-cairo text-amber-900 leading-relaxed">
            <div>
              <strong>اللي بتاخده:</strong> 3 شهور مجاناً + 50% خصم لسنة كاملة بعدها على باقة Pro (قيمتها 18,000 ج/سنة)
            </div>
            <div>
              <strong>اللي بتعطيه:</strong> استخدام فعلي للنظام + اجتماع feedback كل أسبوعين (20 دقيقة) + testimonial **اختياري** بعد 3 شهور
            </div>
            <div>
              <strong>المدة:</strong> 3 شهور Beta + 12 شهر بـ 50% خصم = 15 شهر إجمالاً بسعر مخفّض
            </div>
          </div>
        </section>

        <article className="prose prose-slate max-w-none font-cairo space-y-8">

          <Section title="1. شروط الأهلية">
            شركتك مؤهلة لـ Beta لو:
            <ul>
              <li>✅ <strong>30 - 200 موظف</strong> (الـ ICP الأساسي لـ Nidham)</li>
              <li>✅ مسجّلة قانونياً في <strong>مصر</strong></li>
              <li>✅ بتستخدم <strong>Excel أو نظام HR قديم</strong> دلوقتي</li>
              <li>✅ صاحب القرار (Owner / HR Manager) هو اللي بيتواصل معانا</li>
              <li>✅ مستعدة لاجتماع feedback نص شهري لمدة 3 شهور</li>
            </ul>
            <p className="mt-3 text-sm">
              <strong>الشركة مش مؤهلة لو:</strong> أقل من 30 موظف (استخدم Free أو Starter بدل كده) أو أكتر من 200 موظف (استخدم Business أو Enterprise).
            </p>
          </Section>

          <Section title="2. اللي بتاخده انت">
            <ul>
              <li><strong>3 شهور مجاناً 100%:</strong> كل ميزات Pro plan (قيمتها 4,500 ج)</li>
              <li><strong>50% خصم لـ 12 شهر بعد ذلك:</strong> توفير 9,000 ج (السعر = 750 ج/شهر بدل 1,500)</li>
              <li><strong>Onboarding شخصي:</strong> Setup كامل + استيراد بياناتك من Excel/أي نظام سابق</li>
              <li><strong>Dedicated support:</strong> رد على رسائل واتساب خلال 15 دقيقة في وقت العمل</li>
              <li><strong>تدريب فريقك:</strong> جلسة 60 دقيقة مع HR + الموظفين على الـ mobile app</li>
              <li><strong>Roadmap input:</strong> اقتراحاتك بتاخد priority — لو طلبت feature معقول، بنبنيها</li>
              <li><strong>Early access:</strong> ميزات جديدة بتيجي لـ Beta عملاء قبل الباقي</li>
            </ul>
          </Section>

          <Section title="3. اللي بتعطيه انت">
            <ul>
              <li>
                <strong>استخدام فعلي:</strong> النظام لازم يكون شغّال على شركتك بمعدل
                استخدام طبيعي (مش بس signup وسيب). الـ أقل: تشغيل دورة مرتبات واحدة شهرياً.
              </li>
              <li>
                <strong>اجتماع feedback كل أسبوعين:</strong> 20 دقيقة عبر Google Meet أو
                WhatsApp Video. الموضوع: ايه الكويس، ايه المش كويس، ايه الناقص.
              </li>
              <li>
                <strong>Testimonial اختياري:</strong> بعد 3 شهور من الاستخدام، لو راضي،
                ممكن (اختياري) تكتب 2-3 جمل عن تجربتك تتنشر على الموقع + اللوجو
                بتاع شركتك. عندك حق veto على أي شيء بنكتبه قبل النشر.
              </li>
            </ul>
            <p className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-sm">
              ❌ <strong>اللي مش بنطلبه:</strong> فلوس، NDA، حصرية، إجبار على testimonial.
            </p>
          </Section>

          <Section title="4. حقوق الـ Feedback والـ IP">
            <ul>
              <li>
                <strong>الـ feedback اللي بتديهلنا:</strong> Nidham بياخد ملكيتها للتحسين
                وتطوير ميزات جديدة، بدون أي مقابل مادي لك.
              </li>
              <li>
                <strong>بياناتك:</strong> ملكك 100% — Nidham مجرد custodian (نفس قواعد
                <Link href="/privacy" className="text-brand-cyan-dark hover:underline mx-1">سياسة الخصوصية</Link>).
              </li>
              <li>
                <strong>اللوجو + التيستيمونيال:</strong> لو وافقت على الـ testimonial،
                Nidham يحق له يستخدمها على الموقع + Facebook + Instagram + برشورات + إعلانات لمدة 3 سنين.
              </li>
            </ul>
          </Section>

          <Section title="5. الانتقال من Beta لـ Paid">
            <p>
              بعد 3 شهور من بداية الـ Beta:
            </p>
            <ul>
              <li><strong>اليوم 91:</strong> يبدأ تطبيق الـ 50% خصم — السعر يصبح 750 ج/شهر بدل 1,500</li>
              <li><strong>الإخطار:</strong> بنبعتلك إيميل + رسالة واتساب قبل 14 يوم من نهاية الـ 3 شهور</li>
              <li><strong>الدفع:</strong> بيتم تلقائياً على نفس الـ payment method اللي حطيته (لو حطيت)</li>
              <li><strong>الإلغاء:</strong> تقدر تلغي قبل نهاية الـ 3 شهور بدون أي عقوبة + بدون أي دفع</li>
              <li><strong>بعد سنة (يوم 456):</strong> السعر يرجع للسعر الكامل (1,500 ج/شهر)</li>
            </ul>
          </Section>

          <Section title="6. لو حابب تخرج من Beta قبل 3 شهور">
            <ul>
              <li>✅ تقدر تخرج أي وقت بدون عقوبة</li>
              <li>✅ بياناتك ملكك — هتاخد export كامل بصيغة Excel/CSV</li>
              <li>✅ مش بنطلب منك سبب — بس لو ممكن نص أو رسالة قصيرة (اختياري) تساعدنا نتحسّن</li>
              <li>❌ بس متقدرش ترجع للـ Beta تاني لاحقاً — هتدفع السعر العادي</li>
            </ul>
          </Section>

          <Section title="7. حالات الإلغاء من جانب Nidham">
            بنحتفظ بحق إخراجك من Beta لو:
            <ul>
              <li>الاستخدام صفر لمدة 30 يوم متواصلين بدون سبب واضح</li>
              <li>تخلّفت عن 3 اجتماعات feedback متتالية بدون تواصل</li>
              <li>إساءة استخدام النظام (انتهاك <Link href="/terms" className="text-brand-cyan-dark hover:underline">الشروط والأحكام</Link>)</li>
            </ul>
            <p className="mt-3 text-sm">
              في كل الحالات دي، بنخبّرك قبل 7 أيام + بنديك chance للتفسير.
            </p>
          </Section>

          <Section title="8. كيف تنضم لـ Beta">
            <ol>
              <li>
                ابعت رسالة واتساب على{" "}
                <a href="https://wa.me/201055356622?text=أهلاً، عايز أنضم لـ Nidham Beta" className="text-brand-cyan-dark hover:underline" dir="ltr">
                  +20 105 535 6622
                </a>
              </li>
              <li>اكتب: اسم شركتك + عدد موظفين + نشاطها</li>
              <li>هنرتب معاك Demo 20 دقيقة للتأكد من المناسبة</li>
              <li>لو متفقين، بنبدأ Onboarding في نفس اليوم أو اليوم اللي بعده</li>
              <li>الـ 3 شهور Beta تبدأ من يوم تفعيل النظام</li>
            </ol>
            <p className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm">
              ⏰ <strong>المكان المتبقي:</strong> 7 من 10 (آخر تحديث: 25 مايو 2026). بنحدّث الرقم ده كل أسبوع.
            </p>
          </Section>

          <Section title="9. التواصل">
            <ul>
              <li>📱 واتساب: <a href="https://wa.me/201055356622" className="text-brand-cyan-dark hover:underline" dir="ltr">+20 105 535 6622</a></li>
              <li>📧 إيميل: <a href="mailto:nidhamhr@proton.me" className="text-brand-cyan-dark hover:underline" dir="ltr">nidhamhr@proton.me</a></li>
            </ul>
          </Section>

        </article>

        <footer className="mt-12 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500 font-cairo">
            برنامج Beta هو فرصة للاتنين معاً — انت تاخد قيمة بسعر مخفّض،
            وإحنا ناخد تجربة حقيقية تساعدنا نبني منتج أحسن.
          </p>
          <p className="mt-2 text-xs text-slate-400 font-cairo">
            Nidham · بُني في دمياط، مصر · v1.0 · 2026
          </p>
        </footer>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-black font-cairo text-slate-900 mb-3 border-r-4 border-amber-500 pr-3">
        {title}
      </h2>
      <div className="text-slate-700 leading-relaxed">{children}</div>
    </section>
  );
}
