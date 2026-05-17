import Link from "next/link";
import { MobileAppQR } from "@/components/mobile-app-qr";

type SearchParams = Promise<{
  error?: string;
  error_code?: string;
  error_description?: string;
}>;

// Public-facing landing page. Sells Nidham as a complete HR + CRM +
// AI Recruitment SaaS for Egyptian SMBs. Built to convert a curious
// visitor into either a signed-up admin or an employee who reaches
// the mobile app. Everything above the fold answers "what is this?"
// and the deeper sections deliver proof on each claim.

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const hasAuthError = !!(params.error || params.error_code);
  const friendlyError =
    params.error_code === "otp_expired"
      ? "اللينك انتهت صلاحيته أو اتستخدم قبل كده — اطلب لينك جديد"
      : params.error_description
      ? decodeURIComponent(params.error_description.replace(/\+/g, " "))
      : "حصلت مشكلة في تسجيل الدخول — جرّب تاني";

  return (
    <main className="bg-white">
      {hasAuthError && (
        <div className="max-w-3xl mx-auto px-6 pt-6">
          <div className="p-4 rounded-xl bg-red-50 border-2 border-red-200 text-right flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <h3 className="font-bold text-red-800 mb-1 font-cairo">حصلت مشكلة</h3>
              <p className="text-sm text-red-700 mb-3 font-cairo">{friendlyError}</p>
              <Link
                href="/forgot-password"
                className="inline-block text-sm text-red-700 font-bold underline hover:no-underline font-cairo"
              >
                اطلب لينك إعادة تعيين جديد ←
              </Link>
            </div>
          </div>
        </div>
      )}

      <HeroSection />
      <ProofStrip />
      <CoreModulesSection />
      <BridgeAnalyticsSection />
      <AISection />
      <MarketingStudioSection />
      <MobileSection />
      <SecuritySection />
      <DeploymentOptionsSection />
      <HowItWorksSection />
      <FinalCTASection />
      <Footer />
    </main>
  );
}

// =================================================================
// Hero
// =================================================================

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-cyan-50/40 px-6 py-16 md:py-24">
      {/* Background glow */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(34,211,238,0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(201,168,76,0.10), transparent 50%)",
        }}
      />

      <div className="max-w-5xl mx-auto text-center">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy mb-6 shadow-xl shadow-cyan-500/20">
          <span className="text-4xl font-black text-white font-display">ن</span>
        </div>

        {/* Brand */}
        <h1 className="text-6xl md:text-7xl font-black mb-2 tracking-tight font-display">
          <span className="bg-gradient-to-r from-brand-cyan-dark via-brand-cyan to-brand-navy bg-clip-text text-transparent">
            نِظام
          </span>
        </h1>
        <p className="text-sm tracking-[0.4em] text-brand-gold font-semibold mb-8">
          NIDHAM · BUILT FOR EGYPT
        </p>

        {/* Headline */}
        <h2 className="text-3xl md:text-5xl font-black text-slate-800 mb-5 font-cairo leading-tight">
          نظام واحد بدل خمس أنظمة منفصلة.
          <br />
          <span className="text-brand-cyan-dark">
            HR + CRM + استوديو تسويق
          </span>{" "}
          — كله بالعربي + AI.
        </h2>
        <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed max-w-3xl mx-auto font-cairo">
          من الحضور بالـ GPS لحد قسائم الرواتب، ومن الـ CRM لحد فحص الـ
          CVs بالـ AI. كمان <strong className="text-amber-700">استوديو تسويق ذكي</strong>{" "}
          بيصمم حملاتك، landing pages، ويجيب leads — متوافق مع قانون العمل
          المصري 12/2003 وقانون التأمينات 148/2019.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
          <Link
            href="/signup"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo"
          >
            جرّب مجانًا 14 يوم
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-4 rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-lg hover:border-slate-400 hover:bg-white transition-all font-cairo"
          >
            تسجيل الدخول
          </Link>
        </div>

        <p className="text-xs text-slate-500 mt-4 font-cairo">
          ما تحتاجش بطاقة ائتمان · تشغيل في دقيقتين · إلغاء أي وقت
        </p>
      </div>
    </section>
  );
}

// =================================================================
// Proof strip — quick wins under the hero
// =================================================================

