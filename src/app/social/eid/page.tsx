// ============================================================================
// /social/eid — Eid Al-Adha 1447H greeting card (1080x1080 social post)
// ============================================================================
//
// Square (Facebook + Instagram feed) Eid greeting branded for Nidham. Two
// jobs at once:
//   1. Be a culturally-appropriate, warm holiday greeting people want to
//      engage with (likes / comments / shares).
//   2. Plant Nidham as the brand quietly in the bottom-right — never the
//      headline, always the signature. People HATE brands that ride on
//      religious holidays for hard sales; soft signature is the right
//      register.
//
// Visual recipe:
//   - Navy → cyan diagonal gradient (Nidham brand)
//   - Subtle Islamic geometric star pattern as background texture (CSS,
//     no external images — keeps the page snappy and screenshot-friendly)
//   - Crescent moon + 3 stars in amber gold at the top
//   - "عيد أضحى مبارك" in display-weight Cairo, gold-on-gold gradient
//   - Smaller "كل عام وأنتم بخير" subtitle
//   - "من فريق نِظام" signature
//   - Bottom strip: Nidham wordmark + nidhamhr.com URL (small, dignified)
//
// Why no marketing CTA? Selling on Eid feels gross. The brand mark at the
// bottom is the entire ROI — anyone who likes/shares/screenshots this
// post is exposing more eyes to Nidham. The conversation comes later.

export const metadata = {
  title: "عيد أضحى مبارك — Nidham",
  robots: { index: false, follow: false },
};

