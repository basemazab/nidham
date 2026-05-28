import Link from "next/link";
import dynamic from "next/dynamic";
import { SectionHeader } from "./sections/section-helpers";

const DynamicLiveScreenshots = dynamic(() => import("./sections/live-screenshots").then((m) => ({ default: m.LiveScreenshotsSection })), { loading: () => <div className="h-64 animate-pulse bg-slate-100 rounded-2xl" /> });
const DynamicBridgeAnalytics = dynamic(() => import("./sections/bridge-analytics").then((m) => ({ default: m.BridgeAnalyticsSection })), { loading: () => <div className="h-64 animate-pulse bg-slate-800 rounded-2xl" /> });
const DynamicAISection = dynamic(() => import("./sections/ai-section").then((m) => ({ default: m.AISection })), { loading: () => <div className="h-64 animate-pulse bg-slate-100 rounded-2xl" /> });
const DynamicMarketingStudio = dynamic(() => import("./sections/marketing-studio").then((m) => ({ default: m.MarketingStudioSection })), { loading: () => <div className="h-64 animate-pulse bg-slate-900 rounded-2xl" /> });
const DynamicMobileSection = dynamic(() => import("./sections/mobile-section").then((m) => ({ default: m.MobileSection })), { loading: () => <div className="h-64 animate-pulse bg-slate-100 rounded-2xl" /> });
const DynamicSecuritySection = dynamic(() => import("./sections/security-section").then((m) => ({ default: m.SecuritySection })), { loading: () => <div className="h-48 animate-pulse bg-slate-100 rounded-2xl" /> });
const DynamicDeploymentOptions = dynamic(() => import("./sections/deployment-options").then((m) => ({ default: m.DeploymentOptionsSection })), { loading: () => <div className="h-48 animate-pulse bg-slate-100 rounded-2xl" /> });
const DynamicHowItWorks = dynamic(() => import("./sections/how-it-works").then((m) => ({ default: m.HowItWorksSection })), { loading: () => <div className="h-64 animate-pulse bg-slate-100 rounded-2xl" /> });
const DynamicFinalCTA = dynamic(() => import("./sections/final-cta").then((m) => ({ default: m.FinalCTASection })));
const DynamicFooter = dynamic(() => import("./sections/footer").then((m) => ({ default: m.Footer })));

type SearchParams = Promise<{
  error?: string;
  error_code?: string;
  error_description?: string;
}>;

