import Link from "next/link";
import { PrintButton } from "./print-button";

// ============================================================================
// /sales-brochure — Professional 10-page sales PDF
// ============================================================================
//
// Built to be opened in any browser, printed to PDF via the floating
// "Download PDF" button, and sent to a prospect on WhatsApp/email. The
// goal is for an HR person or SMB founder to open it on their phone,
// scroll once or twice, and immediately want to call.
//
// Design system:
//   • Brand cyan #22d3ee (gradient with #0891b2) + brand navy #0a1428
//   • Amber #f59e0b as accent for ROI / "saved" numbers
//   • Cairo font for headings, Tajawal for body — both RTL-native
//   • Each major section is its own A4 page (page-break-before: always)
//   • 15mm margins, max content width sized for A4 portrait
//   • Massive type hierarchy — sections readable from arm's length
//   • Lots of whitespace; cluttered = unprofessional
//
// Print rules:
//   • .no-print elements vanish in PDF (toolbar, scroll hints)
//   • Page numbers in footer of every printed sheet
//   • All hyperlinks remain clickable on screen but inherit text color
//     in print (no underlined blue links that distract)

export const metadata = {
  title: "نِظام — كتيب مبيعات احترافي | Sales Brochure",
  description:
    "كل تفاصيل نِظام في ملف واحد: ١٦ موديول، ٨ مميزات بالذكاء الاصطناعي، توفير حقيقي ٦٧ ألف جنيه سنوياً للشركات المصرية.",
};

const PRINT_STYLES = `
  /* A4 portrait, conservative margins so content doesn't crowd the edges */
  @page { size: A4; margin: 15mm; }

  @media print {
    html, body {
      background: white !important;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .no-print { display: none !important; }
    .page-break { page-break-after: always; break-after: page; }
    a { color: inherit !important; text-decoration: none !important; }
    /* Force gradients + emoji to print properly */
    [style*="gradient"] { print-color-adjust: exact; }
  }

  /* Smooth scrolling for the on-screen TOC anchors */
  html { scroll-behavior: smooth; }

  /* Each section behaves like an A4 page on screen too */
  .a4-page {
    min-height: 270mm;
    padding: 16mm 14mm;
    background: white;
    margin: 0 auto 8mm;
    max-width: 210mm;
    box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.05), 0 12px 40px rgba(15, 23, 42, 0.06);
    position: relative;
  }
  @media print {
    .a4-page {
      min-height: auto;
      padding: 0;
      margin: 0;
      box-shadow: none;
      max-width: none;
    }
  }

  /* Big-number aesthetic */
  .stat-num {
    font-family: var(--font-tajawal), sans-serif;
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.02em;
  }
`;

