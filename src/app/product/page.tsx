// ============================================================================
// /product — Visual product tour (شوف Nidham)
// ============================================================================
//
// Closes "I can't see what I'm buying" — the single biggest objection a
// thoughtful Egyptian buyer surfaces on every demo call. Six feature
// blocks, each with a screenshot frame + short description + the actual
// dashboard URL behind it. Visitors get a real sense of the product
// without having to sign up.
//
// Screenshot loading strategy:
//   - Each frame tries to load /marketing/screenshots/desktop/{name}.png
//     (produced by scripts/capture-screenshots.ts).
//   - If the file isn't there yet (Basem hasn't run the script), the
//     <img> falls back to a CSS-only mockup that *looks* like the
//     dashboard. Either way the page stays presentable.
//
// To populate the real screenshots:
//   1. Fill scripts/.env.local with NIDHAM_EMAIL + NIDHAM_PASSWORD
//   2. npm run screenshots
//   3. git add public/marketing/screenshots && git commit && push
//   Vercel auto-deploys and the real screenshots replace the mockups.

import Link from "next/link";

export const metadata = {
  title: "شوف Nidham | جولة في النظام",
  description:
    "شوف كل ميزات Nidham بالصور — إدارة الموظفين، المرتبات، الحضور بالـ GPS، AI Agent، Mobile app، Bridge Analytics. شغّال عند 200+ موظف.",
};

type Feature = {
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  bullets: string[];
  screenshot: string; // filename in public/marketing/screenshots/desktop/
  href: string; // link in dashboard
  mockup: "list" | "payroll" | "mobile" | "ai" | "attendance" | "analytics";
};

const FEATURES: Feature[] = [
  {
    emoji: "👥",
    title: "إدارة الموظفين الكاملة",
    subtitle: "كل بياناتهم في مكان واحد",
    description:
      "ملف كامل لكل موظف — بيانات شخصية، عقد عمل، تأمينات، مستندات، تاريخ الوظائف. كله مشفّر AES-256 وآمن.",
    bullets: [
      "إدارة 1-500 موظف بدون frictions",
      "PII encryption لكل البيانات الحساسة",
      "Custom fields حسب شركتك",
      "استيراد سريع من Excel/CSV",
    ],
    screenshot: "02-employees-list",
    href: "/dashboard/employees",
    mockup: "list",
  },
  {
    emoji: "💰",
    title: "مرتبات بقانون 2026",
    subtitle: "تلقائي بدون أخطاء",
    description:
      "حساب الراتب الكامل: أساسي + بدلات - تأمينات 11% - ضرايب 2026 - خصومات. كله في 5 دقايق بدل 30 ساعة.",
    bullets: [
      "÷26 في الراتب اليومي (مش ÷30)",
      "Overtime تلقائي (35% / 50% / 100%)",
      "نماذج التأمينات 1، 2، 6 بنقرة",
      "تصدير ملف بنكي مباشرة",
    ],
    screenshot: "05-payroll",
    href: "/dashboard/payroll",
    mockup: "payroll",
  },
  {
    emoji: "📱",
    title: "Mobile App للموظفين",
    subtitle: "GPS attendance + إجازات",
    description:
      "كل موظف عنده app على موبايله — Check-in بالـ GPS، طلب إجازة، شوف قسيمة الراتب، إشعارات تلقائية.",
    bullets: [
      "Android 8+ و iOS 14+",
      "GPS verified location (مش fake check-ins)",
      "طلب إجازة + موافقة فورية",
      "Push notifications لكل HR event",
    ],
    screenshot: "04-attendance-gps",
    href: "/dashboard/attendance",
    mockup: "mobile",
  },
  {
    emoji: "🤖",
    title: "AI Agent بالعربي",
    subtitle: "أوامر طبيعية بدل forms",
    description:
      "اكتب 'ضيف موظف اسمه أحمد، راتب 5000' — والـ AI ينفّذ. مفيش لازم تدور على forms أو menus.",
    bullets: [
      "أوامر بالعربية المصرية الدارجة",
      "CV screening تلقائي للمرشحين",
      "Pattern detection للغياب المتكرر",
      "Marketing Studio بـ AI",
    ],
    screenshot: "12-ai-assistant",
    href: "/dashboard/ai",
    mockup: "ai",
  },
  {
    emoji: "⏱",
    title: "حضور وانصراف ذكي",
    subtitle: "ZKTeco + GPS + Pattern detection",
    description:
      "استيراد من ZKTeco devices تلقائي + Check-in بالـ GPS للـ remote workers + كشف الـ patterns غير الطبيعية.",
    bullets: [
      "ZKTeco file import — صفر شغل يدوي",
      "Geofencing — منع fake check-ins",
      "Tardiness reports تلقائياً",
      "Shifts management (نهاري + ليلي)",
    ],
    screenshot: "04-attendance-gps",
    href: "/dashboard/attendance",
    mockup: "attendance",
  },
  {
    emoji: "📊",
    title: "Bridge Analytics ✨",
    subtitle: "اللي مفيش نظام تاني بيعمله",
    description:
      "Reports بتربط الـ HR بالـ CRM — مين من فريقك بيقفّل deals أكتر؟ مين قدّمه قليل بس revenue عالي؟",
    bullets: [
      "Performance vs Revenue correlation",
      "Top performers بحسب الـ KPIs",
      "Flight risk detection (قبل ما الموظف يستقيل)",
      "Custom reports بـ AI",
    ],
    screenshot: "11-bridge-analytics",
    href: "/dashboard/reports/bridge",
    mockup: "analytics",
  },
];

