import Link from "next/link";

// ============================================================================
// /crm — CRM-only landing page (for sales / shipping / software customers)
// ============================================================================
//
// Built for the specific scenario where a customer asked for "CRM only"
// (no HR / no payroll). The page positions Nidham purely as a sales +
// pipeline tool, with shipping-company and B2B-software examples, then
// funnels into /signup?plan=crm-starter (or crm-pro) — which the signup
// action detects and uses to auto-apply feature overrides that hide all
// HR modules from the new tenant's dashboard.

export const metadata = {
  title: "نِظام CRM — إدارة المبيعات للشركات المصرية | Nidham",
  description:
    "نظام CRM عربي لإدارة العملاء والـ Pipeline ومتابعة الـ deals. مبني للشركات المصرية في الـ B2B والتجارة والخدمات. 14 يوم تجربة مجانية.",
};

export default function CrmLandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-cyan-50/30 font-cairo">
      {/* Top nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-cyan-dark flex items-center justify-center shadow-md">
            <span className="text-xl font-black text-white font-display">ن</span>
          </div>
          <span className="text-xl font-black text-slate-900">نِظام CRM</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="hidden md:inline-block px-4 py-2 text-sm text-slate-600 hover:text-slate-900 font-medium"
          >
            دخول
          </Link>
          <Link
            href="/signup?plan=crm-starter"
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white text-sm font-bold shadow-md hover:shadow-lg transition"
          >
            ابدأ مجاناً
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 py-16 md:py-24 max-w-5xl mx-auto">
        <div className="text-center">
          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold mb-6">
            ✦ مخصص لشركات B2B والشحن والبرمجة في مصر
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-slate-900 leading-tight mb-6">
            وقف عن متابعة العملاء
            <br />
            <span style={{ color: "#0891b2" }}>في Excel و WhatsApp.</span>
          </h1>
          <p className="text-xl text-slate-600 leading-relaxed mb-8 max-w-2xl mx-auto">
            نِظام CRM عربي بسيط وقوي. تابع كل عميل، اتفاعل، وعقد في مكان
            واحد. مع AI بيرتب الأولوية و WhatsApp bot بيرد على عملاءك تلقائياً.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
            <Link
              href="/signup?plan=crm-starter"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-lg hover:shadow-xl transition"
            >
              🚀 ابدأ تجربتك 14 يوم
            </Link>
            <Link
              href="/sales-brochure"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-white border-2 border-slate-200 text-slate-700 font-bold hover:border-slate-300 transition"
            >
              📥 حمّل الـ Brochure PDF
            </Link>
          </div>

          {/* Trust strip */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
            <span>✓ بدون credit card</span>
            <span>✓ Migration مجاناً من Excel/WhatsApp</span>
            <span>✓ دعم بالعربي</span>
            <span>✓ Setup في 5 دقايق</span>
          </div>
        </div>
      </section>

      {/* The Pain section */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="text-xs font-bold tracking-widest uppercase text-rose-600 mb-3">
            مين فينا ما عداش الموقف ده؟
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3">
            بائعك بيكتب في WhatsApp Group:
          </h2>
          <p className="text-lg text-slate-600 italic max-w-2xl mx-auto">
            "كلّمت شركة X، عايزين Demo الأسبوع الجاي"
          </p>
          <p className="text-lg text-slate-600 mt-2">
            بعد أسبوعين... نسيت تعمل follow-up.{" "}
            <strong className="text-rose-700">العميل راح للمنافس.</strong>
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <PainCard num="٣" unit="عملاء/شهر" desc="بتخسرهم بسبب نسيان الـ follow-up" />
          <PainCard
            num="٤"
            unit="ساعات/أسبوع"
            desc="بتروح في تتبع العملاء يدوي"
          />
          <PainCard
            num="٤٠٪"
            unit=""
            desc="من المعلومات بتضيع في WhatsApp groups"
          />
          <PainCard
            num="٠"
            unit=""
            desc="تقارير دقيقة عن أداء فريق المبيعات"
          />
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16 bg-white max-w-6xl mx-auto rounded-3xl shadow-sm border border-slate-100">
        <div className="text-center mb-12">
          <div className="text-xs font-bold tracking-widest uppercase text-brand-cyan-dark mb-3">
            ١٠ مميزات أساسية
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3">
            كل اللي محتاجه عشان تبيع أسرع
          </h2>
          <p className="text-lg text-slate-600">
            مفيش حاجة زيادة. مفيش حاجة ناقصة.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <FeatureBlock
            emoji="📊"
            title="Pipeline visual"
            desc="شوف كل عملاءك على لوحة واحدة. اسحب بين Stages (تواصل أول → Qualified → Demo → Proposal → Closed)."
          />
          <FeatureBlock
            emoji="💬"
            title="Customer 360"
            desc="ملف كامل لكل عميل: تليفون، إيميل، آخر تواصل، الـ deals، الملفات، التذاكر. كله في صفحة واحدة."
          />
          <FeatureBlock
            emoji="🤖"
            title="AI Lead Scoring"
            desc="الـ AI بيرتب عملاءك حسب الاحتمالية يقفلوا — البائع بيركز على الـ deals اللي بتحصد."
          />
          <FeatureBlock
            emoji="⏰"
            title="Automated Follow-ups"
            desc="النظام بيذكّر بائعك قبل الـ renewal بـ 60 يوم، أو بعد آخر تواصل بـ 14 يوم. مفيش عميل بينساه."
          />
          <FeatureBlock
            emoji="📱"
            title="WhatsApp Integration"
            desc="عميلك يكتب على واتساب → النظام يحفظ المحادثة في ملفه. مفيش معلومة بتضيع."
          />
          <FeatureBlock
            emoji="📜"
            title="عقود + توقيع إلكتروني"
            desc="ابعت العقد على واتساب → العميل يوقّع من موبايله في ثواني. مفيش طباعة، مفيش تأخير."
          />
          <FeatureBlock
            emoji="📈"
            title="تقارير وتحليلات"
            desc="Sales velocity, win rate, pipeline value. كل اللي الإدارة تحتاج تشوفه في dashboard واحد."
          />
          <FeatureBlock
            emoji="📥"
            title="Migration مجاناً"
            desc="ابعت ملف Excel أو CSV — هننقل كل عملاءك وتفاعلاتهم في أقل من ساعة. بدون أي رسوم."
          />
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-16 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-xs font-bold tracking-widest uppercase text-emerald-700 mb-3">
            أسعار شفافة · لا رسوم خفية
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3">
            اختار اللي يناسبك
          </h2>
          <p className="text-lg text-slate-600">
            كل الباقات بدون credit card · 14 يوم تجربة كاملة
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {/* CRM Starter */}
          <div className="p-6 rounded-2xl bg-white border-2 border-slate-200 hover:border-cyan-300 transition">
            <div className="mb-4">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                للبداية
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-1">
                CRM Starter
              </h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-black text-slate-900">٥٩٩</span>
                <span className="text-slate-500">ج / شهر</span>
              </div>
              <div className="text-sm text-slate-600">
                ✦ <strong>٥ بائعين</strong> · يكفيك + فريق الدعم
              </div>
            </div>

            <ul className="space-y-2 text-sm text-slate-700 mb-6">
              <FeatureLi text="Pipeline visual + إدارة Stages" />
              <FeatureLi text="ملف كامل لكل عميل (Customer 360)" />
              <FeatureLi text="متابعة تلقائية + تذكيرات" />
              <FeatureLi text="عقود + توقيع إلكتروني" />
              <FeatureLi text="تقارير أساسية" />
              <FeatureLi text="Migration مجاناً من Excel/WhatsApp" />
              <FeatureLi text="دعم بالعربي" />
            </ul>

            <Link
              href="/signup?plan=crm-starter"
              className="block text-center w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold transition"
            >
              ابدأ تجربتك 14 يوم
            </Link>
          </div>

          {/* CRM Pro — recommended */}
          <div
            className="p-6 rounded-2xl bg-gradient-to-br from-cyan-50 via-white to-amber-50 border-2 relative"
            style={{ borderColor: "#0891b2" }}
          >
            <div className="absolute -top-3 right-6 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md">
              ⭐ الموصى به
            </div>

            <div className="mb-4">
              <div className="text-xs font-bold text-cyan-700 uppercase tracking-wider mb-2">
                للنمو
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-1">
                CRM Pro
              </h3>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-black text-slate-900">
                  ١,٤٩٠
                </span>
                <span className="text-slate-500">ج / شهر</span>
              </div>
              <div className="text-sm text-slate-600">
                ✦ <strong>١٥ بائع</strong> · لفرق المبيعات النامية
              </div>
            </div>

            <ul className="space-y-2 text-sm text-slate-700 mb-6">
              <FeatureLi text="كل اللي في Starter +" highlight />
              <FeatureLi text="🤖 AI lead scoring + توصيات تلقائية" highlight />
              <FeatureLi text="💬 WhatsApp bot للعملاء" highlight />
              <FeatureLi text="📱 Marketing automations" highlight />
              <FeatureLi text="📈 تحليلات متقدمة + dashboard" highlight />
              <FeatureLi text="تكامل Email + Calendar" highlight />
              <FeatureLi text="REST API للتكامل مع أنظمتك" highlight />
            </ul>

            <Link
              href="/signup?plan=crm-pro"
              className="block text-center w-full py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold shadow-md hover:shadow-lg transition"
            >
              ابدأ Pro — 14 يوم مجاناً
            </Link>
          </div>
        </div>

        {/* Annual discount banner */}
        <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300 text-center">
          <div className="text-emerald-800 font-bold text-lg mb-1">
            💰 اشتراك سنوي = خصم 20%
          </div>
          <p className="text-sm text-emerald-700">
            CRM Pro السنوي:{" "}
            <strong>١٤,٣٠٤ ج</strong> بدل ١٧,٨٨٠ — توفير ٣,٥٧٦ ج كل سنة
          </p>
        </div>
      </section>

      {/* Bundle Upsell — soft */}
      <section className="px-6 py-12 max-w-4xl mx-auto">
        <div className="p-6 rounded-2xl bg-gradient-to-br from-amber-50 to-cyan-50 border-2 border-amber-200">
          <div className="flex items-start gap-4">
            <div className="text-4xl">💡</div>
            <div className="flex-1">
              <h3 className="text-lg font-black text-slate-900 mb-2">
                لو احتجت HR / مرتبات يوم من الأيام...
              </h3>
              <p className="text-sm text-slate-700 leading-relaxed mb-3">
                Nidham عنده موديول HR كامل (موظفين، مرتبات، إجازات، نماذج
                التأمينات الرسمية). الـ Bundle بـ ٢,٤٣٠ ج/شهر — يعني{" "}
                <strong>٩٤٠ ج زيادة فقط</strong> فوق CRM Pro، عشان تستخدم كل
                الـ HR.
              </p>
              <Link
                href="/pricing"
                className="inline-block text-sm text-amber-800 font-bold underline"
              >
                شوف الباقات الكاملة →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-16 max-w-3xl mx-auto text-center">
        <h2 className="text-4xl font-black text-slate-900 mb-4">
          جاهز تجرّب؟
        </h2>
        <p className="text-lg text-slate-600 mb-8">
          سجّل في دقيقة. 14 يوم تجربة كاملة. مفيش credit card.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/signup?plan=crm-starter"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-black text-lg shadow-lg hover:shadow-xl transition"
          >
            🚀 ابدأ مجاناً
          </Link>
          <a
            href="https://wa.me/201055356622?text=أهلاً، عايز Demo حية لـ Nidham CRM"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition"
          >
            💬 احجز Demo
          </a>
        </div>

        <p className="text-xs text-slate-400 mt-8">
          نِظام · Made in Damietta, Egypt · للشركات المصرية بكل تفاصيلها
        </p>
      </section>
    </main>
  );
}

// ============================================================================
// Helper components
// ============================================================================

function PainCard({
  num,
  unit,
  desc,
}: {
  num: string;
  unit: string;
  desc: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center">
      <div className="text-3xl font-black text-rose-700">{num}</div>
      <div className="text-xs text-rose-600 mb-2">{unit}</div>
      <p className="text-xs text-slate-700 leading-snug">{desc}</p>
    </div>
  );
}

function FeatureBlock({
  emoji,
  title,
  desc,
}: {
  emoji: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">{emoji}</div>
        <div>
          <h3 className="font-bold text-slate-900 mb-1">{title}</h3>
          <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function FeatureLi({
  text,
  highlight,
}: {
  text: string;
  highlight?: boolean;
}) {
  return (
    <li className="flex items-start gap-2">
      <span
        className={`flex-shrink-0 ${highlight ? "text-cyan-600" : "text-emerald-600"}`}
      >
        ✓
      </span>
      <span className={highlight ? "font-medium" : ""}>{text}</span>
    </li>
  );
}
