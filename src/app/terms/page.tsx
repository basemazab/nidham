// ============================================================================
// /terms — Terms of Service (الشروط والأحكام)
// ============================================================================
//
// Required for a paid SaaS. Defines the contract between Nidham and the
// customer: what they're paying for, what we promise to deliver, what
// happens if either side breaks the deal, and which jurisdiction governs
// the relationship.
//
// Versioning: bump TERMS_VERSION whenever a clause materially changes —
// next login should re-prompt for consent.

import Link from "next/link";

export const metadata = {
  title: "الشروط والأحكام | نِظام",
  description:
    "الشروط والأحكام بتاعت Nidham — العقد القانوني بينك وبينّا، حقوقك، واجباتنا، وضوابط الاستخدام.",
};

export const TERMS_VERSION = "v1.0";
export const TERMS_LAST_UPDATED = "2026-05-25";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 py-12 px-6">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/"
          className="text-sm text-brand-cyan-dark hover:underline font-cairo mb-6 inline-block"
        >
          ← الرجوع للصفحة الرئيسية
        </Link>

        <header className="mb-10 pb-6 border-b border-slate-200">
          <h1 className="text-4xl md:text-5xl font-black font-cairo text-slate-900 mb-3">
            الشروط والأحكام
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            النسخة {TERMS_VERSION} · آخر تحديث: {TERMS_LAST_UPDATED} · مطبّقة
            على كل عملاء وزوّار{" "}
            <span className="font-mono" dir="ltr">
              nidhamhr.com
            </span>
          </p>
        </header>

        {/* TL;DR */}
        <section className="mb-8 p-5 rounded-2xl bg-amber-50 border-2 border-amber-300">
          <h2 className="text-lg font-black font-cairo text-amber-900 mb-2">
            🔑 الخلاصة في 30 ثانية
          </h2>
          <ul className="space-y-2 text-sm font-cairo text-amber-900 leading-relaxed">
            <li>✓ بنوفّر لك نظام HR + Payroll، انت بتدفع اشتراك شهري أو سنوي.</li>
            <li>✓ تقدر تلغي اشتراكك أي وقت بدون عقوبات.</li>
            <li>✓ 30 يوم ضمان استرداد على أول دفعة لو مش راضي.</li>
            <li>✓ بياناتك ملكك — تقدر تنزّلها وقت ما تحب.</li>
            <li>✓ لو حد كسر القانون، الـ jurisdiction = محاكم مصر.</li>
          </ul>
        </section>

        <article className="prose prose-slate max-w-none font-cairo space-y-8">

          <Section title="1. تعريفات">
            <ul>
              <li><strong>الشركة (Nidham):</strong> الكيان المملوك لـ HR BASEM AZAB، المقرّ في دمياط، مصر.</li>
              <li><strong>الخدمة:</strong> منصّة Nidham السحابية على nidhamhr.com لإدارة الموارد البشرية والمرتبات.</li>
              <li><strong>العميل:</strong> أي شخص أو شركة بتشترك في الخدمة.</li>
              <li><strong>الاشتراك:</strong> العقد الشهري أو السنوي لاستخدام الخدمة.</li>
              <li><strong>المستخدم النهائي:</strong> موظفي العميل اللي بيتعاملوا مع النظام.</li>
            </ul>
          </Section>

          <Section title="2. قبول الشروط">
            <p>
              بمجرد إنشاء حساب على nidhamhr.com أو دفع أي اشتراك، انت بتوافق رسمياً على:
            </p>
            <ul>
              <li>الشروط والأحكام دي (TERMS_VERSION = {TERMS_VERSION})</li>
              <li>
                <Link href="/privacy" className="text-brand-cyan-dark hover:underline">سياسة الخصوصية</Link>
              </li>
              <li>
                <Link href="/refund" className="text-brand-cyan-dark hover:underline">سياسة الاسترداد</Link>
              </li>
            </ul>
            <p className="mt-3">
              لو مش موافق على أي بند، **لا تستخدم الخدمة**. الاستمرار في استخدام النظام بعد تحديث الشروط = موافقة ضمنية.
            </p>
          </Section>

          <Section title="3. الباقات والاشتراكات">
            <h3 className="text-lg font-bold mt-4 mb-2">3.1 الباقات المتاحة</h3>
            <ul>
              <li><strong>Free:</strong> 0 ج/شهر، حتى 5 موظفين، بدون التزام زمني</li>
              <li><strong>Starter:</strong> 500 ج/شهر، حتى 25 موظف</li>
              <li><strong>Pro:</strong> 1,500 ج/شهر، حتى 100 موظف</li>
              <li><strong>Business:</strong> 3,500 ج/شهر، حتى 500 موظف</li>
              <li><strong>Enterprise:</strong> تسعير مخصص، 500+ موظف</li>
              <li><strong>Beta:</strong> 3 شهور مجاناً + 50% خصم لسنة كاملة (أحكام منفصلة في <Link href="/beta-terms" className="text-brand-cyan-dark hover:underline">/beta-terms</Link>)</li>
            </ul>

            <h3 className="text-lg font-bold mt-6 mb-2">3.2 دورة الفوترة</h3>
            <ul>
              <li>الاشتراك بيتجدّد تلقائياً كل شهر/سنة على نفس البطاقة</li>
              <li>الفاتورة بتصدر يوم تجديد الاشتراك</li>
              <li>الـ VAT 14% بيتضاف للأسعار المعروضة (للأفراد) — للشركات بـ TRN، بنطبّق reverse charge</li>
              <li>اللي عنده اشتراك سنوي بياخد خصم 20%</li>
            </ul>

            <h3 className="text-lg font-bold mt-6 mb-2">3.3 تغيير الباقة</h3>
            <p>
              تقدر تكبّر أو تصغّر باقتك أي وقت من <code>/dashboard/subscription</code>:
            </p>
            <ul>
              <li><strong>Upgrade:</strong> فوري + بنحسب الفرق بالـ pro-rata</li>
              <li><strong>Downgrade:</strong> يطبّق في بداية الـ billing cycle الجاي</li>
            </ul>
          </Section>

          <Section title="4. حقوقك (العميل)">
            <ul>
              <li><strong>الوصول للنظام:</strong> 24/7 ما عدا أوقات الصيانة (هنبلّغك قبلها بـ 48 ساعة)</li>
              <li><strong>دعم فني:</strong> عبر واتساب 0105 535 6622 + إيميل nidhamhr@proton.me في وقت العمل (السبت-الخميس 9 ص - 6 م)</li>
              <li><strong>تحديثات مجانية:</strong> كل التحديثات والميزات الجديدة بدون رسوم إضافية طول فترة اشتراكك</li>
              <li><strong>تصدير بياناتك:</strong> تقدر تنزّل كل بياناتك (موظفين + مرتبات + تأمينات) بصيغة Excel/CSV أي وقت</li>
              <li><strong>إلغاء أي وقت:</strong> بدون عقوبات، بدون شروط، بدون "هل أنت متأكد؟" مزعج</li>
              <li><strong>30 يوم ضمان استرداد:</strong> راجع <Link href="/refund" className="text-brand-cyan-dark hover:underline">سياسة الاسترداد</Link></li>
            </ul>
          </Section>

          <Section title="5. واجباتك (العميل)">
            <ul>
              <li><strong>دقة البيانات:</strong> انت مسؤول عن صحة بيانات الموظفين اللي بتدخّلها</li>
              <li><strong>الالتزام القانوني:</strong> Nidham بيحسب التأمينات والضرايب على أساس البيانات اللي بتدخّلها — الالتزام النهائي بالقانون مسؤوليتك أنت كصاحب عمل</li>
              <li><strong>كلمات السر:</strong> أنت مسؤول عن أمان حسابك + كلمة السر — Nidham مش مسؤول عن أي وصول غير مرخّص بسبب إهمالك</li>
              <li><strong>عدم إساءة الاستخدام:</strong> ممنوع:
                <ul>
                  <li>إعادة بيع الخدمة لطرف ثالث</li>
                  <li>محاولة اختراق النظام أو تجاوز الـ rate limits</li>
                  <li>استخدام النظام لأغراض غير قانونية (مثلاً غسيل أموال، تهرّب ضريبي)</li>
                  <li>تخزين بيانات حساسة غير متعلقة بـ HR</li>
                </ul>
              </li>
              <li><strong>دفع في الموعد:</strong> لو ما دفعتش لمدة 14 يوم بعد تاريخ التجديد، الحساب بيتعلّق (data محفوظة 30 يوم إضافية للاسترداد، بعدها بيتحذف نهائياً)</li>
            </ul>
          </Section>

          <Section title="6. حقوقنا (Nidham)">
            <ul>
              <li>الحق في تعليق الحساب لو في انتهاك للشروط (مع إنذار 7 أيام لاسترداد البيانات)</li>
              <li>الحق في تعديل الأسعار مع إخطار 60 يوم قبل التطبيق على المشتركين الحاليين</li>
              <li>الحق في إيقاف أي ميزة بـ deprecate إذا أعلنّا قبل 90 يوم</li>
              <li>الحق في تسجيل audit log immutable لكل عملية حساسة (للتفتيش القانوني)</li>
            </ul>
          </Section>

          <Section title="7. الـ Service Level (SLA)">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-right py-2 px-3 border border-slate-300 font-bold">الباقة</th>
                  <th className="text-right py-2 px-3 border border-slate-300 font-bold">Uptime</th>
                  <th className="text-right py-2 px-3 border border-slate-300 font-bold">Response Time</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="py-2 px-3 border border-slate-300">Free</td><td className="py-2 px-3 border border-slate-300">95%</td><td className="py-2 px-3 border border-slate-300">Best effort</td></tr>
                <tr><td className="py-2 px-3 border border-slate-300">Starter / Pro</td><td className="py-2 px-3 border border-slate-300">99%</td><td className="py-2 px-3 border border-slate-300">24 ساعة عمل</td></tr>
                <tr><td className="py-2 px-3 border border-slate-300">Business</td><td className="py-2 px-3 border border-slate-300">99.5%</td><td className="py-2 px-3 border border-slate-300">4 ساعات عمل</td></tr>
                <tr><td className="py-2 px-3 border border-slate-300">Enterprise</td><td className="py-2 px-3 border border-slate-300">99.9%</td><td className="py-2 px-3 border border-slate-300">1 ساعة عمل (24/7)</td></tr>
              </tbody>
            </table>
            <p className="mt-3 text-sm">
              لو خرقنا الـ uptime SLA لشهر، بنرجّع 10% من قيمة الاشتراك الشهري كـ credit للشهر التالي.
            </p>
          </Section>

          <Section title="8. حدود المسؤولية">
            <p>
              <strong>Nidham مش مسؤول عن:</strong>
            </p>
            <ul>
              <li>أي خسائر مالية ناتجة عن أخطاء انت أدخلتها (مثلاً أرقام مرتبات غلط)</li>
              <li>غرامات تأمينات أو ضرايب لو البيانات اللي دخّلتها كانت ناقصة أو غلط</li>
              <li>انقطاع الخدمة لأسباب خارج إرادتنا (قطع نت عالمي، كارثة طبيعية، حرب)</li>
              <li>أي شكاوى بين العميل وموظفينه (إجازات، مرتبات، إنذارات)</li>
              <li>أي قرارات قانونية بناءً على output الـ AI Agent</li>
            </ul>
            <p className="mt-3">
              <strong>الحد الأقصى للتعويض:</strong> قيمة الاشتراك السنوي اللي دفعته (مثلاً 18,000 ج لـ Pro).
            </p>
          </Section>

          <Section title="9. الملكية الفكرية">
            <ul>
              <li><strong>الكود + التصميم + الـ AI prompts:</strong> ملك Nidham 100% — ممنوع نسخ أو reverse engineer</li>
              <li><strong>بياناتك:</strong> ملكك 100% — Nidham مجرد custodian</li>
              <li><strong>الـ feedback اللي بتديهلنا:</strong> ملكنا (للتحسين)، بدون أي مقابل مادي لك</li>
            </ul>
          </Section>

          <Section title="10. الإلغاء + الحذف">
            <ul>
              <li>الإلغاء عبر <code>/dashboard/subscription</code> أو إيميل nidhamhr@proton.me</li>
              <li>الاشتراك يفضل شغّال لحد نهاية الـ billing cycle المدفوع</li>
              <li>بعد الإلغاء، البيانات بتفضل 30 يوم (لو غيّرت رأيك أو محتاج export)</li>
              <li>بعد 30 يوم، البيانات بتتحذف نهائياً من السيرفر + الـ backups</li>
              <li>الـ audit log القانوني بيتحفظ 7 سنين (قانون الضرايب المصري)</li>
            </ul>
          </Section>

          <Section title="11. التعديلات على الشروط">
            <p>
              لو غيّرنا الشروط، هنخبّرك:
            </p>
            <ul>
              <li>إيميل قبل التطبيق بـ 30 يوم</li>
              <li>إشعار في الـ dashboard لما تدخل</li>
              <li>صفحة الشروط محدّثة بـ version + date جديدين</li>
            </ul>
            <p className="mt-3">
              لو مش موافق على التعديل، تقدر تلغي الاشتراك قبل تطبيق التغيير بدون عقوبة.
            </p>
          </Section>

          <Section title="12. الجهة القضائية + القانون المطبّق">
            <ul>
              <li>الشروط دي محكومة بقوانين <strong>جمهورية مصر العربية</strong></li>
              <li>أي نزاع يتم حلّه في <strong>محاكم القاهرة</strong> أولاً</li>
              <li>التحكيم اختياري قبل اللجوء للمحاكم</li>
              <li>اللغة العربية هي المرجع الرسمي (الترجمة الإنجليزية لو متوفرة = للمساعدة فقط)</li>
            </ul>
          </Section>

          <Section title="13. التواصل القانوني">
            <p>
              لأي إشعار رسمي أو تواصل قانوني:
            </p>
            <ul>
              <li>📧 إيميل: <a href="mailto:nidhamhr@proton.me" className="text-brand-cyan-dark hover:underline" dir="ltr">nidhamhr@proton.me</a></li>
              <li>📍 العنوان: HR BASEM AZAB، دمياط، مصر</li>
              <li>📱 واتساب رسمي: <a href="https://wa.me/201055356622" className="text-brand-cyan-dark hover:underline" dir="ltr">+20 105 535 6622</a></li>
            </ul>
          </Section>

        </article>

        <footer className="mt-12 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500 font-cairo">
            الشروط دي مكتوبة بلغة بسيطة عشان تكون مفهومة بدون محامي.
            ده تعاقد جدّي بينك وبيننا — اقراه بعناية قبل ما تشترك.
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
      <h2 className="text-2xl font-black font-cairo text-slate-900 mb-3 border-r-4 border-brand-cyan pr-3">
        {title}
      </h2>
      <div className="text-slate-700 leading-relaxed">{children}</div>
    </section>
  );
}