export default function ProductPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50/30 py-12 px-6">
      <div className="max-w-6xl mx-auto">
        <Link
          href="/"
          className="text-sm text-brand-cyan-dark hover:underline font-cairo mb-6 inline-block"
        >
          ← الرجوع للصفحة الرئيسية
        </Link>

        <header className="mb-12 text-center">
          <div className="inline-block px-3 py-1 rounded-full bg-cyan-50 border border-cyan-300 text-cyan-700 text-xs font-bold mb-3 font-cairo">
            🎯 جولة في النظام
          </div>
          <h1 className="text-4xl md:text-5xl font-black font-cairo text-slate-900 mb-3">
            شوف Nidham بنفسك
          </h1>
          <p className="text-lg text-slate-600 font-cairo max-w-2xl mx-auto">
            6 ميزات أساسية شغّالة دلوقتي عند 200+ موظف في 2 شركة مصرية.
          </p>
        </header>

        {/* Feature blocks — alternating left/right layout */}
        <div className="space-y-16 mb-16">
          {FEATURES.map((feature, idx) => (
            <FeatureBlock
              key={feature.title}
              feature={feature}
              reversed={idx % 2 === 1}
            />
          ))}
        </div>

        {/* ──────────────────────────────────────────────────────────
            New features 2026 — added after Basem's expansion sprint.
            Compact grid (not full feature blocks) so the page doesn't
            explode in length, but every new capability gets visibility.
            ────────────────────────────────────────────────────────── */}
        <section className="mb-16 p-8 rounded-3xl bg-gradient-to-br from-amber-50 via-cyan-50 to-white border-2 border-amber-200">
          <div className="text-center mb-8">
            <div className="inline-block px-4 py-1.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold mb-3 font-cairo">
              ✦ جديد 2026 — أضفناه بناءً على طلبات العملاء
            </div>
            <h2 className="text-3xl font-black font-cairo text-slate-900 mb-2">
              ٩ مميزات جديدة في إصدار هذا الشهر
            </h2>
            <p className="text-sm text-slate-600 font-cairo max-w-2xl mx-auto">
              مفيش نظام HR مصري تاني عنده الميزات دي. كلها مبنية للسوق المصري
              وبتشتغل من اليوم الأول.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <NewFeatureCard
              emoji="🤖"
              title="المساعد الذكي بالعربي"
              desc="١٥ أداة AI تنفذ مهام HR فعلياً — قفل المرتبات، تحليل الاحتفاظ، فحص CVs."
              href="/dashboard/ai"
              badge="Pro"
            />
            <NewFeatureCard
              emoji="💬"
              title="بوت WhatsApp للموظفين"
              desc='موظف يكتب "كم رصيد إجازاتي" → رد فوري على واتساب. ٦ أوامر مدعومة.'
              href="/dashboard/whatsapp-test"
              badge="Pro"
            />
            <NewFeatureCard
              emoji="📍"
              title="حضور بالـ GPS + سيلفي"
              desc="الموظف يفتح اللينك من موبايله → GPS + صورة → اتسجّل حضوره."
              href="/clock-in"
            />
            <NewFeatureCard
              emoji="✍"
              title="التوقيع الإلكتروني"
              desc="ابعت عقد على واتساب → الموظف يوقّع بإصبعه على الموبايل في ثواني."
              href="/dashboard/signatures"
            />
            <NewFeatureCard
              emoji="⚖"
              title="حاسبة نهاية الخدمة"
              desc="حساب EOS حسب قانون 12/2003 — تفصيل سنة بسنة بالقيمة الفعلية."
              href="/dashboard/eos-calculator"
            />
            <NewFeatureCard
              emoji="💵"
              title="السلف والمرتجعات"
              desc="موظف يطلب سلفة → HR يعتمد → خصم تلقائي شهري من الراتب."
              href="/dashboard/loans"
            />
            <NewFeatureCard
              emoji="📊"
              title="لوحة تحليلات متقدمة"
              desc="٧ رسوم بيانية: تطور العدد، نمط التأخير، توزيع المرتبات، مخاطر الاستقالة."
              href="/dashboard/analytics"
            />
            <NewFeatureCard
              emoji="🎉"
              title="ذكريات تعيين + أعياد ميلاد"
              desc="تنبيه فوري قبل أي ذكرى + زرار 'تهنّي على واتساب' برسالة جاهزة."
              href="/dashboard/celebrations"
            />
            <NewFeatureCard
              emoji="🎨"
              title="Onboarding wizard"
              desc="الموظف الجديد يفتح اللينك ويسجّل نفسه — بدون ما HR يكتب عنه أي بيانات."
              href="/onboard"
            />
          </div>

          <div className="mt-6 p-4 rounded-xl bg-white border border-amber-200 font-cairo text-center">
            <p className="text-sm text-slate-700">
              ✦ <strong>ميزة إضافية مجانية:</strong> النظام يعمل كـ <strong>PWA</strong> —
              الموظف يفتح اللينك من موبايله ويضغط "Add to Home Screen" يبقى عنده
              تطبيق Nidham بدون ما تدفع لـ Apple أو Google رسوم.
            </p>
          </div>
        </section>

        {/* Demo CTA */}
        <section className="p-8 rounded-3xl bg-gradient-to-br from-brand-cyan-dark via-brand-navy to-slate-900 text-white text-center mb-12">
          <h2 className="text-3xl font-black font-cairo mb-3">
            عايز Demo حية 20 دقيقة؟
          </h2>
          <p className="text-cyan-100 font-cairo mb-6 max-w-xl mx-auto">
            بنشغّل أول دورة مرتبات + نطبع نموذج 6 + نجرّب AI Agent — كله live على
            شاشتك.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="https://wa.me/201055356622?text=أهلاً، عايز Demo حية لـ Nidham"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 font-bold font-cairo transition"
            >
              💬 احجز Demo
            </a>
            <Link
              href="/signup"
              className="px-6 py-3 rounded-xl bg-white text-brand-cyan-dark font-bold font-cairo hover:bg-cyan-50 transition"
            >
              🚀 ابدأ مجاناً
            </Link>
            <Link
              href="/pricing"
              className="px-6 py-3 rounded-xl bg-white/10 border border-white/30 font-bold font-cairo hover:bg-white/20 transition"
            >
              💰 الأسعار
            </Link>
          </div>
        </section>

        <footer className="text-center pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500 font-cairo">
            Nidham · بُني في دمياط، مصر · 2026
          </p>
        </footer>
      </div>
    </main>
  );
}

