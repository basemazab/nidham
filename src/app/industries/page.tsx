import type { Metadata } from "next";
import Link from "next/link";
import { BlogNav, BlogFooter } from "@/components/blog-chrome";

export const metadata: Metadata = {
  title: "نظام HR متخصص لقطاعك — صناعة، شحن، مطاعم، ريتيل | نِظام HR",
  description:
    "نِظام HR مع تخصيصات لقطاعات السوق المصري: المصانع، شركات الشحن، المطاعم والكافيهات، ومحلات الريتيل. اختار قطاعك وشوف المميزات.",
  alternates: { canonical: "/industries" },
};

const INDUSTRIES = [
  {
    slug: "manufacturing",
    icon: "🏭",
    title: "المصانع والإنتاج",
    description: "ورديات متعددة، أوفر تايم بالنسب القانونية، حضور بالبصمة أو GPS، نماذج التأمينات.",
  },
  {
    slug: "logistics",
    icon: "🚛",
    title: "الشحن واللوجستيات",
    description: "تتبع السائقين بـ GPS، CRM لعملاء الشركات، تكامل مع TMS، WhatsApp Bot.",
  },
  {
    slug: "restaurants",
    icon: "🍽️",
    title: "المطاعم والكافيهات",
    description: "جدولة الورديات، توزيع البقشيش، Part-time + Full-time، Onboarding سريع.",
  },
  {
    slug: "retail",
    icon: "🛍️",
    title: "الريتيل والمحلات",
    description: "إدارة فروع متعددة، عمولات الـ Sales، تحويل موظفين، تكامل POS.",
  },
];

export default function IndustriesHubPage() {
  return (
    <div className="min-h-screen bg-white font-cairo flex flex-col">
      <BlogNav />

      <section className="px-6 py-16 md:py-20 bg-gradient-to-b from-cyan-50/40 via-white to-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold mb-6">
            ✦ نِظام HR لقطاعك
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-5">
            نظام HR متخصص
            <br />
            <span style={{ color: "#0891b2" }}>لكل قطاع في السوق المصري</span>
          </h1>
          <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
            مش كل الشركات زي بعض. لكل قطاع تحدياته الخاصة في الـ HR — ورديات،
            عمولات، بقشيش، أو حضور ميداني. اختر قطاعك واشوف إزاي نِظام HR
            بيخدمك.
          </p>
        </div>
      </section>

      <main className="px-6 pb-16 max-w-5xl mx-auto w-full flex-1">
        <div className="grid md:grid-cols-2 gap-6">
          {INDUSTRIES.map((ind) => (
            <Link
              key={ind.slug}
              href={`/industries/${ind.slug}`}
              className="group block rounded-2xl border border-slate-200 bg-white p-6 hover:border-brand-cyan hover:shadow-lg transition"
            >
              <div className="text-5xl mb-4">{ind.icon}</div>
              <h2 className="text-2xl font-black text-slate-900 mb-2 group-hover:text-brand-cyan-dark transition">
                {ind.title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed mb-4">
                {ind.description}
              </p>
              <div className="text-sm font-bold text-brand-cyan-dark inline-flex items-center gap-1">
                شوف الميزات
                <span className="group-hover:-translate-x-1 transition">←</span>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-12 p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center">
          <h3 className="text-lg font-bold text-slate-900 mb-2">
            قطاعك مش في القائمة؟
          </h3>
          <p className="text-sm text-slate-600 mb-4">
            نِظام HR شغّال مع مختلف القطاعات — العيادات، مكاتب المحاماة،
            المدارس، الشركات الخدمية، الـ NGOs، وأكتر.
          </p>
          <Link
            href="/contact"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:border-brand-cyan transition"
          >
            اتواصل معانا
          </Link>
        </div>
      </main>

      <BlogFooter />
    </div>
  );
}
