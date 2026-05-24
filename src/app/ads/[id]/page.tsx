// ============================================================================
// /ads/[id] — Static 1080×1080 ad creative templates for Meta Ads
// ============================================================================
//
// Three ready-to-screenshot square creatives for the Nidham launch
// campaign. Each renders at a fixed 1080×1080 viewport in pure CSS so HR
// (read: Basem) can:
//
//   1. Open https://nidhamhr.com/ads/<id> in a browser
//   2. Set browser zoom to 100% (Ctrl+0)
//   3. Use Windows Snipping Tool / Cmd+Shift+4 on Mac to clip the square
//   4. Upload as an image asset in Meta Ads Manager
//
// Why not Canva? Two reasons:
//   • No external dependency — works offline once nidhamhr.com is up
//   • Re-generates cleanly when copy changes (just edit this file +
//     deploy, no Canva project to keep in sync)
//
// Why 3 variants? Meta needs 3-5 creatives to learn — running a single
// ad gives the algorithm nothing to optimize against. The three angles
// here cover the three reasons an Egyptian SMB buys HR software:
//   1. PAIN     — Excel chaos / wasted time
//   2. ROI      — 14,750 EGP/month savings math
//   3. COMPLIANCE — fear of 100k EGP tax fines
//
// Each variant uses the exact same brand colours + logo treatment so
// they feel like a coherent campaign rather than three random posts.

import { notFound } from "next/navigation";

type AdId = "pain" | "roi" | "compliance";

const VALID_IDS: AdId[] = ["pain", "roi", "compliance"];

type Props = {
  params: Promise<{ id: string }>;
};

export const metadata = {
  // Don't index ad-creative pages in Google — they're internal assets,
  // not user-facing landing pages.
  robots: { index: false, follow: false },
};

export default async function AdCreativePage({ params }: Props) {
  const { id } = await params;
  if (!VALID_IDS.includes(id as AdId)) notFound();

  return (
    <main className="min-h-screen bg-slate-200 flex flex-col items-center justify-start py-8 print:bg-white print:py-0">
      {/* Instructions banner — hidden when printing/screenshotting */}
      <div className="no-print max-w-2xl mb-6 mx-4 p-4 rounded-2xl bg-white border-2 border-amber-300 text-sm font-cairo">
        <h2 className="font-black text-amber-900 mb-2">
          📸 طريقة استخدام التصميم ده
        </h2>
        <ol className="space-y-1 text-slate-700 list-decimal pr-5">
          <li>
            تأكد إن zoom المتصفح <strong>100%</strong> (اضغط Ctrl+0)
          </li>
          <li>
            افتح <strong>Snipping Tool</strong> (Windows) أو{" "}
            <strong>Cmd+Shift+4</strong> (Mac)
          </li>
          <li>اقص المربع الأبيض اللي تحت بالظبط (1080×1080)</li>
          <li>احفظ الصورة → ارفعها في Meta Ads Manager</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          الـ 3 variants:{" "}
          <a href="/ads/pain" className="text-brand-cyan-dark hover:underline">
            pain
          </a>{" "}
          ·{" "}
          <a href="/ads/roi" className="text-brand-cyan-dark hover:underline">
            roi
          </a>{" "}
          ·{" "}
          <a
            href="/ads/compliance"
            className="text-brand-cyan-dark hover:underline"
          >
            compliance
          </a>
        </p>
      </div>

      {/* The actual 1080×1080 creative. The container is exactly 1080px ×
          1080px so screenshots come out at 1:1 with Meta's preferred size. */}
      <div
        className="bg-white shadow-2xl overflow-hidden"
        style={{ width: "1080px", height: "1080px" }}
      >
        {id === "pain" && <PainAd />}
        {id === "roi" && <RoiAd />}
        {id === "compliance" && <ComplianceAd />}
      </div>
    </main>
  );
}

