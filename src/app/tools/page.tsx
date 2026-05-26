import type { Metadata } from "next";
import Link from "next/link";
import { BlogNav, BlogFooter } from "@/components/blog-chrome";

// ============================================================================
// /tools — Free calculators hub (link magnet listing)
// ============================================================================
//
// One landing page that aggregates all our free Egyptian HR calculators.
// Serves as:
//   • SEO landing for "حاسبات HR مصر" / "أدوات HR مجانية"
//   • Internal hub linking to each tool (improves crawl depth)
//   • Shareable URL for sales/marketing ("شوف الحاسبات المجانية")

export const metadata: Metadata = {
  title: "أدوات HR مجانية للشركات المصرية — حاسبات مرتبات وتأمينات | نِظام HR",
  description:
    "حاسبات HR مجانية: المرتب الصافي، نهاية الخدمة، التأمينات الاجتماعية. مبنية على آخر تحديثات قانون 12/2003 وقانون 148/2019 لـ 2026.",
  alternates: { canonical: "/tools" },
  openGraph: {
    type: "website",
    title: "أدوات HR مجانية للشركات المصرية",
    description:
      "حاسبات للمرتبات والتأمينات ونهاية الخدمة — بدون تسجيل، مجاناً.",
    url: "/tools",
  },
};

type Tool = {
  href: string;
  title: string;
  description: string;
  icon: string;
  badge?: string;
};

const TOOLS: Tool[] = [
  {
    href: "/tools/salary-calculator",
    title: "حاسبة المرتب الصافي",
    description:
      "احسب صافي المرتب بعد التأمينات وضريبة كسب العمل بالشرايح المتدرجة 2026. مع تكلفة الشركة الكاملة.",
    icon: "💰",
    badge: "الأكثر استخداماً",
  },
  {
    href: "/tools/end-of-service",
    title: "حاسبة مكافأة نهاية الخدمة",
    description:
      "احسب المكافأة المستحقة لأي موظف حسب قانون العمل 12/2003 المادة 122. تفصيل سنة بسنة.",
    icon: "🎁",
  },
  {
    href: "/tools/social-insurance",
    title: "حاسبة التأمينات الاجتماعية",
    description:
      "احسب نصيب الموظف (11%) والشركة (18.75%) بآخر قيم NOSI لـ 2026 — الحد الأدنى 2,700 والأقصى 16,700.",
    icon: "🛡️",
  },
];

export default function ToolsHubPage() {
  return (
    <div className="min-h-screen bg-white font-cairo flex flex-col">
      <BlogNav />

      <section className="px-6 py-16 md:py-20 bg-gradient-to-b from-cyan-50/40 via-white to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold mb-6">
            ✦ أدوات مجانية للـ HR في مصر
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-5">
            حاسبات HR مجانية
            <br />
            <span style={{ color: "#0891b2" }}>متخصصة للسوق المصري</span>
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            كل الحاسبات مبنية على آخر تحديثات قانون العمل 12/2003 وقانون
            التأمينات 148/2019 وشرايح ضريبة الدخل 2026. مجانية بالكامل،
            من غير تسجيل.
          </p>
        </div>
      </section>

      <main className="px-6 pb-16 max-w-5xl mx-auto w-full flex-1">
        <div className="grid md:grid-cols-3 gap-6">
          {TOOLS.map((tool) => (
            <Link
              key={tool.href}
              href={tool.href}
              className="group block rounded-2xl border border-slate-200 bg-white p-6 hover:border-brand-cyan hover:shadow-lg transition relative"
            >
              {tool.badge && (
                <span className="absolute top-4 left-4 text-[10px] font-bold tracking-wide uppercase px-2 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-300">
                  {tool.badge}
                </span>
              )}
              <div className="text-5xl mb-4">{tool.icon}</div>
              <h2 className="text-xl font-black text-slate-900 mb-2 group-hover:text-brand-cyan-dark transition">
                {tool.title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                {tool.description}
              </p>
              <div className="text-sm font-bold text-brand-cyan-dark inline-flex items-center gap-1">
                افتح الحاسبة
                <span className="group-hover:-translate-x-1 transition">←</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Coming-soon teaser */}
        <div className="mt-16 p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center">
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            حاسبات جاية قريب
          </h3>
          <p className="text-sm text-slate-600">
            حاسبة الأوفر تايم · حاسبة الإجازة السنوية المستحقة · حاسبة
            التكلفة الحقيقية للموظف
          </p>
        </div>

        {/* CTA */}
        <section className="mt-12">
          <div className="rounded-3xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark p-8 md:p-10 text-white shadow-xl text-center">
            <h2 className="text-2xl md:text-3xl font-black mb-3">
              عايز كل ده تلقائياً للموظفين كلهم؟
            </h2>
            <p className="text-cyan-50 mb-6 max-w-xl mx-auto">
              نِظام HR بيعمل الحسابات دي مرة واحدة لكل موظفينك ويطبع
              قسائم المرتبات + نماذج التأمينات + إقرارات الضريبة.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-brand-cyan-dark font-bold shadow-md hover:shadow-lg transition"
            >
              🚀 ابدأ تجربة مجانية 14 يوم
            </Link>
          </div>
        </section>
      </main>

      <BlogFooter />
    </div>
  );
}