export default function SalesBrochurePage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <main className="bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 min-h-screen pb-12 print:bg-white print:pb-0">
        <PrintButton />

        {/* ─────────────────────────────────────────────────────────────
            PAGE 1 — Cover (redesigned for PDF clarity)
            ─────────────────────────────────────────────────────────────
            Rewritten after user feedback that the original was unclear
            in PDF form. Removed:
              ✗ bg-clip-text gradient on hero headline (prints as black
                or transparent on dark background in Chrome's PDF export)
              ✗ blurred decorative orbs (print muddy / wash out colors)
              ✗ low-contrast text-white/50 micro-labels (illegible on A4)

            Added:
              ✓ Solid cyan/amber colored words (no gradient text)
              ✓ Bold geometric accent shapes that print cleanly
              ✓ High-contrast white-on-navy throughout
              ✓ Larger, more confident type hierarchy
              ✓ Clear visual anchor: huge "نِظام" wordmark
              ✓ Trust badges row anchored at the bottom
        ───────────────────────────────────────────────────────────── */}
        <section
          className="a4-page page-break overflow-hidden relative text-white"
          style={{
            background:
              "linear-gradient(135deg, #0a1428 0%, #112048 50%, #0a1428 100%)",
          }}
        >
          {/* Clean geometric accent — no blurs. A solid cyan corner block
              prints crisply in PDF and gives the cover its visual identity. */}
          <div
            className="absolute"
            style={{
              top: 0,
              right: 0,
              width: 220,
              height: 220,
              background:
                "linear-gradient(225deg, #22d3ee 0%, #0891b2 100%)",
              clipPath: "polygon(40% 0, 100% 0, 100% 60%)",
            }}
          />
          <div
            className="absolute"
            style={{
              bottom: 0,
              left: 0,
              width: 180,
              height: 180,
              background: "linear-gradient(45deg, #f59e0b 0%, #d97706 100%)",
              clipPath: "polygon(0 40%, 60% 100%, 0 100%)",
            }}
          />

          <div className="relative h-full flex flex-col">
            {/* Top bar — bigger logo + clear edition tag */}
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)",
                  }}
                >
                  <span className="text-3xl font-black text-white font-display">
                    ن
                  </span>
                </div>
                <div>
                  <div className="text-3xl font-black tracking-tight font-cairo leading-none">
                    نِظام
                  </div>
                  <div
                    className="text-[10px] tracking-[0.4em] uppercase font-bold mt-1"
                    style={{ color: "#22d3ee" }}
                  >
                    Nidham · HR + Payroll + AI
                  </div>
                </div>
              </div>
              <div
                className="px-3 py-1.5 rounded-full border font-cairo text-xs font-bold"
                style={{
                  borderColor: "rgba(255,255,255,0.3)",
                  color: "rgba(255,255,255,0.9)",
                }}
              >
                إصدار 2026
              </div>
            </div>

            {/* Hook headline — SOLID colors, no gradient text */}
            <div className="flex-1 flex flex-col justify-center max-w-3xl">
              <div
                className="inline-block px-5 py-2 rounded-full text-xs font-black mb-8 font-cairo w-fit border-2"
                style={{
                  backgroundColor: "#f59e0b",
                  borderColor: "#d97706",
                  color: "#0a1428",
                }}
              >
                ✦ للشركات المصرية الناجحة ✦
              </div>

              <h1 className="text-[64px] font-black font-cairo leading-[1.02] mb-6 text-white">
                وقف عن إدارة
                <br />
                الموظفين
                <br />
                <span style={{ color: "#22d3ee" }}>بالشكاوي</span>
                <span style={{ color: "#f59e0b" }}> والاجتماعات.</span>
              </h1>

              <p className="text-xl leading-relaxed font-cairo mb-10 max-w-2xl text-white">
                نظام HR + Payroll + AI متكامل، مبني خصيصاً للسوق المصري. متوافق
                مع قانون العمل <strong style={{ color: "#22d3ee" }}>12/2003</strong>{" "}
                وقانون التأمينات{" "}
                <strong style={{ color: "#22d3ee" }}>148/2019</strong>. بربع
                تكلفة Bayzat و ZenHR.
              </p>

              {/* Stats row — high contrast, clean borders */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <CoverStatV2
                  num="16"
                  label="موديول كامل"
                  sub="HR + CRM + AI"
                />
                <CoverStatV2
                  num="8"
                  label="مميزات AI"
                  sub="ذكاء اصطناعي"
                />
                <CoverStatV2
                  num="٦٧"
                  label="ألف جنيه"
                  sub="توفير سنوي مقدّر"
                  highlight
                />
              </div>
            </div>

            {/* Footer of cover — bigger and more confident */}
            <div className="mt-auto pt-10 grid grid-cols-2 gap-4 text-sm border-t-2 border-white/15">
              <div className="font-cairo pt-6">
                <div
                  className="text-[10px] tracking-[0.3em] uppercase font-bold mb-2"
                  style={{ color: "#22d3ee" }}
                >
                  للاتصال المباشر
                </div>
                <div className="text-white font-bold text-lg" dir="ltr">
                  📱 +20 105 535 6622
                </div>
                <div className="text-white/80 text-xs mt-1">
                  💻 nidhamhr.com · WhatsApp 24/7
                </div>
              </div>
              <div className="text-right font-cairo pt-6">
                <div
                  className="text-[10px] tracking-[0.3em] uppercase font-bold mb-2"
                  style={{ color: "#22d3ee" }}
                >
                  Page
                </div>
                <div className="text-3xl font-black">01 / 10</div>
              </div>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            PAGE 2 — The Pain (HR Reality in Egypt)
            ───────────────────────────────────────────────────────────── */}
        <section className="a4-page page-break">
          <PageHeader number="02" sectionLabel="الواقع" />

          <h2 className="text-5xl font-black font-cairo text-slate-900 mb-3 leading-tight">
            بتقضي 3 أيام في الشهر
            <br />
            <span className="text-rose-600">بتعمل المرتبات؟</span>
          </h2>
          <p className="text-lg text-slate-600 font-cairo mb-10 max-w-2xl leading-relaxed">
            دي مش مشكلتك إنت لوحدك — معظم شركات الـ SMB المصرية بتعاني من نفس
            الأرقام دي:
          </p>

          <div className="grid grid-cols-1 gap-4 mb-8">
            <PainStat
              pct="47%"
              title="من شركات الـ SMB المصرية بتعمل المرتبات في Excel"
              detail="مع كل خطأ ممكن يكلّفك دفعات زيادة أو شكاوى من مكتب العمل."
              tone="rose"
            />
            <PainStat
              pct="73%"
              title="بيعملوا غلطات في حساب التأمينات سنوياً"
              detail="٩٢١ جنيه متوسط الخصم لكل خطأ — بيتراكم بسرعة لـ ٢٠+ موظف."
              tone="amber"
            />
            <PainStat
              pct="4 ساعات"
              title="في الأسبوع بتروح في طلبات الإجازات يدوي"
              detail="ورقة، توقيع، تحديث Excel، إيميل للموظف. كل ده ممكن يخلص في ٣٠ ثانية."
              tone="violet"
            />
            <PainStat
              pct="80,000 ج"
              title="سنوياً تكلفة موظف HR إضافي"
              detail="بدل ما تشغّله، الـ AI بياخد مهامه التكرارية ويسيب لك الناس."
              tone="cyan"
            />
            <PainStat
              pct="12%"
              title="خسارة في الرواتب بسبب غياب نظام تتبّع"
              detail="عدم تسجيل التأخير، الإجازات غير المعتمدة، السلف اللي بتتنسى."
              tone="emerald"
            />
          </div>

          <div className="bg-slate-900 text-white rounded-2xl p-6 font-cairo">
            <div className="text-sm text-amber-300 font-bold mb-1">💡 خلاصة</div>
            <p className="text-lg leading-relaxed">
              ميتش معقول إنّك بتدير شركتك في 2026 بنفس أدوات 2010. النظام بقا
              <strong> رخيص جداً</strong> والـ AI بقا <strong>دقيق جداً </strong>
              لدرجة إنك مش هتقدر تكمّل بدونه.
            </p>
          </div>

          <PageFooter />
        </section>

        {/* ─────────────────────────────────────────────────────────────
            PAGE 3 — The Promise
            ───────────────────────────────────────────────────────────── */}
        <section className="a4-page page-break bg-gradient-to-br from-cyan-50 via-white to-amber-50/30">
          <PageHeader number="03" sectionLabel="الحل" />

          <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold mb-6 font-cairo">
            ✦ هدف نِظام في جملة واحدة
          </div>

          <h2 className="text-6xl font-black font-cairo text-slate-900 leading-tight mb-10">
            <span style={{ color: "#0891b2" }}>نظام واحد</span>
            <br />
            بياخد كل اللي بتعمله يدوي
            <br />
            ويخلّيه <span style={{ color: "#059669" }}>أوتوماتيك.</span>
          </h2>

          {/* Before / After comparison */}
          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="bg-white border-2 border-rose-200 rounded-2xl p-6 font-cairo">
              <div className="text-xs text-rose-600 font-bold mb-3 tracking-widest uppercase">
                قبل نِظام
              </div>
              <ul className="space-y-2.5 text-sm text-slate-700">
                <BeforeAfterItem icon="❌" text="٣ شيتات Excel منفصلين" />
                <BeforeAfterItem icon="❌" text="حساب المرتبات يدوي كل شهر" />
                <BeforeAfterItem icon="❌" text="إجازات على WhatsApp" />
                <BeforeAfterItem icon="❌" text="نماذج الحكومة بتتلكش" />
                <BeforeAfterItem icon="❌" text="مفيش تقارير ولا تحليلات" />
                <BeforeAfterItem icon="❌" text="فحص CVs يدوي" />
              </ul>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 border-2 border-emerald-300 rounded-2xl p-6 font-cairo">
              <div className="text-xs text-emerald-700 font-bold mb-3 tracking-widest uppercase">
                مع نِظام
              </div>
              <ul className="space-y-2.5 text-sm text-slate-700">
                <BeforeAfterItem icon="✓" text="١ شاشة فيها كل البيانات" />
                <BeforeAfterItem icon="✓" text="مرتبات أوتوماتيك في ٣ دقايق" />
                <BeforeAfterItem icon="✓" text="بوت WhatsApp يجاوب الموظفين" />
                <BeforeAfterItem icon="✓" text="٩ نماذج رسمية جاهزة للطباعة" />
                <BeforeAfterItem icon="✓" text="لوحة تحليلات + Bridge" />
                <BeforeAfterItem icon="✓" text="AI بيفحص CVs ويعطيك score" />
              </ul>
            </div>
          </div>

          {/* The four outcomes */}
          <div className="grid grid-cols-4 gap-3">
            <OutcomeChip icon="⏱" label="وقت أقل" sub="٨٠٪ توفير" />
            <OutcomeChip icon="💰" label="تكلفة أقل" sub="٦٧ ألف/سنة" />
            <OutcomeChip icon="🎯" label="دقة أعلى" sub="صفر أخطاء" />
            <OutcomeChip icon="⚖" label="امتثال قانوني" sub="١٠٠٪" />
          </div>

          <PageFooter />
        </section>

        {/* ─────────────────────────────────────────────────────────────
            PAGE 4 — System at a Glance
            ───────────────────────────────────────────────────────────── */}
        <section className="a4-page page-break">
          <PageHeader number="04" sectionLabel="النظام كامل" />

          <h2 className="text-5xl font-black font-cairo text-slate-900 mb-3 leading-tight">
            النظام كامل
            <br />
            <span className="text-brand-cyan-dark">في صورة واحدة.</span>
          </h2>
          <p className="text-base text-slate-600 font-cairo mb-8 max-w-2xl">
            ١٦ موديول مترابطين — بياناتهم مشتركة، تقاريرهم مدمجة. مش زي اللي
            بيشتغل في برنامج مرتبات + برنامج CRM + Google Sheets للحضور.
          </p>

          {/* 4×4 grid */}
          <div className="grid grid-cols-4 gap-3">
            <ModuleTile emoji="👥" title="الموظفين" hint="ضيف + استورد + هيكل" />
            <ModuleTile emoji="📈" title="الأداء" hint="KPIs + مراجعات" />
            <ModuleTile emoji="🌳" title="الهيكل" hint="مخطط تنظيمي" />
            <ModuleTile emoji="📦" title="الأصول" hint="عهد + جرد" />

            <ModuleTile emoji="⏰" title="الحضور" hint="دخول + خروج + سيلفي" />
            <ModuleTile emoji="🕒" title="الورديات" hint="جدول أسبوعي" />
            <ModuleTile emoji="📅" title="الإجازات" hint="رصيد + موافقات" />
            <ModuleTile emoji="📨" title="الطلبات" hint="إجازة + سلفة + استئذان" />

            <ModuleTile emoji="💰" title="الرواتب" hint="دورات + كشوف" />
            <ModuleTile emoji="💵" title="السلف" hint="خصم تلقائي" />
            <ModuleTile emoji="⚖" title="نهاية الخدمة" hint="حاسبة مادة 122" />
            <ModuleTile emoji="💼" title="العملاء" hint="CRM + Pipeline" />

            <ModuleTile
              emoji="🤖"
              title="المساعد الذكي"
              hint="١٥ أداة AI"
              highlight
            />
            <ModuleTile
              emoji="✍"
              title="التوقيع الإلكتروني"
              hint="بإصبع الموظف"
              highlight
            />
            <ModuleTile
              emoji="📍"
              title="حضور بالـ GPS"
              hint="سيلفي + موقع"
              highlight
            />
            <ModuleTile
              emoji="📜"
              title="٩ نماذج رسمية"
              hint="تأمينات + ضرايب"
              highlight
            />
          </div>

          <div className="mt-8 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-cyan-50 border-2 border-amber-300 font-cairo">
            <div className="text-sm font-bold text-slate-800 mb-1">
              ✦ المميّزات بالرتقالي مفيش نظام HR مصري تاني عنده
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Bayzat و ZenHR و Workday بيركّزوا على HR الأساسي بس. إحنا أضفنا
              طبقة AI كاملة (شات بوت، فحص CV، تحليل احتفاظ بالموظفين) + كل
              النماذج الحكومية المصرية مدمجة.
            </p>
          </div>

          <PageFooter />
        </section>

        {/* ─────────────────────────────────────────────────────────────
            PAGE 5 — HR Core Features (detail)
            ───────────────────────────────────────────────────────────── */}
        <section className="a4-page page-break">
          <PageHeader number="05" sectionLabel="الموديولات الأساسية" />

          <h2 className="text-4xl font-black font-cairo text-slate-900 mb-2 leading-tight">
            HR + Payroll<br />
            <span className="text-brand-cyan-dark">الأساس اللي بيشتغل ٢٤/٧</span>
          </h2>
          <p className="text-base text-slate-600 font-cairo mb-8">
            الخمسة موديولات اللي بيستخدمها الـ HR كل يوم
          </p>

          <FeatureBlock
            icon="👥"
            title="إدارة الموظفين"
            body="ضيف موظفين فردياً أو استورد من Excel. كل موظف عنده ملف شامل: رقم قومي مشفّر بـ AES، بنك، تأمينات، عقد، صور. ربط مع الـ WhatsApp/SMS للتواصل."
            highlights={[
              "Import من Excel + ZKTeco بصمة",
              "تشفير PII كامل (قانون 151/2020)",
              "تتبّع نهاية الخدمة تلقائي",
            ]}
          />

          <FeatureBlock
            icon="⏰"
            title="الحضور والانصراف"
            body="٤ طرق تسجيل حضور — يدوي من الـ HR، Excel/ZKTeco، GPS من موبايل الموظف، أو سيلفي + GPS للعمالة الميدانية. النظام يعرف الموظف من رقمه."
            highlights={[
              "٤٠٠ موظف × ٣٠ يوم في صفحة واحدة",
              "تنبيه أنماط التأخير المتكرر",
              "Geofencing + سيلفي verification",
            ]}
          />

          <FeatureBlock
            icon="💰"
            title="الرواتب"
            body="حساب آلي للراتب الإجمالي والصافي بكل التفاصيل: التأمينات (شرائح 2024), ضريبة الدخل (٧ شرائح), البدلات, الـ overtime (35% نهار / 50% ليل / 100% راحة), الخصومات."
            highlights={[
              "حسبة الإجازات بدون أجر",
              "قسائم رواتب احترافية للطباعة",
              "Export لكل البنوك المصرية",
            ]}
          />

          <FeatureBlock
            icon="📨"
            title="طلبات الموظفين"
            body="إجازات + سلف + استئذان كله من تطبيق الموبايل. الـ HR بيوافق/يرفض بضغطة واحدة. الرصيد بيتحدّث تلقائياً. Multi-level approval لو الشركة عايزة موافقة المدير المباشر قبل HR."
            highlights={[
              "موافقات بـ Multi-level workflow",
              "تنبيهات WhatsApp فورية",
              "تقويم إجازات تفاعلي",
            ]}
          />

          <FeatureBlock
            icon="💵"
            title="السلف والمرتجعات"
            body="موظف يطلب سلفة → HR يعتمد → النظام بيخصمها أوتوماتيك من المرتبات الشهرية حسب القسط المحدد. لو الموظف ساب الشركة، الباقي بيتخصم من نهاية الخدمة."
            highlights={[
              "خصم آلي من المرتب",
              "حماية ضد الـ over-payment",
              "تقرير سلف نشطة + متبقي",
            ]}
          />

          <PageFooter />
        </section>

        {/* ─────────────────────────────────────────────────────────────
            PAGE 6 — AI + Automation (the differentiator)
            ───────────────────────────────────────────────────────────── */}
        <section className="a4-page page-break bg-gradient-to-br from-slate-50 via-cyan-50/30 to-amber-50/30">
          <PageHeader number="06" sectionLabel="الذكاء الاصطناعي" />

          <div className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-100 to-cyan-100 border-2 border-amber-300 text-amber-800 text-xs font-bold mb-6 font-cairo">
            ✦ الميّزة اللي مفيش حد عاملها في السوق المصري
          </div>

          <h2 className="text-4xl font-black font-cairo text-slate-900 mb-2 leading-tight">
            AI بيشتغل معاك<br />
            <span className="text-amber-600">زي زميل HR شاطر.</span>
          </h2>
          <p className="text-base text-slate-600 font-cairo mb-8">
            مش chatbot يجاوب بكلام عام. ده agent عنده ١٥ أداة بيستخدمها فعلياً
            على بيانات شركتك.
          </p>

          <FeatureBlock
            icon="🤖"
            title="المساعد الذكي بالعربي"
            body='شات بـ ١٥ أداة. تكتب "اقفل مرتبات الشهر ده" — يحسبها لك، يبيّنلك الإجمالي قبل التنفيذ، يستنى تأكيدك. "احسب لي مرتب أحمد لو زدته ١٠٪" — يحسب ويرد فوري. "مين متأخر أكتر من ٣ مرات الشهر ده" — قائمة بأسماء.'
            highlights={[
              "Powered by Gemini 2.5 Flash",
              "موافقة صريحة قبل أي تنفيذ",
              "متخصص في قانون العمل 12/2003",
            ]}
            tone="amber"
          />

          <FeatureBlock
            icon="💬"
            title="بوت WhatsApp للموظفين"
            body='الموظف يبعت "كم رصيد إجازاتي" — رد فوري من الـ DB. "مرتبي" — صورة قسيمة المرتب. "حضوري" — آخر ٧ أيام. "شهادة عمل" — إرشاد للـ HR. كل ده بدون ما الموظف يفتح تطبيق.'
            highlights={[
              "٦ أوامر مدعومة بالعربي",
              "تجاوب فوري ٢٤/٧",
              "Free tier — ١٠٠٠ محادثة شهرياً مجاناً",
            ]}
            tone="amber"
          />

          <FeatureBlock
            icon="🎯"
            title="فحص CVs بالذكاء"
            body="ارفع ١٠٠ CV — الـ AI بيدّيك كل واحد score من ١٠٠ + نقاط قوة + نقاط ضعف + ٥ أسئلة مقترحة للمقابلة. توفير ٣ ساعات لكل توظيف."
            highlights={[
              "بيقرأ PDF/Word/صور",
              "Score مبني على متطلبات الوظيفة",
              "أسئلة مقابلة شخصية لكل CV",
            ]}
            tone="amber"
          />

          <FeatureBlock
            icon="🛡"
            title="احتفاظ بالموظفين تنبئي"
            body="الـ AI بيحلل البيانات يومياً ويقولك: مين معرّض للاستقالة (بناءً على نمط تأخيره + إجازاته + غيابه)، مين يستحق زيادة، مين يستحق مكافأة، إنذارات مبكرة قبل ما تخسر موظف."
            highlights={[
              "تحليل ٤ مؤشرات سلوكية",
              "تنبيهات قبل ١٤ يوم من المخاطر",
              "اقتراحات تدخّل عملية",
            ]}
            tone="amber"
          />

          <PageFooter />
        </section>

        {/* ─────────────────────────────────────────────────────────────
            PAGE 7 — Egyptian Compliance
            ───────────────────────────────────────────────────────────── */}
        <section className="a4-page page-break">
          <PageHeader number="07" sectionLabel="الامتثال القانوني" />

          <h2 className="text-4xl font-black font-cairo text-slate-900 mb-2 leading-tight">
            قانون مصري<br />
            <span className="text-emerald-700">١٠٠٪ — مش ترجمة لخارجي.</span>
          </h2>
          <p className="text-base text-slate-600 font-cairo mb-8">
            النظام مبني من الصفر للسوق المصري. كل قاعدة قانونية موجودة في القانون
            مطبّقة بدقة.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-8">
            <ComplianceCard
              law="قانون العمل 12/2003"
              items={[
                "مادة 47: الإجازات (٢١ يوم → ٣٠ يوم بعد ١٠ سنين)",
                "مادة 122: مكافأة نهاية الخدمة",
                "مادة 69: الإنهاء بسبب جسيم (سقوط المكافأة)",
                "Overtime: ٣٥٪ نهار / ٥٠٪ ليل / ١٠٠٪ راحة",
              ]}
            />
            <ComplianceCard
              law="التأمينات 148/2019"
              items={[
                "شرائح 2024 محدّثة",
                "حصة الموظف + حصة صاحب العمل",
                "نموذج ١ تسجيل عامل",
                "نموذج ٢ تعديل أجر",
                "نموذج ٦ ترك الخدمة",
              ]}
            />
            <ComplianceCard
              law="ضريبة الدخل 91/2005"
              items={[
                "٧ شرائح ضريبية (٠ → ٢٧.٥٪)",
                "إعفاء شخصي ٢٠ ألف",
                "شهادة ضريبية سنوية أوتوماتيك",
                "Export لإقرارات شركة",
              ]}
            />
            <ComplianceCard
              law="حماية البيانات 151/2020 (PDPL)"
              items={[
                "تشفير PII بـ AES-256",
                "موافقة صريحة للموظف",
                "سجل عمليات (Audit Log) مع hash chain",
                "حق المسح والوصول",
              ]}
            />
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 border-2 border-emerald-300 rounded-2xl p-5 font-cairo">
            <div className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
              <span>📜</span>
              <span>٩ نماذج رسمية جاهزة للطباعة</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              نموذج ١ تأمينات (تسجيل عامل) · نموذج ٢ (تعديل أجر) · نموذج ٦ (ترك
              الخدمة) · شهادة عمل · شهادة خبرة · شهادة راتب · عقد عمل · إنذار
              نهاية الخدمة · إقرار ضريبي سنوي. كله بـ ضغطة واحدة، مع بيانات
              الشركة والموظف ملقّمة تلقائياً.
            </p>
          </div>

          <PageFooter />
        </section>

        {/* ─────────────────────────────────────────────────────────────
            PAGE 8 — ROI Calculator
            ───────────────────────────────────────────────────────────── */}
        <section className="a4-page page-break bg-gradient-to-br from-amber-50 via-white to-emerald-50/50">
          <PageHeader number="08" sectionLabel="حساب التوفير" />

          <div className="inline-block px-4 py-1.5 rounded-full bg-amber-100 border-2 border-amber-300 text-amber-800 text-xs font-bold mb-6 font-cairo">
            ✦ الحسبة بالأرقام الفعلية
          </div>

          <h2 className="text-4xl font-black font-cairo text-slate-900 mb-2 leading-tight">
            ٦٧,٨٣٢ ج
            <br />
            <span className="text-emerald-700">توفير سنوي حقيقي.</span>
          </h2>
          <p className="text-base text-slate-600 font-cairo mb-8">
            لشركة بـ ٢٠-٥٠ موظف. الحساب مفصّل تحت — مش كلام تسويق.
          </p>

          {/* Before vs After ROI table */}
          <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden mb-6">
            <table className="w-full text-right font-cairo">
              <thead className="bg-slate-100 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-right font-bold">البند</th>
                  <th className="px-4 py-3 text-center font-bold w-32">
                    قبل نِظام
                  </th>
                  <th className="px-4 py-3 text-center font-bold w-32 text-emerald-700">
                    مع نِظام
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                <RoiRow
                  label="موظف HR إضافي (للمرتبات والإجازات)"
                  before="٨٠,٠٠٠ ج"
                  after="٠ ج"
                  savings="٨٠,٠٠٠"
                />
                <RoiRow
                  label="أخطاء حساب التأمينات (متوسط ٧ مرات/سنة)"
                  before="٦,٤٤٧ ج"
                  after="٠ ج"
                  savings="٦,٤٤٧"
                />
                <RoiRow
                  label="مستشار قانوني (تقديم نماذج التأمينات)"
                  before="٥,٠٠٠ ج"
                  after="٠ ج"
                  savings="٥,٠٠٠"
                />
                <RoiRow
                  label="Software متفرّق (Excel / WhatsApp / Drive)"
                  before="٢,٠٠٠ ج"
                  after="٠ ج"
                  savings="٢,٠٠٠"
                />
                <RoiRow
                  label="أوراق + طباعة + كاتب يدوي"
                  before="٣,٥٥٣ ج"
                  after="٠ ج"
                  savings="٣,٥٥٣"
                />
                <tr className="bg-slate-50 font-bold">
                  <td className="px-4 py-3">إجمالي تكاليف سنوية</td>
                  <td className="px-4 py-3 text-center text-rose-700">
                    ٩٧,٠٠٠ ج
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-700">
                    ٠ ج
                  </td>
                </tr>
                <tr className="bg-amber-50">
                  <td className="px-4 py-3 text-sm">
                    اشتراك نِظام Pro (سنوي)
                  </td>
                  <td className="px-4 py-3 text-center text-slate-400">—</td>
                  <td className="px-4 py-3 text-center text-amber-800 font-bold">
                    ٢٩,١٦٨ ج
                  </td>
                </tr>
                <tr className="bg-gradient-to-r from-emerald-100 to-cyan-100 font-black text-base">
                  <td className="px-4 py-4 text-emerald-900">صافي التوفير</td>
                  <td className="px-4 py-4 text-center text-slate-500">—</td>
                  <td className="px-4 py-4 text-center text-emerald-800 text-2xl stat-num">
                    ٦٧,٨٣٢ ج
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Extra value not in money */}
          <div className="grid grid-cols-3 gap-3">
            <ValueCard
              icon="⏱"
              num="١٢٠ ساعة"
              label="توفير وقت سنوياً"
              detail="بدل ما تعملها في المرتبات والطلبات"
            />
            <ValueCard
              icon="📊"
              num="١٠٠٪"
              label="دقة الحسابات"
              detail="لا أخطاء بشرية في التأمينات/الضرائب"
            />
            <ValueCard
              icon="📱"
              num="٢٤/٧"
              label="وصول من الموبايل"
              detail="HR من اللاب + موظفين من الموبايل"
            />
          </div>

          <PageFooter />
        </section>

        {/* ─────────────────────────────────────────────────────────────
            PAGE 9 — Pricing
            ───────────────────────────────────────────────────────────── */}
        <section className="a4-page page-break">
          <PageHeader number="09" sectionLabel="الأسعار" />

          <h2 className="text-4xl font-black font-cairo text-slate-900 mb-2 leading-tight">
            أسعار واضحة<br />
            <span className="text-brand-cyan-dark">بدون مفاجآت.</span>
          </h2>
          <p className="text-base text-slate-600 font-cairo mb-8">
            كل الباقات شاملة كل الميزات الأساسية. الفرق بس في عدد الموظفين والـ AI.
          </p>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <PriceCard
              name="Starter"
              price="٧٤٩"
              suffix="ج / شهر"
              employees="حتى ٢٥ موظف"
              best="للشركات الصغيرة"
              features={[
                "كل موديولات HR + Payroll",
                "تسجيل حضور + GPS",
                "نماذج تأمينات وضرايب",
                "تطبيق موبايل للموظفين",
                "دعم بالعربي",
              ]}
            />
            <PriceCard
              name="Pro"
              price="٢,٤٣٠"
              suffix="ج / شهر"
              employees="حتى ١٠٠ موظف"
              best="الباقة الموصى بها"
              recommended
              features={[
                "كل اللي في Starter",
                "✦ المساعد الذكي بالعربي",
                "✦ بوت WhatsApp للموظفين",
                "✦ احتفاظ بالموظفين تنبئي",
                "✦ فحص CVs بالـ AI",
                "✦ التوقيع الإلكتروني",
              ]}
            />
            <PriceCard
              name="Business"
              price="٥,٩٩٠"
              suffix="ج / شهر"
              employees="حتى ٥٠٠ موظف"
              best="للشركات المتوسطة"
              features={[
                "كل اللي في Pro",
                "Multi-level approvals",
                "Custom fields",
                "Bridge Analytics",
                "Marketing Studio",
                "API للتكامل الخارجي",
              ]}
            />
            <PriceCard
              name="Enterprise"
              price="حسب الطلب"
              suffix=""
              employees="٥٠٠+ موظف"
              best="للمجموعات الكبرى"
              features={[
                "كل اللي في Business",
                "نشر داخلي (On-premise)",
                "دعم مخصص ٢٤/٧",
                "تدريب فريق HR",
                "تخصيصات حسب الصناعة",
                "اتفاقية SLA",
              ]}
            />
          </div>

          <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-5 font-cairo">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🎁</span>
              <div className="font-bold text-emerald-900 text-lg">
                ١٤ يوم تجربة مجانية + ضمان استرداد ٣٠ يوم
              </div>
            </div>
            <p className="text-xs text-emerald-800 leading-relaxed">
              جرّب كل الميزات بدون التزام. لو مش حابب، نرجّع فلوسك بدون أسئلة.
              عمليات الـ migration من Bayzat/ZenHR/Excel مجانية تماماً.
            </p>
          </div>

          <PageFooter />
        </section>

        {/* ─────────────────────────────────────────────────────────────
            PAGE 10 — CTA + Contact (PDF-safe redesign)
            ───────────────────────────────────────────────────────────── */}
        <section
          className="a4-page text-white relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #0a1428 0%, #112048 50%, #0a1428 100%)",
          }}
        >
          {/* Solid accents — no blurs, prints cleanly */}
          <div
            className="absolute"
            style={{
              top: 0,
              left: 0,
              width: 200,
              height: 200,
              background:
                "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)",
              clipPath: "polygon(0 0, 100% 0, 0 100%)",
            }}
          />
          <div
            className="absolute"
            style={{
              bottom: 0,
              right: 0,
              width: 220,
              height: 220,
              background: "linear-gradient(225deg, #f59e0b 0%, #d97706 100%)",
              clipPath: "polygon(100% 40%, 100% 100%, 40% 100%)",
            }}
          />

          <div className="relative h-full flex flex-col">
            <PageHeader number="10" sectionLabel="ابدأ" white />

            <div className="flex-1 flex flex-col justify-center">
              <h2 className="text-7xl font-black font-cairo leading-[1.05] mb-6 text-white">
                ابدأ مجاناً
                <br />
                <span style={{ color: "#f59e0b" }}>النهاردة.</span>
              </h2>

              <p className="text-xl text-white leading-relaxed font-cairo mb-10 max-w-2xl">
                مفيش setup معقّد. مفيش credit card. ١٤ يوم تجربة كاملة، استورد
                موظفينك من Excel في ٣ دقايق، وابدأ تحس بالفرق من أول يوم.
              </p>

              {/* CTAs */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white text-slate-900 rounded-2xl p-5 font-cairo border-2" style={{ borderColor: "#22d3ee" }}>
                  <div
                    className="text-[10px] font-black tracking-widest uppercase mb-3"
                    style={{ color: "#059669" }}
                  >
                    خيار 1 — أسرع
                  </div>
                  <div className="text-2xl font-black mb-2 text-slate-900">
                    💬 WhatsApp
                  </div>
                  <div className="text-sm text-slate-700 mb-3">
                    كلمنا مباشرة. هنرد في ٥ دقايق:
                  </div>
                  <div
                    className="text-xl font-black font-mono"
                    style={{ color: "#0891b2" }}
                    dir="ltr"
                  >
                    +20 105 535 6622
                  </div>
                </div>

                <div
                  className="rounded-2xl p-5 font-cairo border-2"
                  style={{
                    background:
                      "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)",
                    borderColor: "#f59e0b",
                  }}
                >
                  <div
                    className="text-[10px] font-black tracking-widest uppercase mb-3"
                    style={{ color: "#fef3c7" }}
                  >
                    خيار 2 — جرّب أولاً
                  </div>
                  <div className="text-2xl font-black mb-2 text-white">
                    🌐 nidhamhr.com
                  </div>
                  <div className="text-sm text-white mb-3">
                    سجّل دلوقتي وابدأ تجربتك الـ ١٤ يوم:
                  </div>
                  <div className="text-lg font-black text-white">
                    /signup → ١ دقيقة → جاهز
                  </div>
                </div>
              </div>

              {/* Trust badges */}
              <div
                className="rounded-2xl p-5 border-2 font-cairo"
                style={{
                  borderColor: "rgba(245, 158, 11, 0.6)",
                  backgroundColor: "rgba(245, 158, 11, 0.1)",
                }}
              >
                <div
                  className="text-xs font-black uppercase tracking-widest mb-3"
                  style={{ color: "#fbbf24" }}
                >
                  ✦ ضمانات إضافية مع الاشتراك
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <TrustItem text="✓ Migration من نظامك القديم مجاناً" />
                  <TrustItem text="✓ تدريب فريق HR في ساعة واحدة" />
                  <TrustItem text="✓ دعم بالعربي ٢٤/٧" />
                  <TrustItem text="✓ ضمان استرداد ٣٠ يوم" />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div
              className="mt-auto pt-6 border-t-2 flex items-end justify-between flex-wrap gap-4"
              style={{ borderColor: "rgba(255,255,255,0.2)" }}
            >
              <div className="font-cairo">
                <div className="text-2xl font-black mb-1 text-white">
                  نِظام · Nidham
                </div>
                <div className="text-xs text-white">
                  Made in Damietta, Egypt 🇪🇬 · للسوق المصري بكل تفاصيله
                </div>
              </div>
              <div className="text-right text-xs text-white">
                © 2026 Nidham HR · هذا الكتيب للتسويق فقط
                <br />
                الأسعار قابلة للتغيير حسب العرض المعتمد
              </div>
            </div>
          </div>
        </section>

        {/* On-screen footer banner with CTAs */}
        <div className="no-print max-w-[210mm] mx-auto mt-8 px-4">
          <div className="bg-gradient-to-r from-brand-cyan to-brand-cyan-dark rounded-2xl p-5 text-white font-cairo text-center">
            <div className="text-lg font-bold mb-1">
              عجبك الكتاب؟ اطبعه PDF واعمله share على واتساب 👇
            </div>
            <p className="text-sm text-white/80">
              اضغط زرار "تحميل PDF" فوق على اليمين، أو اضغط Ctrl+P → Save as PDF
            </p>
            <Link
              href="/signup"
              className="inline-block mt-3 px-6 py-2.5 rounded-xl bg-white text-brand-cyan-dark font-bold text-sm shadow-md hover:shadow-lg transition"
            >
              ابدأ تجربتك المجانية ←
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

// ============================================================================
// Sub-components — local to this page so the brochure stays portable
// ============================================================================

function CoverStat({
  num,
  label,
  sub,
}: {
  num: string;
  label: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-5xl stat-num text-brand-cyan mb-1">{num}</div>
      <div className="text-sm font-bold text-white font-cairo">{label}</div>
      {sub && <div className="text-[10px] text-white/50 font-cairo">{sub}</div>}
    </div>
  );
}

/**
 * CoverStatV2 — redesigned cover stat block with PDF-safe contrast.
 *
 * Each stat sits in a bordered card with solid hex colors (not Tailwind
 * opacity utilities, which Chrome's print engine sometimes flattens to
 * pure black). The "highlight" variant for the headline stat uses the
 * brand amber.
 */
function CoverStatV2({
  num,
  label,
  sub,
  highlight,
}: {
  num: string;
  label: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="p-4 rounded-2xl border-2 font-cairo"
      style={{
        borderColor: highlight ? "#f59e0b" : "rgba(34, 211, 238, 0.5)",
        backgroundColor: highlight
          ? "rgba(245, 158, 11, 0.1)"
          : "rgba(34, 211, 238, 0.08)",
      }}
    >
      <div
        className="stat-num text-5xl mb-1"
        style={{ color: highlight ? "#f59e0b" : "#22d3ee" }}
      >
        {num}
      </div>
      <div className="text-sm font-bold text-white">{label}</div>
      <div className="text-[10px] text-white/80">{sub}</div>
    </div>
  );
}

function PageHeader({
  number,
  sectionLabel,
  white,
}: {
  number: string;
  sectionLabel: string;
  white?: boolean;
}) {
  // PDF-safe header — uses solid colors instead of Tailwind opacity
  // utilities (text-white/70 etc.), which Chrome's print engine can
  // flatten to pure-black or transparent on dark backgrounds.
  return (
    <div
      className="flex items-center justify-between mb-8 pb-4 border-b-2 font-cairo"
      style={{
        borderColor: white ? "rgba(255,255,255,0.25)" : "#e2e8f0",
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black text-white"
          style={{
            backgroundColor: white ? "#22d3ee" : "#0891b2",
          }}
        >
          {number}
        </div>
        <div
          className="text-[11px] uppercase tracking-[0.3em] font-black"
          style={{ color: white ? "#22d3ee" : "#64748b" }}
        >
          {sectionLabel}
        </div>
      </div>
      <div
        className="text-xs font-bold"
        style={{ color: white ? "#cbd5e1" : "#94a3b8" }}
      >
        نِظام · Sales Brochure 2026
      </div>
    </div>
  );
}

function PageFooter() {
  return null; // page number rendered by @page CSS counter on print
}

function PainStat({
  pct,
  title,
  detail,
  tone,
}: {
  pct: string;
  title: string;
  detail: string;
  tone: "rose" | "amber" | "violet" | "cyan" | "emerald";
}) {
  const palette: Record<typeof tone, string> = {
    rose: "border-rose-300 bg-rose-50/50",
    amber: "border-amber-300 bg-amber-50/50",
    violet: "border-violet-300 bg-violet-50/50",
    cyan: "border-cyan-300 bg-cyan-50/50",
    emerald: "border-emerald-300 bg-emerald-50/50",
  };
  const numColor: Record<typeof tone, string> = {
    rose: "text-rose-700",
    amber: "text-amber-700",
    violet: "text-violet-700",
    cyan: "text-cyan-700",
    emerald: "text-emerald-700",
  };
  return (
    <div
      className={`flex items-start gap-5 p-4 rounded-2xl border-2 ${palette[tone]} font-cairo`}
    >
      <div className={`stat-num text-4xl ${numColor[tone]} w-28 shrink-0`}>
        {pct}
      </div>
      <div className="flex-1">
        <div className="font-bold text-slate-900 mb-1">{title}</div>
        <p className="text-xs text-slate-600 leading-relaxed">{detail}</p>
      </div>
    </div>
  );
}

function BeforeAfterItem({ icon, text }: { icon: string; text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-base flex-shrink-0">{icon}</span>
      <span>{text}</span>
    </li>
  );
}

function OutcomeChip({
  icon,
  label,
  sub,
}: {
  icon: string;
  label: string;
  sub: string;
}) {
  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 text-center font-cairo">
      <div className="text-3xl mb-1">{icon}</div>
      <div className="font-bold text-slate-900 text-sm mb-0.5">{label}</div>
      <div className="text-xs text-emerald-700 font-bold">{sub}</div>
    </div>
  );
}

function ModuleTile({
  emoji,
  title,
  hint,
  highlight,
}: {
  emoji: string;
  title: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-xl border-2 font-cairo ${
        highlight
          ? "bg-gradient-to-br from-amber-50 to-cyan-50 border-amber-300"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="text-2xl mb-1.5">{emoji}</div>
      <div
        className={`font-bold text-sm mb-0.5 ${
          highlight ? "text-amber-900" : "text-slate-900"
        }`}
      >
        {title}
      </div>
      <div
        className={`text-[10px] ${
          highlight ? "text-amber-700" : "text-slate-500"
        }`}
      >
        {hint}
      </div>
    </div>
  );
}

function FeatureBlock({
  icon,
  title,
  body,
  highlights,
  tone,
}: {
  icon: string;
  title: string;
  body: string;
  highlights: string[];
  tone?: "amber";
}) {
  return (
    <div
      className={`mb-4 p-5 rounded-2xl border-2 font-cairo ${
        tone === "amber"
          ? "bg-gradient-to-br from-amber-50 to-cyan-50 border-amber-200"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="text-3xl flex-shrink-0">{icon}</div>
        <div className="flex-1">
          <h3 className="text-lg font-black text-slate-900 mb-1.5">{title}</h3>
          <p className="text-sm text-slate-700 leading-relaxed mb-3">{body}</p>
          <div className="flex flex-wrap gap-1.5">
            {highlights.map((h) => (
              <span
                key={h}
                className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                  tone === "amber"
                    ? "bg-amber-200 text-amber-900"
                    : "bg-white text-slate-700 border border-slate-200"
                }`}
              >
                {h}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplianceCard({ law, items }: { law: string; items: string[] }) {
  return (
    <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 font-cairo">
      <div className="text-xs font-bold text-emerald-700 mb-3 tracking-wider uppercase">
        ⚖ {law}
      </div>
      <ul className="space-y-1.5 text-xs text-slate-700">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-1.5">
            <span className="text-emerald-600 flex-shrink-0">✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoiRow({
  label,
  before,
  after,
  savings,
}: {
  label: string;
  before: string;
  after: string;
  savings: string;
}) {
  return (
    <tr>
      <td className="px-4 py-2.5 text-slate-700">{label}</td>
      <td className="px-4 py-2.5 text-center text-slate-500 line-through">
        {before}
      </td>
      <td className="px-4 py-2.5 text-center text-emerald-700 font-bold">
        {after}
      </td>
    </tr>
  );
}

function ValueCard({
  icon,
  num,
  label,
  detail,
}: {
  icon: string;
  num: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="bg-white border-2 border-amber-200 rounded-2xl p-4 text-center font-cairo">
      <div className="text-3xl mb-1">{icon}</div>
      <div className="stat-num text-2xl text-amber-700 mb-0.5">{num}</div>
      <div className="font-bold text-slate-900 text-sm mb-1">{label}</div>
      <div className="text-[10px] text-slate-500 leading-relaxed">{detail}</div>
    </div>
  );
}

function PriceCard({
  name,
  price,
  suffix,
  employees,
  best,
  features,
  recommended,
}: {
  name: string;
  price: string;
  suffix: string;
  employees: string;
  best: string;
  features: string[];
  recommended?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-2xl border-2 font-cairo ${
        recommended
          ? "bg-gradient-to-br from-amber-50 via-white to-cyan-50 border-amber-400 shadow-lg shadow-amber-500/20"
          : "bg-white border-slate-200"
      }`}
    >
      {recommended && (
        <div className="text-[10px] font-bold text-amber-700 tracking-widest uppercase mb-2">
          ⭐ موصى به
        </div>
      )}
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
        {name}
      </div>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="stat-num text-3xl text-slate-900">{price}</span>
        <span className="text-xs text-slate-500">{suffix}</span>
      </div>
      <div className="text-xs text-slate-700 font-bold mb-1">{employees}</div>
      <div className="text-[10px] text-slate-500 italic mb-3">{best}</div>
      <ul className="space-y-1 text-[11px] text-slate-700">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-1.5">
            <span
              className={`flex-shrink-0 ${
                recommended ? "text-amber-700" : "text-emerald-600"
              }`}
            >
              ✓
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrustItem({ text }: { text: string }) {
  return (
    <div className="text-white font-cairo flex items-start gap-2 font-medium">
      <span>{text}</span>
    </div>
  );
}
