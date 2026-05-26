// ============================================================================
// /pricing — Public pricing page
// ============================================================================
//
// 4 tiers: Free / Starter / Pro / Business + Enterprise CTA. Pro is the
// "anchor" tier (marked with a Most Popular ribbon — psychology pushes
// people one tier above/below the highlighted one, which is exactly
// where most SMBs land).
//
// FAQ section answers the 5 questions every prospect asks in demos.

import Link from "next/link";
import { FAQPageSchema } from "@/components/json-ld";

// SEO O2: title front-loads "أسعار" + "نظام HR" — common Egyptian search.
export const metadata = {
  title: "أسعار نظام HR ومرتبات مصري — من 749 ج/شهر | نِظام",
  description:
    "باقات نظام HR ومرتبات مصري — Free / Starter (749 ج) / Pro (2,430 ج) / Business (5,990 ج). 14 يوم تجربة مجاناً. خصم 20% على الاشتراك السنوي.",
  alternates: { canonical: "/pricing" },
};

// FAQ schema content — populated below into JSON-LD AND rendered visually
// on the page so users + Google see the same answers.
const PRICING_FAQS = [
  {
    question: "كم سعر نظام HR ومرتبات لشركة 50 موظف في مصر؟",
    answer:
      "باقة Pro من نِظام بـ 2,430 جنيه شهرياً (أو 1,944 ج/شهر مع الاشتراك السنوي بخصم 20%) تكفي لـ 100 موظف وتشمل كل الـ HR + Payroll + AI Assistant + WhatsApp Bot للموظفين. متوافقة مع قانون العمل المصري 12/2003 وقانون التأمينات 148/2019.",
  },
  {
    question: "هل في نسخة مجانية من نِظام؟",
    answer:
      "أيوة. الـ Free Plan مجاني للأبد لحد 5 موظفين، ويشمل إدارة موظفين أساسية + حضور وانصراف + 9 نماذج رسمية للتأمينات والضرايب. مفيش credit card مطلوب.",
  },
  {
    question: "إيه الفرق بين نِظام و Bayzat و ZenHR؟",
    answer:
      "نِظام مبني خصيصاً للسوق المصري — حساب التأمينات بشرائح 2024، شرائح ضريبة الدخل المصرية، 9 نماذج رسمية مصرية، واجهة عربية كاملة، ودعم WhatsApp بالعربي. السعر أقل بـ 60-70% من Bayzat / ZenHR لنفس الموظفين.",
  },
  {
    question: "هل النظام بيحسب التأمينات الاجتماعية والضرايب تلقائياً؟",
    answer:
      "أيوة، النظام بيحسب حصة الموظف وحصة صاحب العمل من التأمينات الاجتماعية حسب قانون 148/2019 وشرائح 2024، وضريبة الدخل حسب شرائح قانون 91/2005 المحدّثة لـ 2026 (7 شرائح من 0% لـ 27.5%).",
  },
  {
    question: "هل يقدر الموظف يسجّل حضوره من موبايله؟",
    answer:
      "أيوة. الموظف بيفتح اللينك من موبايله (PWA - بدون تنزيل تطبيق) → بيسمح للـ GPS والكاميرا → بياخد سيلفي → النظام بيتحقق إنه في مكان العمل (Geofencing) وبيسجّل حضوره مع الوقت والصورة.",
  },
  {
    question: "كم وقت يستغرق Setup النظام لشركتي؟",
    answer:
      "أقل من 5 دقايق. تسجّل حسابك → تستورد موظفينك من Excel (مجاناً) → تضبط إعدادات الشركة → تبدأ. لو محتاج مساعدة، فيه تدريب لفريق HR لمدة ساعة مجاناً مع كل اشتراك Pro.",
  },
  {
    question: "هل في API للتكامل مع أنظمة شركتي؟",
    answer:
      "أيوة، في REST API متاح لباقات Pro و Business، يشمل endpoints لإدارة الموظفين والعملاء والحضور والمرتبات. للـ Enterprise بنبني integration مخصص حسب احتياجك.",
  },
  {
    question: "هل بياناتي آمنة وفقاً لقانون حماية البيانات المصري؟",
    answer:
      "أيوة، النظام متوافق مع قانون حماية البيانات المصري 151/2020 (PDPL). كل بيانات الـ PII الحساسة (الرقم القومي، بيانات البنك، رقم التأمينات) مشفّرة بـ AES-256، ويوجد سجل نشاط (audit log) كامل لكل عمليات الوصول.",
  },
];

