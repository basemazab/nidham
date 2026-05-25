// ============================================================================
// /social/eid-story — Vertical 1080x1920 story card for Eid Al-Adha
// ============================================================================
//
// Companion to /social/eid. Same warm Eid signature, but laid out vertical
// for Instagram/Facebook/WhatsApp Story (9:16 aspect ratio).
//
// Mobile story-UI overlay considerations:
//   - The top ~250px gets covered by the page-name + progress bar
//   - The bottom ~280px gets covered by the reply box / swipe-up arrow
//   - "Safe zone" = the middle ~1390px (vertical)
//
// So the headline lives at vertical center, and the brand mark sits about
// 500px from the bottom — comfortably above the reply box.
//
// Use it as either:
//   (A) Static story (uploaded as image — Instagram shows for 15s)
//   (B) Background of a video — record yourself talking over this in
//       Reels/CapCut and overlay it as the title card

export const metadata = {
  title: "عيد أضحى مبارك (Story) — Nidham",
  robots: { index: false, follow: false },
};

export default function EidStoryPage() {
  return (
    <main className="min-h-screen bg-slate-200 flex flex-col items-center justify-start py-8">
      {/* Instructions banner — clipped out of the screenshot */}
      <div className="no-print max-w-2xl mb-6 mx-4 p-4 rounded-2xl bg-white border-2 border-amber-300 text-sm font-cairo">
        <h2 className="font-black text-amber-900 mb-2">
          📱 صورة عيد الأضحى — Story (1080×1920 vertical)
        </h2>
        <ol className="space-y-1 text-slate-700 list-decimal pr-5">
          <li>Zoom المتصفح = 100% (Ctrl+0)</li>
          <li>Snipping Tool → اقص المستطيل الطولي بالكامل</li>
          <li>ارفعها كـ Story على Instagram + Facebook + WhatsApp</li>
        </ol>
        <p className="mt-2 text-xs text-slate-500">
          أو حمّلها من: <code>nidhamhr.com/marketing/nidham-eid-story.png</code>
        </p>
      </div>

      {/* THE STORY CREATIVE — fixed 1080x1920 */}
      <div
        className="shadow-2xl overflow-hidden relative"
        style={{ width: "1080px", height: "1920px" }}
      >
        <div
          className="w-full h-full relative"
          style={{
            background:
              "linear-gradient(180deg, #0a1428 0%, #0e1d3a 30%, #0891b2 70%, #22d3ee 100%)",
          }}
        >
          {/* Geometric Islamic pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage: `
                radial-gradient(circle at 50% 50%, #f4e9c9 2.5px, transparent 3px),
                radial-gradient(circle at 0% 0%, #f4e9c9 2px, transparent 2.5px),
                radial-gradient(circle at 100% 100%, #f4e9c9 2px, transparent 2.5px)
              `,
              backgroundSize: "80px 80px, 80px 80px, 80px 80px",
            }}
          />

          {/* Decorative blurred gold orbs */}
          <div
            className="absolute rounded-full blur-3xl"
            style={{
              width: "700px",
              height: "700px",
              top: "100px",
              right: "-200px",
              background: "radial-gradient(circle, #c9a84c 0%, transparent 70%)",
              opacity: 0.4,
            }}
          />
          <div
            className="absolute rounded-full blur-3xl"
            style={{
              width: "600px",
              height: "600px",
              bottom: "200px",
              left: "-150px",
              background: "radial-gradient(circle, #22d3ee 0%, transparent 70%)",
              opacity: 0.3,
            }}
          />

          {/* Top safe-zone padding (~280px) — story UI lives here */}
          <div style={{ height: "280px" }} />

          {/* Crescent moon — bigger for vertical format */}
          <div className="flex flex-col items-center gap-10 mb-16">
            <div className="relative" style={{ width: "220px", height: "220px" }}>
              <div
                className="absolute rounded-full"
                style={{
                  width: "220px",
                  height: "220px",
                  background:
                    "radial-gradient(circle at 30% 30%, #f4e9c9 0%, #c9a84c 60%, #8b6914 100%)",
                  boxShadow: "0 0 100px rgba(201, 168, 76, 0.6)",
                }}
              />
              <div
                className="absolute rounded-full"
                style={{
                  width: "190px",
                  height: "190px",
                  top: "15px",
                  left: "45px",
                  background:
                    "linear-gradient(135deg, #0a1428 0%, #0e1d3a 100%)",
                }}
              />
            </div>

            {/* Stars cluster */}
            <div className="flex items-center gap-16">
              <Star size={28} dim />
              <Star size={42} />
              <Star size={28} dim />
            </div>
          </div>

          {/* Main calligraphy — centered in the safe zone */}
          <div className="flex flex-col items-center text-center px-12">
            {/* Main greeting */}
            <div
              className="font-black font-cairo leading-tight mb-6"
              style={{
                fontSize: "150px",
                background:
                  "linear-gradient(180deg, #f4e9c9 0%, #c9a84c 60%, #8b6914 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "#c9a84c", /* fallback for html2canvas */
                textShadow: "0 6px 30px rgba(201, 168, 76, 0.4)",
              }}
            >
              عيد أضحى
            </div>
            <div
              className="font-black font-cairo leading-tight mb-12"
              style={{
                fontSize: "150px",
                background:
                  "linear-gradient(180deg, #f4e9c9 0%, #c9a84c 60%, #8b6914 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                color: "#c9a84c",
                textShadow: "0 6px 30px rgba(201, 168, 76, 0.4)",
              }}
            >
              مبارك
            </div>

            {/* Subtitle */}
            <div
              className="text-cyan-50 font-cairo mb-10"
              style={{ fontSize: "56px", fontWeight: 300 }}
            >
              كل عام وأنتم بخير
            </div>

            {/* Decorative divider */}
            <div className="flex items-center gap-4 mb-10">
              <div
                style={{
                  width: "80px",
                  height: "2px",
                  background: "rgba(244, 233, 201, 0.5)",
                }}
              />
              <span className="text-amber-300" style={{ fontSize: "32px" }}>
                ✦
              </span>
              <div
                style={{
                  width: "80px",
                  height: "2px",
                  background: "rgba(244, 233, 201, 0.5)",
                }}
              />
            </div>

            {/* Signature */}
            <div
              className="text-cyan-100 font-cairo mb-2"
              style={{ fontSize: "42px", fontWeight: 500 }}
            >
              من فريق{" "}
              <span className="text-amber-300 font-bold">نِظام</span>
            </div>
            <div
              className="text-cyan-200/70 font-cairo"
              style={{ fontSize: "30px" }}
            >
              تقبّل الله منا ومنكم
            </div>
          </div>

          {/* Bottom brand mark — positioned ~500px from bottom to clear the
              reply box overlay */}
          <div
            className="absolute left-0 right-0 flex flex-col items-center"
            style={{ bottom: "500px" }}
          >
            <div className="flex items-center gap-4">
              <div
                className="rounded-2xl flex items-center justify-center shadow-xl"
                style={{
                  width: "80px",
                  height: "80px",
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
                  className="text-amber-300/80 font-bold tracking-[0.3em]"
                  style={{ fontSize: "12px" }}
                >
                  NIDHAMHR.COM
                </div>
              </div>
            </div>
          </div>

          {/* Bottom safe-zone padding — story reply box lives here */}
        </div>
      </div>
    </main>
  );
}

function Star({ size, dim }: { size: number; dim?: boolean }) {
  const color = dim ? "#c9a84c" : "#f4e9c9";
  const glow = dim
    ? "0 0 15px rgba(201, 168, 76, 0.4)"
    : "0 0 30px rgba(244, 233, 201, 0.6)";
  return (
    <span style={{ fontSize: `${size}px`, color, textShadow: glow }}>✦</span>
  );
}