export default function EidPostPage() {
  return (
    <main className="min-h-screen bg-slate-200 flex flex-col items-center justify-start py-8 print:bg-white print:py-0">
      {/* Instructions banner — clipped out of the screenshot. */}
      <div className="no-print max-w-2xl mb-6 mx-4 p-4 rounded-2xl bg-white border-2 border-amber-300 text-sm font-cairo">
        <h2 className="font-black text-amber-900 mb-2">
          📸 صورة عيد الأضحى — Facebook + Instagram Post
        </h2>
        <ol className="space-y-1 text-slate-700 list-decimal pr-5">
          <li>Zoom المتصفح = 100% (Ctrl+0)</li>
          <li>Snipping Tool → اقص المربع الأسود (1080×1080)</li>
          <li>ارفعها كـ post على Facebook + Instagram</li>
        </ol>
        <p className="mt-2 text-xs text-slate-500">
          أو حمّلها مباشرة من: <code>nidhamhr.com/marketing/nidham-eid-post.png</code>
        </p>
      </div>

      {/* THE CREATIVE — fixed 1080x1080 square */}
      <div
        className="shadow-2xl overflow-hidden relative"
        style={{ width: "1080px", height: "1080px" }}
      >
        <div
          className="w-full h-full relative"
          style={{
            background:
              "linear-gradient(135deg, #0a1428 0%, #0e1d3a 35%, #0891b2 80%, #22d3ee 100%)",
          }}
        >
          {/* Islamic geometric pattern overlay — pure CSS dots in an
              8-pointed star arrangement. Faded so the wordmark stays
              the focal point. */}
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: `
                radial-gradient(circle at 50% 50%, #f4e9c9 2px, transparent 2.5px),
                radial-gradient(circle at 0% 0%, #f4e9c9 1.5px, transparent 2px),
                radial-gradient(circle at 100% 100%, #f4e9c9 1.5px, transparent 2px)
              `,
              backgroundSize: "60px 60px, 60px 60px, 60px 60px",
            }}
          />

          {/* Decorative blurred gold orbs for depth */}
          <div
            className="absolute rounded-full blur-3xl"
            style={{
              width: "500px",
              height: "500px",
              top: "-100px",
              right: "-100px",
              background: "radial-gradient(circle, #c9a84c 0%, transparent 70%)",
              opacity: 0.35,
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

          {/* Top: Crescent + 3 stars */}
          <div className="absolute top-20 left-0 right-0 flex flex-col items-center gap-6">
            {/* Crescent moon — drawn with two overlapping circles */}
            <div className="relative" style={{ width: "140px", height: "140px" }}>
              <div
                className="absolute rounded-full"
                style={{
                  width: "140px",
                  height: "140px",
                  background:
                    "radial-gradient(circle at 30% 30%, #f4e9c9 0%, #c9a84c 60%, #8b6914 100%)",
                  boxShadow: "0 0 60px rgba(201, 168, 76, 0.5)",
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  width: "120px",
                  height: "120px",
                  top: "10px",
                  left: "30px",
                  background:
                    "linear-gradient(135deg, #0a1428 0%, #0e1d3a 100%)",
                }}
              />
            </div>

            {/* 3 stars sprinkled around */}
            <div className="flex items-center gap-12">
              <Star size={20} dim />
              <Star size={28} />
              <Star size={20} dim />
            </div>
          </div>

          {/* Center: The greeting — the entire reason this card exists */}
          <div
            className="absolute left-0 right-0 flex flex-col items-center text-center"
            style={{ top: "440px" }}
          >
            {/* Main calligraphy */}
            <div
              className="font-black font-cairo leading-tight mb-4"
              style={{
                fontSize: "120px",
                background:
                  "linear-gradient(180deg, #f4e9c9 0%, #c9a84c 60%, #8b6914 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "#c9a84c", /* fallback for screenshot tools that strip
                                     -webkit-text-fill-color (e.g. html2canvas) */
                textShadow: "0 4px 20px rgba(201, 168, 76, 0.3)",
              }}
            >
              عيد أضحى مبارك
            </div>

            {/* Subtitle */}
            <div
              className="text-cyan-50 font-cairo mb-7"
              style={{ fontSize: "44px", fontWeight: 300 }}
            >
              كل عام وأنتم بخير
            </div>

            {/* Decorative divider */}
            <div className="flex items-center gap-3 mb-7">
              <div style={{ width: "60px", height: "1px", background: "rgba(244, 233, 201, 0.5)" }} />
              <span className="text-amber-300 text-xl">✦</span>
              <div style={{ width: "60px", height: "1px", background: "rgba(244, 233, 201, 0.5)" }} />
            </div>

            {/* Signature */}
            <div
              className="text-cyan-100 font-cairo"
              style={{ fontSize: "32px", fontWeight: 500 }}
            >
              من فريق <span className="text-amber-300 font-bold">نِظام</span>
            </div>
            <div
              className="text-cyan-200/70 font-cairo mt-1"
              style={{ fontSize: "22px" }}
            >
              تقبّل الله منا ومنكم
            </div>
          </div>

          {/* Bottom strip: brand mark + URL */}
          <div className="absolute bottom-12 left-0 right-0 flex items-center justify-between px-12">
            {/* Logo + wordmark */}
            <div className="flex items-center gap-3">
              <div
                className="rounded-2xl flex items-center justify-center shadow-lg"
                style={{
                  width: "60px",
                  height: "60px",
                  background:
                    "linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)",
                }}
              >
                <span className="text-3xl font-black text-white font-display">
                  ن
                </span>
              </div>
              <div>
                <div className="text-2xl font-black text-white font-display">
                  نِظام
                </div>
                <div
                  className="text-amber-300/80 font-bold tracking-[0.3em]"
                  style={{ fontSize: "10px" }}
                >
                  HR · AI · EGYPT
                </div>
              </div>
            </div>

            {/* URL */}
            <div
              className="text-cyan-100/70 font-mono"
              style={{ fontSize: "16px" }}
              dir="ltr"
            >
              nidhamhr.com
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// Small reusable star — accepts a size and a `dim` flag for the side stars.
function Star({ size, dim }: { size: number; dim?: boolean }) {
  const color = dim ? "#c9a84c" : "#f4e9c9";
  const glow = dim
    ? "0 0 10px rgba(201, 168, 76, 0.4)"
    : "0 0 20px rgba(244, 233, 201, 0.6)";
  return (
    <span
      style={{
        fontSize: `${size}px`,
        color,
        textShadow: glow,
      }}
    >
      ✦
    </span>
  );
}
