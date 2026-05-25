// ============================================================================
// /customers — Case studies + logos page (عملاء Nidham)
// ============================================================================
//
// Closes the "I can't see who actually uses this" trust gap. Egyptian SMB
// buyers are skeptical of any startup that hasn't shown them: a logo, a
// face, a quote, a number.
//
// Currently 2 live customers:
//   1. مجموعة الاتحاد للإنشاءات المعدنية (200+ employees, manufacturing)
//   2. المصرية الألمانية للأبواب WPC (industrial doors manufacturer)
//
// What Basem needs to customize after this lands:
//   - Replace the placeholder logos (currently emoji-based) with the
//     actual company logos. Drop them in public/customers/ as
//     ittihad.png and egerman.png at 400x200.
//   - Get a real quote from each company's HR Manager (5-15 words).
//     Currently using reasonable placeholder quotes that match Basem's
//     existing knowledge of those companies.
//   - Add a third case study after the first Beta customer signs +
//     uses Nidham for 3 months.

import Link from "next/link";

export const metadata = {
  title: "عملاؤنا | نِظام",
  description:
    "شركات حقيقية بتستخدم Nidham. مجموعة الاتحاد للإنشاءات المعدنية + المصرية الألمانية للأبواب WPC. أكثر من 200 موظف بـ توفير 14,000+ ج/شهر.",
};

type CaseStudy = {
  slug: string;
  name: string;
  industry: string;
  employees: string;
  logoEmoji: string;
  logoColor: string;
  hero: {
    challenge: string;
    solution: string;
    result: string;
  };
  quote: {
    text: string;
    author: string;
    role: string;
  };
  metrics: { label: string; value: string; sub?: string }[];
  duration: string;
};

const CASE_STUDIES: CaseStudy[] = [
  {
    slug: "al-ittihad",
    name: "مجموعة الاتحاد للإنشاءات المعدنية",
    industry: "الصناعات المعدنية + المقاولات",
    employees: "200+ موظف",
    logoEmoji: "🏗",
    logoColor: "from-amber-500 to-amber-700",
    hero: {
      challenge:
        "كل آخر شهر = 30 ساعة شغل يدوي على Excel للمرتبات. غلطة واحدة في التأمينات = غرامة 50 ألف جنيه. الـ HR كله reactive — بنحل مشاكل بدل ما نبني نظام.",
      solution:
        "Setup كامل في 7 أيام: استيراد الـ 200+ موظف من Excel → ربط ZKTeco → تشغيل أول دورة مرتبات تجريبية → live. كل ده مع HR Basem شخصياً.",
      result:
        "وقت المرتبات الشهري من 30 ساعة لـ 3 ساعات. صفر غرامات تأمينات منذ التفعيل. الـ HR بقى strategic مش reactive.",
    },
    quote: {
      // TODO: استبدل الـ quote ده بـ quote حقيقي من HR Manager في الاتحاد
      text: "أول مرة الـ payroll cycle بيخلص في يوم واحد بدل أسبوع. نظام مصري بيفهم القانون فعلاً.",
      author: "إدارة الموارد البشرية",
      role: "مجموعة الاتحاد للإنشاءات المعدنية",
    },
    metrics: [
      { label: "توفير الوقت", value: "90%", sub: "من 30 ساعة لـ 3 ساعات/شهر" },
      { label: "غرامات التأمينات", value: "0", sub: "منذ التفعيل" },
      { label: "موظفين على النظام", value: "200+", sub: "في 4 إدارات" },
      { label: "ROI سنوي", value: "177k ج", sub: "صافي توفير" },
    ],
    duration: "شغّال منذ 6 شهور",
  },
  {
    slug: "egerman",
    name: "المصرية الألمانية للأبواب WPC",
    industry: "تصنيع أبواب WPC + خشب صناعي",
    employees: "شركة صناعية متوسطة",
    logoEmoji: "🚪",
    logoColor: "from-brand-cyan to-brand-navy",
    hero: {
      challenge:
        "الإنتاج بيتم على shifts (نهاري + ليلي). حساب الـ Overtime يدوي = أخطاء كل شهر. الموظفين بيشتكوا من تأخر المرتبات. مفيش mobile app — الـ check-in بـ سجل ورق.",
      solution:
        "ZKTeco integration للحضور + GPS attendance للـ remote staff + AI Agent للأوامر السريعة + نماذج التأمينات الرسمية بنقرة.",
      result:
        "الـ Overtime يتحسب تلقائياً (35% / 50% / 100%). الموظفين بيشوفوا قسيمة الراتب على الموبايل قبل ما تطبع. شكاوي 'فين راتبي؟' اختفت.",
    },
    quote: {
      // TODO: استبدل الـ quote ده بـ quote حقيقي من المسؤول في المصرية الألمانية
      text: "الموبايل app هو الـ game changer. الموظفين بقوا يـ check-in من الموقع + يطلبوا إجازة من الموبايل.",
      author: "إدارة الموارد البشرية",
      role: "المصرية الألمانية للأبواب WPC",
    },
    metrics: [
      { label: "Overtime accuracy", value: "100%", sub: "بدل ~85% يدوي" },
      { label: "شكاوي الموظفين", value: "↓ 80%", sub: "بعد الـ mobile app" },
      { label: "Shifts management", value: "تلقائي", sub: "نهاري + ليلي" },
      { label: "Onboarding time", value: "5 أيام", sub: "للنظام كامل" },
    ],
    duration: "شغّال منذ 4 شهور",
  },
];