function ProofStrip() {
  const items = [
    { stat: "21", label: "يوم إجازة سنوية محسوبين تلقائيًا" },
    { stat: "14%", label: "تأمينات اجتماعية، مخصومة لحد سقف المرتب" },
    { stat: "100م", label: "geofence حول مكتبك للحضور" },
    { stat: "6", label: "أدوات AI تسويق بتحل محل وكالة كاملة" },
    { stat: "AI", label: "بيقرا CVs، يصمم حملات، ويجيب leads" },
  ];

  return (
    <section className="border-y border-slate-200 bg-white px-6 py-8">
      <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-6">
        {items.map((i) => (
          <div key={i.label} className="text-center">
            <div className="text-3xl font-black font-display bg-gradient-to-r from-brand-cyan-dark to-brand-navy bg-clip-text text-transparent mb-1">
              {i.stat}
            </div>
            <div className="text-xs md:text-sm text-slate-600 font-cairo leading-relaxed">
              {i.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// =================================================================
// Core modules
// =================================================================

function CoreModulesSection() {
  const modules = [
    {
      icon: "👥",
      title: "إدارة الموظفين",
      desc: "بيانات شاملة (مرتب، تأمينات، قومي، بنك)، رفع Excel أو PDF بالـ AI، أكواد دعوة بـ QR.",
      points: ["رفع Excel + CSV", "رفع PDF بالـ AI", "Audit log كامل"],
    },
    {
      icon: "⏰",
      title: "الحضور والانصراف",
      desc: "GPS-aware من تطبيق الموبايل، أو دخول يدوي، أو رفع من بصمة ZKTeco.",
      points: ["تثبيت بالـ GPS", "Geofence قابل للتعديل", "استيراد من البصمة"],
    },
    {
      icon: "💰",
      title: "الرواتب المصرية",
      desc: "محاسبة كاملة بقانون العمل والضرائب 2024 + شرائح ضريبة الدخل 6 شرائح.",
      points: [
        "تأمينات 14% + سقف",
        "ضريبة 10% → 27.5%",
        "خصم السلف تلقائيًا",
      ],
    },
    {
      icon: "📨",
      title: "طلبات الموظفين",
      desc: "إجازات، سلف، استئذانات — الموظف بيقدّم من الموبايل، HR يوافق ويتم خصم الرصيد.",
      points: ["8 أنواع إجازة", "أقساط حتى 24 شهر", "رصيد يقل تلقائيًا"],
    },
    {
      icon: "💼",
      title: "إدارة العملاء (CRM)",
      desc: "Pipeline متكامل + تفاعلات + عقود مع تتبع تواريخ التجديد.",
      points: ["Leads → Active → Won/Lost", "تفاعلات يومية", "تنبيهات العقود"],
    },
    {
      icon: "🎯",
      title: "التوظيف الذكي",
      desc: "إعلانات وظائف عامة + فحص CVs بالـ AI ودرجة تطابق وأسئلة مقابلة.",
      points: ["صفحة public للوظائف", "AI score 0-100", "أسئلة مقابلة جاهزة"],
    },
    {
      icon: "📊",
      title: "التقارير",
      desc: "تقرير الحضور الشهري + Bridge Analytics (الالتزام × الإنتاجية).",
      points: ["Export Excel", "Per-employee", "Bridge HR ↔ CRM"],
    },
    {
      icon: "🤖",
      title: "مساعد ذكي",
      desc: "اسأله بالعربي عن قانون العمل أو عن بيانات شركتك. Gemini 2.5 + قانون 12/2003.",
      points: ["قانون عمل وتأمينات", "حسابات الضرائب", "ملخصات الشركة"],
    },
    {
      icon: "✦",
      title: "استوديو التسويق (Enterprise)",
      desc: "وكالة تسويق كاملة جواه نظامك: 6 أدوات AI + landing pages + Leads pipeline + Meta integration.",
      points: [
        "AI يصمم حملات + ad copy + SEO",
        "Landing pages + Lead capture",
        "Pipeline Kanban + Analytics",
      ],
    },
  ];

  return (
    <section className="px-6 py-20 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="الموديولات الأساسية"
          title="كل اللي شركتك محتاجه — في صفحة واحدة"
          subtitle="من ساعة ما توقّع عقد موظف لحد ما تبعتله شيك آخر الشهر، كل خطوة في نظام واحد."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {modules.map((m) => (
            <div
              key={m.title}
              className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-brand-cyan/40 hover:shadow-lg hover:-translate-y-1 transition-all"
            >
              <div className="text-3xl mb-3">{m.icon}</div>
              <h3 className="font-black font-cairo text-slate-800 mb-2">
                {m.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4 font-cairo">
                {m.desc}
              </p>
              <ul className="space-y-1.5">
                {m.points.map((p) => (
                  <li
                    key={p}
                    className="text-xs text-slate-500 flex items-start gap-2 font-cairo"
                  >
                    <span className="text-brand-cyan-dark mt-0.5">✓</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =================================================================
// Bridge Analytics — the unique differentiator
// =================================================================

function BridgeAnalyticsSection() {
  return (
    <section className="px-6 py-20 bg-gradient-to-br from-brand-navy via-slate-900 to-brand-navy text-white relative overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "radial-gradient(circle at 70% 30%, rgba(34,211,238,0.6), transparent 50%)",
        }}
      />

      <div className="max-w-5xl mx-auto relative">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-xs font-bold mb-4 font-cairo">
              ✦ الميزة اللي مفيش حد عاملها
            </div>
            <h2 className="text-3xl md:text-4xl font-black font-cairo mb-4 leading-tight">
              Bridge Analytics
              <br />
              <span className="text-brand-cyan">
                التزام × إنتاجية = صورة الموظف الحقيقية
              </span>
            </h2>
            <p className="text-lg text-slate-300 mb-6 leading-relaxed font-cairo">
              معظم الأنظمة بتقولك &quot;محمد ملتزم 95%&quot; — وخلاص. نِظام
              بيوصّل بيانات الحضور بـ بيانات الـ CRM ويقولك:
            </p>
            <div className="space-y-3 mb-6">
              <Quote text="محمد حضور 95% بس عمل 3 تفاعلات إيجابية بس الشهر ده. ملتزم — مش منتج." />
              <Quote text="أحمد حضور 75%، عمل 22 تفاعل، 8 صفقات Active. منتج — حتى لو متأخر يومين." />
            </div>
            <p className="text-sm text-slate-400 font-cairo">
              ده الفرق بين موظف &quot;بيتجوّز شغل&quot; وموظف &quot;بيدفع
              لشركتك تنمو&quot;.
            </p>
          </div>

          <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur rounded-2xl p-6 border border-slate-700 shadow-2xl">
            <div className="text-xs text-slate-400 mb-3 font-cairo">
              تقرير Bridge — يونيو 2026
            </div>
            <table className="w-full text-xs md:text-sm font-cairo">
              <thead className="border-b border-slate-700 text-slate-400">
                <tr>
                  <th className="text-right py-2">الموظف</th>
                  <th className="text-center py-2">حضور</th>
                  <th className="text-center py-2">تفاعلات</th>
                  <th className="text-center py-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                <TableRow
                  name="أحمد محمد"
                  attendance="75%"
                  interactions="22"
                  status="ممتاز"
                  good
                />
                <TableRow
                  name="محمد علي"
                  attendance="95%"
                  interactions="3"
                  status="مراجعة"
                  warn
                />
                <TableRow
                  name="سارة حسن"
                  attendance="88%"
                  interactions="15"
                  status="جيد"
                  good
                />
                <TableRow
                  name="عمر إبراهيم"
                  attendance="60%"
                  interactions="0"
                  status="خطر"
                  bad
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function Quote({ text }: { text: string }) {
  return (
    <div className="border-r-4 border-brand-cyan/50 pr-4 text-slate-200 font-cairo italic">
      &quot;{text}&quot;
    </div>
  );
}

function TableRow({
  name,
  attendance,
  interactions,
  status,
  good,
  warn,
  bad,
}: {
  name: string;
  attendance: string;
  interactions: string;
  status: string;
  good?: boolean;
  warn?: boolean;
  bad?: boolean;
}) {
  const cls = good
    ? "text-emerald-400"
    : warn
    ? "text-amber-400"
    : bad
    ? "text-red-400"
    : "text-slate-300";
  return (
    <tr className="border-b border-slate-800">
      <td className="py-2 text-slate-200">{name}</td>
      <td className="py-2 text-center text-slate-300">{attendance}</td>
      <td className="py-2 text-center text-slate-300">{interactions}</td>
      <td className={`py-2 text-center font-bold ${cls}`}>{status}</td>
    </tr>
  );
}

// =================================================================
// AI Section
// =================================================================

function AISection() {
  return (
    <section className="px-6 py-20 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="✦ ذكاء اصطناعي"
          title="الـ AI مدمج في نظامك — مش add-on"
          subtitle="نِظام بيستخدم Groq + Gemini مع multi-provider fallback، بحيث ما تقفش في وش حد قط. ١٠+ مواضع AI، كل واحد بيوفّر لك ساعات أسبوعيًا."
        />

        <div className="grid md:grid-cols-2 gap-5">
          <AICard
            icon="📑"
            title="فحص CVs بالـ AI"
            desc="ارفع CV → الـ AI بيقرا، يقيّم 0-100، يطلع نقاط القوة والضعف، ويقترح 5 أسئلة مقابلة محددة. كله بالعربي."
            cta="جرّب على /dashboard/jobs"
          />
          <AICard
            icon="📂"
            title="استيراد موظفين من PDF"
            desc="ارفع PDF فيه أسامي وبيانات (من برنامج HR قديم، شيت مطبوع، أي ملف). الـ AI بيستخرج كل صف ويعرضه عليك للتأكيد قبل الحفظ."
            cta="جرّب على /dashboard/employees/import"
          />
          <AICard
            icon="🤖"
            title="مساعد الموارد البشرية"
            desc="اسأل بالعربي: 'ضريبة الدخل على مرتب 8000 كام؟' أو 'مين أحسن موظف الشهر ده؟' — مدرّب على قانون العمل + بياناتك."
            cta="جرّب على /dashboard/ai"
          />
          <AICard
            icon="🎯"
            title="ترشيح أسئلة مقابلة"
            desc="بناءً على الـ JD والمرشح، الـ AI بيولّد أسئلة technical + behavioral مفصّلة، كل واحدة بسبب فني واضح."
            cta="ضمن فحص الـ CV"
          />
          <AICard
            icon="✦"
            title="٦ أدوات تسويق AI (Enterprise)"
            desc="محلل منتج + باني personas + كاتب إعلانات + ماستر SEO + معالج حملات + Page Doctor — وكالة Big4 جواه نظامك."
            cta="شوف القسم اللي تحت ↓"
          />
          <AICard
            icon="🏠"
            title="Landing Pages + Lead Capture (Enterprise)"
            desc="صفحات هبوط بتجمع leads تلقائياً مع UTM tracking كامل. Pipeline Kanban بـ drag-and-drop يخلّيك تتابع كل lead لحد ما يبقى عميل."
            cta="ضمن استوديو التسويق"
          />
        </div>

        <div className="mt-10 p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-4 max-w-4xl mx-auto">
          <div className="text-2xl">🔒</div>
          <div className="text-sm text-slate-700 font-cairo leading-relaxed">
            <b>الخصوصية + Resilience:</b> بياناتك بتروح Groq أو Gemini
            للمعالجة بس — مش بتُستخدم training data، مفيش رفع تلقائي لأي
            طرف ثالث. والـ multi-provider fallback معناه إن لو حد منهم وقع،
            النظام تلقائياً يستخدم التاني — مفيش downtime.
          </div>
        </div>
      </div>
    </section>
  );
}

function AICard({
  icon,
  title,
  desc,
  cta,
}: {
  icon: string;
  title: string;
  desc: string;
  cta: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-amber-300 hover:shadow-lg transition-all">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-3xl">{icon}</div>
        <h3 className="text-lg font-black text-slate-800 font-cairo flex-1">
          {title}
        </h3>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed mb-4 font-cairo">
        {desc}
      </p>
      <div className="text-xs text-amber-700 font-bold font-cairo">{cta}</div>
    </div>
  );
}

// =================================================================
// Marketing Studio — the Enterprise-tier flagship
// =================================================================

function MarketingStudioSection() {
  return (
    <section className="px-6 py-20 bg-gradient-to-br from-slate-900 via-amber-950 to-slate-900 text-white relative overflow-hidden">
      {/* Background glow */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(245,158,11,0.4), transparent 50%), radial-gradient(circle at 80% 70%, rgba(244,63,94,0.3), transparent 50%)",
        }}
      />

      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold mb-4 font-cairo">
            👑 Enterprise Exclusive · جديد ٢٠٢٦
          </div>
          <h2 className="text-3xl md:text-5xl font-black font-cairo mb-4 leading-tight">
            استوديو التسويق الذكي
            <br />
            <span className="bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent">
              وكالة Big4 جواه نظامك
            </span>
          </h2>
          <p className="text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed font-cairo">
            بدل ما تدفع <strong className="text-amber-300">10,000-50,000 ج/شهر</strong>{" "}
            لوكالة تسويق، AI بيصمم لك حملاتك، يكتب إعلاناتك، يبني landing
            pages، ويجيب لك leads — وكله بالعربي المصري.
          </p>
        </div>

        {/* ----- 6 AI Tools ----- */}
        <div className="mb-12">
          <h3 className="text-center text-xs tracking-[0.3em] text-amber-400 font-bold mb-6 font-cairo">
            ✦ ٦ أدوات AI متكاملة
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ToolCard
              icon="🔬"
              title="محلل المنتج"
              desc="USP + Positioning + قنوات التسويق المناسبة"
            />
            <ToolCard
              icon="🎯"
              title="باني الجمهور"
              desc="2-4 buyer personas مع targeting كامل لـ Meta/Google"
            />
            <ToolCard
              icon="✍"
              title="كاتب الإعلانات"
              desc="3-8 ad variants لـ Meta / Google / TikTok جاهزة للنشر"
            />
            <ToolCard
              icon="🔍"
              title="ماستر SEO"
              desc="10-25 keyword + content strategy + quick wins"
            />
            <ToolCard
              icon="🚀"
              title="معالج الحملات"
              desc="استراتيجية كاملة: ميزانية + مراحل + توقعات CPA"
            />
            <ToolCard
              icon="🩺"
              title="Page Doctor"
              desc="تشخيص مشاكل صفحتك قبل الإعلان + خطة إصلاح مرقمة"
            />
          </div>
        </div>

        {/* ----- Operational Flow ----- */}
        <div className="mb-12">
          <h3 className="text-center text-xs tracking-[0.3em] text-amber-400 font-bold mb-6 font-cairo">
            ⚡ Pipeline التشغيلي — من الـ AI لحد العميل
          </h3>

          <div className="grid md:grid-cols-4 gap-3 mb-4">
            <FlowCard
              num="١"
              icon="🏠"
              title="Landing Pages"
              desc="ابني صفحة هبوط في دقايق. WhatsApp + tracking + lead form قابل للتخصيص."
              accent="cyan"
            />
            <FlowCard
              num="٢"
              icon="📥"
              title="Leads Inbox"
              desc="كل lead بيدخل CRM تلقائياً مع مصدره الكامل (UTM + landing page)."
              accent="violet"
            />
            <FlowCard
              num="٣"
              icon="🎯"
              title="Pipeline Kanban"
              desc="اسحب الـ leads بين 6 مراحل (جديد → عميل) بـ drag-and-drop."
              accent="rose"
            />
            <FlowCard
              num="٤"
              icon="📊"
              title="Analytics"
              desc="Funnel كامل + ROI لكل حملة + leaderboard للصفحات."
              accent="emerald"
            />
          </div>
        </div>

        {/* ----- Integrations row ----- */}
        <div className="bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur rounded-2xl border border-amber-400/20 p-6 mb-10">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="text-4xl shrink-0">🔌</div>
            <div className="flex-1 min-w-[250px]">
              <h3 className="text-lg font-black font-cairo mb-1 text-white">
                Meta Lead Ads Integration
              </h3>
              <p className="text-sm text-slate-300 font-cairo leading-relaxed">
                اربط Facebook/Instagram → الـ leads من إعلاناتك الممولة
                بيدخلوا CRM <strong className="text-amber-300">تلقائياً في ثوانٍ</strong>{" "}
                — بدون تنزيل CSV يدوي.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Pill text="🔒 HMAC verification" />
              <Pill text="🔐 Encrypted tokens" />
              <Pill text="📥 Auto-dedup" />
            </div>
          </div>
        </div>

        {/* ----- Differentiator quote ----- */}
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          <Stat
            big="٥ د"
            label="بدل ٥ أيام مع وكالة تسويق"
          />
          <Stat
            big="٠ ج"
            label="بدل ١٠ آلاف ج/شهر لوكالة"
          />
          <Stat
            big="١٠٠٪"
            label="بالعربي المصري — مش ترجمة من إنجليزي"
          />
        </div>

        {/* ----- AI providers used ----- */}
        <div className="text-center mb-8">
          <p className="text-xs text-slate-400 font-cairo mb-3">
            مدعوم بـ multi-provider AI fallback
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-[10px]">
            <ProviderBadge text="Groq · gpt-oss-120b" />
            <ProviderBadge text="Groq · gpt-oss-20b" />
            <ProviderBadge text="Groq · Llama 4 Scout" />
            <ProviderBadge text="Google · Gemini 2.5 Flash Lite" />
          </div>
          <p className="text-[10px] text-slate-500 font-cairo mt-3">
            لو وصلنا حد الـ quota في أي provider، النظام يـ fallback تلقائياً
          </p>
        </div>

        {/* ----- CTA ----- */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] font-bold mb-4 font-cairo">
            👑 متاح للنسخة Enterprise فقط
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="https://wa.me/201553641615?text=أهلاً، عايز أعرف تفاصيل استوديو التسويق Enterprise"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white font-black text-lg shadow-2xl hover:shadow-amber-500/50 hover:scale-105 transition-all font-cairo"
            >
              ✦ احجز جلسة تعريفية
            </a>
            <Link
              href="/signup"
              className="px-8 py-4 rounded-xl border-2 border-amber-400/40 text-amber-200 font-bold text-lg hover:bg-amber-500/10 transition-all font-cairo"
            >
              ابدأ تجربة 14 يوم
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// Tool card — for the 6-tool grid
function ToolCard({
  icon,
  title,
  desc,
}: {
  icon: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="group bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur border border-amber-400/20 hover:border-amber-400/60 rounded-2xl p-4 transition hover:scale-105">
      <div className="text-2xl mb-2">{icon}</div>
      <h4 className="text-sm font-black font-cairo text-white mb-1 group-hover:text-amber-300 transition">
        {title}
      </h4>
      <p className="text-[11px] text-slate-400 font-cairo leading-snug">
        {desc}
      </p>
    </div>
  );
}

// Flow card — for the 4-stage operational pipeline
function FlowCard({
  num,
  icon,
  title,
  desc,
  accent,
}: {
  num: string;
  icon: string;
  title: string;
  desc: string;
  accent: "cyan" | "violet" | "rose" | "emerald";
}) {
  const accentRing: Record<typeof accent, string> = {
    cyan: "ring-cyan-400/50 from-cyan-500/20 to-cyan-500/5",
    violet: "ring-violet-400/50 from-violet-500/20 to-violet-500/5",
    rose: "ring-rose-400/50 from-rose-500/20 to-rose-500/5",
    emerald: "ring-emerald-400/50 from-emerald-500/20 to-emerald-500/5",
  };
  const numRing: Record<typeof accent, string> = {
    cyan: "bg-cyan-500/30 border-cyan-300 text-cyan-100",
    violet: "bg-violet-500/30 border-violet-300 text-violet-100",
    rose: "bg-rose-500/30 border-rose-300 text-rose-100",
    emerald: "bg-emerald-500/30 border-emerald-300 text-emerald-100",
  };
  return (
    <div
      className={`relative bg-gradient-to-br backdrop-blur rounded-2xl p-5 ring-1 ${accentRing[accent]}`}
    >
      <div
        className={`absolute -top-3 right-4 w-8 h-8 rounded-full border-2 font-display font-black flex items-center justify-center text-sm ${numRing[accent]}`}
      >
        {num}
      </div>
      <div className="text-3xl mb-2 mt-2">{icon}</div>
      <h4 className="text-base font-black font-cairo text-white mb-1">
        {title}
      </h4>
      <p className="text-xs text-slate-300 font-cairo leading-relaxed">
        {desc}
      </p>
    </div>
  );
}

function Pill({ text }: { text: string }) {
  return (
    <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold font-cairo bg-amber-500/15 border border-amber-400/30 text-amber-200">
      {text}
    </span>
  );
}

function Stat({ big, label }: { big: string; label: string }) {
  return (
    <div className="text-center bg-gradient-to-br from-amber-500/10 to-rose-500/10 border border-amber-400/20 rounded-2xl p-4">
      <div className="text-4xl font-black font-display bg-gradient-to-r from-amber-300 to-rose-300 bg-clip-text text-transparent mb-1">
        {big}
      </div>
      <div className="text-xs text-slate-300 font-cairo">{label}</div>
    </div>
  );
}

function ProviderBadge({ text }: { text: string }) {
  return (
    <span className="inline-block px-2.5 py-1 rounded-full font-mono bg-slate-800/70 border border-slate-700 text-slate-300">
      {text}
    </span>
  );
}

// =================================================================
// Mobile section
// =================================================================

function MobileSection() {
  return (
    <section className="px-6 py-20 bg-gradient-to-br from-brand-navy to-slate-900 text-white">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 text-brand-cyan text-xs font-bold mb-4 font-cairo">
            📱 تطبيق منفصل للموظفين
          </div>
          <h2 className="text-3xl md:text-4xl font-black font-cairo mb-4 leading-tight">
            موظفك في جيبه نِظام كامل
          </h2>
          <p className="text-lg text-slate-300 mb-6 leading-relaxed font-cairo">
            بدل ما يتصل بـ HR كل مرة، يقدر من تطبيق Nidham للموظفين على
            الأندرويد والـ iOS:
          </p>
          <ul className="space-y-3 mb-8">
            <MobileFeature text="يثبّت حضور وانصراف من موقعه (GPS)" />
            <MobileFeature text="يطلب إجازة / سلفة / استئذان في ثوانٍ" />
            <MobileFeature text="يشوف رصيد إجازاته السنوية الحالي" />
            <MobileFeature text="يحمّل قسائم مرتباته الشهرية" />
            <MobileFeature text="يستلم إشعار الموافقة على طلباته" />
          </ul>
          <div className="text-sm text-slate-400 font-cairo">
            ✓ كود QR من صفحة الموظف بيفتح التطبيق بالكود تلقائيًا — مفيش
            تعقيد.
          </div>
        </div>

        <div className="flex justify-center">
          <div className="max-w-sm w-full">
            <MobileAppQR variant="card" />
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileFeature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-3 text-slate-200 font-cairo">
      <span className="w-6 h-6 rounded-full bg-brand-cyan/20 border border-brand-cyan/40 flex items-center justify-center text-brand-cyan text-xs shrink-0 mt-0.5">
        ✓
      </span>
      <span>{text}</span>
    </li>
  );
}

// =================================================================
// Security section
// =================================================================

function SecuritySection() {
  const points = [
    {
      icon: "🛡",
      title: "Multi-tenant RLS",
      desc: "كل شركة معزولة على مستوى الـ DB. مفيش طريقة لشركة تشوف بيانات شركة تانية حتى لو حاولت.",
    },
    {
      icon: "👁",
      title: "Audit Log",
      desc: "كل تعديل في الموظفين / الرواتب / العقود متسجّل — مين عمله، إمتى، وإيه القيم قبل وبعد.",
    },
    {
      icon: "🔐",
      title: "Role-based access",
      desc: "Admin / Manager / Employee — كل واحد بيشوف اللي يخصه فقط. PII (رقم قومي، بنك) للـ HR بس.",
    },
    {
      icon: "📜",
      title: "متوافق قانونيًا",
      desc: "حسابات الضرائب والتأمينات بآخر تعديلات 2024، إجازات Article 47، نهاية الخدمة Article 122.",
    },
  ];
  return (
    <section className="px-6 py-20 bg-white">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="🔒 الأمان"
          title="بياناتك أهم من بيانات بنكك"
          subtitle="منذ اليوم الأول: عزل tenants، تشفير، audit، وامتثال كامل لقانون العمل المصري."
        />
        <div className="grid md:grid-cols-4 gap-4">
          {points.map((p) => (
            <div
              key={p.title}
              className="bg-slate-50 rounded-2xl p-6 border border-slate-200"
            >
              <div className="text-3xl mb-3">{p.icon}</div>
              <h3 className="font-black text-slate-800 mb-2 font-cairo">
                {p.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-cairo">
                {p.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =================================================================
// Deployment options — Cloud vs. On-Premise (Enterprise)
// =================================================================

function DeploymentOptionsSection() {
  return (
    <section className="px-6 py-20 bg-gradient-to-br from-slate-100 via-white to-slate-100 relative">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="نشر مرن"
          title="Cloud أو On-Premise — انت تختار"
          subtitle="نفس الكود، نفس الواجهة، نفس الـ features — متاحة على السحابة أو على سيرفر شركتك الداخلي."
        />

        <div className="grid md:grid-cols-2 gap-6">
          {/* Cloud */}
          <div className="bg-white border-2 border-brand-cyan/30 rounded-3xl p-8 shadow-lg relative overflow-hidden">
            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan-dark text-[10px] font-bold font-cairo">
              الأكثر شيوعًا
            </div>
            <div className="text-4xl mb-3">☁</div>
            <h3 className="text-2xl font-black text-slate-800 mb-2 font-cairo">
              Nidham Cloud
            </h3>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed font-cairo">
              السحابة المُدارة. تشغّل شركتك في دقيقة، التحديثات تنزل تلقائيًا،
              مفيش بنية تحتية بتديرها.
            </p>

            <ul className="space-y-2.5 mb-6 text-sm font-cairo">
              <Check text="تشغيل فوري في 30 ثانية" />
              <Check text="تحديثات + ميزات جديدة تلقائيًا" />
              <Check text="Backups يومية تلقائية" />
              <Check text="بنية متعددة المناطق (multi-region)" />
              <Check text="14 يوم تجربة مجانية، اشتراك شهري بعدها" />
            </ul>

            <div className="mb-6 pb-4 border-b border-slate-100">
              <div className="text-xs text-slate-500 font-cairo mb-1">المناسب لـ</div>
              <div className="text-sm text-slate-700 font-cairo">
                الشركات الصغيرة والمتوسطة (5 – 500 موظف) اللي محتاجة تبدأ
                دلوقتي بدون IT.
              </div>
            </div>

            <Link
              href="/signup"
              className="block w-full text-center px-5 py-3 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-sm hover:shadow-lg transition font-cairo"
            >
              ابدأ التجربة المجانية
            </Link>
          </div>

          {/* On-Premise / Enterprise */}
          <div className="bg-gradient-to-br from-slate-900 via-brand-navy to-slate-900 text-white border-2 border-brand-gold/40 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold text-[10px] font-bold font-cairo">
              للشركات والمؤسسات
            </div>
            <div className="text-4xl mb-3">🏢</div>
            <h3 className="text-2xl font-black mb-2 font-cairo">
              Nidham Enterprise
            </h3>
            <p className="text-sm text-slate-300 mb-5 leading-relaxed font-cairo">
              تثبيت كامل على سيرفر شركتك الداخلي. بياناتك ما تخرجش من
              شبكتك. تحكم كامل، عزل كامل، وخصوصية على مستوى الصفر.
            </p>

            <ul className="space-y-2.5 mb-6 text-sm font-cairo">
              <CheckDark text="نشر على بنية شركتك (On-premise / Private Cloud)" />
              <CheckDark text="عزل بيانات كامل — صفر مشاركة مع أي طرف ثالث" />
              <CheckDark text="عمل بدون إنترنت (Air-gapped) ممكن" />
              <CheckDark text="Dockerized — تشغيل + ترقية بضغطة" />
              <CheckDark text="دومين خاص + Branding مخصص" />
              <CheckDark text="SLA ودعم فني مباشر + تدريب على الفريق" />
            </ul>

            <div className="mb-6 pb-4 border-b border-slate-700">
              <div className="text-xs text-slate-400 font-cairo mb-1">المناسب لـ</div>
              <div className="text-sm text-slate-200 font-cairo">
                البنوك، الجهات الحكومية، المستشفيات، المصانع، أي شركة
                عندها متطلبات سيادة بيانات أو قطاع منظّم.
              </div>
            </div>

            <a
              href="https://wa.me/201553641615?text=أهلاً، عايز أعرف تفاصيل نسخة Nidham Enterprise"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center px-5 py-3 rounded-xl bg-gradient-to-r from-brand-gold to-amber-600 text-slate-900 font-bold text-sm hover:shadow-xl transition font-cairo"
            >
              احجز جلسة تعريفية
            </a>
          </div>
        </div>

        {/* Bottom strip — same codebase reassurance */}
        <div className="mt-8 p-5 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row items-center gap-4 max-w-4xl mx-auto text-sm">
          <div className="text-3xl shrink-0">🔄</div>
          <div className="flex-1 text-center md:text-right font-cairo text-slate-700 leading-relaxed">
            <b>نفس النظام بالظبط في النشرتين.</b> نفس الواجهة، نفس
            الموديولات، نفس الـ AI، نفس تطبيق الموبايل. الفرق الوحيد:
            مين بيشغّل السيرفر.
          </div>
        </div>
      </div>
    </section>
  );
}

function Check({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-slate-700">
      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs shrink-0 mt-0.5">
        ✓
      </span>
      <span>{text}</span>
    </li>
  );
}

function CheckDark({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 text-slate-200">
      <span className="w-5 h-5 rounded-full bg-brand-gold/20 border border-brand-gold/40 text-brand-gold flex items-center justify-center text-xs shrink-0 mt-0.5">
        ✓
      </span>
      <span>{text}</span>
    </li>
  );
}


// =================================================================
// How it works
// =================================================================

function HowItWorksSection() {
  const steps = [
    {
      n: "١",
      title: "سجّل شركتك",
      desc: "إيميل + كلمة سر + اسم الشركة. 30 ثانية. 14 يوم تجربة مجانًا.",
    },
    {
      n: "٢",
      title: "ارفع موظفيك",
      desc: "Excel أو CSV أو PDF بالـ AI. أو ضيفهم واحد واحد. النظام بيمنت رصيد إجازاتهم تلقائيًا.",
    },
    {
      n: "٣",
      title: "ابعت لهم كود الـ QR",
      desc: "كل موظف بيصوّر الكود من جيبه، التطبيق بيتفتح ومسجّل دخوله. يبدأ يثبّت حضور.",
    },
    {
      n: "٤",
      title: "اعمل أول payroll",
      desc: "اضغط زرار. النظام بيحسب التأمينات والضرائب والسلف. وقّع وابعت.",
    },
    {
      n: "٥",
      title: "أطلق أول حملة تسويق",
      desc: "(Enterprise) خلّي الـ AI يصمم حملة + landing page + يجيب الـ leads أوتوماتيك في الـ CRM.",
    },
  ];
  return (
    <section className="px-6 py-20 bg-gradient-to-b from-cyan-50/30 to-white">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="بداية سهلة"
          title="من التسجيل لأول راتب + أول حملة — في يوم واحد"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {steps.map((s, i) => (
            <div
              key={s.n}
              className={`relative bg-white border rounded-2xl p-6 hover:shadow-lg transition ${
                i === 4 ? "border-amber-300" : "border-slate-200"
              }`}
            >
              <div
                className={`absolute -top-4 right-6 w-10 h-10 rounded-full text-white font-black text-lg flex items-center justify-center shadow-lg font-display ${
                  i === 4
                    ? "bg-gradient-to-br from-amber-500 to-rose-500"
                    : "bg-gradient-to-br from-brand-cyan to-brand-cyan-dark"
                }`}
              >
                {s.n}
              </div>
              <h3 className="font-black text-slate-800 mt-3 mb-2 font-cairo">
                {s.title}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed font-cairo">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// =================================================================
// Final CTA
// =================================================================

function FinalCTASection() {
  return (
    <section className="px-6 py-20 bg-gradient-to-r from-brand-cyan-dark via-brand-cyan to-brand-cyan-dark text-white text-center">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-black mb-4 font-cairo leading-tight">
          خلاص. خلّي شغل HR يشتغل لوحده.
        </h2>
        <p className="text-lg text-cyan-50 mb-8 font-cairo leading-relaxed">
          14 يوم تجربة مجانية بدون كارت ائتمان. لو ما عجبكش، امسح حسابك
          بضغطة. ولو عجبك، استمر بسعر مناسب لحجم شركتك.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="px-8 py-4 rounded-xl bg-white text-brand-cyan-dark font-black text-lg shadow-2xl hover:scale-105 transition-all font-cairo"
          >
            ابدأ التجربة المجانية الآن
          </Link>
          <a
            href="https://wa.me/201553641615"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-4 rounded-xl border-2 border-white/40 text-white font-bold text-lg hover:bg-white/10 transition-all font-cairo"
          >
            💬 كلّمنا على واتساب
          </a>
        </div>
      </div>
    </section>
  );
}

// =================================================================
// Footer
// =================================================================

function Footer() {
  return (
    <footer className="bg-brand-navy text-slate-400 px-6 py-10">
      <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8 text-sm">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-cyan to-brand-navy flex items-center justify-center shadow">
              <span className="text-lg font-black text-white font-display">
                ن
              </span>
            </div>
            <div>
              <div className="text-lg font-black text-white font-cairo">
                نِظام
              </div>
              <div className="text-[10px] tracking-widest text-brand-gold font-bold">
                NIDHAM
              </div>
            </div>
          </div>
          <p className="leading-relaxed font-cairo text-slate-400">
            منصة HR + CRM + AI Recruitment مصرية. مبنية في دمياط، مصر —
            للسوق المصري والعربي.
          </p>
        </div>

        <div>
          <h4 className="text-white font-bold mb-3 font-cairo">المنصة</h4>
          <ul className="space-y-2 font-cairo">
            <li>
              <Link href="/signup" className="hover:text-white transition">
                تسجيل شركة (Cloud)
              </Link>
            </li>
            <li>
              <a
                href="https://wa.me/201553641615?text=أهلاً، عايز أعرف تفاصيل نسخة Nidham Enterprise"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition"
              >
                نسخة Enterprise (On-Premise)
              </a>
            </li>
            <li>
              <a
                href="https://wa.me/201553641615?text=أهلاً، عايز أعرف تفاصيل استوديو التسويق Enterprise"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-amber-300 transition"
              >
                ✦ استوديو التسويق
              </a>
            </li>
            <li>
              <Link href="/login" className="hover:text-white transition">
                دخول
              </Link>
            </li>
            <li>
              <Link href="/download" className="hover:text-white transition">
                تطبيق الموبايل
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold mb-3 font-cairo">تواصل</h4>
          <ul className="space-y-2 font-cairo">
            <li>
              <a
                href="https://wa.me/201553641615"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition"
              >
                💬 واتساب
              </a>
            </li>
            <li>
              <a href="mailto:nidhamhr@proton.me" className="hover:text-white transition">
                ✉ nidhamhr@proton.me
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-3 text-xs">
        <p className="font-cairo">© 2026 Nidham. كل الحقوق محفوظة.</p>
        <p className="font-mono tracking-wider text-slate-500">
          BETA · v0.1 · BUILT IN DAMIETTA, EGYPT
        </p>
      </div>
    </footer>
  );
}

// =================================================================
// Shared helpers
// =================================================================

function SectionHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="text-center mb-12">
      <div className="text-sm text-brand-cyan-dark font-bold tracking-wider uppercase mb-3 font-cairo">
        {eyebrow}
      </div>
      <h2 className="text-3xl md:text-4xl font-black text-slate-800 font-cairo mb-3 leading-tight">
        {title}
      </h2>
      {subtitle && (
        <p className="text-base md:text-lg text-slate-600 max-w-2xl mx-auto font-cairo leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
