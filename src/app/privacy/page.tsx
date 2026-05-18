// ============================================================================
// /privacy — Privacy Notice (Egyptian PDPL 151/2020)
// ============================================================================
//
// Statically-rendered Arabic privacy policy required by Egyptian Personal
// Data Protection Law 151/2020 Article 12 (lawful basis for processing)
// and Article 14 (transparency obligations).
//
// Versioning: the constant POLICY_VERSION below is what we store in
// profiles.consent_version when a user agrees. Bump it whenever the
// policy materially changes — that triggers a re-consent prompt next
// login.

import Link from "next/link";

export const metadata = {
  title: "سياسة الخصوصية — نظام",
  description:
    "سياسة جمع ومعالجة البيانات الشخصية في نظام (Nidham) وفقاً لقانون 151/2020.",
};

// MUST stay in sync with the version captured at signup. Bump on any
// substantive change.
export const POLICY_VERSION = "v1.0";
export const POLICY_LAST_UPDATED = "2026-05-18";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 py-12 px-6">
      <div className="max-w-3xl mx-auto bg-white rounded-3xl shadow-sm border border-slate-100 p-8 md:p-12">
        {/* Breadcrumb */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-brand-cyan-dark font-cairo"
          >
            ← الرئيسية
          </Link>
        </div>

        {/* Header */}
        <header className="mb-8 pb-6 border-b border-slate-100">
          <h1 className="text-3xl md:text-4xl font-black font-cairo text-slate-900 mb-2">
            سياسة الخصوصية
          </h1>
          <p className="text-sm text-slate-500 font-cairo">
            النسخة {POLICY_VERSION} — آخر تحديث {POLICY_LAST_UPDATED}
          </p>
        </header>

        <div className="prose prose-slate max-w-none font-cairo text-slate-700 leading-relaxed space-y-8">
          {/* Section 1 — Intro */}
          <section>
            <h2 className="text-xl font-black text-slate-800 mb-3">
              ١. مين إحنا وليه السياسة دي مهمة
            </h2>
            <p>
              "نظام" (Nidham) منصة برمجية لإدارة الموارد البشرية والعلاقات مع
              العملاء للشركات المصرية. السياسة دي بتشرح إيه البيانات اللي
              بنجمعها، ليه بنجمعها، مين بيشوفها، وحقوقك علينا.
            </p>
            <p>
              السياسة دي مطبّقة لقانون حماية البيانات الشخصية رقم 151 لسنة
              2020، وهي ملزمة قانونياً لينا ولأي شخص بيستخدم النظام.
            </p>
          </section>

          {/* Section 2 — What we collect */}
          <section>
            <h2 className="text-xl font-black text-slate-800 mb-3">
              ٢. البيانات اللي بنجمعها
            </h2>
            <p>عندنا ٣ فئات من البيانات:</p>

            <h3 className="text-base font-bold text-slate-800 mt-4 mb-2">
              أ) بيانات حساب الشركة (الـ Admin)
            </h3>
            <ul className="list-disc pr-6 space-y-1">
              <li>اسم صاحب الحساب وإيميله</li>
              <li>اسم الشركة وصناعتها</li>
              <li>كلمة السر (مشفّرة باستخدام bcrypt — مفيش حد عندنا يقدر يقراها)</li>
              <li>عنوان IP وتاريخ التسجيل (للأمان)</li>
            </ul>

            <h3 className="text-base font-bold text-slate-800 mt-4 mb-2">
              ب) بيانات الموظفين اللي بتدخلهم على النظام
            </h3>
            <ul className="list-disc pr-6 space-y-1">
              <li>الاسم، الوظيفة، القسم، تاريخ التعيين</li>
              <li>الرقم القومي (مشفّر at-rest)</li>
              <li>بيانات الراتب والبدلات</li>
              <li>الحضور والإجازات والطلبات</li>
              <li>المستندات اللي بتتم رفعها (عقود، شهادات، إلخ)</li>
              <li>صور الموظفين (اختياري)</li>
            </ul>
            <p className="text-sm bg-amber-50 border border-amber-200 p-3 rounded-lg mt-2">
              ⚠ <b>أنت كصاحب الشركة (الـ Controller) مسؤول قانونياً</b> عن
              أخذ موافقة موظفينك قبل إدخال بياناتهم. نظام بيوفّر لك الأدوات
              التقنية، بس الالتزام القانوني عليك.
            </p>

            <h3 className="text-base font-bold text-slate-800 mt-4 mb-2">
              ج) بيانات الاستخدام (Telemetry)
            </h3>
            <ul className="list-disc pr-6 space-y-1">
              <li>الصفحات اللي بتفتحها وإمتى</li>
              <li>أخطاء النظام (للإصلاح فقط، مع إخفاء البيانات الحساسة)</li>
              <li>متصفحك وجهازك (User-Agent)</li>
            </ul>
          </section>

          {/* Section 3 — Why */}
          <section>
            <h2 className="text-xl font-black text-slate-800 mb-3">
              ٣. ليه بنجمعها (الأساس القانوني)
            </h2>
            <p>كل بيانة عندنا غرض محدد:</p>
            <ul className="list-disc pr-6 space-y-2 mt-3">
              <li>
                <b>تقديم الخدمة</b> — مينفعش نحسب مرتب من غير راتب أساسي،
                ومينفعش نسجل حضور بدون اسم الموظف.
              </li>
              <li>
                <b>الأمان</b> — IP وتاريخ التسجيل لاكتشاف محاولات الاختراق.
              </li>
              <li>
                <b>التحسين</b> — telemetry الأخطاء بتساعدنا نصلح bugs قبل ما
                تأثّر على عملاء تانيين.
              </li>
              <li>
                <b>الالتزام القانوني</b> — بيانات الضرايب والتأمينات لازم
                نحتفظ بيها ٦ سنين (قانون الإجراءات الضريبية).
              </li>
            </ul>
          </section>

          {/* Section 4 — Who sees */}
          <section>
            <h2 className="text-xl font-black text-slate-800 mb-3">
              ٤. مين بيشوف بياناتك
            </h2>
            <ul className="list-disc pr-6 space-y-2">
              <li>
                <b>أنت + فريق الـ HR في شركتك</b> — حسب الصلاحيات اللي
                بتحدّدها.
              </li>
              <li>
                <b>إحنا (فريق نظام التقني)</b> — للدعم الفني فقط ولما تطلب
                مساعدة، وبسجل audit log بكل عملية وصول.
              </li>
              <li>
                <b>Supabase</b> — استضافة قاعدة البيانات. مزوّد منفصل عنّا
                ملتزم بـ SOC 2 + GDPR.
              </li>
              <li>
                <b>Sentry</b> — مراقبة الأخطاء. بنخفي البيانات الحساسة (أرقام
                قومية، حسابات بنكية) قبل ما ترسل.
              </li>
              <li>
                <b>Vercel</b> — استضافة التطبيق. ملتزم بـ SOC 2 + ISO 27001.
              </li>
            </ul>
            <p className="mt-3">
              <b>إحنا مش بنبيع بياناتك لحد.</b> ولا بنستخدمها لإعلانات.
            </p>
          </section>

          {/* Section 5 — Rights */}
          <section>
            <h2 className="text-xl font-black text-slate-800 mb-3">
              ٥. حقوقك (PDPL Articles 12-19)
            </h2>
            <ul className="list-disc pr-6 space-y-2">
              <li>
                <b>حق الاطلاع</b> — تشوف كل البيانات اللي عندنا عنك في أي وقت
                من <code className="bg-slate-100 px-1 rounded">/dashboard</code>.
              </li>
              <li>
                <b>حق التصدير (Portability)</b> — تصدّر كل بيانات شركتك (Excel
                واحد) من{" "}
                <code className="bg-slate-100 px-1 rounded">/api/export</code>.
              </li>
              <li>
                <b>حق التصحيح</b> — تعدّل أي بيانة من dashboard.
              </li>
              <li>
                <b>حق الحذف</b> — تحذف حسابك وكل بيانات شركتك في أي وقت من
                إعدادات الحساب. الحذف نهائي بعد ٣٠ يوم grace period.
              </li>
              <li>
                <b>حق سحب الموافقة</b> — تلغي موافقتك دلوقتي وبيتم اعتبار
                الحذف.
              </li>
              <li>
                <b>حق الشكوى</b> — لو شايف إن حقوقك اتنتهكت، تقدر تشتكي للمركز
                المصري لحماية البيانات.
              </li>
            </ul>
          </section>

          {/* Section 6 — Retention */}
          <section>
            <h2 className="text-xl font-black text-slate-800 mb-3">
              ٦. مدة الاحتفاظ بالبيانات
            </h2>
            <ul className="list-disc pr-6 space-y-1">
              <li>
                <b>بيانات الحساب النشطة</b> — طول ما الحساب شغّال.
              </li>
              <li>
                <b>بيانات المرتبات والضرايب</b> — ٦ سنين (متطلب قانوني مصري).
              </li>
              <li>
                <b>بيانات الموظفين المنتهية خدمتهم</b> — ٣ سنين، بعدها بنخفيها
                anonymize.
              </li>
              <li>
                <b>Audit log</b> — سنة واحدة.
              </li>
              <li>
                <b>بعد حذف الحساب</b> — ٣٠ يوم grace period، بعدها كل البيانات
                بتُمحى نهائياً.
              </li>
            </ul>
          </section>

          {/* Section 7 — Security */}
          <section>
            <h2 className="text-xl font-black text-slate-800 mb-3">
              ٧. الأمان
            </h2>
            <ul className="list-disc pr-6 space-y-1">
              <li>كل الاتصال بـ HTTPS (TLS 1.3)</li>
              <li>كلمات السر مشفّرة (bcrypt — مش reversible)</li>
              <li>الأرقام القومية والحسابات البنكية مشفّرة at-rest (pgp_sym_encrypt)</li>
              <li>Row-Level Security على كل جدول — مفيش tenant يشوف بيانات tenant تاني</li>
              <li>Audit log بيسجل كل تعديل حساس</li>
              <li>Rate limiting على محاولات تسجيل الدخول</li>
              <li>نسخ احتياطي يومي + Point-In-Time Recovery</li>
            </ul>
          </section>

          {/* Section 8 — Children */}
          <section>
            <h2 className="text-xl font-black text-slate-800 mb-3">
              ٨. الأطفال
            </h2>
            <p>
              نظام مش متاح لأي حد تحت ١٨ سنة. لو اكتشفنا حساب أو موظف بيانات
              قاصر، بنحذف البيانات فوراً ونوقف الحساب.
            </p>
          </section>

          {/* Section 9 — Changes */}
          <section>
            <h2 className="text-xl font-black text-slate-800 mb-3">
              ٩. تغيير السياسة
            </h2>
            <p>
              ممكن نعدّل السياسة دي مع تطوّر النظام. أي تغيير جوهري بنبعتلك
              إيميل قبلها بـ ٣٠ يوم، وأول مرة تسجل دخول بعد التغيير هنطلب منك
              توافق على النسخة الجديدة. لو رفضت، تقدر تصدّر بياناتك وتحذف
              حسابك.
            </p>
            <p className="text-sm bg-slate-100 p-3 rounded-lg mt-2">
              <b>النسخة الحالية:</b> {POLICY_VERSION} — {POLICY_LAST_UPDATED}
            </p>
          </section>

          {/* Section 10 — Contact */}
          <section>
            <h2 className="text-xl font-black text-slate-800 mb-3">
              ١٠. التواصل (مسؤول حماية البيانات)
            </h2>
            <p>
              لأي استفسار، تواصل مع: <br />
              <b>باسم عزب</b> — مسؤول حماية البيانات (DPO)
              <br />
              📧 <a href="mailto:privacy@nidham.app" className="text-brand-cyan-dark hover:underline">privacy@nidham.app</a>
              <br />
              📱 +20 100 000 0000
              <br />
              📍 القاهرة، مصر
            </p>
          </section>
        </div>

        {/* Footer back link */}
        <div className="mt-10 pt-6 border-t border-slate-100 text-center">
          <Link
            href="/"
            className="inline-block px-6 py-3 rounded-xl bg-brand-cyan-dark text-white font-bold font-cairo hover:bg-brand-cyan transition"
          >
            للرئيسية
          </Link>
        </div>
      </div>
    </main>
  );
}