// ============================================================================
// Ad 1: PAIN — Excel chaos
// ============================================================================
//
// Hook: "30 ساعة شهرياً + 100,000 ج غرامات = Excel ضد شركتك"
// Visual: red ❌ over Excel sheet → green ✓ Nidham
// Emotion: frustration → relief
function PainAd() {
  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-rose-50 via-white to-cyan-50 relative font-cairo">
      {/* Top brand bar */}
      <div className="px-12 py-6 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy flex items-center justify-center shadow-lg">
            <span className="text-3xl font-black text-white font-display">ن</span>
          </div>
          <div>
            <div className="text-2xl font-black text-brand-cyan-dark font-display">
              نِظام
            </div>
            <div className="text-[10px] tracking-[0.3em] text-amber-600 font-bold">
              HR · AI · EGYPT
            </div>
          </div>
        </div>
        <div className="text-[11px] text-slate-500 font-bold">
          nidhamhr.com
        </div>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col justify-center px-14">
        <div className="text-rose-600 text-7xl mb-4 leading-none">😩</div>
        <h1 className="text-[58px] leading-[1.1] font-black text-slate-900 mb-6">
          لسة بتدير<br />
          المرتبات على<br />
          <span className="line-through decoration-rose-600 decoration-[6px]">
            Excel
          </span>
          ؟
        </h1>

        <div className="space-y-3 mb-8">
          <Stat color="rose" label="ساعة شهرياً ضايعة" value="30+" />
          <Stat color="rose" label="ج/سنة غرامات تأمينات" value="100,000" />
        </div>

        <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-300">
          <div className="text-xs font-bold text-emerald-700 mb-1 tracking-wider">
            ✓ الحل
          </div>
          <div className="text-2xl font-black text-slate-900">
            نِظام = نظام HR + AI كامل
          </div>
          <div className="text-sm text-slate-600 mt-1">
            مرتبات تلقائية + نماذج التأمينات بنقرة + موبايل app
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="px-12 py-7 bg-gradient-to-r from-brand-cyan-dark to-brand-navy text-white flex items-center justify-between">
        <div>
          <div className="text-xs opacity-80 tracking-wider mb-1">
            🎁 برنامج Beta
          </div>
          <div className="text-2xl font-black">3 شهور مجاناً</div>
        </div>
        <div className="px-7 py-4 rounded-2xl bg-white text-brand-cyan-dark font-black text-lg">
          سجّل دلوقتي →
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Ad 2: ROI — 14,750 EGP/month savings math
// ============================================================================
//
// Hook: clear before/after numbers stacked side-by-side
// Visual: red 16,500 vs green 1,750 → big delta highlighted
// Emotion: greed / opportunity
function RoiAd() {
  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-emerald-50 via-white to-cyan-50 font-cairo">
      <div className="px-12 py-6 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy flex items-center justify-center shadow-lg">
            <span className="text-3xl font-black text-white font-display">ن</span>
          </div>
          <div>
            <div className="text-2xl font-black text-brand-cyan-dark font-display">
              نِظام
            </div>
            <div className="text-[10px] tracking-[0.3em] text-amber-600 font-bold">
              HR · AI · EGYPT
            </div>
          </div>
        </div>
        <div className="text-[11px] text-slate-500 font-bold">
          nidhamhr.com
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-14">
        <div className="text-xs tracking-[0.3em] font-black text-emerald-700 mb-2">
          شركة بـ 100 موظف
        </div>
        <h1 className="text-[54px] leading-[1.1] font-black text-slate-900 mb-10">
          كام بتدفع شهرياً<br />
          على HR + مرتبات؟
        </h1>

        {/* Before / After */}
        <div className="grid grid-cols-2 gap-5 mb-8">
          <div className="p-6 rounded-3xl bg-rose-50 border-2 border-rose-300">
            <div className="text-xs font-bold text-rose-700 mb-2 tracking-wider">
              ❌ بدون نِظام
            </div>
            <div className="text-5xl font-black text-rose-600 mb-1 font-display">
              16,500
            </div>
            <div className="text-xs text-slate-600">جنيه/شهر</div>
            <div className="text-[10px] text-slate-500 mt-3 leading-tight">
              محاسب خارجي + وقت HR
            </div>
          </div>
          <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-400">
            <div className="text-xs font-bold text-emerald-700 mb-2 tracking-wider">
              ✓ مع نِظام
            </div>
            <div className="text-5xl font-black text-emerald-600 mb-1 font-display">
              1,750
            </div>
            <div className="text-xs text-slate-600">جنيه/شهر</div>
            <div className="text-[10px] text-slate-500 mt-3 leading-tight">
              اشتراك Pro + دقايق HR
            </div>
          </div>
        </div>

        {/* Big delta */}
        <div className="p-5 rounded-2xl bg-amber-50 border-2 border-amber-400 text-center">
          <div className="text-xs font-bold text-amber-700 tracking-wider mb-1">
            💰 توفير سنوي
          </div>
          <div className="text-5xl font-black text-amber-700 font-display">
            177,000 ج
          </div>
        </div>
      </div>

      <div className="px-12 py-7 bg-gradient-to-r from-brand-cyan-dark to-brand-navy text-white flex items-center justify-between">
        <div>
          <div className="text-xs opacity-80 tracking-wider mb-1">
            احسب التوفير بتاع شركتك
          </div>
          <div className="text-xl font-black">Beta = 50% خصم سنة كاملة</div>
        </div>
        <div className="px-7 py-4 rounded-2xl bg-white text-brand-cyan-dark font-black text-lg">
          سجّل دلوقتي →
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Ad 3: COMPLIANCE — avoid tax fines
// ============================================================================
//
// Hook: "غرامات تأمينات 2026 = 10,000 - 100,000 ج"
// Visual: warning ⚠️ + checklist of compliance items
// Emotion: fear → safety
function ComplianceAd() {
  return (
    <div className="w-full h-full flex flex-col bg-gradient-to-br from-amber-50 via-white to-cyan-50 font-cairo">
      <div className="px-12 py-6 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-cyan to-brand-navy flex items-center justify-center shadow-lg">
            <span className="text-3xl font-black text-white font-display">ن</span>
          </div>
          <div>
            <div className="text-2xl font-black text-brand-cyan-dark font-display">
              نِظام
            </div>
            <div className="text-[10px] tracking-[0.3em] text-amber-600 font-bold">
              HR · AI · EGYPT
            </div>
          </div>
        </div>
        <div className="text-[11px] text-slate-500 font-bold">
          nidhamhr.com
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-14">
        <div className="text-7xl mb-4">🚨</div>
        <h1 className="text-[54px] leading-[1.1] font-black text-slate-900 mb-3">
          غرامات تأمينات<br />
          <span className="text-amber-700">2026</span>
        </h1>
        <div className="text-3xl font-black text-rose-600 mb-7 font-display">
          10,000 - 100,000 ج
        </div>

        <div className="space-y-2 mb-8">
          <ComplianceItem text="شرايح ضريبة 2026 الجديدة" />
          <ComplianceItem text="نسبة التأمينات 11% + 18.75%" />
          <ComplianceItem text="نموذج 6 لما موظف يستقيل" />
          <ComplianceItem text="Overtime: 35% / 50% / 100%" />
        </div>

        <div className="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-400">
          <div className="text-xs font-bold text-emerald-700 mb-1 tracking-wider">
            ✓ نِظام بيحسب كل ده تلقائياً
          </div>
          <div className="text-xl font-black text-slate-900">
            صفر غرامات · 100% قانون مصري
          </div>
        </div>
      </div>

      <div className="px-12 py-7 bg-gradient-to-r from-brand-cyan-dark to-brand-navy text-white flex items-center justify-between">
        <div>
          <div className="text-xs opacity-80 tracking-wider mb-1">
            مبني خصيصاً لمصر — مش "نسخة معرّبة"
          </div>
          <div className="text-xl font-black">demo مجاناً 20 دقيقة</div>
        </div>
        <div className="px-7 py-4 rounded-2xl bg-white text-brand-cyan-dark font-black text-lg">
          احجز الآن →
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Small reusable bits
// ============================================================================

function Stat({
  color,
  label,
  value,
}: {
  color: "rose" | "emerald";
  label: string;
  value: string;
}) {
  const cls = color === "rose" ? "text-rose-600" : "text-emerald-600";
  return (
    <div className="flex items-baseline gap-4">
      <div className={`text-4xl font-black font-display ${cls}`}>{value}</div>
      <div className="text-sm text-slate-700">{label}</div>
    </div>
  );
}

function ComplianceItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 text-base text-slate-700">
      <span className="text-emerald-600 text-xl">✓</span>
      <span>{text}</span>
    </div>
  );
}
