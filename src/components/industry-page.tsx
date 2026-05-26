import Link from "next/link";
import { BlogNav, BlogFooter } from "@/components/blog-chrome";
import { BreadcrumbSchema } from "@/components/json-ld";

// ============================================================================
// Reusable industry-landing-page template
// ============================================================================
//
// Each /industries/<slug> page reuses this. The shared shape gives every
// industry the same SEO surface (H1 + H2 sections, FAQ, schema, CTA) while
// allowing different copy. Cuts the per-industry file to a 60-line config.
//
// Why industry pages matter for SEO:
//   • "نظام HR للمصانع" / "نظام HR لشركات الشحن" are higher-converting than
//     generic "نظام HR" — visitors know they have an industry-specific need
//   • Industry-specific copy boosts on-page topical relevance for Google's
//     latest BERT/SGE updates that reward query-intent matching

export type IndustryPainPoint = {
  icon: string;
  problem: string;
  cost: string;
};

export type IndustryFeature = {
  icon: string;
  title: string;
  description: string;
};

export type IndustryPageData = {
  // SEO + URL
  slug: string;                    // "manufacturing", "logistics", etc.
  // Hero
  badge: string;                   // chip text under nav
  h1: string;                      // the big headline
  subhead: string;                 // grey subheadline below H1
  // Audience persona
  audienceLabel: string;           // "للمصانع" or "لشركات الشحن"
  // Pain points (4 cards)
  painPoints: IndustryPainPoint[];
  // Features tailored to this industry (4-6 cards)
  features: IndustryFeature[];
  // FAQ (5-7 Q&A)
  faqs: { question: string; answer: string }[];
  // Customer-style proof point (1 sentence)
  proofPoint?: string;
};

export function IndustryPage({ data }: { data: IndustryPageData }) {
  return (
    <div className="min-h-screen bg-white font-cairo flex flex-col">
      <BlogNav />
      <BreadcrumbSchema
        items={[
          { name: "الرئيسية", url: "/" },
          { name: "الصناعات", url: "/industries" },
          { name: data.audienceLabel, url: `/industries/${data.slug}` },
        ]}
      />

      {/* Hero */}
      <section className="px-6 py-14 md:py-20 bg-gradient-to-b from-cyan-50/40 via-white to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold mb-6">
            ✦ {data.badge}
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-900 leading-tight mb-5">
            {data.h1}
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto mb-8">
            {data.subhead}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg hover:shadow-xl transition"
            >
              🚀 ابدأ تجربة مجانية 14 يوم
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-bold hover:border-slate-300 transition"
            >
              📊 شوف الأسعار
            </Link>
          </div>
        </div>
      </section>

      {/* Pain points */}
      <section className="px-6 py-16 max-w-5xl mx-auto w-full">
        <div className="text-center mb-12">
          <div className="text-xs font-bold tracking-widest uppercase text-rose-600 mb-3">
            التحديات اللي بتقابلك
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900">
            مين فينا ما عاشش الموقف ده؟
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {data.painPoints.map((pain, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-rose-200 bg-rose-50/40"
            >
              <div className="text-3xl mb-3">{pain.icon}</div>
              <p className="text-sm font-bold text-slate-900 mb-2">
                {pain.problem}
              </p>
              <p className="text-xs text-rose-700">
                {pain.cost}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="text-xs font-bold tracking-widest uppercase text-brand-cyan-dark mb-3">
              المميزات الخاصة بـ {data.audienceLabel}
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900">
              نِظام HR متخصص لقطاعك
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.features.map((f, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm"
              >
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof point */}
      {data.proofPoint && (
        <section className="px-6 py-12">
          <div className="max-w-3xl mx-auto rounded-2xl bg-gradient-to-br from-brand-navy to-slate-800 p-8 text-white shadow-lg">
            <div className="text-4xl mb-4">💬</div>
            <p className="text-lg leading-relaxed">{data.proofPoint}</p>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="px-6 py-16 max-w-3xl mx-auto w-full">
        <h2 className="text-3xl font-black text-slate-900 mb-8 text-center">
          الأسئلة الشائعة
        </h2>
        <div className="space-y-4">
          {data.faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <h3 className="font-bold text-slate-900 mb-2">
                {faq.question}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-16 max-w-4xl mx-auto w-full">
        <div className="rounded-3xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark p-8 md:p-12 text-white shadow-xl text-center">
          <h2 className="text-2xl md:text-3xl font-black mb-3">
            جرّب نِظام HR لشركتك مجاناً
          </h2>
          <p className="text-cyan-50 mb-6 max-w-xl mx-auto">
            14 يوم تجربة كاملة. مفيش credit card. شغّال في 5 دقايق.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white text-brand-cyan-dark font-bold shadow-md hover:shadow-lg transition"
          >
            🚀 ابدأ مجاناً
          </Link>
        </div>
      </section>

      <BlogFooter />
    </div>
  );
}
