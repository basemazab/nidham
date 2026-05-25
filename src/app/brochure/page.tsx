// ============================================================================
// /brochure — Print-optimized marketing brochure
// ============================================================================
//
// The "send this to a prospect" page. Open it → Ctrl+P → Save as PDF →
// send the PDF on WhatsApp/email.
//
// Design rules:
//   - Looks great on screen AND on printed A4 (4-page max when printed)
//   - Scannable in 30 seconds (no walls of text)
//   - All key selling points hit before scroll-2
//   - Final CTA + contact info is on every printed page

import Link from "next/link";
import { PrintButton } from "./print-button";

export const metadata = {
  title: "نِظام — نظام HR + AI مصري | Brochure",
  description:
    "نظام HR + Payroll + AI مصري بقانون 2026. شغّال عند 200+ موظف. بربع تكلفة Bayzat. ابدأ مجاناً.",
};

// Print-only CSS injected via a plain <style> tag. styled-jsx's
// `<style jsx global>` requires a Client Component, but we keep this
// page as a Server Component so the `metadata` export can do its job.
const PRINT_STYLES = `
  @page { size: A4; margin: 15mm; }
  @media print {
    .no-print { display: none !important; }
    .page-break-after { page-break-after: always; }
    html, body { background: white !important; }
    a { color: inherit !important; text-decoration: none !important; }
  }
`;