type Tier = {
  name: string;
  tagline: string;
  monthlyEgp: number | "custom";
  capLabel: string;
  features: string[];
  notIncluded?: string[];
  ctaLabel: string;
  ctaHref: string;
  highlight?: boolean;
  ribbon?: string;
};

const TIERS: Tier[] = [
  {
    name: "مجانية",
    tagline: "للشركات الصغيرة أو لتجرب النظام",
    monthlyEgp: 0,
    capLabel: "حتى 5 موظفين",
    features: [
      "إدارة الموظفين",
      "تسجيل الحضور والانصراف",
      "طلبات الإجازات",
      "تطبيق موبايل للموظفين",
      "Dashboard أساسي",
    ],
    notIncluded: ["مرتبات", "نماذج تأمينات", "AI Agent", "Marketing Studio"],
    ctaLabel: "ابدأ مجاناً",
    ctaHref: "/signup",
  },
  {
    name: "Starter",
    tagline: "للشركات الصاعدة اللي محتاجة الأساسيات بسرعة",
    monthlyEgp: 500,
    capLabel: "حتى 25 موظف",
    features: [
      "كل مميزات المجانية",
      "نظام مرتبات كامل بحسابات قانون 2026",
      "حساب التأمينات + الضرائب تلقائياً",
      "كل نماذج التأمينات الرسمية (1، 2، 6)",
      "شهادات (عمل، خبرة، راتب)",
      "استيراد بيانات من ZKTeco / Excel",
      "Audit log + Backup يومي",
      "2FA للأمان",
    ],
    notIncluded: ["AI Agent", "Marketing Studio", "Performance Reviews"],
    ctaLabel: "ابدأ Starter",
    ctaHref: "/signup?plan=starter",
  },
  {
    name: "Pro",
    tagline: "الباقة الأكثر شعبية للـ SMBs المصرية",
    monthlyEgp: 1500,
    capLabel: "حتى 100 موظف",
    features: [
      "كل مميزات Starter",
      "🤖 AI Agent (نفّذ طلبات HR بالكلام)",
      "🎯 AI CV Screening (تقييم المرشحين تلقائياً)",
      "📊 Bridge Analytics (CRM + HR في شاشة واحدة)",
      "✨ Marketing Studio (AI لـ social posts + ads)",
      "📋 Performance Reviews + KPIs",
      "📦 Asset Management",
      "🌳 Org Chart تفاعلي",
      "📅 Team Calendar",
      "Sentry monitoring + uptime guarantee",
    ],
    ctaLabel: "ابدأ Pro",
    ctaHref: "/signup?plan=pro",
    highlight: true,
    ribbon: "الأكثر شعبية ⭐",
  },
  {
    name: "Business",
    tagline: "للشركات المتوسطة اللي محتاجة customization",
    monthlyEgp: 3500,
    capLabel: "حتى 500 موظف",
    features: [
      "كل مميزات Pro",
      "📝 Custom Fields لكل entity",
      "🔀 Multi-level Approval Workflows",
      "📊 Reports Builder متقدم",
      "💾 Backup كل 6 ساعات",
      "🛡 Penetration testing report سنوي",
      "📞 Priority support (response خلال 4 ساعات)",
      "SLA 99.9% uptime",
      "Training session للفريق",
    ],
    ctaLabel: "ابدأ Business",
    ctaHref: "/signup?plan=business",
  },
];