export default async function Home({ searchParams }: { searchParams: SearchParams }) {
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
              <Link href="/forgot-password" className="inline-block text-sm text-red-700 font-bold underline hover:no-underline font-cairo">
                اطلب لينك إعادة تعيين جديد ←
              </Link>
            </div>
          </div>
        </div>
      )}
      <HeroSection />
      <ProofStrip />
      <CoreModulesSection />
      <DynamicLiveScreenshots />
      <DynamicBridgeAnalytics />
      <DynamicAISection />
      <DynamicMarketingStudio />
      <DynamicMobileSection />
      <DynamicSecuritySection />
      <DynamicDeploymentOptions />
      <DynamicHowItWorks />
      <DynamicFinalCTA />
      <DynamicFooter />
    </main>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-cyan-50/40 px-6 py-16 md:py-24">
      <div aria-hidden className="absolute inset-0 -z-10 opacity-50"
        style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(34,211,238,0.15), transparent 50%), radial-gradient(circle at 80% 80%, rgba(201,168,76,0.10), transparent 50%)" }}
      />
      <div className="max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy mb-6 shadow-xl shadow-cyan-500/20">
          <span className="text-4xl font-black text-white font-display">ن</span>
        </div>
        <h1 className="text-6xl md:text-7xl font-black mb-2 tracking-tight font-display">
          <span className="bg-gradient-to-r from-brand-cyan-dark via-brand-cyan to-brand-navy bg-clip-text text-transparent">نِظام</span>
        </h1>
        <p className="text-sm tracking-[0.4em] text-brand-gold font-semibold mb-8">NIDHAM · BUILT FOR EGYPT</p>
        <h2 className="text-3xl md:text-5xl font-black text-slate-800 mb-5 font-cairo leading-tight">
          نظام واحد بدل خمس أنظمة منفصلة.<br />
          <span className="text-brand-cyan-dark">HR + CRM + استوديو تسويق</span> — كله بالعربي + AI.
        </h2>
        <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed max-w-3xl mx-auto font-cairo">
          من الحضور بالـ GPS لحد قسائم الرواتب، ومن الـ CRM لحد فحص الـ CVs بالـ AI. كمان <strong className="text-amber-700">استوديو تسويق ذكي</strong> بيصمم حملاتك، landing pages، ويجيب leads — متوافق مع قانون العمل المصري 12/2003 وقانون التأمينات 148/2019.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-stretch sm:items-center">
          <Link href="/signup" className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-brand-cyan to-brand-cyan-dark text-white font-bold text-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-all font-cairo">
            جرّب مجانًا 14 يوم
          </Link>
          <Link href="/login" className="w-full sm:w-auto px-8 py-4 rounded-xl border-2 border-slate-200 text-slate-700 font-bold text-lg hover:border-slate-400 hover:bg-white transition-all font-cairo">
            تسجيل الدخول
          </Link>
        </div>
        <p className="text-xs text-slate-500 mt-4 font-cairo">ما تحتاجش بطاقة ائتمان · تشغيل في دقيقتين · إلغاء أي وقت</p>
      </div>
    </section>
  );
}

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
            <div className="text-3xl font-black font-display bg-gradient-to-r from-brand-cyan-dark to-brand-navy bg-clip-text text-transparent mb-1">{i.stat}</div>
            <div className="text-xs md:text-sm text-slate-600 font-cairo leading-relaxed">{i.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoreModulesSection() {
  const modules = [
    { icon: "👥", title: "إدارة الموظفين", desc: "بيانات شاملة (مرتب، تأمينات، قومي، بنك)، رفع Excel أو PDF بالـ AI، أكواد دعوة بـ QR.", points: ["رفع Excel + CSV", "رفع PDF بالـ AI", "Audit log كامل"] },
    { icon: "⏰", title: "الحضور والانصراف", desc: "GPS-aware من تطبيق الموبايل، أو دخول يدوي، أو رفع من بصمة ZKTeco.", points: ["تثبيت بالـ GPS", "Geofence قابل للتعديل", "استيراد من البصمة"] },
    { icon: "💰", title: "الرواتب المصرية", desc: "محاسبة كاملة بقانون العمل والضرائب 2024 + شرائح ضريبة الدخل 6 شرائح.", points: ["تأمينات 14% + سقف", "ضريبة 10% → 27.5%", "خصم السلف تلقائيًا"] },
    { icon: "📨", title: "طلبات الموظفين", desc: "إجازات، سلف، استئذانات — الموظف بيقدّم من الموبايل، HR يوافق ويتم خصم الرصيد.", points: ["8 أنواع إجازة", "أقساط حتى 24 شهر", "رصيد يقل تلقائيًا"] },
    { icon: "💼", title: "إدارة العملاء (CRM)", desc: "Pipeline متكامل + تفاعلات + عقود مع تتبع تواريخ التجديد.", points: ["Leads → Active → Won/Lost", "تفاعلات يومية", "تنبيهات العقود"] },
    { icon: "🎯", title: "التوظيف الذكي", desc: "إعلانات وظائف عامة + فحص CVs بالـ AI ودرجة تطابق وأسئلة مقابلة.", points: ["صفحة public للوظائف", "AI score 0-100", "أسئلة مقابلة جاهزة"] },
    { icon: "📊", title: "التقارير", desc: "تقرير الحضور الشهري + Bridge Analytics (الالتزام × الإنتاجية).", points: ["Export Excel", "Per-employee", "Bridge HR ↔ CRM"] },
    { icon: "🤖", title: "مساعد ذكي", desc: "اسأله بالعربي عن قانون العمل أو عن بيانات شركتك. Gemini 2.5 + قانون 12/2003.", points: ["قانون عمل وتأمينات", "حسابات الضرائب", "ملخصات الشركة"] },
    { icon: "✦", title: "استوديو التسويق (Enterprise)", desc: "وكالة تسويق كاملة جواه نظامك: 6 أدوات AI + landing pages + Leads pipeline + Meta integration.", points: ["AI يصمم حملات + ad copy + SEO", "Landing pages + Lead capture", "Pipeline Kanban + Analytics"] },
  ];
  return (
    <section className="px-6 py-20 bg-gradient-to-b from-white to-slate-50">
      <div className="max-w-6xl mx-auto">
        <SectionHeader eyebrow="الموديولات الأساسية" title="كل اللي شركتك محتاجه — في صفحة واحدة" subtitle="من ساعة ما توقّع عقد موظف لحد ما تبعتله شيك آخر الشهر، كل خطوة في نظام واحد." />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {modules.map((m) => (
            <div key={m.title} className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-brand-cyan/40 hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="text-3xl mb-3">{m.icon}</div>
              <h3 className="font-black font-cairo text-slate-800 mb-2">{m.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-4 font-cairo">{m.desc}</p>
              <ul className="space-y-1.5">
                {m.points.map((p) => (
                  <li key={p} className="text-xs text-slate-500 flex items-start gap-2 font-cairo">
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
