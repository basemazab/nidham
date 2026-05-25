// ============================================================================
// /ads/compare — 1080×1350 head-to-head comparison ad creative
// ============================================================================
//
// Vertical 4:5 ad creative aimed at the "should I pick Nidham over Bayzat /
// ZenHR" decision. The previous ad creatives lean on pain (Excel chaos),
// math (177k savings), and fear (compliance fines). This one is pure
// competitive comparison — the question every Egyptian SMB owner who's
// shopping for HR software actually asks out loud.
//
// Why 1080×1350 (and not the 1080×1080 the older ads use)?
//   - Facebook recommends 4:5 vertical for News Feed (takes ~78% of the
//     mobile viewport vs 56% for a square)
//   - More vertical real estate = room for 3 plan columns + 6 comparison
//     rows + a Beta offer footer without anything feeling cramped
//
// Design vocabulary matches the existing ad cards (gradient nav→cyan bg,
// amber gold for the price callout, Cairo display weight) so the campaign
// reads as one brand instead of three random posts.
//
// Capture: scripts/capture-social-assets.ts will pick this up next run.

export const metadata = {
  title: "Compare — Nidham vs Bayzat vs ZenHR",
  robots: { index: false, follow: false },
};

export default function ComparisonAdPage() {
  return (
    <main className="min-h-screen bg-slate-200 flex flex-col items-center justify-start py-8 print:bg-white print:py-0">
      {/* Instructions banner — clipped out of the screenshot */}
      <div className="no-print max-w-2xl mb-6 mx-4 p-4 rounded-2xl bg-white border-2 border-amber-300 text-sm font-cairo">
        <h2 className="font-black text-amber-900 mb-2">
          📸 إعلان مقارنة — Facebook + Instagram Feed (1080×1350)
        </h2>
        <ol className="space-y-1 text-slate-700 list-decimal pr-5">
          <li>Zoom المتصفح = 100% (Ctrl+0)</li>
          <li>Snipping Tool → اقص المستطيل الطولي بالكامل</li>
          <li>ارفعها كـ paid ad creative على Meta Ads Manager</li>
        </ol>
        <p className="mt-2 text-xs text-slate-500">
          أو حمّلها من: <code>nidhamhr.com/marketing/nidham-ad-compare.png</code>
        </p>
      </div>

      {/* THE CREATIVE — 1080×1350 vertical (4:5 aspect, FB-recommended) */}
      <div
        className="shadow-2xl overflow-hidden relative"
        style={{ width: "1080px", height: "1350px" }}
      >
        <div
          className="w-full h-full relative font-cairo"
          style={{
            background:
              "linear-gradient(165deg, #0a1428 0%, #0e1d3a 35%, #0891b2 85%, #22d3ee 100%)",
          }}
        >
          {/* Decorative gold orb top-right + cyan glow bottom-left for depth */}
          <div
            className="absolute rounded-full blur-3xl"
            style={{
              width: "500px",
              height: "500px",
              top: "-100px",
              right: "-100px",
              background: "radial-gradient(circle, #c9a84c 0%, transparent 70%)",
              opacity: 0.3,
            }}
          />
          <div
            className="absolute rounded-full blur-3xl"
            style={{
              width: "400px",
              height: "400px",
              bottom: "-50px",
              left: "-50px",
              background: "radial-gradient(circle, #22d3ee 0%, transparent 70%)",
              opacity: 0.25,
            }}
          />

          {/* Subtle dot grid for texture */}
          <div
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                "radial-gradient(circle, white 1.5px, transparent 2px)",
              backgroundSize: "40px 40px",
            }}
          />

          {/* HEADER — brand bar + provocative hook */}
          <div className="relative px-14 pt-14 pb-6">
            <div className="flex items-center justify-between mb-8">
              {/* Logo + wordmark */}
              <div className="flex items-center gap-3">
                <div
                  className="rounded-2xl flex items-center justify-center shadow-lg"
                  style={{
                    width: "70px",
                    height: "70px",
                    background:
                      "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)",
                  }}
                >
                  <span className="text-4xl font-black text-white font-display">
                    ن
                  </span>
                </div>
                <div>
                  <div className="text-3xl font-black text-white font-display">
                    نِظام
                  </div>
                  <div
                    className="text-amber-300 font-bold tracking-[0.3em]"
                    style={{ fontSize: "11px" }}
                  >
                    HR · AI · EGYPT
                  </div>
                </div>
              </div>
              <div className="text-cyan-100/70 font-mono text-sm" dir="ltr">
                nidhamhr.com
              </div>
            </div>

            {/* The hook */}
            <div
              className="inline-block px-4 py-2 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-300 font-bold tracking-wider mb-5"
              style={{ fontSize: "14px" }}
            >
              🥊 المقارنة الصريحة
            </div>
            <h1
              className="font-black text-white leading-tight"
              style={{ fontSize: "62px" }}
            >
              ليه شركتك بتدفع
              <br />
              <span className="text-amber-300">10,000+ ج/شهر</span>
              <br />
              في نظام HR؟
            </h1>
          </div>

          {/* COMPARISON TABLE — 3 columns × 6 rows */}
          <div className="relative px-14 mb-7">
            <div
              className="rounded-3xl overflow-hidden shadow-2xl"
              style={{ background: "rgba(255, 255, 255, 0.97)" }}
            >
              {/* Table header */}
              <div className="grid grid-cols-4 bg-slate-900 text-white">
                <div className="p-4 text-center font-bold text-sm">
                  المقارنة
                </div>
                <Col title="Bayzat" muted />
                <Col title="ZenHR" muted />
                <Col title="نِظام" highlight />
              </div>

              {/* Row 1 — Price (the killer row) */}
              <Row
                label="السعر/شهر"
                sub="لـ 100 موظف"
                bayzat={<Price big="10,000+" />}
                zenhr={<Price big="8,000+" />}
                nidham={<Price big="1,500" winner />}
              />

              {/* Row 2 — Egyptian tax forms */}
              <Row
                label="نماذج التأمينات"
                sub="نموذج 1، 2، 6"
                bayzat={<X />}
                zenhr={<X />}
                nidham={<Check winner />}
              />

              {/* Row 3 — 2026 tax tables */}
              <Row
                label="ضرايب 2026"
                sub="الشرايح الجديدة"
                bayzat={<X warn />}
                zenhr={<X warn />}
                nidham={<Check winner />}
              />

              {/* Row 4 — AI Agent */}
              <Row
                label="AI Agent"
                sub="بالعربي المصري"
                bayzat={<X />}
                zenhr={<X />}
                nidham={<Check winner />}
              />

              {/* Row 5 — Mobile app */}
              <Row
                label="موبايل app"
                sub="GPS attendance"
                bayzat={<Check />}
                zenhr={<Check />}
                nidham={<Check winner />}
              />

              {/* Row 6 — Audit log */}
              <Row
                label="Audit log Immutable"
                sub="للتفتيش القانوني"
                bayzat={<X />}
                zenhr={<X />}
                nidham={<Check winner />}
                last
              />
            </div>
          </div>

          {/* BOTTOM CTA + Beta callout */}
          <div className="absolute bottom-0 left-0 right-0 px-14 pb-12">
            <div
              className="rounded-3xl p-6 shadow-2xl"
              style={{
                background:
                  "linear-gradient(135deg, #c9a84c 0%, #f4e9c9 50%, #c9a84c 100%)",
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div
                    className="text-slate-900 font-bold tracking-wider mb-1"
                    style={{ fontSize: "13px" }}
                  >
                    🎁 برنامج Beta — أول 10 شركات
                  </div>
                  <div
                    className="text-slate-900 font-black leading-tight"
                    style={{ fontSize: "32px" }}
                  >
                    3 شهور مجاناً
                    <span className="text-slate-700" style={{ fontSize: "22px" }}>
                      {" "}
                      + 50% خصم سنة
                    </span>
                  </div>
                </div>
                <div
                  className="px-6 py-4 rounded-2xl bg-slate-900 text-white font-black"
                  style={{ fontSize: "22px" }}
                >
                  ابدأ →
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Table helpers ────────────────────────────────────────────────────────

function Col({
  title,
  muted,
  highlight,
}: {
  title: string;
  muted?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-4 text-center font-black text-base ${
        highlight ? "bg-brand-cyan-dark text-white" : "text-white"
      } ${muted ? "opacity-70" : ""}`}
    >
      {title}
    </div>
  );
}

function Row({
  label,
  sub,
  bayzat,
  zenhr,
  nidham,
  last,
}: {
  label: string;
  sub?: string;
  bayzat: React.ReactNode;
  zenhr: React.ReactNode;
  nidham: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-4 items-center ${
        last ? "" : "border-b border-slate-200"
      }`}
    >
      <div className="p-4 text-right">
        <div className="font-bold text-slate-900 text-sm">{label}</div>
        {sub && <div className="text-xs text-slate-500">{sub}</div>}
      </div>
      <div className="p-4 text-center">{bayzat}</div>
      <div className="p-4 text-center">{zenhr}</div>
      <div className="p-4 text-center bg-cyan-50/50">{nidham}</div>
    </div>
  );
}

function Check({ winner }: { winner?: boolean }) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full ${
        winner
          ? "bg-emerald-500 text-white"
          : "bg-emerald-100 text-emerald-700"
      }`}
      style={{ width: "36px", height: "36px", fontSize: "22px" }}
    >
      ✓
    </div>
  );
}

function X({ warn }: { warn?: boolean }) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-full ${
        warn ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
      }`}
      style={{ width: "36px", height: "36px", fontSize: "22px" }}
    >
      {warn ? "⚠" : "✗"}
    </div>
  );
}

function Price({ big, winner }: { big: string; winner?: boolean }) {
  return (
    <div className="text-center">
      <div
        className={`font-black font-display ${
          winner ? "text-emerald-600" : "text-slate-700"
        }`}
        style={{ fontSize: "26px", lineHeight: "1" }}
      >
        {big}
      </div>
      <div className="text-[10px] text-slate-500 mt-1">ج</div>
    </div>
  );
}