const ENTERPRISE_FEATURES = [
  "موظفين غير محدودين",
  "Custom domain (hr.yourcompany.com)",
  "On-premise deployment (Docker)",
  "SSO (SAML / OAuth)",
  "Dedicated success manager",
  "Custom integrations (ERP, payroll bank)",
  "Custom legal compliance review",
  "SLA 99.99% + dedicated infrastructure",
];

const FAQ = [
  {
    q: "هل أقدر أبدأ مجاناً قبل ما أدفع؟",
    a: "أكيد. الباقة المجانية للأبد لحد 5 موظفين. بعدها لو شركتك كبرت، ترقّى للباقة المناسبة. مفيش credit card مطلوبة في البداية.",
  },
  {
    q: "هل السعر شامل ضريبة القيمة المضافة؟",
    a: "السعر المعروض دون ضريبة. الـ VAT 14% بتنضاف على الفاتورة النهائية. لو شركتك مسجلة ضريبياً، تقدر تخصمها كـ input tax.",
  },
  {
    q: "ممكن أدفع سنوياً وأخصم؟",
    a: "أيوه — الدفع السنوي بيخصملك 20%. شركة 100 موظف على Pro: 18,000 ج/سنة بدل 18,000 ج (1,500 × 12). بتوفّر 3,600 ج بدفعة واحدة.",
  },
  {
    q: "هل عندي ضمان استرداد لو ما عجبنيش؟",
    a: "أيوه — 30 يوم ضمان استرداد كامل لأول دفعة. مفيش أسئلة، بنرجّع الفلوس + بياناتك تقدر تـ export-ها كاملة.",
  },
  {
    q: "البيانات بتاعتي آمنة؟ خصوصاً المرتبات؟",
    a: "كل البيانات الحساسة (رقم قومي، حساب بنكي) مشفّرة at-rest. بنتبع قانون حماية البيانات الشخصية المصري 151/2020. عندنا 2FA، audit log بـ SHA-256 chain ضد التزوير، و backup يومي على AWS.",
  },
  {
    q: "بنشتغل ZKTeco — هتقدروا تستوردوا منه؟",
    a: "أيوه، استيراد Excel من جهاز ZKTeco مدمج بـ AI بيقرا الأعمدة العربية تلقائياً ومش بيخسر بصمة. متوسط الاستيراد: 30 ثانية لـ ملف 50 موظف لـ شهر كامل.",
  },
  {
    q: "في support بالعربي؟",
    a: "أكيد. الـ support كله عربي مصري. Pro: عبر WhatsApp + Email. Business: priority WhatsApp + ساعات عمل أطول. Enterprise: dedicated account manager + SLA 4 ساعات response.",
  },
  {
    q: "ممكن أنقل لـ نظام تاني لو قررت؟",
    a: "أيوه — تقدر تـ export كل بياناتك كـ Excel من /api/export في أي وقت. مفيش lock-in. ده حق محفوظ بـ PDPL Article 17 (right to data portability).",
  },
];

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 py-12 px-6">
      {/* SEO O3: FAQ Schema for "People Also Ask" + Featured Snippets.
          Google reads this and may render expandable Q&A directly in
          search results — massive CTR boost for pricing keywords. */}
      <FAQPageSchema questions={PRICING_FAQS} />

      <div className="max-w-6xl mx-auto">
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
        <header className="text-center mb-12">
          <div className="inline-block px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-3 font-cairo">
            💰 أسعار شفافة
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-cairo text-slate-900 mb-3">
            ابدأ مجاناً، ادفع لما تكبر
          </h1>
          <p className="text-base text-slate-600 font-cairo max-w-2xl mx-auto leading-relaxed">
            أربع باقات تغطّي كل أحجام الشركات المصرية. مفيش setup fees، مفيش
            credit card في البداية، مفيش lock-in. كل باقة بـ 30 يوم ضمان
            استرداد.
          </p>
        </header>

        {/* Beta callout */}
        <div className="mb-10 p-5 rounded-2xl bg-gradient-to-r from-amber-50 to-cyan-50 border-2 border-amber-300 text-center font-cairo">
          <div className="text-sm font-black text-amber-900 mb-1">
            🎁 برنامج Beta — أول 10 شركات
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">
            <strong>3 شهور مجاناً</strong> + <strong>50% خصم</strong> للسنة
            الأولى على أي باقة. الشرط: اجتماع نص ساعة كل أسبوعين لـ feedback +
            موافقة على case study.{" "}
            <a
              href="https://wa.me/201055356622?text=أهلاً، عايز أعرف تفاصيل برنامج Beta"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-cyan-dark font-bold hover:underline"
            >
              تواصل واتساب →
            </a>
          </p>
        </div>

        {/* Tiers grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
          {TIERS.map((tier) => (
            <TierCard key={tier.name} tier={tier} />
          ))}
        </div>

        {/* Enterprise CTA */}
        <section className="mb-12 p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-brand-navy text-white">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-block px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold mb-3 font-cairo">
                👑 Enterprise
              </div>
              <h2 className="text-3xl font-black font-cairo mb-3">
                للشركات الكبيرة (500+ موظف)
              </h2>
              <p className="text-slate-300 font-cairo leading-relaxed mb-5">
                لو شركتك كبيرة ومحتاجة custom domain، on-prem deployment، SSO،
                أو compliance review مخصص، عندنا باقة Enterprise مرنة وbي
                إعداد شخصي.
              </p>
              <a
                href="https://wa.me/201055356622?text=أهلاً، عايز عرض Enterprise لشركة عندي [X] موظف"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-6 py-3 rounded-xl bg-amber-400 text-slate-900 font-black font-cairo hover:bg-amber-300 transition"
              >
                💬 تواصل لعرض مخصص
              </a>
            </div>
            <div>
              <ul className="space-y-2 font-cairo">
                {ENTERPRISE_FEATURES.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-amber-400 shrink-0">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="mb-12">
          <h2 className="text-2xl font-black font-cairo text-slate-900 mb-5 text-center">
            مقارنة مع المنافسين
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm font-cairo bg-white rounded-2xl border border-slate-200 shadow-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-right font-black text-slate-700">
                    السمة
                  </th>
                  <th className="px-4 py-3 text-center font-black bg-brand-cyan/10 text-brand-cyan-dark">
                    Nidham (Pro)
                  </th>
                  <th className="px-4 py-3 text-center font-black text-slate-600">
                    Bayzat
                  </th>
                  <th className="px-4 py-3 text-center font-black text-slate-600">
                    ZenHR
                  </th>
                  <th className="px-4 py-3 text-center font-black text-slate-600">
                    BambooHR
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <CompareRow label="سعر شركة 100 موظف/شهر" cells={["1,500 ج", "10,000+ ج", "8,000+ ج", "12,000+ ج"]} />
                <CompareRow label="عربي مصري Native" cells={["✅", "⚠️", "✅", "❌"]} />
                <CompareRow label="نماذج التأمينات المصرية" cells={["✅", "❌", "❌", "❌"]} />
                <CompareRow label="حسابات ضريبة 2026" cells={["✅", "⚠️", "⚠️", "N/A"]} />
                <CompareRow label="AI Agent للتنفيذ" cells={["✅", "❌", "❌", "❌"]} />
                <CompareRow label="2FA مجاني" cells={["✅", "Enterprise only", "Enterprise only", "✅"]} />
                <CompareRow label="PII Encryption" cells={["✅", "Enterprise", "Enterprise", "Enterprise"]} />
                <CompareRow label="Audit Hash Chain" cells={["✅", "❌", "❌", "❌"]} />
                <CompareRow label="Marketing Studio مدمج" cells={["✅", "❌", "❌", "❌"]} />
                <CompareRow label="ZKTeco import بـ AI" cells={["✅", "manual", "manual", "❌"]} />
              </tbody>
            </table>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12">
          <h2 className="text-2xl font-black font-cairo text-slate-900 mb-5 text-center">
            أسئلة شائعة
          </h2>
          <div className="space-y-3 max-w-3xl mx-auto">
            {FAQ.map((item, i) => (
              <details
                key={i}
                className="bg-white rounded-2xl border border-slate-200 p-4 font-cairo group"
              >
                <summary className="cursor-pointer flex items-center justify-between text-sm font-bold text-slate-800">
                  <span>{item.q}</span>
                  <span className="text-slate-400 group-open:rotate-180 transition">
                    ▼
                  </span>
                </summary>
                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="text-center py-12 px-6 rounded-3xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark text-white">
          <h2 className="text-3xl font-black font-cairo mb-3">
            جاهز تبدأ؟
          </h2>
          <p className="text-cyan-50 mb-6 font-cairo">
            ابدأ مجاناً النهاردة — مفيش credit card، مفيش setup، 5 دقايق وانت
            شغّال.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/signup"
              className="px-6 py-3 rounded-xl bg-white text-brand-cyan-dark font-black font-cairo hover:bg-cyan-50 transition"
            >
              🚀 ابدأ مجاناً
            </Link>
            <a
              href="https://wa.me/201055356622?text=أهلاً، عايز demo لـ Nidham"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl bg-white/10 border border-white/30 text-white font-bold font-cairo hover:bg-white/20 transition"
            >
              💬 احجز demo
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div
      className={`relative p-5 rounded-2xl border-2 ${
        tier.highlight
          ? "border-brand-cyan bg-gradient-to-b from-brand-cyan/10 to-white shadow-xl"
          : "border-slate-200 bg-white"
      }`}
    >
      {tier.ribbon && (
        <div className="absolute -top-3 right-3 px-3 py-0.5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black font-cairo shadow">
          {tier.ribbon}
        </div>
      )}

      <h3 className="text-xl font-black font-cairo text-slate-900 mb-1">
        {tier.name}
      </h3>
      <p className="text-xs text-slate-500 font-cairo mb-4 min-h-[2.5em]">
        {tier.tagline}
      </p>

      <div className="mb-2">
        {tier.monthlyEgp === "custom" ? (
          <div className="text-3xl font-black font-display text-slate-900">
            تواصل معنا
          </div>
        ) : (
          <>
            <span className="text-4xl font-black font-display text-slate-900">
              {tier.monthlyEgp === 0 ? "0" : tier.monthlyEgp.toLocaleString("ar-EG")}
            </span>
            <span className="text-sm text-slate-500 font-cairo"> ج / شهر</span>
          </>
        )}
      </div>
      <div className="text-xs text-slate-500 font-cairo mb-5">
        📊 {tier.capLabel}
      </div>

      <Link
        href={tier.ctaHref}
        className={`block text-center px-4 py-2.5 rounded-xl font-bold text-sm font-cairo mb-5 ${
          tier.highlight
            ? "bg-brand-cyan-dark text-white hover:bg-brand-cyan"
            : "bg-slate-100 text-slate-800 hover:bg-slate-200"
        }`}
      >
        {tier.ctaLabel}
      </Link>

      <ul className="space-y-2 font-cairo text-xs">
        {tier.features.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-slate-700">
            <span className="text-emerald-500 shrink-0">✓</span>
            <span>{f}</span>
          </li>
        ))}
        {tier.notIncluded?.map((f, i) => (
          <li key={i} className="flex items-start gap-2 text-slate-400 line-through">
            <span className="shrink-0">✗</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompareRow({ label, cells }: { label: string; cells: string[] }) {
  return (
    <tr>
      <td className="px-4 py-2.5 font-bold text-slate-700">{label}</td>
      {cells.map((c, i) => (
        <td
          key={i}
          className={`px-4 py-2.5 text-center ${i === 0 ? "bg-brand-cyan/5 font-bold text-brand-cyan-dark" : "text-slate-600"}`}
        >
          {c}
        </td>
      ))}
    </tr>
  );
}