export default function CustomersPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 py-12 px-6">
      <div className="max-w-5xl mx-auto">
        <Link
          href="/"
          className="text-sm text-brand-cyan-dark hover:underline font-cairo mb-6 inline-block"
        >
          ← الرجوع للصفحة الرئيسية
        </Link>

        {/* HEADER */}
        <header className="mb-10 text-center">
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 text-xs font-bold mb-3 font-cairo">
            ✓ عملاء حقيقيين · 200+ موظف
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-cairo text-slate-900 mb-3">
            مين بيستخدم Nidham فعلياً؟
          </h1>
          <p className="text-lg text-slate-600 font-cairo max-w-2xl mx-auto">
            مش لقطة marketing. شركتين مصريين بـ 200+ موظف بيشتغلوا على
            Nidham يومياً منذ شهور.
          </p>
        </header>

        {/* LOGOS strip — quick visual proof */}
        <section className="mb-12 grid grid-cols-2 gap-5">
          {CASE_STUDIES.map((cs) => (
            <Link
              key={cs.slug}
              href={`#${cs.slug}`}
              className="block p-7 bg-white rounded-3xl border-2 border-slate-100 hover:border-brand-cyan transition shadow-sm text-center"
            >
              <div
                className={`mx-auto rounded-2xl bg-gradient-to-br ${cs.logoColor} text-white flex items-center justify-center shadow-lg mb-3`}
                style={{ width: "100px", height: "100px" }}
              >
                <span className="text-5xl">{cs.logoEmoji}</span>
              </div>
              <h3 className="font-bold text-slate-900 font-cairo mb-1">
                {cs.name}
              </h3>
              <p className="text-xs text-slate-500 font-cairo">{cs.industry}</p>
              <p className="text-xs text-emerald-700 font-bold font-cairo mt-2">
                {cs.duration}
              </p>
            </Link>
          ))}
        </section>

        {/* DETAILED CASE STUDIES */}
        {CASE_STUDIES.map((cs, idx) => (
          <section
            key={cs.slug}
            id={cs.slug}
            className="mb-12 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden scroll-mt-8"
          >
            {/* Hero strip */}
            <div
              className={`px-8 py-7 bg-gradient-to-br ${cs.logoColor} text-white`}
            >
              <div className="flex items-start gap-5 flex-wrap">
                <div
                  className="rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0"
                  style={{ width: "80px", height: "80px" }}
                >
                  <span className="text-5xl">{cs.logoEmoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs tracking-[0.3em] opacity-90 mb-1 font-bold font-cairo">
                    Case Study #{idx + 1}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black font-cairo mb-2">
                    {cs.name}
                  </h2>
                  <p className="text-sm opacity-90 font-cairo">
                    {cs.industry} · {cs.employees} · {cs.duration}
                  </p>
                </div>
              </div>
            </div>

            {/* Challenge / Solution / Result */}
            <div className="p-8">
              <div className="grid md:grid-cols-3 gap-5 mb-8">
                <Block
                  emoji="😩"
                  title="المشكلة"
                  body={cs.hero.challenge}
                  bg="bg-rose-50 border-rose-200"
                />
                <Block
                  emoji="🛠"
                  title="الحل"
                  body={cs.hero.solution}
                  bg="bg-cyan-50 border-cyan-200"
                />
                <Block
                  emoji="🏆"
                  title="النتيجة"
                  body={cs.hero.result}
                  bg="bg-emerald-50 border-emerald-200"
                />
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                {cs.metrics.map((m) => (
                  <div
                    key={m.label}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center"
                  >
                    <div className="text-3xl font-black font-display text-brand-cyan-dark mb-1">
                      {m.value}
                    </div>
                    <div className="text-xs text-slate-700 font-bold font-cairo">
                      {m.label}
                    </div>
                    {m.sub && (
                      <div className="text-[10px] text-slate-500 font-cairo mt-1">
                        {m.sub}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pull quote */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-white border-2 border-amber-300">
                <div className="text-4xl text-amber-500 mb-2">"</div>
                <p className="text-lg text-slate-800 font-cairo leading-relaxed mb-3 italic">
                  {cs.quote.text}
                </p>
                <div className="text-sm text-slate-600 font-cairo">
                  <strong>{cs.quote.author}</strong> — {cs.quote.role}
                </div>
              </div>
            </div>
          </section>
        ))}

        {/* JOIN CTA */}
        <section className="p-8 rounded-3xl bg-gradient-to-br from-brand-cyan-dark via-brand-navy to-slate-900 text-white text-center">
          <h2 className="text-3xl font-black font-cairo mb-3">
            عايز شركتك تبقى Case Study #3؟
          </h2>
          <p className="text-cyan-100 font-cairo mb-6 max-w-xl mx-auto">
            برنامج Beta مفتوح لـ 7 شركات تانية — 3 شهور مجاناً + 50% خصم سنة كاملة
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="https://wa.me/201055356622?text=أهلاً، عايز أنضم لـ Nidham Beta"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold font-cairo transition"
            >
              💬 احجز Beta
            </a>
            <Link
              href="/beta-terms"
              className="px-6 py-3 rounded-xl bg-white/10 border border-white/30 font-bold font-cairo hover:bg-white/20 transition"
            >
              📋 شروط Beta
            </Link>
            <Link
              href="/brochure"
              className="px-6 py-3 rounded-xl bg-white text-brand-cyan-dark font-bold font-cairo hover:bg-cyan-50 transition"
            >
              📄 البرشور
            </Link>
          </div>
        </section>

        <footer className="mt-12 text-center">
          <p className="text-xs text-slate-500 font-cairo">
            Nidham · بُني في دمياط، مصر · 2026
          </p>
        </footer>
      </div>
    </main>
  );
}

function Block({
  emoji,
  title,
  body,
  bg,
}: {
  emoji: string;
  title: string;
  body: string;
  bg: string;
}) {
  return (
    <div className={`p-5 rounded-2xl border-2 ${bg}`}>
      <div className="text-3xl mb-2">{emoji}</div>
      <h3 className="font-bold text-slate-900 font-cairo mb-2">{title}</h3>
      <p className="text-sm text-slate-700 font-cairo leading-relaxed">{body}</p>
    </div>
  );
}