export default function BrochurePage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      <main className="min-h-screen bg-white text-slate-900 print:bg-white">
        {/* Toolbar lives in a client component — onClick={window.print}
            can't run from a server component. The toolbar has its own
            .no-print + .pdf-hide so it doesn't appear in the downloaded
            PDF either. */}
        <PrintButton />

        {/* Everything inside #brochure-content is what the Download PDF
            button captures via html2canvas. */}
        <div id="brochure-content">

        {/* PAGE 1 — Cover */}
        <section className="max-w-4xl mx-auto px-8 pt-12 pb-16 page-break-after">
          {/* Logo + brand */}
          <div className="flex items-center gap-4 mb-10">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-cyan to-brand-navy flex items-center justify-center shadow-xl shadow-cyan-500/20">
              <span className="text-4xl font-black text-white font-display">
                ن
              </span>
            </div>
            <div>
              {/* Solid color (not gradient-clip-text) — html2canvas-pro
                  can't render the bg-clip-text trick into the PDF, the
                  text shows up blank. Solid color survives the capture. */}
              <div className="text-4xl font-black font-display text-brand-cyan-dark">
                نِظام
              </div>
              <div className="text-xs tracking-[0.3em] text-amber-600 font-bold mt-0.5">
                NIDHAM · HR · AI · EGYPT
              </div>
            </div>
          </div>

          {/* Hero */}
          <div className="mb-12">
            <div className="inline-block px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold mb-4 font-cairo">
              ✨ شغّال دلوقتي عند 2 شركة بـ 200+ موظف
            </div>
            <h1 className="text-5xl md:text-6xl font-black font-cairo text-slate-900 leading-tight mb-4">
              نظام HR + AI<br />
              {/* Solid brand-cyan-dark — see header note above */}
              <span className="text-brand-cyan-dark">للشركات المصرية</span>
            </h1>
            <p className="text-xl text-slate-600 font-cairo leading-relaxed max-w-2xl">
              مرتبات بقانون 2026، نماذج تأمينات تلقائية، AI بينفّذ، وحضور
              بالـ GPS — كله في برنامج واحد. بـ <strong className="text-brand-cyan-dark">ربع تكلفة Bayzat</strong>.
            </p>
          </div>

          {/* 3 big benefit cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            <BenefitCard
              icon="⚡"
              title="وفّر 20+ ساعة HR شهرياً"
              body="استيراد ZKTeco بـ AI، payroll في 5 دقايق، نماذج تأمينات بنقرة"
              color="cyan"
            />
            <BenefitCard
              icon="🛡"
              title="صفر غرامات تأمينات"
              body="حسابات قانونية صح: ÷26، 11% SI، شرايح ضريبة 2026، Overtime تلقائي"
              color="emerald"
            />
            <BenefitCard
              icon="💰"
              title="1,500 ج/شهر — مش 10,000"
              body="مقارنة بـ Bayzat بـ 10,000+، Nidham 5-10× أرخص بنفس القوة"
              color="amber"
            />
          </div>

          {/* CTA card */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-brand-cyan-dark via-brand-cyan to-brand-navy text-white shadow-xl">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs tracking-wider opacity-80 mb-1 font-cairo">
                  🎁 برنامج Beta
                </div>
                <div className="text-2xl font-black font-cairo mb-1">
                  3 شهور مجاناً + 50% خصم لسنة
                </div>
                <div className="text-sm opacity-90 font-cairo">
                  لأول 10 شركات بس · في 7 منهم اشتركوا
                </div>
              </div>
              <a
                href="https://wa.me/201055356622?text=أهلاً، عايز أعرف عن Nidham Beta"
                className="px-6 py-3 rounded-xl bg-white text-brand-cyan-dark font-black font-cairo whitespace-nowrap"
              >
                💬 احجز مكانك
              </a>
            </div>
          </div>
        </section>

        {/* PAGE 2 — The Problem + Solution */}
        <section className="max-w-4xl mx-auto px-8 pb-16 page-break-after">
          <div className="grid md:grid-cols-2 gap-12 mb-12">
            {/* Problem */}
            <div>
              <div className="text-xs tracking-wider text-rose-600 font-black uppercase mb-3 font-cairo">
                المشكلة
              </div>
              <h2 className="text-3xl font-black font-cairo text-slate-900 mb-5">
                HR في شركتك<br />= Excel + WhatsApp + شكاوي
              </h2>
              <ul className="space-y-3 font-cairo text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">😩</span>
                  <span>فريق HR بياخد <strong>30+ ساعة</strong> شهرياً على المرتبات والحضور</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">⚖</span>
                  <span>غرامات تأمينات بسبب حسابات غلط = <strong>100k ج/سنة</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">📉</span>
                  <span>موظفين بيشكوا من تأخر المرتبات وضياع طلبات الإجازات</span>
                </li>
              </ul>
            </div>

            {/* Solution */}
            <div>
              <div className="text-xs tracking-wider text-emerald-600 font-black uppercase mb-3 font-cairo">
                الحل
              </div>
              <h2 className="text-3xl font-black font-cairo text-slate-900 mb-5">
                نِظام يحلّ كل ده<br />في برنامج واحد
              </h2>
              <ul className="space-y-3 font-cairo text-slate-700">
                <li className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">⚡</span>
                  <span>استيراد ZKTeco بـ AI + payroll تلقائي</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">📋</span>
                  <span>كل نماذج التأمينات (1، 2، 6) بنقرة واحدة</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">📱</span>
                  <span>تطبيق موبايل للموظفين — حضور بالـ GPS + طلبات</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Big features grid */}
          <div className="mb-12">
            <h3 className="text-2xl font-black font-cairo text-slate-900 mb-6 text-center">
              ✨ كل اللي محتاجه في برنامج واحد
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: "👥", label: "إدارة موظفين" },
                { icon: "⏰", label: "حضور + GPS" },
                { icon: "💰", label: "مرتبات قانونية" },
                { icon: "🏝", label: "إجازات" },
                { icon: "📊", label: "تقييم أداء" },
                { icon: "📦", label: "إدارة أصول" },
                { icon: "🌳", label: "هيكل تنظيمي" },
                { icon: "📅", label: "تقويم إجازات" },
                { icon: "🤖", label: "AI Agent" },
                { icon: "✦", label: "Marketing Studio" },
                { icon: "🔐", label: "2FA + تشفير" },
                { icon: "📋", label: "نماذج رسمية" },
              ].map((f) => (
                <FeatureChip key={f.label} icon={f.icon} label={f.label} />
              ))}
            </div>
          </div>

          {/* Why Egyptian-specific */}
          <div className="p-6 rounded-2xl bg-amber-50 border-2 border-amber-300">
            <h3 className="text-xl font-black font-cairo text-amber-900 mb-4 flex items-center gap-2">
              <span>🇪🇬</span> ليه Nidham مش "نسخة معرّبة" — مبني لمصر
            </h3>
            <div className="grid md:grid-cols-2 gap-4 font-cairo text-sm">
              <ComparePair
                label="الراتب اليومي"
                bad="basic ÷ 30 (معظم البرامج)"
                good="basic ÷ 26 (الصحيح قانونياً)"
              />
              <ComparePair
                label="التأمينات 2026"
                bad="14% (قديم)"
                good="11% موظف + 18.75% صاحب عمل"
              />
              <ComparePair
                label="ضرايب 2026"
                bad="شرايح 2024"
                good="شريحة 0% للـ 40k الأولى"
              />
              <ComparePair
                label="نماذج التأمينات"
                bad="مش موجودة"
                good="نموذج 1، 2، 6 بنقرة"
              />
            </div>
          </div>
        </section>

        {/* PAGE 3 — Pricing + ROI */}
        <section className="max-w-4xl mx-auto px-8 pb-16 page-break-after">
          <h2 className="text-3xl font-black font-cairo text-slate-900 mb-2 text-center">
            💰 أسعار شفافة — اختار الباقة المناسبة
          </h2>
          <p className="text-center text-sm text-slate-500 font-cairo mb-8">
            ابدأ مجاناً، ادفع لما تكبر · 30 يوم ضمان استرداد
          </p>

          {/* Pricing grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
            <PriceCard
              name="مجاني"
              price="0"
              cap="حتى 5 موظفين"
              perfect="للتجربة"
            />
            <PriceCard
              name="Starter"
              price="500"
              cap="حتى 25 موظف"
              perfect="شركات صغيرة"
            />
            <PriceCard
              name="Pro"
              price="1,500"
              cap="حتى 100 موظف"
              perfect="الـ sweet spot"
              highlight
            />
            <PriceCard
              name="Business"
              price="3,500"
              cap="حتى 500 موظف"
              perfect="متوسطة"
            />
          </div>

          {/* ROI Table */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-50 to-cyan-50 border-2 border-emerald-300">
            <h3 className="text-xl font-black font-cairo text-emerald-900 mb-4 text-center">
              📊 ROI لشركة 100 موظف
            </h3>
            <table className="w-full text-sm font-cairo">
              <thead>
                <tr className="text-emerald-700 border-b-2 border-emerald-200">
                  <th className="text-right py-2 font-bold">البند</th>
                  <th className="text-center py-2 font-bold">بدون Nidham</th>
                  <th className="text-center py-2 font-bold">مع Nidham</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-emerald-100">
                  <td className="py-2 text-slate-700">محاسب خارجي</td>
                  <td className="text-center text-slate-700">15,000 ج/شهر</td>
                  <td className="text-center text-emerald-700 font-bold">0</td>
                </tr>
                <tr className="border-b border-emerald-100">
                  <td className="py-2 text-slate-700">وقت HR (30 ساعة)</td>
                  <td className="text-center text-slate-700">1,500 ج/شهر</td>
                  <td className="text-center text-emerald-700 font-bold">250 ج/شهر</td>
                </tr>
                <tr className="border-b border-emerald-100">
                  <td className="py-2 text-slate-700">اشتراك Nidham</td>
                  <td className="text-center text-slate-700">—</td>
                  <td className="text-center text-emerald-700 font-bold">1,500 ج/شهر</td>
                </tr>
                <tr className="bg-emerald-100">
                  <td className="py-3 text-emerald-900 font-black">الإجمالي شهرياً</td>
                  <td className="text-center text-rose-700 font-black text-lg">16,500</td>
                  <td className="text-center text-emerald-700 font-black text-lg">1,750</td>
                </tr>
              </tbody>
            </table>
            <div className="text-center mt-4 p-3 rounded-xl bg-white border-2 border-emerald-400">
              <span className="text-sm text-slate-700 font-cairo">التوفير الشهري: </span>
              <span className="text-3xl font-black text-emerald-700 font-display">
                14,750 ج
              </span>
              <span className="text-sm text-slate-500 font-cairo"> = 177,000 ج/سنة</span>
            </div>
          </div>
        </section>

        {/* PAGE 4 — Final CTA */}
        <section className="max-w-4xl mx-auto px-8 pb-20">
          <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-brand-navy to-slate-900 text-white text-center">
            <div className="inline-block px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold mb-4 font-cairo">
              🎁 برنامج Beta — 7 مكان متاح
            </div>
            <h2 className="text-4xl font-black font-cairo mb-3">
              ابدأ Nidham النهاردة
            </h2>
            <p className="text-cyan-100 mb-8 font-cairo max-w-xl mx-auto">
              3 شهور مجاناً + 50% خصم سنة كاملة لأول 10 شركات.
              <br />
              في مقابل: استخدام النظام فعلياً + اجتماع feedback كل أسبوعين.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <a
                href="https://wa.me/201055356622?text=أهلاً، عايز أبدأ Nidham Beta"
                className="px-6 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black font-cairo text-lg transition"
              >
                💬 احجز Beta عبر WhatsApp
              </a>
              <a
                href="https://nidhamhr.com/signup"
                className="px-6 py-4 rounded-2xl bg-brand-cyan hover:bg-brand-cyan-dark text-white font-black font-cairo text-lg transition"
              >
                🚀 ابدأ مجاناً دلوقتي
              </a>
            </div>

            {/* Contact info — pulled from the live landing page footer
                so it stays in sync. Update both places together if any
                of these changes. */}
            <div className="grid md:grid-cols-3 gap-4 pt-6 border-t border-white/20 text-sm font-cairo">
              <div>
                <div className="text-amber-300 font-bold mb-1">📱 واتساب</div>
                <a
                  href="https://wa.me/201055356622"
                  className="font-mono hover:text-amber-200"
                  dir="ltr"
                >
                  +20 105 535 6622
                </a>
              </div>
              <div>
                <div className="text-amber-300 font-bold mb-1">📧 إيميل</div>
                <a
                  href="mailto:nidhamhr@proton.me"
                  className="font-mono hover:text-amber-200"
                  dir="ltr"
                >
                  nidhamhr@proton.me
                </a>
              </div>
              <div>
                <div className="text-amber-300 font-bold mb-1">🌐 الموقع</div>
                <a
                  href="https://nidhamhr.com"
                  className="font-mono hover:text-amber-200 text-xs"
                  dir="ltr"
                >
                  nidhamhr.com
                </a>
              </div>
            </div>
          </div>

          {/* Footer signature */}
          <div className="mt-8 text-center text-xs text-slate-500 font-cairo">
            <p>صدر هذا الـ Brochure من HR BASEM AZAB · مبني في دمياط، مصر · v1.0 · 2026</p>
          </div>
        </section>

        </div>{/* /#brochure-content */}
      </main>
    </>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function BenefitCard({
  icon,
  title,
  body,
  color,
}: {
  icon: string;
  title: string;
  body: string;
  color: "cyan" | "emerald" | "amber";
}) {
  const colorMap = {
    cyan: "from-cyan-50 to-white border-cyan-200",
    emerald: "from-emerald-50 to-white border-emerald-200",
    amber: "from-amber-50 to-white border-amber-200",
  };
  return (
    <div className={`p-5 rounded-2xl bg-gradient-to-br ${colorMap[color]} border-2`}>
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-black font-cairo text-slate-900 mb-2 leading-tight">
        {title}
      </div>
      <p className="text-xs text-slate-600 font-cairo leading-relaxed">
        {body}
      </p>
    </div>
  );
}

function FeatureChip({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center hover:border-brand-cyan transition">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xs font-bold text-slate-700 font-cairo">{label}</div>
    </div>
  );
}

function ComparePair({
  label,
  bad,
  good,
}: {
  label: string;
  bad: string;
  good: string;
}) {
  return (
    <div>
      <div className="text-xs font-black text-amber-700 mb-1">{label}</div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-rose-600 line-through opacity-70">{bad}</span>
        <span className="text-emerald-600 font-bold">→ {good}</span>
      </div>
    </div>
  );
}

function PriceCard({
  name,
  price,
  cap,
  perfect,
  highlight,
}: {
  name: string;
  price: string;
  cap: string;
  perfect: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 rounded-2xl border-2 text-center ${
        highlight
          ? "border-brand-cyan bg-gradient-to-b from-brand-cyan/10 to-white shadow-xl scale-105"
          : "border-slate-200 bg-white"
      }`}
    >
      {highlight && (
        <div className="text-[10px] font-black text-amber-600 mb-1 font-cairo">
          ⭐ الأكثر شعبية
        </div>
      )}
      <div className="text-base font-black font-cairo text-slate-800 mb-1">
        {name}
      </div>
      <div className="mb-2">
        <span className="text-3xl font-black font-display text-slate-900">
          {price}
        </span>
        <span className="text-xs text-slate-500"> ج/شهر</span>
      </div>
      <div className="text-[10px] text-slate-500 font-cairo mb-2">{cap}</div>
      <div className="text-[10px] text-brand-cyan-dark font-bold font-cairo">
        {perfect}
      </div>
    </div>
  );
}