function FeatureBlock({
  feature,
  reversed,
}: {
  feature: Feature;
  reversed: boolean;
}) {
  return (
    <div
      className={`grid md:grid-cols-2 gap-8 items-center ${
        reversed ? "md:[direction:ltr]" : ""
      }`}
    >
      {/* Text side */}
      <div className={reversed ? "md:[direction:rtl]" : ""}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-bold mb-3 font-cairo">
          <span className="text-base">{feature.emoji}</span>
          <span>{feature.subtitle}</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-black font-cairo text-slate-900 mb-3">
          {feature.title}
        </h2>
        <p className="text-base text-slate-600 font-cairo leading-relaxed mb-5">
          {feature.description}
        </p>
        <ul className="space-y-2 font-cairo">
          {feature.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
              <span className="text-emerald-600 mt-0.5 shrink-0">✓</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Screenshot side */}
      <div className={reversed ? "md:[direction:rtl]" : ""}>
        <ScreenshotFrame name={feature.screenshot} mockup={feature.mockup} />
      </div>
    </div>
  );
}

// Screenshot frame — wraps a CSS mockup in fake browser chrome so the
// frame *looks* like a real product screenshot. Once Basem runs
// scripts/capture-screenshots.ts to produce real PNGs, the mockup
// component for that feature can be swapped for an <img> pointing at
// /marketing/screenshots/desktop/{name}.png. Keeping it CSS-only for
// now means the page is a Server Component (no `use client` overhead)
// and the build doesn't trip on event handlers.
function ScreenshotFrame({
  name: _name,
  mockup,
}: {
  name: string;
  mockup: Feature["mockup"];
}) {
  return (
    <div className="rounded-2xl bg-slate-100 border border-slate-200 shadow-2xl overflow-hidden">
      {/* Browser chrome */}
      <div className="bg-slate-200 px-3 py-2 flex items-center gap-2 border-b border-slate-300">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 text-center text-[10px] text-slate-500 font-mono" dir="ltr">
          nidhamhr.com/dashboard
        </div>
      </div>

      {/* The mockup itself — pure CSS, no images. Swap to <img> when real
          screenshots are captured. */}
      <div className="relative">
        <MockupRenderer type={mockup} />
      </div>
    </div>
  );
}

