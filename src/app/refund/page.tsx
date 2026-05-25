// ============================================================================
// /refund — Refund Policy (سياسة الاسترداد)
// ============================================================================
//
// Promised at /pricing#faq but had no standalone document — created here
// to give the 30-day guarantee real contractual force.

import Link from "next/link";

export const metadata = {
  title: "سياسة الاسترداد | نِظام",
  description:
    "30 يوم ضمان استرداد على أول دفعة. مفيش شروط مخفية ولا أسئلة محرجة.",
};

export const REFUND_VERSION = "v1.0";
export const REFUND_LAST_UPDATED = "2026-05-25";

export default function RefundPage() {
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
            سياسة الاسترداد
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            النسخة {REFUND_VERSION} · آخر تحديث: {REFUND_LAST_UPDATED}
          </p>
        </header>

        <section className="mb-8 p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300">
          <h2 className="text-lg font-black font-cairo text-emerald-900 mb-2">
            🛡 ضمان 30 يوم — بدون أسئلة محرجة
          </h2>
          <p className="text-sm font-cairo text-emerald-900 leading-relaxed">
            لو في خلال 30 يوم من أول دفعة، شركتك ما لقتش Nidham مناسب،
            تقدر تطلب استرداد كامل بدون أي عقوبة أو سؤال "ليه".
            بنرجّع المبلغ في 7-14 يوم عمل على نفس البطاقة.
          </p>
        </section>

        <article className="prose prose-slate max-w-none font-cairo space-y-8">

          <Section title="1. اللي يأهّل للاسترداد">
            <ul>
              <li>✅ <strong>أول دفعة من أي باقة مدفوعة</strong> (Starter / Pro / Business / Enterprise)</li>
              <li>✅ خلال <strong>30 يوم من تاريخ الدفع الأول</strong></li>
              <li>✅ لو طلبت بصراحة عبر إيميل أو واتساب</li>
            </ul>
          </Section>

          <Section title="2. اللي مش مشمول بالاسترداد">
            <ul>
              <li>❌ <strong>تجديدات الاشتراك بعد أول 30 يوم</strong> (الـ recurring renewals)</li>
              <li>❌ <strong>الـ Beta plan</strong> (لأنها أصلاً مجانية الـ 3 شهور)</li>
              <li>❌ <strong>Custom development</strong> أو <strong>API integrations</strong> لـ Enterprise</li>
              <li>❌ <strong>Onboarding services</strong> اللي تم استهلاكها</li>
              <li>❌ <strong>اشتراك سنوي بعد استخدام أكتر من 30 يوم</strong> (بنرد proportional)</li>
            </ul>
          </Section>

          <Section title="3. إزاي تطلب الاسترداد">
            <ol>
              <li>
                ابعت إيميل لـ{" "}
                <a href="mailto:nidhamhr@proton.me" className="text-brand-cyan-dark hover:underline" dir="ltr">
                  nidhamhr@proton.me
                </a>{" "}
                من نفس الإيميل المسجّل بالحساب
              </li>
              <li>
                أو ابعت رسالة على واتساب{" "}
                <a href="https://wa.me/201055356622" className="text-brand-cyan-dark hover:underline" dir="ltr">
                  +20 105 535 6622
                </a>
              </li>
              <li>
                اكتب:
                <ul>
                  <li>اسم الشركة + إيميل الحساب</li>
                  <li>سبب الإلغاء (اختياري — بس بيساعدنا نتحسّن)</li>
                </ul>
              </li>
              <li>هنرد عليك خلال <strong>24 ساعة عمل</strong> بتأكيد الاستلام</li>
              <li>الاسترداد بيتم خلال <strong>7-14 يوم عمل</strong> على نفس البطاقة</li>
            </ol>
          </Section>

          <Section title="4. ماذا يحدث ببياناتك بعد الاسترداد">
            <ul>
              <li><strong>30 يوم grace period:</strong> بياناتك بتفضل متاحة للـ export بصيغة Excel/CSV</li>
              <li><strong>بعد 30 يوم:</strong> بيتم حذف كل البيانات نهائياً من السيرفر + الـ backups</li>
              <li><strong>Audit log القانوني:</strong> بيتحفظ 7 سنين (إلزامي بقانون الضرايب المصري)</li>
            </ul>
          </Section>

          <Section title="5. التواصل">
            <ul>
              <li>📧 إيميل: <a href="mailto:nidhamhr@proton.me" className="text-brand-cyan-dark hover:underline" dir="ltr">nidhamhr@proton.me</a></li>
              <li>📱 واتساب: <a href="https://wa.me/201055356622" className="text-brand-cyan-dark hover:underline" dir="ltr">+20 105 535 6622</a></li>
              <li>⏰ ساعات العمل: السبت - الخميس، 9 ص - 6 م</li>
            </ul>
          </Section>

        </article>

        <footer className="mt-12 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-slate-500 font-cairo">
            بنصدق فيك. لو Nidham مش مناسب، خد فلوسك ورجع متى ما عايز.
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
