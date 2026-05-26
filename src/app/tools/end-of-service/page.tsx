import type { Metadata } from "next";
import { EosCalculator } from "./calculator";
import { BlogNav, BlogFooter } from "@/components/blog-chrome";
import { BreadcrumbSchema } from "@/components/json-ld";
import { EmbedSnippet } from "@/components/embed-snippet";

// ============================================================================
// /tools/end-of-service — Free Egyptian EOS gratuity calculator
// ============================================================================
//
// Target keyword: "حاسبة نهاية الخدمة" / "مكافأة نهاية الخدمة"
// Egyptian Labor Law 12/2003 Article 122:
//   - 0.5 month of LAST salary per year for the first 5 years
//   - 1 full month per year thereafter
//
// Same architecture as salary-calculator: server shell + client form.

export const metadata: Metadata = {
  title: "حاسبة مكافأة نهاية الخدمة في مصر 2026 — قانون 12/2003 | نِظام HR",
  description:
    "احسب مكافأة نهاية الخدمة لأي موظف في مصر حسب قانون العمل 12/2003 المادة 122 — نص شهر للسنين الأولى، شهر كامل بعد كده. مجاناً ودقيق.",
  alternates: { canonical: "/tools/end-of-service" },
  openGraph: {
    type: "website",
    title: "حاسبة نهاية الخدمة في مصر — قانون 12/2003",
    description:
      "حاسبة مجانية لمكافأة نهاية الخدمة طبقاً للقانون المصري — مع تفصيل سنة بسنة.",
    url: "/tools/end-of-service",
  },
  twitter: {
    card: "summary_large_image",
    title: "حاسبة نهاية الخدمة في مصر 2026",
    description: "مكافأة نهاية الخدمة بقانون 12/2003 — مجاناً.",
  },
};

export default function EosCalculatorPage() {
  return (
    <div className="min-h-screen bg-white font-cairo flex flex-col">
      <BlogNav />
      <BreadcrumbSchema
        items={[
          { name: "الرئيسية", url: "/" },
          { name: "أدوات مجانية", url: "/tools" },
          { name: "حاسبة نهاية الخدمة", url: "/tools/end-of-service" },
        ]}
      />

      <header className="px-6 pt-12 pb-6 max-w-3xl mx-auto w-full">
        <nav aria-label="breadcrumb" className="text-xs text-slate-500 mb-5">
          <a href="/" className="hover:text-brand-cyan-dark">الرئيسية</a>
          <span className="mx-2">›</span>
          <a href="/tools" className="hover:text-brand-cyan-dark">الأدوات</a>
          <span className="mx-2">›</span>
          <span className="text-slate-700">نهاية الخدمة</span>
        </nav>

        <div className="inline-block px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold mb-4">
          ⚡ أداة مجانية · بدون تسجيل
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight mb-4">
          حاسبة مكافأة نهاية الخدمة
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed">
          احسب المكافأة المستحقة لأي موظف حسب قانون العمل المصري 12/2003
          المادة 122. النتيجة تفصيلية سنة بسنة مع شرح القاعدة.
        </p>
      </header>

      <main className="px-6 pb-12 max-w-3xl mx-auto w-full flex-1">
        <EosCalculator />

        <section className="mt-12 prose-ar">
          <h2>القاعدة في القانون</h2>
          <p>
            <strong>قانون العمل المصري 12/2003 المادة 122</strong> بيقول إن
            العامل اللي اتنهى عقده مع تطبيق شروط الاستحقاق له:
          </p>
          <ul>
            <li>
              <strong>نص شهر</strong> من آخر أجر أساسي عن كل سنة من السنين
              الخمس الأولى
            </li>
            <li>
              <strong>شهر كامل</strong> من آخر أجر أساسي عن كل سنة بعد كده
            </li>
            <li>
              <strong>كسور السنة</strong> تتحسب بنسبتها (6 شهور = نص سنة،
              إلخ)
            </li>
          </ul>

          <h3>متى يستحق الموظف المكافأة؟</h3>
          <ul>
            <li>صاحب العمل أنهى العقد بدون سبب مشروع</li>
            <li>الموظف استقال بعد سنتين خدمة على الأقل، مع إخطار مكتوب</li>
            <li>وفاة الموظف أثناء الخدمة (للورثة)</li>
            <li>الإحالة للمعاش (60 سنة)</li>
          </ul>

          <h3>متى يفقد الموظف المكافأة؟</h3>
          <ul>
            <li>الفصل لسبب مشروع (المادة 69 — سرقة، احتيال، غياب 20 يوم/سنة)</li>
            <li>الاستقالة قبل إكمال سنتين خدمة</li>
            <li>الاستقالة بدون إخطار قانوني</li>
          </ul>

          <div className="callout">
            <div className="callout-title">📚 اقرا أكتر</div>
            <p>
              <a href="/blog/end-of-service-calculator-egypt">
                دليل تفصيلي عن مكافأة نهاية الخدمة
              </a>{" "}
              فيه 5 أمثلة عملية + الحالات الخاصة + الجانب الضريبي.
            </p>
          </div>
        </section>

        <EmbedSnippet embedPath="/embed/end-of-service" height={720} />

        <section className="mt-12">
          <div className="rounded-3xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark p-8 text-white shadow-xl">
            <h2 className="text-2xl md:text-3xl font-black mb-3">
              المكافأة دي مش الوحيدة...
            </h2>
            <p className="text-cyan-50 mb-5">
              نِظام HR بيحسب نهاية الخدمة + الإجازات المتراكمة + مستحقات
              الشهر الأخير + معاش التأمينات تلقائياً، ويطبعلك شهادة خبرة
              ونموذج 6 ترك خدمة لتقديمهم للهيئة.
            </p>
            <a
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-brand-cyan-dark font-bold shadow-md hover:shadow-lg transition"
            >
              🚀 جرّب نِظام HR مجاناً
            </a>
          </div>
        </section>
      </main>

      <BlogFooter />
    </div>
  );
}
