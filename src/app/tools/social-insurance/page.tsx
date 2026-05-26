import type { Metadata } from "next";
import { InsuranceCalculator } from "./calculator";
import { BlogNav, BlogFooter } from "@/components/blog-chrome";
import { BreadcrumbSchema } from "@/components/json-ld";
import { EmbedSnippet } from "@/components/embed-snippet";

// ============================================================================
// /tools/social-insurance — Free Egyptian social insurance calculator
// ============================================================================
//
// Target keyword: "حاسبة التأمينات الاجتماعية" / "حساب التأمينات في مصر"
// Law 148/2019 + 2026 NOSI decree (min 2,700 / max 16,700 / 11% + 18.75%)

export const metadata: Metadata = {
  title: "حاسبة التأمينات الاجتماعية في مصر 2026 — قانون 148/2019 | نِظام HR",
  description:
    "احسب التأمينات الاجتماعية المستحقة على الموظف وصاحب العمل في مصر 2026 — 11% الموظف، 18.75% الشركة، مع تطبيق الحد الأدنى (2,700) والأقصى (16,700).",
  alternates: { canonical: "/tools/social-insurance" },
  openGraph: {
    type: "website",
    title: "حاسبة التأمينات الاجتماعية في مصر 2026",
    description:
      "11% الموظف + 18.75% صاحب العمل. حاسبة دقيقة بآخر تحديثات NOSI 2026.",
    url: "/tools/social-insurance",
  },
  twitter: {
    card: "summary_large_image",
    title: "حاسبة تأمينات مصر 2026",
    description: "احسب نصيب الموظف والشركة بالأرقام الحالية.",
  },
};

export default function SocialInsurancePage() {
  return (
    <div className="min-h-screen bg-white font-cairo flex flex-col">
      <BlogNav />
      <BreadcrumbSchema
        items={[
          { name: "الرئيسية", url: "/" },
          { name: "أدوات مجانية", url: "/tools" },
          {
            name: "حاسبة التأمينات الاجتماعية",
            url: "/tools/social-insurance",
          },
        ]}
      />

      <header className="px-6 pt-12 pb-6 max-w-3xl mx-auto w-full">
        <nav aria-label="breadcrumb" className="text-xs text-slate-500 mb-5">
          <a href="/" className="hover:text-brand-cyan-dark">الرئيسية</a>
          <span className="mx-2">›</span>
          <a href="/tools" className="hover:text-brand-cyan-dark">الأدوات</a>
          <span className="mx-2">›</span>
          <span className="text-slate-700">التأمينات الاجتماعية</span>
        </nav>

        <div className="inline-block px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold mb-4">
          ⚡ أداة مجانية · بدون تسجيل
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight mb-4">
          حاسبة التأمينات الاجتماعية 2026
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed">
          احسب نصيب الموظف وصاحب العمل من التأمينات حسب قانون 148/2019،
          مع تطبيق الحد الأدنى والأقصى لـ 2026 (آخر تحديث NOSI).
        </p>
      </header>

      <main className="px-6 pb-12 max-w-3xl mx-auto w-full flex-1">
        <InsuranceCalculator />

        <section className="mt-12 prose-ar">
          <h2>إيه هو "الأجر التأميني"؟</h2>
          <p>
            قانون التأمينات 148/2019 بيفرّق بين الأجر "الإجمالي" والأجر
            "التأميني":
          </p>
          <ul>
            <li>
              <strong>الأجر التأميني</strong> = الأساسي + البدلات الثابتة
              (مواصلات، أكل، طبيعة عمل)
            </li>
            <li>
              <strong>مش داخل فيه:</strong> الأوفر تايم، العمولات، المكافآت
              المتغيرة
            </li>
            <li>
              <strong>محصور بين:</strong> 2,700 جنيه (أدنى) و 16,700 جنيه
              (أقصى)
            </li>
          </ul>

          <h3>النسب 2026</h3>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>الجهة</th>
                  <th>النسبة</th>
                  <th>تنزل من جيب مين</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>الموظف</td>
                  <td>11%</td>
                  <td>الموظف (تخصم من المرتب)</td>
                </tr>
                <tr>
                  <td>صاحب العمل</td>
                  <td>18.75%</td>
                  <td>الشركة (تكلفة إضافية)</td>
                </tr>
                <tr>
                  <td><strong>الإجمالي</strong></td>
                  <td><strong>29.75%</strong></td>
                  <td>من الأجر التأميني</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="callout">
            <div className="callout-title">📋 يعني إيه عملياً؟</div>
            <p>
              لو الأجر الثابت للموظف = 10,000 جنيه/شهر:
              <br />
              • الموظف بيدفع: 10,000 × 11% = 1,100 جنيه (من جيبه)
              <br />
              • الشركة بتدفع: 10,000 × 18.75% = 1,875 جنيه (إضافي على المرتب)
              <br />
              • إجمالي اللي بيوصل للهيئة = 2,975 جنيه/شهر لهذا الموظف
            </p>
          </div>

          <h3>إزاي بتتدفع للهيئة؟</h3>
          <p>
            الشركة بتجمع نصيب الموظفين + نصيبها وبتسددها للهيئة القومية
            للتأمين الاجتماعي شهرياً (آخر يوم من الشهر التالي). التأخير
            بيرتب فوائد + غرامات.
          </p>
        </section>

        <EmbedSnippet embedPath="/embed/social-insurance" height={680} />

        <section className="mt-12">
          <div className="rounded-3xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark p-8 text-white shadow-xl">
            <h2 className="text-2xl md:text-3xl font-black mb-3">
              حساب يدوي = أخطاء حتمية
            </h2>
            <p className="text-cyan-50 mb-5">
              نِظام HR بيحسب تأمينات كل موظفينك في ثواني، ويطبع كشف
              التأمينات الشهري الجاهز للتقديم. ولو في موظف اتعدّل أجره،
              النظام بيطبع نموذج 2 تلقائياً.
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
