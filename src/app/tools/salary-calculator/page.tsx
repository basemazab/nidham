import type { Metadata } from "next";
import { SalaryCalculator } from "./calculator";
import { BlogNav, BlogFooter } from "@/components/blog-chrome";
import { BreadcrumbSchema } from "@/components/json-ld";
import { EmbedSnippet } from "@/components/embed-snippet";

// ============================================================================
// /tools/salary-calculator — Free Egyptian payroll calculator (link magnet)
// ============================================================================
//
// Server shell — handles metadata + chrome. The actual interactive form is
// in `./calculator.tsx` (client component). Splitting this way:
//   • Lets us define <Metadata> for SEO without forcing a client boundary
//   • Keeps the static HTML rich (Google can crawl + cache the page text)
//   • The calculator hydrates only after JS loads
//
// Why this matters for ranking:
//   "حاسبة مرتب مصر" / "ازاي احسب مرتب موظف" → ~1,200 searches/month.
//   Most existing results are either outdated 2023/2024 values or
//   non-functional articles. A real, accurate calculator with the 2026
//   NOSI + tax updates is a strong ranking play AND a backlink magnet
//   (other Arabic HR/finance blogs will link to it).

export const metadata: Metadata = {
  title: "حاسبة مرتب الموظف في مصر 2026 — صافي + تأمينات + ضرائب | نِظام HR",
  description:
    "حاسبة مرتب صافي للموظف في مصر 2026 — تحسب التأمينات الاجتماعية (11%) وضريبة كسب العمل بالشرايح المتدرجة وتعطيك الصافي خطوة بخطوة. مجاناً.",
  alternates: { canonical: "/tools/salary-calculator" },
  openGraph: {
    type: "website",
    title: "حاسبة مرتب الموظف في مصر 2026 — مجانية",
    description:
      "احسب صافي مرتب الموظف بالتأمينات وضرايب 2026 — مع شرح تفصيلي لكل خصم.",
    url: "/tools/salary-calculator",
  },
  twitter: {
    card: "summary_large_image",
    title: "حاسبة مرتب موظف في مصر 2026",
    description: "صافي + تأمينات + ضرايب 2026 — مجاناً.",
  },
};

export default function SalaryCalculatorPage() {
  return (
    <div className="min-h-screen bg-white font-cairo flex flex-col">
      <BlogNav />
      <BreadcrumbSchema
        items={[
          { name: "الرئيسية", url: "/" },
          { name: "أدوات مجانية", url: "/tools" },
          { name: "حاسبة المرتبات", url: "/tools/salary-calculator" },
        ]}
      />

      <header className="px-6 pt-12 pb-6 max-w-3xl mx-auto w-full">
        <nav aria-label="breadcrumb" className="text-xs text-slate-500 mb-5">
          <a href="/" className="hover:text-brand-cyan-dark">الرئيسية</a>
          <span className="mx-2">›</span>
          <a href="/tools" className="hover:text-brand-cyan-dark">الأدوات</a>
          <span className="mx-2">›</span>
          <span className="text-slate-700">حاسبة المرتب</span>
        </nav>

        <div className="inline-block px-3 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold mb-4">
          ⚡ أداة مجانية · بدون تسجيل
        </div>
        <h1 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight mb-4">
          حاسبة مرتب موظف في مصر 2026
        </h1>
        <p className="text-lg text-slate-600 leading-relaxed mb-2">
          احسب الصافي اللي بيستلمه الموظف بعد التأمينات وضريبة كسب العمل.
          مبنية على آخر تحديثات قانون 148/2019 وشرايح ضريبة 2026.
        </p>
      </header>

      <main className="px-6 pb-12 max-w-3xl mx-auto w-full flex-1">
        <SalaryCalculator />

        {/* Explanatory section — pure HTML, helps SEO and reassures users */}
        <section className="mt-12 prose-ar">
          <h2>إزاي بنحسب الصافي؟</h2>
          <p>
            المعادلة بسيطة لكن الـ details بتخلي الناس تغلط فيها. الحاسبة
            بتطبق القواعد دي:
          </p>

          <h3>1. الأجر التأميني</h3>
          <p>
            القانون 148/2019 بيقول إن التأمينات بتتحسب على "الأجر التأميني"
            وليس الإجمالي. الأجر التأميني محصور بين:
          </p>
          <ul>
            <li><strong>الحد الأدنى:</strong> 2,700 جنيه/شهر (لو الأجر أقل، التأمينات لسه على 2,700)</li>
            <li><strong>الحد الأقصى:</strong> 16,700 جنيه/شهر (لو الأجر أعلى، التأمينات على 16,700 بس)</li>
          </ul>

          <h3>2. التأمينات الاجتماعية (11%)</h3>
          <p>
            بتتخصم من الموظف على الأجر التأميني. صاحب العمل بيدفع 18.75%
            إضافية من جيبه. الحاسبة بتعرض الاتنين.
          </p>

          <h3>3. ضريبة كسب العمل (شرايح متدرجة 2026)</h3>
          <p>
            بعد ما نخصم التأمينات السنوية من الإجمالي السنوي، بنطبق
            الإعفاء الشخصي 20,000 جنيه/سنة + الشرايح المتدرجة:
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>الشريحة السنوية</th>
                  <th>النسبة</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>أول 20,000 (إعفاء شخصي)</td><td>0%</td></tr>
                <tr><td>20,001 – 60,000</td><td>0%</td></tr>
                <tr><td>60,001 – 75,000</td><td>10%</td></tr>
                <tr><td>75,001 – 90,000</td><td>15%</td></tr>
                <tr><td>90,001 – 220,000</td><td>20%</td></tr>
                <tr><td>220,001 – 420,000</td><td>22.5%</td></tr>
                <tr><td>420,001 – 1,220,000</td><td>25%</td></tr>
                <tr><td>أكثر من 1,220,000</td><td>27.5%</td></tr>
              </tbody>
            </table>
          </div>

          <h3>4. النتيجة النهائية</h3>
          <p>
            <strong>الصافي = الإجمالي - التأمينات - الضريبة</strong>
          </p>

          <div className="callout">
            <div className="callout-title">💡 ملاحظات</div>
            <p>
              الحاسبة دي للحسابات التقريبية. لو شركتك بتعمل خصومات إضافية
              (سلف، غياب، جزاءات) لازم تطرحها يدوي.
              <strong> لحساب آلي + قسائم مرتبات للموظفين، </strong>
              <a href="/signup">جرّب نِظام HR مجاناً</a>.
            </p>
          </div>
        </section>

        {/* Embed snippet — gives bloggers a 1-click way to embed our
            calculator with a "Powered by Nidham HR" backlink. */}
        <EmbedSnippet embedPath="/embed/salary-calculator" height={760} />

        {/* CTA */}
        <section className="mt-12">
          <div className="rounded-3xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark p-8 text-white shadow-xl">
            <h2 className="text-2xl md:text-3xl font-black mb-3">
              عايز النظام يحسب لك بدل ما تحسب يدوي؟
            </h2>
            <p className="text-cyan-50 mb-5">
              نِظام HR بيحسب مرتبات كل موظفينك تلقائياً، ويطبعلك
              قسيمة مرتب لكل واحد، ونماذج 1/6 للتأمينات، وإقرار الضريبة.
              14 يوم تجربة مجاناً.
            </p>
            <a
              href="/signup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-brand-cyan-dark font-bold shadow-md hover:shadow-lg transition"
            >
              🚀 ابدأ تجربة مجانية
            </a>
          </div>
        </section>
      </main>

      <BlogFooter />
    </div>
  );
}