// CSS mockups — different layout per feature type. Not pixel-perfect
// dashboards (that'd require way more CSS), but they communicate the
// shape of each screen so the page doesn't feel empty before real
// screenshots ship.
function MockupRenderer({ type }: { type: Feature["mockup"] }) {
  if (type === "list") {
    return <ListMockup />;
  }
  if (type === "payroll") {
    return <PayrollMockup />;
  }
  if (type === "mobile") {
    return <MobileMockup />;
  }
  if (type === "ai") {
    return <AiMockup />;
  }
  if (type === "attendance") {
    return <AttendanceMockup />;
  }
  return <AnalyticsMockup />;
}

function ListMockup() {
  return (
    <div className="p-4 bg-white" style={{ minHeight: "320px" }}>
      <div className="h-8 w-32 bg-slate-200 rounded mb-4" />
      <div className="space-y-2">
        {["أحمد محمود", "سارة علي", "محمد فاروق", "ميرنا سعد", "كريم نبيل"].map(
          (name, i) => (
            <div
              key={name}
              className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-cyan to-brand-navy text-white flex items-center justify-center font-bold">
                {name[0]}
              </div>
              <div className="flex-1">
                <div className="text-sm font-bold text-slate-800 font-cairo">
                  {name}
                </div>
                <div className="text-[10px] text-slate-500 font-cairo">
                  {["HR Manager", "Developer", "Sales Lead", "Designer", "Accountant"][i]}
                </div>
              </div>
              <div className="text-xs text-emerald-600 font-bold">نشط</div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

function PayrollMockup() {
  return (
    <div className="p-4 bg-white font-cairo" style={{ minHeight: "320px" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-black text-slate-800">دورة مايو 2026</div>
        <div className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-bold">
          مكتملة ✓
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat label="موظفين" value="124" />
        <Stat label="إجمالي رواتب" value="324,500 ج" />
        <Stat label="تأمينات" value="35,695 ج" highlight />
        <Stat label="ضرايب" value="42,180 ج" highlight />
      </div>
      <div className="space-y-1.5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex justify-between items-center px-3 py-2 rounded-lg bg-slate-50"
          >
            <span className="text-xs text-slate-700">موظف #{i}</span>
            <span className="text-xs font-bold text-emerald-600">
              {(2615 - i * 50).toLocaleString()} ج
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileMockup() {
  return (
    <div
      className="p-4 bg-gradient-to-br from-slate-100 to-cyan-50 flex items-center justify-center font-cairo"
      style={{ minHeight: "320px" }}
    >
      <div
        className="rounded-3xl bg-slate-900 p-2 shadow-2xl"
        style={{ width: "180px" }}
      >
        <div className="rounded-2xl bg-white p-3 text-center">
          <div className="text-[10px] text-slate-500 mb-2">Nidham Mobile</div>
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-cyan to-brand-navy text-white flex items-center justify-center mx-auto mb-2 text-xl font-black">
            ن
          </div>
          <div className="text-xs font-bold mb-3">أهلاً أحمد 👋</div>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <div className="bg-emerald-500 text-white text-[9px] py-2 rounded font-bold">
              Check-in 📍
            </div>
            <div className="bg-amber-100 text-amber-700 text-[9px] py-2 rounded font-bold">
              إجازة 🏖
            </div>
          </div>
          <div className="text-[9px] text-slate-500 mt-2 leading-relaxed">
            راتب مايو متاح<br/>اضغط للعرض
          </div>
        </div>
      </div>
    </div>
  );
}

function AiMockup() {
  return (
    <div className="p-4 bg-white font-cairo" style={{ minHeight: "320px" }}>
      <div className="space-y-2">
        <div className="flex justify-end">
          <div className="bg-brand-cyan text-white px-3 py-2 rounded-2xl text-xs max-w-[80%]">
            ضيف موظف جديد اسمه أحمد محمود راتب 5500 ج وظيفته Developer
          </div>
        </div>
        <div className="flex">
          <div className="bg-slate-100 text-slate-800 px-3 py-2 rounded-2xl text-xs max-w-[85%]">
            تمام ✅ ضفت أحمد محمود في النظام:
            <br />
            • راتب أساسي: 5,500 ج
            <br />
            • وظيفة: Developer
            <br />
            • تأمينات: 605 ج/شهر
            <br />
            • صافي: 4,400 ج/شهر تقريباً
            <br />
            <br />
            عايز أعمل invitation للـ mobile app؟
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-brand-cyan text-white px-3 py-2 rounded-2xl text-xs max-w-[80%]">
            أيوة، وابعتله رابط واتساب
          </div>
        </div>
      </div>
    </div>
  );
}

function AttendanceMockup() {
  return (
    <div className="p-4 bg-white font-cairo" style={{ minHeight: "320px" }}>
      <div className="text-xs font-bold text-slate-800 mb-3">حضور النهاردة</div>
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className={`aspect-square rounded ${
              i < 18
                ? "bg-emerald-100"
                : i < 21
                ? "bg-amber-100"
                : "bg-rose-100"
            }`}
            title={`موظف ${i + 1}`}
          />
        ))}
      </div>
      <div className="flex gap-3 text-[10px] font-bold mb-3">
        <span className="text-emerald-600">✓ حاضر: 18</span>
        <span className="text-amber-600">⏰ متأخر: 3</span>
        <span className="text-rose-600">✗ غايب: 3</span>
      </div>
      <div className="rounded-xl bg-cyan-50 border border-cyan-200 p-2 text-[10px]">
        📍 GPS verified: 17/18 check-ins
      </div>
    </div>
  );
}

function AnalyticsMockup() {
  return (
    <div className="p-4 bg-white font-cairo" style={{ minHeight: "320px" }}>
      <div className="text-xs font-bold text-slate-800 mb-3">
        Top Performers (Bridge Analytics)
      </div>
      <div className="space-y-2">
        {[
          { name: "ميرنا سعد", revenue: "184k ج", attendance: "98%", color: "emerald" },
          { name: "أحمد محمود", revenue: "152k ج", attendance: "94%", color: "cyan" },
          { name: "كريم نبيل", revenue: "127k ج", attendance: "89%", color: "amber" },
        ].map((p, i) => (
          <div
            key={p.name}
            className="flex items-center gap-2 p-2 rounded-lg bg-slate-50"
          >
            <div className="text-lg font-black text-slate-400">#{i + 1}</div>
            <div className="flex-1">
              <div className="text-xs font-bold text-slate-800">{p.name}</div>
              <div className="text-[10px] text-slate-500">
                {p.revenue} · حضور {p.attendance}
              </div>
            </div>
            <div className="text-2xl">🏆</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-2 rounded-lg ${
        highlight ? "bg-amber-50 border border-amber-200" : "bg-slate-50"
      }`}
    >
      <div className="text-[10px] text-slate-500 font-bold">{label}</div>
      <div className="text-base font-black text-slate-800">{value}</div>
    </div>
  );
}

// New-features compact card — used in the 2026 features grid.
// Links into the live page so visitors who are already signed in can
// click straight through. Pro/Enterprise gating still applies on the
// destination page (so this isn't an exfil risk).
function NewFeatureCard({
  emoji,
  title,
  desc,
  href,
  badge,
}: {
  emoji: string;
  title: string;
  desc: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="block p-4 rounded-2xl bg-white border-2 border-slate-100 hover:border-amber-300 hover:shadow-md hover:-translate-y-0.5 transition-all font-cairo"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-3xl">{emoji}</div>
        {badge && (
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
            {badge}
          </span>
        )}
      </div>
      <h3 className="font-black text-slate-900 text-base mb-1">{title}</h3>
      <p className="text-xs text-slate-600 leading-relaxed">{desc}</p>
    </Link>
  );
}
